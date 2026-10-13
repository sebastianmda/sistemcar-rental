// Corrects the handover data of a rental that was already saved (date/time, km, fuel, price, equipment, delegate)
import { useState } from 'react'
import { Save } from 'lucide-react'
import { useToast } from './Toast'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { toLocalInput, fmtMoney, rentalDays } from '../lib/format'
import { FUEL_LEVELS, defaultEquipment, fuelEighths } from '../lib/rentalTerms'
import { clientName, defaultDelegate, isCompany } from '../lib/party'
import { Modal, Button, Field, Input, Select, Textarea, FormSection, ErrorText } from './ui'
import { UploadProgress } from './Media'
import { DateTimeInput } from './DateInputs'
import { DelegateFields } from './ClientFields'
import { EquipmentChecklist } from './HandoverForm'
import { useArchiveRefresh } from './Contract'

const str = (v) => (v === null || v === undefined ? '' : String(v))

function delegateOf(rental) {
  if (!rental.delegat_nume) return defaultDelegate(rental.client)
  return {
    delegat_nume: str(rental.delegat_nume),
    delegat_cnp: str(rental.delegat_cnp),
    delegat_act: str(rental.delegat_act),
    delegat_telefon: str(rental.delegat_telefon),
    delegat_permis_numar: str(rental.delegat_permis_numar),
    delegat_permis_categorie: str(rental.delegat_permis_categorie) || 'B',
    delegat_permis_expira: rental.delegat_permis_expira ? String(rental.delegat_permis_expira).slice(0, 10) : '',
    delegatie: str(rental.delegatie),
  }
}

export default function HandoverEditForm({ rental, onClose, onDone }) {
  const toast = useToast()
  const refreshArchive = useArchiveRefresh()
  const company = isCompany(rental.client)
  const finished = rental.status === 'finalizata'
  const fuel = fuelEighths(rental.combustibil_predare)

  const [form, setForm] = useState({
    data_predare: toLocalInput(rental.data_predare),
    data_returnare_planificata: toLocalInput(rental.data_returnare_planificata),
    tarif_zilnic: str(rental.tarif_zilnic),
    garantie: str(rental.garantie),
    loc_predare: str(rental.loc_predare) || 'sediul Locatorului',
    km_predare: str(rental.km_predare),
    combustibil_predare: fuel !== null ? `${fuel}/8` : '8/8',
    dotari_predare: rental.dotari_predare || defaultEquipment(),
    nr_chei: str(rental.nr_chei),
    sofer2_nume: str(rental.sofer2_nume),
    sofer2_permis: str(rental.sofer2_permis),
    observatii_predare: str(rental.observatii_predare),
  })
  const [delegate, setDelegate] = useState(() => delegateOf(rental))
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async () => {
    setError(null)
    if (!form.data_predare || !form.data_returnare_planificata) return setError('Completează data și ora predării și a returnării.')
    if (new Date(form.data_returnare_planificata) <= new Date(form.data_predare))
      return setError('Data returnării trebuie să fie după data predării.')
    if (finished && rental.data_returnare && new Date(rental.data_returnare) < new Date(form.data_predare))
      return setError('Data predării nu poate fi după data returului.')
    if (finished && rental.km_primire !== null && form.km_predare !== '' && Number(form.km_predare) > rental.km_primire)
      return setError('Kilometrajul la predare nu poate fi mai mare decât la retur.')
    if (company && !delegate.delegat_nume.trim()) return setError('Completează numele delegatului.')
    try {
      setSaving('Se salvează modificările…')
      let updated = await api.updateHandover(rental, { ...form, delegat: company ? delegate : null })
      if (updated.contract_pdf) {
        setSaving('Se actualizează contractul arhivat…')
        updated = await refreshArchive(updated).catch(() => updated)
      }
      toast('Predarea a fost corectată')
      onDone(updated)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(null)
    }
  }

  const days = rentalDays(form.data_predare, form.data_returnare_planificata)

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      title="Editează predarea"
      subtitle={`${rental.vehicle?.inmatriculare ?? ''} — ${clientName(rental.client)}`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={!!saving}>
            Anulează
          </Button>
          <Button icon={Save} loading={!!saving} onClick={submit}>
            Salvează modificările
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Corectezi o predare deja salvată. Contractul arhivat se reface cu datele noi; dacă l-ați semnat deja pe hârtie, tipărește-l din nou.
          {finished && ' Închirierea e finalizată: dacă schimbi data predării, verifică și returul (zile și total) cu „Editează returul”.'}
        </div>

        {company && (
          <FormSection title="Delegat">
            <DelegateFields value={delegate} onChange={setDelegate} />
          </FormSection>
        )}

        <FormSection title="Perioadă și preț">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Data și ora predării">
              <DateTimeInput value={form.data_predare} onChange={set('data_predare')} />
            </Field>
            <Field label="Returnare convenită">
              <DateTimeInput value={form.data_returnare_planificata} onChange={set('data_returnare_planificata')} />
            </Field>
            <Field label="Tarif zilnic (RON, fără TVA)">
              <Input type="number" inputMode="decimal" min={0} value={form.tarif_zilnic} onChange={set('tarif_zilnic')} />
            </Field>
            <Field label="Garanție (RON)">
              <Input type="number" inputMode="decimal" min={0} value={form.garantie} onChange={set('garantie')} />
            </Field>
            <Field label="Locul predării" className="sm:col-span-2">
              <Input value={form.loc_predare} onChange={set('loc_predare')} />
            </Field>
          </div>
          <p className="text-sm text-slate-500">
            Durata convenită: {days} {days === 1 ? 'zi' : 'zile'} × {fmtMoney(form.tarif_zilnic)} + TVA
          </p>
        </FormSection>

        <FormSection title="Șofer suplimentar">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Șofer autorizat suplimentar" hint="Opțional">
              <Input value={form.sofer2_nume} onChange={set('sofer2_nume')} />
            </Field>
            <Field label="Nr. permis șofer suplimentar">
              <Input value={form.sofer2_permis} onChange={set('sofer2_permis')} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Starea mașinii la predare">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Kilometraj la predare">
              <Input type="number" inputMode="numeric" min={0} value={form.km_predare} onChange={set('km_predare')} />
            </Field>
            <Field label="Nivel combustibil">
              <Select value={form.combustibil_predare} onChange={set('combustibil_predare')}>
                {FUEL_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Dotări și documente predate (Anexa 1)</div>
            <EquipmentChecklist value={form.dotari_predare} onChange={(v) => setForm((f) => ({ ...f, dotari_predare: v }))} />
          </div>
          <Field label="Număr chei predate" className="max-w-[10rem]">
            <Input type="number" inputMode="numeric" min={0} value={form.nr_chei} onChange={set('nr_chei')} />
          </Field>
          <Field label="Observații / daune existente">
            <Textarea value={form.observatii_predare} onChange={set('observatii_predare')} />
          </Field>
        </FormSection>

        <UploadProgress text={saving} />
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}
