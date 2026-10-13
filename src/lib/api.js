import { supabase } from './supabase'
import { compressImage, isImage, MAX_FILE_MB } from './media'

const BUCKET = 'rental-media'

const VEHICLE_FIELDS = [
  'nume_model', 'inmatriculare', 'vin', 'an_fabricatie', 'culoare', 'capacitate_pasageri',
  'tip_combustibil', 'cutie_viteze', 'km_actuali', 'status', 'tarif_zilnic',
  'rca_expira', 'itp_expira', 'rovinieta_expira', 'casco_expira', 'observatii',
]
const VEHICLE_NUMBERS = ['an_fabricatie', 'capacitate_pasageri', 'km_actuali', 'tarif_zilnic']

const CLIENT_FIELDS = [
  'nume', 'telefon', 'email', 'cnp', 'act_identitate', 'adresa',
  'permis_numar', 'permis_categorie', 'permis_expira', 'firma', 'cui', 'observatii',
  'tip_client', 'reg_com', 'sediu',
]

const DELEGATE_FIELDS = [
  'delegat_nume', 'delegat_cnp', 'delegat_act', 'delegat_telefon',
  'delegat_permis_numar', 'delegat_permis_categorie', 'delegat_permis_expira', 'delegatie',
]

// a firm's client must have a not-null `nume`; without a delegate name the firm name is used
function clientPayload(data) {
  const out = clean(data, CLIENT_FIELDS)
  if (out.tip_client !== 'PJ') {
    out.reg_com = null
    out.sediu = null
  }
  if (!out.nume && out.firma) out.nume = out.firma
  return out
}

const missingNewColumn = (err) => /tip_client|reg_com|sediu|delegat/.test(String(err?.message || ''))

// persoană fizică: works even before SUPABASE_UPDATE_V7.sql was run (the new columns are dropped)
async function saveClient(data, write) {
  const payload = clientPayload(data)
  try {
    return await run(write(payload))
  } catch (err) {
    if (payload.tip_client === 'PJ' || !missingNewColumn(err)) {
      if (missingNewColumn(err)) throw new Error('Pentru clienți persoane juridice rulează întâi SUPABASE_UPDATE_V7.sql în Supabase.')
      throw err
    }
    const { tip_client, reg_com, sediu, ...rest } = payload
    return run(write(rest))
  }
}

// keeps only known columns; empty strings become null (empty dates used to crash inserts)
function clean(data, fields, numbers = []) {
  const out = {}
  for (const f of fields) {
    if (!(f in data)) continue
    let v = data[f]
    if (typeof v === 'string') v = v.trim()
    if (v === '' || v === undefined) v = null
    if (v !== null && numbers.includes(f)) {
      v = Number(v)
      if (!isFinite(v)) v = null
    }
    out[f] = v
  }
  return out
}

async function run(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}

const RENTAL_SELECT =
  '*, vehicle:vehicles(id, nume_model, inmatriculare, km_actuali, an_fabricatie, vin), ' +
  'client:clients(*)'

