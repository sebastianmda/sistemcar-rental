import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Save } from 'lucide-react'
import { useToast } from './Toast'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { toLocalInput, rentalDays, fmtMoney, fmtDateTime, fmtKm } from '../lib/format'
import { EQUIPMENT, FEES, FUEL_LEVELS, SERVICE_NAMES, fuelEighths, fuelLabel } from '../lib/rentalTerms'
import { Modal, Button, Field, Input, Select, Textarea, FormSection, ErrorText, InfoRow, Card } from './ui'
import { MediaPicker, UploadProgress } from './Media'
import { contractLabel } from '../lib/contract'
import { DateInput, DateTimeInput } from './DateInputs'
import { clientName } from '../lib/party'
import { useArchiveRefresh } from './Contract'

function Check({ checked, onChange, children }) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
      />
      <span>{children}</span>
    </label>
  )
}

// editing an already saved return: the form starts from the saved values
function savedReturn(rental, handedOver) {
  const missing = String(rental.dotari_lipsa || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  const known = handedOver.map((e) => e.label)
  return {
    data_returnare: toLocalInput(rental.data_returnare),
    km_primire: rental.km_primire ?? '',
    combustibil_primire: fuelEighths(rental.combustibil_primire) !== null ? `${fuelEighths(rental.combustibil_primire)}/8` : '8/8',
    observatii_primire: rental.observatii_primire || '',
    avarii_noi: Boolean(rental.avarii_noi),
    prezente: Object.fromEntries(handedOver.map((e) => [e.key, !missing.includes(e.label)])),
    alte_lipsuri: missing.filter((m) => !known.includes(m)).join(', '),
    taxa_curatare: Boolean(rental.taxa_curatare),
    taxa_igienizare: Boolean(rental.taxa_igienizare),
    realimentare: Boolean(rental.realimentare),
    cost_combustibil: rental.realimentare && Number(rental.cost_combustibil) ? String(rental.cost_combustibil) : '',
    trimite_service: false,
  }
}

export default function ReturnForm({ rental, editing = false, onClose, onDone }) {
  const toast = useToast()
  const refreshArchive = useArchiveRefresh()
  const handedOver = EQUIPMENT.filter((e) => rental.dotari_predare?.[e.key])
  const startFuel = fuelEighths(rental.combustibil_predare)

  const [form, setForm] = useState(() =>
    editing
      ? savedReturn(rental, handedOver)
      : {
          data_returnare: toLocalInput(new Date()),
          km_primire: rental.km_predare ?? '',
          combustibil_primire: startFuel !== null ? `${startFuel}/8` : '8/8',
          observatii_primire: '',
          avarii_noi: false,
          prezente: Object.fromEntries(handedOver.map((e) => [e.key, true])),
          alte_lipsuri: '',
          taxa_curatare: false,
          taxa_igienizare: false,
          realimentare: false,
          cost_combustibil: '',
          trimite_service: false,
        }
  )
  const [totalOverride, setTotalOverride] = useState(null)
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setFlag = (key) => (v) => setForm((f) => ({ ...f, [key]: v }))

  // contract art. 3: calendar days, both the handover day and the return day, whatever the hour
  const days = rentalDays(rental.data_predare, form.data_returnare)
  const rent = days * Number(rental.tarif_zilnic || 0)
  const fees =
    (form.taxa_curatare ? FEES.curatare : 0) +
    (form.taxa_igienizare ? FEES.igienizare : 0) +
    (form.realimentare ? FEES.realimentare + (Number(form.cost_combustibil) || 0) : 0)
  const computed = rent + fees
  // editing: keep the saved total if it was set by hand (discount, penalty) — it can be recalculated with one tap
  useEffect(() => {
    if (editing && Number(rental.total_final) !== computed) setTotalOverride(Number(rental.total_final) || 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const total = totalOverride ?? computed

  const kmDriven =
    form.km_primire !== '' && rental.km_predare !== null ? Number(form.km_primire) - Number(rental.km_predare) : null
  const lowerFuel = startFuel !== null && fuelEighths(form.combustibil_primire) < startFuel

  const missing = useMemo(() => {
    const list = handedOver.filter((e) => !form.prezente[e.key]).map((e) => e.label)
    if (form.alte_lipsuri.trim()) list.push(form.alte_lipsuri.trim())
    return list.join(', ')
  }, [form.prezente, form.alte_lipsuri, handedOver])

  const submit = async () => {
    setError(null)
    if (!form.data_returnare) return setError('Completează data și ora returului (ex: 27.09.2026 și 14:30).')
    if (kmDriven !== null && kmDriven < 0) return setError('Kilometrajul la primire nu poate fi mai mic decât la predare.')
    if (new Date(form.data_returnare) < new Date(rental.data_predare)) return setError('Data primirii este înaintea predării.')
    setSaving(true)
    try {
      setProgress(editing ? 'Se salvează modificările…' : 'Se salvează primirea…')
      const data = { ...form, dotari_lipsa: missing, zile_facturabile: days, total_final: total }
      let updated = editing ? await api.updateReturn(rental, data) : await api.finishRental(rental, data)
      if (files.length) {
        const failed = await api.uploadMany(rental.id, 'primire', files, (i, n) => setProgress(`Se încarcă pozele ${i}/${n}…`))
        if (failed.length) toast(`${failed.length} poză(e) nu s-au încărcat. Le poți adăuga din detaliile închirierii.`, 'error')
      }
      if (editing && updated.contract_pdf) {
        setProgress('Se actualizează contractul arhivat…')
        updated = await refreshArchive(updated).catch(() => updated)
      }
      toast(editing ? 'Returul a fost corectat' : 'Mașina a fost primită')
      onDone(updated)
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
      title={editing ? 'Editează returul' : 'Primire mașină'}
      subtitle={`Contract ${contractLabel(rental)} · ${rental.vehicle?.inmatriculare ?? ''} — ${clientName(rental.client)}`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Anulează
          </Button>
          <Button icon={editing ? Save : CheckCircle2} loading={saving} onClick={submit}>
            {editing ? 'Salvează modificările' : 'Confirmă primirea'}
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        {editing && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Corectezi un retur deja salvat. După salvare, contractul arhivat se reface cu datele noi. Dacă ați semnat deja Anexa 1 pe
            hârtie cu datele greșite, tipărește-o din nou și semnați-o.
          </div>
        )}
        <Card className="bg-slate-50 px-4 py-2">
          <InfoRow label="Predată la">{fmtDateTime(rental.data_predare)}</InfoRow>
          <InfoRow label="Km la predare">{fmtKm(rental.km_predare)}</InfoRow>
          <InfoRow label="Combustibil la predare">{fuelLabel(rental.combustibil_predare)}</InfoRow>
          <InfoRow label="Tarif zilnic">{fmtMoney(rental.tarif_zilnic)} + TVA</InfoRow>
          {Number(rental.garantie) > 0 && <InfoRow label="Garanție încasată">{fmtMoney(rental.garantie)}</InfoRow>}
        </Card>

        <FormSection title="Starea mașinii la retur">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Data și ora returului">
              <DateTimeInput value={form.data_returnare} onChange={set('data_returnare')} />
            </Field>
            <Field label="Kilometraj la retur" hint={kmDriven !== null && kmDriven >= 0 ? `Parcurși: ${fmtKm(kmDriven)}` : null}>
              <Input type="number" inputMode="numeric" min={0} value={form.km_primire} onChange={set('km_primire')} />
            </Field>
            <Field label="Nivel combustibil" hint={lowerFuel ? 'Mai puțin decât la predare' : null}>
              <Select value={form.combustibil_primire} onChange={set('combustibil_primire')}>
                {FUEL_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Observații / avarii la retur">
            <Textarea value={form.observatii_primire} onChange={set('observatii_primire')} />
          </Field>
          <Check checked={form.avarii_noi} onChange={setFlag('avarii_noi')}>
            Există avarii noi (detaliază mai sus)
          </Check>
        </FormSection>

        {handedOver.length > 0 && (
          <FormSection title="Dotări returnate" description="Debifează ce lipsește față de predare.">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {handedOver.map((e) => (
                <Check
                  key={e.key}
                  checked={Boolean(form.prezente[e.key])}
                  onChange={(v) => setForm((f) => ({ ...f, prezente: { ...f.prezente, [e.key]: v } }))}
                >
                  {e.label}
                  {e.key === 'chei' && rental.nr_chei ? ` (${rental.nr_chei})` : ''}
                </Check>
              ))}
            </div>
            <Field label="Alte lipsuri">
              <Input value={form.alte_lipsuri} onChange={set('alte_lipsuri')} />
            </Field>
          </FormSection>
        )}

        <FormSection title="Poze la retur">
          <MediaPicker files={files} onChange={setFiles} />
        </FormSection>

        <FormSection title="Servicii suplimentare facturabile (art. 4 din contract)" description="Sumele sunt fără TVA. Fă poze ca dovadă, apoi tipărește procesul-verbal de constatare din detaliile închirierii.">
          <div className="space-y-2.5">
            <Check checked={form.taxa_curatare} onChange={setFlag('taxa_curatare')}>
              {SERVICE_NAMES.curatare} — {fmtMoney(FEES.curatare)} + TVA
            </Check>
            <Check checked={form.taxa_igienizare} onChange={setFlag('taxa_igienizare')}>
              {SERVICE_NAMES.igienizare} (miros persistent) — {fmtMoney(FEES.igienizare)} + TVA
            </Check>
            <Check checked={form.realimentare} onChange={setFlag('realimentare')}>
              {SERVICE_NAMES.realimentare} — {fmtMoney(FEES.realimentare)} + TVA, plus combustibilul
            </Check>
            {form.realimentare && (
              <Field label="Contravaloare combustibil (RON fără TVA, din bon)" hint="Valoarea fără TVA de pe bonul de la pompă" className="max-w-xs pl-6">
                <Input type="number" inputMode="decimal" min={0} value={form.cost_combustibil} onChange={set('cost_combustibil')} />
              </Field>
            )}
          </div>
        </FormSection>

        <FormSection title="Decont">
          <Card className="px-4 py-2">
            <InfoRow label="Zile facturabile">{days}</InfoRow>
            <InfoRow label={`Chirie ${days} × ${fmtMoney(rental.tarif_zilnic)}`}>{fmtMoney(rent)}</InfoRow>
            {fees > 0 && <InfoRow label="Servicii suplimentare">{fmtMoney(fees)}</InfoRow>}
            <InfoRow label="Total calculat (fără TVA)">
              <span className="text-base">{fmtMoney(computed)}</span>
            </InfoRow>
          </Card>
          <Field label="Total de încasat (RON, fără TVA)" hint="Se completează singur; îl poți modifica (reduceri, daune).">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={total}
              onChange={(e) => setTotalOverride(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </Field>
          {editing && totalOverride !== null && totalOverride !== computed && (
            <button type="button" onClick={() => setTotalOverride(null)} className="text-sm font-medium text-blue-600">
              Folosește totalul calculat ({fmtMoney(computed)})
            </button>
          )}
          {!editing && (
            <Check checked={form.trimite_service} onChange={setFlag('trimite_service')}>
              Trimite mașina în service după retur
            </Check>
          )}
        </FormSection>

        <UploadProgress text={progress} />
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}
