// Values that come from the Sistemcar rental contract (keep in sync with the contract text)

// tarife fără TVA (art. 4 din contract); la facturare se adaugă TVA
export const FEES = {
  curatare: 500, // serviciu de curățare a autovehiculului
  igienizare: 250, // serviciu de igienizare și dezodorizare (miros persistent)
  realimentare: 200, // serviciu de alimentare (+ contravaloarea combustibilului, separat)
}

// denumirile serviciilor, la fel în contract, în formularul de primire și în procesul-verbal
export const SERVICE_NAMES = {
  curatare: 'Servicii de curățare a autovehiculului',
  igienizare: 'Servicii de igienizare și dezodorizare a habitaclului',
  realimentare: 'Serviciu de alimentare cu combustibil',
  combustibil: 'Contravaloare combustibil alimentat',
}

// Anexa 1 — equipment checklist, in the contract's order
export const EQUIPMENT = [
  { key: 'certificat', label: 'Certificat de înmatriculare' },
  { key: 'itp', label: 'ITP valabil' },
  { key: 'rovinieta', label: 'Rovinietă' },
  { key: 'rca', label: 'RCA / documente asigurare' },
  { key: 'chei', label: 'Cheie / chei' },
  { key: 'trusa', label: 'Trusă medicală' },
  { key: 'triunghi', label: 'Triunghi reflectorizant' },
  { key: 'vesta', label: 'Vestă reflectorizantă' },
  { key: 'cric', label: 'Cric' },
  { key: 'roata', label: 'Roată de rezervă / kit' },
  { key: 'stingator', label: 'Stingător' },
  { key: 'jante', label: 'Jante aliaj / capace' },
]

export const defaultEquipment = () => Object.fromEntries(EQUIPMENT.map((e) => [e.key, true]))

// Fuel is recorded in eighths, like the contract ("combustibil: __ / 8")
export const FUEL_LEVELS = [8, 7, 6, 5, 4, 3, 2, 1, 0].map((n) => ({
  value: `${n}/8`,
  label: n === 8 ? '8/8 (plin)' : n === 0 ? '0/8 (gol)' : n === 1 ? '1/8 (rezervă)' : `${n}/8`,
}))

const LEGACY_FUEL = { Plin: 8, '3/4': 6, '1/2': 4, '1/4': 2, Rezervă: 1 }

// '6/8' -> 6, legacy 'Plin' -> 8, unknown -> null
export function fuelEighths(value) {
  if (value === null || value === undefined || value === '') return null
  const m = String(value).match(/^(\d)\s*\/\s*8$/)
  if (m) return Number(m[1])
  return LEGACY_FUEL[value] ?? null
}

export function fuelLabel(value) {
  const n = fuelEighths(value)
  return n === null ? value || '—' : `${n}/8`
}

// "XH 123456" -> { seria: 'XH', nr: '123456' }
export function splitIdCard(text) {
  const t = String(text || '').trim()
  const m = t.match(/^([A-Za-z]{1,3})\s*[-/.,]?\s*(\d{4,})$/)
  if (m) return { seria: m[1].toUpperCase(), nr: m[2] }
  return { seria: '', nr: t }
}
