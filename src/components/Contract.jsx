import { useState } from 'react'
import { FileText, PenLine, Share2, Printer, CheckCircle2, ExternalLink, Hash, Save, ClipboardCheck } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from './Toast'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import {
  contractPdfBlob,
  contractFileName,
  showPdf,
  sharePdf,
  contractLabel,
  suggestContractNumber,
  returnReportPdfBlob,
  returnReportServices,
} from '../lib/contract'
import { fmtDateTime } from '../lib/format'
import { Modal, Button, Card, Badge, ErrorText, Field, Input } from './ui'
import SignaturePad from './SignaturePad'
import { UploadProgress } from './Media'
import { DateInput } from './DateInputs'

function useContractTools() {
  const { settings } = useData()
  const company = settings?.date_firma || null

  // fresh PDF from the current data (with whatever signatures exist)
  const generate = async (rental) => {
    const photoCounts = await api.countMedia(rental.id).catch(() => ({}))
    return contractPdfBlob({ rental, company, photoCounts })
  }

  // proces-verbal de constatare la restituire (servicii suplimentare facturabile)
  const report = async (rental) => {
    const photoCounts = await api.countMedia(rental.id).catch(() => ({}))
    return returnReportPdfBlob({ rental, company, photoCounts })
  }

  // the archived PDF if there is one, otherwise a fresh one
  // (after the return, until the return is signed / printed, a fresh one so it includes the return data)
  const current = async (rental) => {
    const archiveUpToDate = rental.status !== 'finalizata' || returnDone(rental)
    return rental.contract_pdf && archiveUpToDate ? api.contractBlob(rental.contract_pdf) : generate(rental)
  }

  return { settings, company, generate, current, report }
}

// a stage counts as done when it was signed on screen OR printed and signed with a pen
export const handoverDone = (r) => Boolean(r.semnatura_locatar_predare || r.semnat_hartie_predare)
export const returnDone = (r) => Boolean(r.semnatura_locatar_retur || r.semnat_hartie_retur)

export function contractStatus(rental) {
  if (returnDone(rental)) return { label: rental.semnatura_locatar_retur ? 'Semnat complet' : 'Semnat pe hârtie', tone: 'green' }
  if (handoverDone(rental)) {
    return { label: rental.semnatura_locatar_predare ? 'Semnat la predare' : 'Tipărit pentru semnare', tone: 'blue' }
  }
  return { label: 'Nesemnat', tone: 'amber' }
}

const missingColumn = (err) => /semnat_hartie/.test(String(err?.message || err))

