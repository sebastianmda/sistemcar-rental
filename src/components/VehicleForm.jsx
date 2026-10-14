import { useEffect, useMemo, useRef, useState } from 'react'
import { Save, Camera, Car, Trash2 } from 'lucide-react'
import { Modal, Button, Field, Input, Select, Textarea, FormSection, ErrorText, Tabs } from './ui'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { useToast } from './Toast'
import { PhotoGrid, PhotoInput, UploadProgress, useLocalPreviews } from './Media'
import { DateInput } from './DateInputs'

export const PHOTO_CATEGORIES = [
  { value: 'document', label: 'Documente', hint: 'Talon, poliță RCA, ITP, rovinietă, CASCO' },
  { value: 'masina', label: 'Mașină', hint: 'Exterior și interior, eventuale daune' },
  { value: 'bord', label: 'Bord / km', hint: 'Kilometraj, martori bord' },
  { value: 'altele', label: 'Altele', hint: 'Orice altceva util' },
]
const NO_PENDING = { document: [], masina: [], bord: [], altele: [] }

const EMPTY = {
  nume_model: '',
  inmatriculare: '',
  vin: '',
  an_fabricatie: '',
  culoare: '',
  tip_combustibil: 'Benzină',
  cutie_viteze: 'Manuală',
  capacitate_pasageri: 5,
  km_actuali: '',
  tarif_zilnic: '',
  status: 'Disponibil',
  rca_expira: '',
  itp_expira: '',
  rovinieta_expira: '',
  casco_expira: '',
  casco_fransiza: '',
  observatii: '',
}

function toForm(vehicle) {
  if (!vehicle) return EMPTY
  const out = { ...EMPTY }
  for (const k of Object.keys(EMPTY)) {
    const v = vehicle[k]
    out[k] = v === null || v === undefined ? '' : k.endsWith('_expira') ? String(v).slice(0, 10) : v
  }
  return out
}