export const api = {
  // ---------- vehicles ----------
  listVehicles() {
    return run(
      supabase.from('vehicles').select('*').eq('is_archived', false).order('nume_model', { ascending: true })
    )
  },

  createVehicle(data) {
    const row = clean(data, VEHICLE_FIELDS, VEHICLE_NUMBERS)
    row.inmatriculare = row.inmatriculare?.toUpperCase()
    row.status = row.status || 'Disponibil'
    return run(supabase.from('vehicles').insert(row).select().single())
  },

  updateVehicle(id, data) {
    const row = clean(data, VEHICLE_FIELDS, VEHICLE_NUMBERS)
    if (row.inmatriculare) row.inmatriculare = row.inmatriculare.toUpperCase()
    row.updated_at = new Date().toISOString()
    return run(supabase.from('vehicles').update(row).eq('id', id).select().single())
  },

  archiveVehicle(id) {
    return run(
      supabase.from('vehicles').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id)
    )
  },

  // ---------- clients ----------
  listClients() {
    return run(supabase.from('clients').select('*').order('nume', { ascending: true }))
  },

  createClient(data) {
    return saveClient(data, (payload) => supabase.from('clients').insert(payload).select().single())
  },

  updateClient(id, data) {
    return saveClient(data, (payload) => supabase.from('clients').update(payload).eq('id', id).select().single())
  },

  deleteClient(id) {
    return run(supabase.from('clients').delete().eq('id', id))
  },

  // ---------- rentals ----------
  listRentals() {
    return run(supabase.from('rentals').select(RENTAL_SELECT).order('data_predare', { ascending: false }))
  },

  async createRental(data) {
    const rental = await run(
      supabase
        .from('rentals')
        .insert({
          vehicle_id: data.vehicle_id,
          client_id: data.client_id,
          status: 'activa',
          data_predare: new Date(data.data_predare).toISOString(),
          data_returnare_planificata: new Date(data.data_returnare_planificata).toISOString(),
          tarif_zilnic: Number(data.tarif_zilnic) || 0,
          garantie: Number(data.garantie) || 0,
          km_predare: data.km_predare === '' ? null : Number(data.km_predare),
          combustibil_predare: data.combustibil_predare || null,
          observatii_predare: data.observatii_predare?.trim() || null,
          loc_predare: data.loc_predare?.trim() || 'sediul Locatorului',
          sofer2_nume: data.sofer2_nume?.trim() || null,
          sofer2_permis: data.sofer2_permis?.trim() || null,
          nr_chei: data.nr_chei === '' ? null : Number(data.nr_chei),
          dotari_predare: data.dotari_predare || null,
          numar_contract: data.numar_contract?.trim() || null,
          data_contract: data.data_contract || null,
          ...(data.delegat ? clean(data.delegat, DELEGATE_FIELDS) : {}),
        })
        .select(RENTAL_SELECT)
        .single()
    )
    const vehicleUpdate = { status: 'În chirie', updated_at: new Date().toISOString() }
    if (rental.km_predare !== null) vehicleUpdate.km_actuali = rental.km_predare
    await run(supabase.from('vehicles').update(vehicleUpdate).eq('id', data.vehicle_id))
    return rental
  },

  // corrects a return that was already saved: rental fields only, the car's status is left alone;
  // the car's km follows only if it still shows the old return km (no newer handover since)
  async updateReturn(rental, data) {
    const updated = await run(
      supabase
        .from('rentals')
        .update({
          data_returnare: new Date(data.data_returnare).toISOString(),
          km_primire: data.km_primire === '' ? null : Number(data.km_primire),
          combustibil_primire: data.combustibil_primire || null,
          observatii_primire: data.observatii_primire?.trim() || null,
          total_final: Number(data.total_final) || 0,
          zile_facturabile: Number(data.zile_facturabile) || null,
          avarii_noi: Boolean(data.avarii_noi),
          dotari_lipsa: data.dotari_lipsa?.trim() || null,
          taxa_curatare: Boolean(data.taxa_curatare),
          taxa_igienizare: Boolean(data.taxa_igienizare),
          realimentare: Boolean(data.realimentare),
          cost_combustibil: data.realimentare ? Number(data.cost_combustibil) || 0 : 0,
        })
        .eq('id', rental.id)
        .select(RENTAL_SELECT)
        .single()
    )
    const oldKm = rental.km_primire
    if (updated.km_primire !== null && oldKm !== null && rental.vehicle?.km_actuali === oldKm && oldKm !== updated.km_primire) {
      await run(supabase.from('vehicles').update({ km_actuali: updated.km_primire, updated_at: new Date().toISOString() }).eq('id', rental.vehicle_id))
    }
    return updated
  },

  // corrects the handover data of a rental
  updateHandover(rental, data) {
    const fields = {
      data_predare: new Date(data.data_predare).toISOString(),
      data_returnare_planificata: new Date(data.data_returnare_planificata).toISOString(),
      tarif_zilnic: Number(data.tarif_zilnic) || 0,
      garantie: Number(data.garantie) || 0,
      km_predare: data.km_predare === '' ? null : Number(data.km_predare),
      combustibil_predare: data.combustibil_predare || null,
      observatii_predare: data.observatii_predare?.trim() || null,
      loc_predare: data.loc_predare?.trim() || 'sediul Locatorului',
      sofer2_nume: data.sofer2_nume?.trim() || null,
      sofer2_permis: data.sofer2_permis?.trim() || null,
      nr_chei: data.nr_chei === '' || data.nr_chei === null ? null : Number(data.nr_chei),
      dotari_predare: data.dotari_predare || null,
      ...(data.delegat ? clean(data.delegat, DELEGATE_FIELDS) : {}),
    }
    return run(supabase.from('rentals').update(fields).eq('id', rental.id).select(RENTAL_SELECT).single())
  },

  async finishRental(rental, data) {
    const updated = await run(
      supabase
        .from('rentals')
        .update({
          status: 'finalizata',
          data_returnare: new Date(data.data_returnare).toISOString(),
          km_primire: data.km_primire === '' ? null : Number(data.km_primire),
          combustibil_primire: data.combustibil_primire || null,
          observatii_primire: data.observatii_primire?.trim() || null,
          total_final: Number(data.total_final) || 0,
          zile_facturabile: Number(data.zile_facturabile) || null,
          avarii_noi: Boolean(data.avarii_noi),
          dotari_lipsa: data.dotari_lipsa?.trim() || null,
          taxa_curatare: Boolean(data.taxa_curatare),
          taxa_igienizare: Boolean(data.taxa_igienizare),
          realimentare: Boolean(data.realimentare),
          cost_combustibil: data.realimentare ? Number(data.cost_combustibil) || 0 : 0,
        })
        .eq('id', rental.id)
        .select(RENTAL_SELECT)
        .single()
    )
    const vehicleUpdate = {
      status: data.trimite_service ? 'Service' : 'Disponibil',
      updated_at: new Date().toISOString(),
    }
    if (updated.km_primire !== null) vehicleUpdate.km_actuali = updated.km_primire
    await run(supabase.from('vehicles').update(vehicleUpdate).eq('id', rental.vehicle_id))
    return updated
  },

  async cancelRental(rental) {
    await run(supabase.from('rentals').update({ status: 'anulata' }).eq('id', rental.id))
    await run(
      supabase
        .from('vehicles')
        .update({ status: 'Disponibil', updated_at: new Date().toISOString() })
        .eq('id', rental.vehicle_id)
    )
  },

  // ---------- settings ----------
  async getSettings() {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 'default_tariff').maybeSingle()
    if (error) throw error
    return data || { id: 'default_tariff', tarif_zilnic_default: 150 }
  },

  saveSettings(fields) {
    return run(
      supabase
        .from('settings')
        .upsert({ id: 'default_tariff', ...fields, updated_at: new Date().toISOString() })
        .select()
        .single()
    )
  },

  saveDefaultTariff(value) {
    return run(
      supabase
        .from('settings')
        .upsert({ id: 'default_tariff', tarif_zilnic_default: Number(value) || 0, updated_at: new Date().toISOString() })
        .select()
        .single()
    )
  },

  // ---------- contract ----------
  saveRentalFields(id, fields) {
    return run(supabase.from('rentals').update(fields).eq('id', id).select(RENTAL_SELECT).single())
  },

  // stores the signed contract PDF and links it to the rental
  async uploadContract(rental, blob) {
    const path = `contracts/${rental.id}/contract-${Date.now()}.pdf`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'application/pdf', upsert: false })
    if (error) throw error
    return api.saveRentalFields(rental.id, { contract_pdf: path, contract_semnat_la: new Date().toISOString() })
  },

  async countMedia(rentalId) {
    const rows = await run(supabase.from('rental_media').select('etapa').eq('rental_id', rentalId))
    return {
      predare: rows.filter((r) => r.etapa === 'predare').length,
      primire: rows.filter((r) => r.etapa === 'primire').length,
    }
  },

  async contractBlob(path) {
    const url = (await api.signedUrls([path]))[path]
    if (!url) throw new Error('Contractul salvat nu a fost găsit.')
    const res = await fetch(url)
    if (!res.ok) throw new Error('Contractul nu a putut fi descărcat.')
    return res.blob()
  },

  async contractUrl(path) {
    const urls = await api.signedUrls([path])
    return urls[path]
  },

  // ---------- photos ----------
  async signedUrls(paths) {
    const list = [...new Set(paths.filter(Boolean))]
    if (!list.length) return {}
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(list, 60 * 60)
    if (error) throw error
    return Object.fromEntries((data || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]))
  },

  // compresses and uploads one photo, returns its storage path
  async uploadPhoto(folder, originalFile) {
    if (!isImage(originalFile)) throw new Error(`„${originalFile.name}” nu este o fotografie.`)
    const file = await compressImage(originalFile)
    if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`„${originalFile.name}” are peste ${MAX_FILE_MB} MB.`)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
    if (error) throw error
    return path
  },

  async removeFiles(paths) {
    const list = paths.filter(Boolean)
    if (!list.length) return
    const { error } = await supabase.storage.from(BUCKET).remove(list)
    if (error) throw error
  },

  // uploads many files one by one; returns the ones that failed
  async uploadEach(files, uploadOne, onProgress) {
    const failed = []
    for (let i = 0; i < files.length; i++) {
      onProgress?.(i + 1, files.length)
      try {
        await uploadOne(files[i])
      } catch (err) {
        failed.push({ file: files[i], err })
      }
    }
    return failed
  },

  // --- rental photos (predare / primire)
  async listMedia(rentalId) {
    const rows = await run(
      supabase.from('rental_media').select('*').eq('rental_id', rentalId).order('created_at', { ascending: true })
    )
    const urls = await api.signedUrls(rows.map((r) => r.path))
    return rows.map((r) => ({ ...r, url: urls[r.path] || null }))
  },

  async uploadMedia(rentalId, etapa, file) {
    const path = await api.uploadPhoto(`${rentalId}/${etapa}`, file)
    return run(supabase.from('rental_media').insert({ rental_id: rentalId, etapa, tip: 'foto', path }).select().single())
  },

  uploadMany(rentalId, etapa, files, onProgress) {
    return api.uploadEach(files, (f) => api.uploadMedia(rentalId, etapa, f), onProgress)
  },

  async deleteMedia(item) {
    await api.removeFiles([item.path])
    return run(supabase.from('rental_media').delete().eq('id', item.id))
  },

  // --- vehicle profile photo
  async setVehicleProfile(vehicle, file) {
    const path = await api.uploadPhoto(`vehicles/${vehicle.id}/profil`, file)
    await run(supabase.from('vehicles').update({ foto_profil: path }).eq('id', vehicle.id))
    if (vehicle.foto_profil && vehicle.foto_profil !== path) {
      api.removeFiles([vehicle.foto_profil]).catch(() => {}) // old photo; not critical if it stays
    }
    return path
  },

  async removeVehicleProfile(vehicle) {
    await run(supabase.from('vehicles').update({ foto_profil: null }).eq('id', vehicle.id))
    api.removeFiles([vehicle.foto_profil]).catch(() => {})
  },

  // --- vehicle gallery (documente / mașină / bord / altele)
  async listVehicleMedia(vehicleId) {
    const rows = await run(
      supabase.from('vehicle_media').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: true })
    )
    const urls = await api.signedUrls(rows.map((r) => r.path))
    return rows.map((r) => ({ ...r, url: urls[r.path] || null }))
  },

  async uploadVehicleMedia(vehicleId, categorie, file) {
    const path = await api.uploadPhoto(`vehicles/${vehicleId}/${categorie}`, file)
    return run(supabase.from('vehicle_media').insert({ vehicle_id: vehicleId, categorie, path }).select().single())
  },

  async deleteVehicleMedia(item) {
    await api.removeFiles([item.path])
    return run(supabase.from('vehicle_media').delete().eq('id', item.id))
  },
}
