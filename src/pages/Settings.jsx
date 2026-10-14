import { useRef, useState } from 'react'
import { Save, LogOut, Upload, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../components/Toast'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { DEFAULT_COMPANY } from '../lib/contract'
import { Button, Card, Field, Input, PageHeader } from '../components/ui'
import SignaturePad from '../components/SignaturePad'
import { ContractRefreshCard } from '../components/Contract'
import { WARNING_DAYS, CRITICAL_DAYS } from '../lib/alerts'

const COMPANY_FIELDS = [
  ['nume', 'Nume firmă (antet)'],
  ['denumire_contract', 'Denumire în contract'],
  ['adresa', 'Adresă (antet)'],
  ['sediu_contract', 'Sediu (în contract)'],
  ['telefon', 'Telefon'],
  ['email', 'Email'],
  ['reg_com', 'Nr. Registrul Comerțului'],
  ['cif', 'CIF'],
  ['iban', 'IBAN'],
  ['banca', 'Banca'],
  ['reprezentant', 'Reprezentant legal'],
  ['functie', 'Funcția'],
]

// a photo of a signature + stamp on white paper -> small PNG
async function imageToDataUrl(file, max = 600) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function SettingsPage({ email, onLogout }) {
  const { defaultTariff, settings, reload } = useData()
  const toast = useToast()
  const fileRef = useRef(null)
  const [tariff, setTariff] = useState(defaultTariff)
  const [company, setCompany] = useState({ ...DEFAULT_COMPANY, ...(settings?.date_firma || {}) })
  const [signature, setSignature] = useState(settings?.semnatura_locator || null)
  const [drawing, setDrawing] = useState(false)
  const [saving, setSaving] = useState(null)

  const save = async (key, fields, message) => {
    setSaving(key)
    try {
      await api.saveSettings(fields)
      toast(message)
      reload()
    } catch (err) {
      toast(friendlyError(err), 'error')
    } finally {
      setSaving(null)
    }
  }

  return (
    <>
      <PageHeader title="Setări" />
      <div className="grid max-w-3xl grid-cols-1 gap-6">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Tarif implicit</h2>
          <p className="mt-1 text-sm text-slate-500">
            Pentru mașinile fără tarif propriu. Tarifele sunt fără TVA, ca în contract („lei/zi + TVA”).
          </p>
          <div className="mt-4 flex max-w-sm items-end gap-2">
            <Field label="RON / zi" className="flex-1">
              <Input type="number" inputMode="decimal" min={0} value={tariff} onChange={(e) => setTariff(e.target.value)} />
            </Field>
            <Button
              icon={Save}
              loading={saving === 'tariff'}
              onClick={() =>
                Number(tariff) > 0
                  ? save('tariff', { tarif_zilnic_default: Number(tariff) }, 'Tarif implicit salvat')
                  : toast('Tariful trebuie să fie mai mare decât 0.', 'error')
              }
            >
              Salvează
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Semnătura / ștampila Sistemcar</h2>
          <p className="mt-1 text-sm text-slate-500">
            Se pune automat pe contracte în locul „Locator”. O poți desena aici sau poți încărca o poză cu semnătura și ștampila pe
            hârtie albă.
          </p>
          <div className="mt-4 space-y-3">
            {drawing ? (
              <SignaturePad label="Semnătura locatorului" onChange={setSignature} />
            ) : signature ? (
              <div className="flex h-28 items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
                <img src={signature} alt="Semnătura salvată" className="max-h-full object-contain" />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                Nicio semnătură salvată
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {!drawing && (
                <Button size="sm" variant="secondary" onClick={() => setDrawing(true)}>
                  Desenează
                </Button>
              )}
              <Button size="sm" variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>
                Încarcă poză
              </Button>
              {signature && (
                <Button size="sm" variant="dangerGhost" icon={Trash2} onClick={() => setSignature(null)}>
                  Scoate
                </Button>
              )}
              <Button
                size="sm"
                icon={Save}
                loading={saving === 'signature'}
                onClick={async () => {
                  await save('signature', { semnatura_locator: signature }, 'Semnătura a fost salvată')
                  setDrawing(false)
                }}
              >
                Salvează semnătura
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  setSignature(await imageToDataUrl(file))
                  setDrawing(false)
                } catch {
                  toast('Poza nu a putut fi citită. Încearcă JPG sau PNG.', 'error')
                }
              }}
            />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Date firmă pentru contract</h2>
          <p className="mt-1 text-sm text-slate-500">Apar în antetul contractului și la „Locator”.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {COMPANY_FIELDS.map(([key, label]) => (
              <Field key={key} label={label}>
                <Input value={company[key] || ''} onChange={(e) => setCompany((c) => ({ ...c, [key]: e.target.value }))} />
              </Field>
            ))}
          </div>
          <Button
            className="mt-4"
            icon={Save}
            loading={saving === 'company'}
            onClick={() => save('company', { date_firma: company }, 'Datele firmei au fost salvate')}
          >
            Salvează datele firmei
          </Button>
        </Card>

        <ContractRefreshCard />

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Alerte documente</h2>
          <p className="mt-1 text-sm text-slate-500">
            RCA, ITP, rovinieta și CASCO apar în Panou cu {WARNING_DAYS} de zile înainte de expirare (galben) și cu {CRITICAL_DAYS} zile
            înainte (portocaliu). Documentele expirate apar cu roșu, iar predarea unei mașini cu RCA sau ITP expirat este blocată.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Cont</h2>
          <p className="mt-1 text-sm text-slate-500">Conectat ca {email}</p>
          <Button variant="secondary" icon={LogOut} onClick={onLogout} className="mt-4">
            Deconectare
          </Button>
        </Card>
      </div>
    </>
  )
}