export default function VehicleForm({ vehicle, photoUrl, defaultTariff, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(() => toForm(vehicle))
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const rented = vehicle?.status === 'În chirie'

  // profile photo
  const profileInput = useRef(null)
  const [profileFile, setProfileFile] = useState(null)
  const [profileRemoved, setProfileRemoved] = useState(false)
  const profileFiles = useMemo(() => (profileFile ? [profileFile] : []), [profileFile])
  const [profilePreview] = useLocalPreviews(profileFiles)
  const shownProfile = profileFile ? profilePreview : profileRemoved ? null : photoUrl

  // gallery
  const [category, setCategory] = useState('document')
  const [saved, setSaved] = useState([])
  const [pending, setPending] = useState(NO_PENDING)
  const [savedVehicle, setSavedVehicle] = useState(vehicle) // after a first save of a new vehicle

  useEffect(() => {
    if (!vehicle) return
    api
      .listVehicleMedia(vehicle.id)
      .then(setSaved)
      .catch((err) => setError(friendlyError(err)))
  }, [vehicle])

  const deleteSaved = async (item) => {
    if (!confirm('Ștergi această poză?')) return
    try {
      await api.deleteVehicleMedia(item)
      setSaved((list) => list.filter((x) => x.id !== item.id))
    } catch (err) {
      toast(friendlyError(err), 'error')
    }
  }

  const pendingCount = Object.values(pending).reduce((n, list) => n + list.length, 0)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e?.preventDefault()
    setError(null)
    if (!form.nume_model.trim() || !form.inmatriculare.trim()) {
      setError('Completează marca/modelul și numărul de înmatriculare.')
      return
    }
    const year = Number(form.an_fabricatie)
    if (form.an_fabricatie && (year < 1980 || year > new Date().getFullYear() + 1)) {
      setError('Anul de fabricație nu este valid.')
      return
    }
    setSaving(true)
    try {
      const data = { ...form }
      if (rented) delete data.status
      setProgress('Se salvează vehiculul…')
      const target = savedVehicle
        ? await api.updateVehicle(savedVehicle.id, data)
        : await api.createVehicle(data)
      setSavedVehicle(target) // a retry after a photo error won't create a duplicate vehicle

      if (profileFile) {
        setProgress('Se încarcă poza de profil…')
        await api.setVehicleProfile(target, profileFile)
        setProfileFile(null)
      } else if (profileRemoved && target.foto_profil) {
        await api.removeVehicleProfile(target)
      }

      const queue = PHOTO_CATEGORIES.flatMap((c) => pending[c.value].map((file) => ({ file, categorie: c.value })))
      const failed = await api.uploadEach(
        queue,
        (q) => api.uploadVehicleMedia(target.id, q.categorie, q.file),
        (i, n) => setProgress(`Se încarcă pozele ${i}/${n}…`)
      )
      if (failed.length) {
        const left = { document: [], masina: [], bord: [], altele: [] }
        failed.forEach((f) => left[f.file.categorie].push(f.file.file))
        setPending(left)
        api.listVehicleMedia(target.id).then(setSaved).catch(() => {})
        setError(`${failed.length} poză(e) nu s-au încărcat: ${friendlyError(failed[0].err)}. Apasă din nou Salvează.`)
        return
      }
      toast(vehicle ? 'Vehicul actualizat' : 'Vehicul adăugat')
      onSaved()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      title={vehicle ? 'Editează vehicul' : 'Adaugă vehicul'}
      subtitle={vehicle ? `${vehicle.nume_model} · ${vehicle.inmatriculare}` : 'Datele mașinii și documentele'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anulează
          </Button>
          <Button icon={Save} loading={saving} onClick={submit}>
            {pendingCount ? `Salvează (+${pendingCount} poze)` : 'Salvează'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-7">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => profileInput.current?.click()}
            className="relative flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200"
          >
            {shownProfile ? (
              <img src={shownProfile} alt="" className="h-full w-full object-cover" />
            ) : (
              <Car className="h-10 w-10 text-slate-300" />
            )}
            <span className="absolute bottom-1 right-1 rounded-full bg-slate-900/70 p-1.5 text-white">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Poză de profil</div>
            <p className="text-xs text-slate-500">Apare pe cartonașul mașinii din Flotă.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={Camera} onClick={() => profileInput.current?.click()}>
                {shownProfile ? 'Schimbă' : 'Alege poza'}
              </Button>
              {shownProfile && (
                <Button
                  size="sm"
                  variant="dangerGhost"
                  icon={Trash2}
                  onClick={() => {
                    setProfileFile(null)
                    setProfileRemoved(true)
                  }}
                  aria-label="Scoate poza"
                />
              )}
            </div>
          </div>
          <PhotoInput
            inputRef={profileInput}
            multiple={false}
            onFiles={(files) => {
              setProfileFile(files[0])
              setProfileRemoved(false)
            }}
          />
        </div>

        <FormSection title="Identificare">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Marcă și model" required>
              <Input value={form.nume_model} onChange={set('nume_model')} placeholder="ex: Dacia Logan 1.0 TCe" />
            </Field>
            <Field label="Nr. înmatriculare" required>
              <Input
                value={form.inmatriculare}
                onChange={(e) => setForm((f) => ({ ...f, inmatriculare: e.target.value.toUpperCase() }))}
                placeholder="ex: BH 12 SIS"
              />
            </Field>
            <Field label="Serie șasiu (VIN)">
              <Input value={form.vin} onChange={set('vin')} maxLength={17} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="An fabricație">
                <Input type="number" inputMode="numeric" value={form.an_fabricatie} onChange={set('an_fabricatie')} />
              </Field>
              <Field label="Culoare">
                <Input value={form.culoare} onChange={set('culoare')} />
              </Field>
            </div>
            <Field label="Combustibil">
              <Select value={form.tip_combustibil} onChange={set('tip_combustibil')}>
                {['Benzină', 'Motorină', 'Hibrid', 'Electric', 'GPL'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cutie viteze">
                <Select value={form.cutie_viteze} onChange={set('cutie_viteze')}>
                  <option>Manuală</option>
                  <option>Automată</option>
                </Select>
              </Field>
              <Field label="Locuri">
                <Input type="number" inputMode="numeric" min={1} value={form.capacitate_pasageri} onChange={set('capacitate_pasageri')} />
              </Field>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Documente"
          description="Primești alertă cu 30 de zile și cu 7 zile înainte de expirare."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="RCA valabil până la">
              <DateInput value={form.rca_expira} onChange={set('rca_expira')} />
            </Field>
            <Field label="ITP valabil până la">
              <DateInput value={form.itp_expira} onChange={set('itp_expira')} />
            </Field>
            <Field label="Rovinietă valabilă până la">
              <DateInput value={form.rovinieta_expira} onChange={set('rovinieta_expira')} />
            </Field>
            <Field label="CASCO valabil până la" hint="Opțional">
              <DateInput value={form.casco_expira} onChange={set('casco_expira')} />
            </Field>
            <Field label="Franșiză CASCO" hint="Opțional — apare în Anexa 1, ex: 200 EUR sau 10%">
              <Input value={form.casco_fransiza} onChange={set('casco_fransiza')} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Fotografii" description="Pozele noi se salvează când apeși Salvează.">
          <div className="overflow-x-auto">
            <Tabs
              value={category}
              onChange={setCategory}
              tabs={PHOTO_CATEGORIES.map((c) => {
                const n = saved.filter((x) => x.categorie === c.value).length + pending[c.value].length
                return { value: c.value, label: n ? `${c.label} (${n})` : c.label }
              })}
            />
          </div>
          <p className="text-xs text-slate-500">{PHOTO_CATEGORIES.find((c) => c.value === category).hint}</p>
          <PhotoGrid
            key={category}
            items={saved.filter((x) => x.categorie === category)}
            pending={pending[category]}
            onAddFiles={(files) => setPending((p) => ({ ...p, [category]: [...p[category], ...files] }))}
            onRemovePending={(j) => setPending((p) => ({ ...p, [category]: p[category].filter((_, k) => k !== j) }))}
            onDeleteItem={deleteSaved}
          />
        </FormSection>

        <FormSection title="Exploatare">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Kilometraj actual">
              <Input type="number" inputMode="numeric" min={0} value={form.km_actuali} onChange={set('km_actuali')} />
            </Field>
            <Field label="Tarif zilnic (RON)" hint={`Gol = tarif implicit (${defaultTariff} RON)`}>
              <Input type="number" inputMode="decimal" min={0} value={form.tarif_zilnic} onChange={set('tarif_zilnic')} />
            </Field>
            <Field label="Status">
              {rented ? (
                <Input value="În chirie" disabled />
              ) : (
                <Select value={form.status} onChange={set('status')}>
                  <option>Disponibil</option>
                  <option>Service</option>
                </Select>
              )}
            </Field>
          </div>
          <Field label="Observații">
            <Textarea value={form.observatii} onChange={set('observatii')} placeholder="Dotări, daune existente, note interne…" />
          </Field>
        </FormSection>
        <UploadProgress text={progress} />
        <ErrorText>{error}</ErrorText>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
