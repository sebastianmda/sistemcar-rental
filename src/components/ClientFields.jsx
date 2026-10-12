import { Field, Input, Textarea, Tabs } from './ui'
import { DateInput } from './DateInputs'

export const EMPTY_CLIENT = {
  tip_client: 'PF',
  nume: '',
  telefon: '',
  email: '',
  cnp: '',
  act_identitate: '',
  adresa: '',
  permis_numar: '',
  permis_categorie: 'B',
  permis_expira: '',
  firma: '',
  cui: '',
  reg_com: '',
  sediu: '',
  observatii: '',
}

export function clientToForm(client) {
  if (!client) return { ...EMPTY_CLIENT }
  const out = { ...EMPTY_CLIENT }
  for (const k of Object.keys(EMPTY_CLIENT)) {
    const v = client[k]
    out[k] = v === null || v === undefined ? EMPTY_CLIENT[k] : k === 'permis_expira' ? String(v).slice(0, 10) : v
  }
  if (out.tip_client !== 'PJ') out.tip_client = 'PF'
  // for a firm saved without a delegate, `nume` holds the firm name — show the delegate field empty
  if (out.tip_client === 'PJ' && out.nume && out.nume === out.firma) out.nume = ''
  return out
}

export function validateClient(form) {
  if (form.tip_client === 'PJ') {
    if (!form.firma.trim()) return 'Completează denumirea firmei.'
    if (!form.cui.trim()) return 'Completează CUI-ul firmei.'
  } else if (!form.nume.trim()) {
    return 'Completează numele clientului.'
  }
  if (!form.telefon.trim()) return 'Completează telefonul clientului.'
  if (form.cnp && !/^\d{13}$/.test(form.cnp.trim())) return 'CNP-ul trebuie să aibă 13 cifre.'
  return null
}

// Fields of one person: client (PF) or a firm's usual delegate (PJ)
function PersonFields({ form, set, company }) {
  return (
    <>
      {company && (
        <Field label="Nume și prenume delegat">
          <Input value={form.nume} onChange={set('nume')} autoComplete="off" />
        </Field>
      )}
      <Field label={company ? 'CNP delegat' : 'CNP'}>
        <Input inputMode="numeric" maxLength={13} value={form.cnp} onChange={set('cnp')} />
      </Field>
      <Field label="Act identitate (serie, nr.)">
        <Input value={form.act_identitate} onChange={set('act_identitate')} placeholder="seria și nr., ex: XH 123456" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Nr. permis conducere" className="col-span-2">
          <Input value={form.permis_numar} onChange={set('permis_numar')} />
        </Field>
        <Field label="Categoria">
          <Input value={form.permis_categorie} onChange={set('permis_categorie')} placeholder="B" />
        </Field>
      </div>
      <Field label="Permis valabil până la">
        <DateInput value={form.permis_expira} onChange={set('permis_expira')} />
      </Field>
    </>
  )
}

export function ClientTypeTabs({ value, onChange }) {
  return (
    <Tabs
      value={value}
      onChange={onChange}
      tabs={[
        { value: 'PF', label: 'Persoană fizică' },
        { value: 'PJ', label: 'Persoană juridică (firmă)' },
      ]}
    />
  )
}

// compact = inside the handover form: for a firm the delegate is filled in there, per rental
export default function ClientFields({ form, setForm, compact }) {
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const company = form.tip_client === 'PJ'

  return (
    <div className="space-y-4">
      <ClientTypeTabs value={company ? 'PJ' : 'PF'} onChange={(v) => setForm((f) => ({ ...f, tip_client: v }))} />

      {company ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Denumire firmă" required>
            <Input value={form.firma} onChange={set('firma')} autoComplete="off" placeholder="ex: EXEMPLU SRL" />
          </Field>
          <Field label="CUI" required>
            <Input value={form.cui} onChange={set('cui')} placeholder="ex: RO12345678" />
          </Field>
          <Field label="Nr. Reg. Comerțului">
            <Input value={form.reg_com} onChange={set('reg_com')} placeholder="ex: J05/123/2010" />
          </Field>
          <Field label="Telefon" required>
            <Input type="tel" inputMode="tel" value={form.telefon} onChange={set('telefon')} />
          </Field>
          <Field label="Sediu social" className="sm:col-span-2">
            <Input value={form.sediu} onChange={set('sediu')} placeholder="localitate, stradă, nr., județ" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          {!compact && (
            <>
              <div className="sm:col-span-2">
                <div className="text-sm font-semibold text-slate-700">Delegat obișnuit</div>
                <p className="text-xs text-slate-500">
                  Persoana care vine de obicei după mașină. La predare se completează automat și o poți schimba pentru fiecare contract.
                </p>
              </div>
              <PersonFields form={form} set={set} company />
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nume și prenume" required>
            <Input value={form.nume} onChange={set('nume')} autoComplete="off" />
          </Field>
          <Field label="Telefon" required>
            <Input type="tel" inputMode="tel" value={form.telefon} onChange={set('telefon')} />
          </Field>
          <PersonFields form={form} set={set} />
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Domiciliu (adresa din buletin)">
            <Input value={form.adresa} onChange={set('adresa')} />
          </Field>
        </div>
      )}

      {!compact && (
        <Field label="Observații">
          <Textarea value={form.observatii} onChange={set('observatii')} />
        </Field>
      )}
    </div>
  )
}

// Delegate of a firm for one rental (the person who receives the car)
export function DelegateFields({ value, onChange }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })
  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <div>
        <div className="text-sm font-semibold text-slate-800">Delegat — persoana căreia i se predă mașina</div>
        <p className="text-xs text-slate-500">Apare pe contract: „firma …, prin delegat …”. Verifică buletinul și permisul delegatului.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nume și prenume delegat" required>
          <Input value={value.delegat_nume} onChange={set('delegat_nume')} autoComplete="off" />
        </Field>
        <Field label="Telefon delegat">
          <Input type="tel" inputMode="tel" value={value.delegat_telefon} onChange={set('delegat_telefon')} />
        </Field>
        <Field label="CNP delegat">
          <Input inputMode="numeric" maxLength={13} value={value.delegat_cnp} onChange={set('delegat_cnp')} />
        </Field>
        <Field label="Act identitate delegat (serie, nr.)">
          <Input value={value.delegat_act} onChange={set('delegat_act')} placeholder="ex: XH 123456" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Nr. permis delegat" className="col-span-2">
            <Input value={value.delegat_permis_numar} onChange={set('delegat_permis_numar')} />
          </Field>
          <Field label="Categoria">
            <Input value={value.delegat_permis_categorie} onChange={set('delegat_permis_categorie')} placeholder="B" />
          </Field>
        </div>
        <Field label="Permis valabil până la">
          <DateInput value={value.delegat_permis_expira} onChange={set('delegat_permis_expira')} />
        </Field>
        <Field label="Delegație / împuternicire nr." hint="Opțional — dacă firma îi dă o delegație scrisă" className="sm:col-span-2">
          <Input value={value.delegatie} onChange={set('delegatie')} placeholder="ex: 45 / 12.10.2026" />
        </Field>
      </div>
    </div>
  )
}