// Contract screen after handover / return.
// Default: save + print, the parties sign with a pen. Optional: sign on the phone screen.
export function ContractSign({ rental, etapa, onClose, onSigned }) {
  const toast = useToast()
  const { settings, generate } = useContractTools()
  const { rentals } = useData()
  const retur = etapa === 'retur'
  const [numar, setNumar] = useState(rental.numar_contract || '')
  const [dataContract, setDataContract] = useState(rental.data_contract ? String(rental.data_contract).slice(0, 10) : '')
  const suggestedNr = suggestContractNumber(rentals)
  const withNumber = { ...rental, numar_contract: numar.trim() || null, data_contract: dataContract || null }
  const savedLocator = settings?.semnatura_locator || null

  const [onScreen, setOnScreen] = useState(false) // false = paper (default)
  const [clientSig, setClientSig] = useState(null)
  const [useSaved, setUseSaved] = useState(Boolean(savedLocator))
  const [locatorSig, setLocatorSig] = useState(null)
  const [rememberLocator, setRememberLocator] = useState(!savedLocator)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null) // { rental, blob, paper }

  const fileName = contractFileName(rental)
  const numberFields = () => ({ numar_contract: numar.trim() || null, data_contract: dataContract || null })

  const preview = async () => {
    const win = window.open('', '_blank')
    try {
      setBusy('Se generează contractul…')
      showPdf(await generate(withNumber), fileName, win)
    } catch (err) {
      win?.close()
      setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  // save the number/date, archive the PDF with empty signature lines and open it for printing
  const saveAndPrint = async () => {
    setError(null)
    const win = window.open('', '_blank') // opened right away, otherwise the phone blocks it
    try {
      setBusy('Se salvează…')
      const mark = retur ? { semnat_hartie_retur: new Date().toISOString() } : { semnat_hartie_predare: new Date().toISOString() }
      let saved
      try {
        saved = await api.saveRentalFields(rental.id, { ...numberFields(), ...mark })
      } catch (err) {
        if (!missingColumn(err)) throw err
        saved = await api.saveRentalFields(rental.id, numberFields()) // SUPABASE_UPDATE_V6.sql not run yet
      }
      setBusy('Se generează contractul…')
      const blob = await generate(saved)
      showPdf(blob, fileName, win)
      setBusy('Se arhivează contractul…')
      const archived = await api.uploadContract(saved, blob)
      toast('Contract salvat. Tipărește-l și semnați cu pixul.')
      setDone({ rental: archived, blob, paper: true })
      onSigned?.(archived)
    } catch (err) {
      win?.close()
      setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  const sign = async () => {
    setError(null)
    const locator = useSaved ? savedLocator : locatorSig
    if (!clientSig) return setError('Lipsește semnătura locatarului.')
    if (!locator) return setError('Lipsește semnătura locatorului (Sistemcar).')
    if (!agreed) return setError(retur ? 'Confirmă că datele de retur sunt corecte.' : 'Confirmă că locatarul a citit contractul.')
    try {
      setBusy('Se salvează semnăturile…')
      const fields = retur
        ? { ...numberFields(), semnatura_locatar_retur: clientSig, semnatura_locator_retur: locator }
        : { ...numberFields(), semnatura_locatar_predare: clientSig, semnatura_locator_predare: locator }
      const signed = await api.saveRentalFields(rental.id, fields)
      if (!useSaved && rememberLocator && locatorSig) {
        await api.saveSettings({ semnatura_locator: locatorSig }).catch(() => {})
      }
      setBusy('Se generează contractul semnat…')
      const blob = await generate(signed)
      setBusy('Se arhivează contractul…')
      const archived = await api.uploadContract(signed, blob)
      toast('Contract semnat și salvat')
      setDone({ rental: archived, blob, paper: false })
      onSigned?.(archived)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  const title = retur ? 'Contract — retur' : 'Contract de închiriere'

  if (done) {
    return (
      <Modal
        open
        onClose={onClose}
        title={title}
        size="md"
        footer={
          <Button variant="secondary" onClick={onClose}>
            Închide
          </Button>
        }
      >
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <div>
            <div className="font-semibold text-slate-900">{done.paper ? 'Contractul a fost salvat' : 'Contractul a fost semnat'}</div>
            <p className="mt-1 text-sm text-slate-500">
              {done.paper
                ? 'S-a deschis PDF-ul. Tipărește-l (de obicei în 2 exemplare) și semnați amândoi cu pixul. Dacă nu s-a deschis, apasă Tipărește.'
                : 'PDF-ul este salvat la închiriere. Trimite-i clientului exemplarul lui.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {done.paper ? (
              <Button icon={Printer} onClick={() => showPdf(done.blob, fileName, window.open('', '_blank'))}>
                Tipărește
              </Button>
            ) : (
              <Button icon={Share2} onClick={() => sharePdf(done.blob, fileName)}>
                Trimite clientului
              </Button>
            )}
            {done.paper ? (
              <Button variant="secondary" icon={Share2} onClick={() => sharePdf(done.blob, fileName)}>
                Trimite / salvează PDF
              </Button>
            ) : (
              <Button variant="secondary" icon={ExternalLink} onClick={() => showPdf(done.blob, fileName, window.open('', '_blank'))}>
                Deschide PDF
              </Button>
            )}
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title={title}
      subtitle={`${rental.client?.nume ?? ''} · ${rental.vehicle?.nume_model ?? ''} ${rental.vehicle?.inmatriculare ?? ''}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={!!busy}>
            Mai târziu
          </Button>
          {onScreen ? (
            <Button icon={PenLine} loading={!!busy} onClick={sign}>
              Semnează și salvează
            </Button>
          ) : (
            <Button icon={Printer} loading={!!busy} onClick={saveAndPrint}>
              Salvează și tipărește
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            {retur
              ? 'Anexa 1 a fost completată cu datele de retur. Verifică-le înainte de tipărire.'
              : 'Contractul a fost completat automat din datele predării.'}
          </div>
          <Button variant="secondary" icon={FileText} onClick={preview} disabled={!!busy}>
            Citește contractul
          </Button>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Nr. contract">
            <Input value={numar} onChange={(e) => setNumar(e.target.value)} placeholder={suggestedNr ? `ex: ${suggestedNr}` : 'ex: 1'} />
          </Field>
          <Field label="Data contractului">
            <DateInput value={dataContract} onChange={(e) => setDataContract(e.target.value)} />
          </Field>
        </div>

        {!onScreen ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              Se salvează numărul și data, iar contractul se deschide gata de tipărit, cu locurile de semnătură libere.
              Semnați amândoi cu pixul pe hârtie.
            </p>
            <button type="button" onClick={() => setOnScreen(true)} className="text-sm font-medium text-blue-600">
              Vreau să semnăm pe ecran (cu degetul)
            </button>
          </div>
        ) : (
          <>
            <button type="button" onClick={() => setOnScreen(false)} className="text-sm font-medium text-blue-600">
              ← Înapoi la semnare pe hârtie
            </button>

            <SignaturePad label={`Semnătura locatarului — ${rental.client?.nume ?? ''}`} onChange={setClientSig} />

            <div>
              {useSaved ? (
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">Semnătura locatorului (Sistemcar)</div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2">
                    <img src={savedLocator} alt="Semnătura salvată" className="h-16 object-contain" />
                    <Button size="sm" variant="ghost" onClick={() => setUseSaved(false)}>
                      Semnează acum
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <SignaturePad label="Semnătura locatorului (Sistemcar)" onChange={setLocatorSig} />
                  <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={rememberLocator} onChange={(e) => setRememberLocator(e.target.checked)} className="h-4 w-4" />
                    Salvează semnătura mea pentru contractele următoare
                  </label>
                </>
              )}
            </div>

            <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
              {retur
                ? 'Părțile confirmă datele de retur consemnate în Anexa 1 (km, combustibil, avarii, dotări, taxe).'
                : 'Locatarul a citit contractul și Anexa 1 și este de acord cu prevederile acestora.'}
            </label>
          </>
        )}

        <UploadProgress text={busy} />
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}

// small window to type / correct the contract number and date
function ContractNumberEditor({ rental, onClose, onSaved }) {
  const toast = useToast()
  const { rentals } = useData()
  const [numar, setNumar] = useState(rental.numar_contract || '')
  const [dataContract, setDataContract] = useState(rental.data_contract ? String(rental.data_contract).slice(0, 10) : '')
  const [saving, setSaving] = useState(false)
  const suggestedNr = suggestContractNumber(rentals)

  const save = async () => {
    setSaving(true)
    try {
      await api.saveRentalFields(rental.id, { numar_contract: numar.trim() || null, data_contract: dataContract || null })
      toast('Numărul și data contractului au fost salvate')
      onSaved()
    } catch (err) {
      toast(friendlyError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Număr și dată contract"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anulează
          </Button>
          <Button icon={Save} loading={saving} onClick={save}>
            Salvează
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nr. contract">
          <Input value={numar} onChange={(e) => setNumar(e.target.value)} placeholder={suggestedNr ? `ex: ${suggestedNr}` : 'ex: 1'} />
        </Field>
        <Field label="Data contractului">
          <DateInput value={dataContract} onChange={(e) => setDataContract(e.target.value)} />
        </Field>
      </div>
      {rental.contract_pdf && (
        <p className="mt-4 text-sm text-amber-700">
          Contractul semnat deja arhivat rămâne cu datele vechi. Noile valori apar pe PDF-urile generate de acum înainte.
        </p>
      )}
    </Modal>
  )
}

// Contract box shown in the rental details
export function ContractCard({ rental, onSign, onChanged }) {
  const toast = useToast()
  const { current, report } = useContractTools()
  const [busy, setBusy] = useState(null)
  const [editingNumber, setEditingNumber] = useState(false)
  const status = contractStatus(rental)
  const fileName = contractFileName(rental)
  const needsHandover = rental.status !== 'anulata' && !handoverDone(rental)
  const needsReturn = rental.status === 'finalizata' && handoverDone(rental) && !returnDone(rental)
  const returned = rental.status === 'finalizata'
  const hasServices = returned && returnReportServices(rental).length > 0
  const reportName = contractFileName(rental, 'Proces-verbal_constatare')

  const openReport = () => {
    const win = window.open('', '_blank')
    return run('report', async () => {
      try {
        showPdf(await report(rental), reportName, win)
      } catch (err) {
        win?.close()
        throw err
      }
    })
  }

  const run = async (label, fn) => {
    setBusy(label)
    try {
      await fn()
    } catch (err) {
      toast(friendlyError(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const open = () => {
    const win = window.open('', '_blank')
    return run('open', async () => {
      try {
        showPdf(await current(rental), fileName, win)
      } catch (err) {
        win?.close()
        throw err
      }
    })
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">Contract {contractLabel(rental)}</div>
            <div className="text-xs text-slate-500">
              {rental.contract_semnat_la ? `Arhivat ${fmtDateTime(rental.contract_semnat_la)}` : 'Generat automat din datele închirierii'}
            </div>
          </div>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {needsHandover && (
          <Button size="sm" icon={Printer} onClick={() => onSign('predare')}>
            Contract: salvează și tipărește
          </Button>
        )}
        {needsReturn && (
          <Button size="sm" icon={Printer} onClick={() => onSign('retur')}>
            Retur: salvează și tipărește
          </Button>
        )}
        <Button size="sm" variant="secondary" icon={ExternalLink} loading={busy === 'open'} onClick={open}>
          Deschide / tipărește PDF
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={Share2}
          loading={busy === 'share'}
          onClick={() => run('share', async () => sharePdf(await current(rental), fileName))}
        >
          Trimite
        </Button>
        {returned && (
          <Button size="sm" variant={hasServices ? 'primary' : 'secondary'} icon={ClipboardCheck} loading={busy === 'report'} onClick={openReport}>
            Proces-verbal de constatare
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={Hash} onClick={() => setEditingNumber(true)}>
          Nr. și dată
        </Button>
      </div>
      {hasServices && (
        <p className="mt-3 text-xs text-slate-500">
          Ai servicii suplimentare de facturat. Tipărește procesul-verbal, semnați-l și păstrează-l împreună cu factura și pozele de la retur.
        </p>
      )}
      {editingNumber && (
        <ContractNumberEditor
          rental={rental}
          onClose={() => setEditingNumber(false)}
          onSaved={() => {
            setEditingNumber(false)
            onChanged?.()
          }}
        />
      )}
    </Card>
  )
}
