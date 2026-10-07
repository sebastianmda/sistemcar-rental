// Generates the Sistemcar rental contract (+ Anexa 1) as a PDF, filled with the rental's data.
// The legal text and layout mirror "Contract_inchiriere_SISTEMCAR.docx" (versiunea din 29.09.2026, ora 10:24).
import { EQUIPMENT, FEES, SERVICE_NAMES, fuelEighths, splitIdCard } from './rentalTerms'
import { fmtDate, fmtDateOnly, fmtTime, rentalDays } from './format'

export const DEFAULT_COMPANY = {
  nume: 'SISTEMCAR SRL',
  denumire_contract: 'S.C. SISTEMCAR S.R.L.',
  adresa: 'Comuna Nojorid, sat Leș nr. 16/A, jud. Bihor, 417348',
  sediu_contract: 'Comuna Nojorid, sat Leș nr. 16/A, jud. Bihor',
  telefon: '0746 089 174',
  email: 'sistemcarauto@gmail.com',
  reg_com: 'J2006002518053',
  cif: 'RO19249704',
  iban: 'RO35BTRLRONCRT0286900001',
  banca: 'Banca Transilvania',
  reprezentant: 'Ghile Ioan Marius',
  functie: 'administrator',
}

const NAVY = '#1B365D'
const TEXT = '#222222'
const GRAY = '#666666'
const LINE = '#C3C9D0'
const FILL = '#F4F6F8'

// keeps "16/A", "e-mail", "cheilor/documentelor" together so justified lines don't open a gap after "/" or "-"
const nb = (t) => String(t).replace(/(\S)([/-])(?=\S)/g, '$1$2\uFEFF')

const blank = (n) => '_'.repeat(n)
const has = (v) => v !== null && v !== undefined && String(v).trim() !== ''
// filled values are printed in bold; missing ones stay as a line to complete by hand
const val = (v, n = 14) => (has(v) ? { text: nb(String(v).trim()), bold: true } : blank(n))
const money = (n) => Number(n || 0).toLocaleString('ro-RO', { maximumFractionDigits: 2 })
const fix = (content) => (typeof content === 'string' ? nb(content) : content.map((c) => (typeof c === 'string' ? nb(c) : c)))

const P = (content, extra = {}) => ({ text: fix(content), style: 'p', ...extra })
const H = (text) => ({ text, style: 'h' })

function box(checked) {
  return {
    width: 10,
    canvas: [
      { type: 'rect', x: 0, y: 1.5, w: 7.5, h: 7.5, lineWidth: 0.7, lineColor: TEXT },
      ...(checked
        ? [
            { type: 'line', x1: 1.4, y1: 2.9, x2: 6.1, y2: 7.6, lineWidth: 1.1, lineColor: TEXT },
            { type: 'line', x1: 6.1, y1: 2.9, x2: 1.4, y2: 7.6, lineWidth: 1.1, lineColor: TEXT },
          ]
        : []),
    ],
  }
}

// one line made of text pieces and checkboxes: ['Curățenie 500 lei: ', box(false), ' nu ', box(true), ' da']
function line(parts, margin = [0, 0, 0, 4]) {
  return {
    columns: parts.map((part) =>
      typeof part === 'string' || Array.isArray(part) || (part && part.text !== undefined)
        ? { text: typeof part === 'string' ? nb(part) : part, width: 'auto' }
        : part
    ),
    columnGap: 3,
    margin,
  }
}

// "Label [ ] nu [ ] da" ; value: true / false / null (not filled in yet)
function yesNo(label, value, suffix) {
  const parts = [label, box(value === false), 'nu', { text: ' ', width: 4 }, box(value === true), 'da']
  if (suffix) parts.push(suffix)
  return line(parts)
}

// "Set foto …: [ ] da, nr. poze ____ [ ] nu"
function photoSet(label, count, known) {
  const yes = known ? count > 0 : null
  return line([
    label,
    box(yes === true),
    'da, nr. poze',
    yes ? { text: String(count), bold: true } : blank(4),
    { text: ' ', width: 6 },
    box(yes === false),
    'nu',
  ])
}

function signatureImage(image) {
  return image ? { image, fit: [140, 44], margin: [0, 2, 0, 2] } : { text: blank(24), margin: [0, 12, 0, 2] }
}

// "Label: [signature] / Nume: … / Data: …" (one column of a two-column signature block)
function signBlock(label, image, name, date) {
  const stack = [{ text: label }, signatureImage(image), { text: ['Nume: ', val(name, 28)], margin: [0, 2, 0, 0] }]
  if (date !== undefined) stack.push({ text: ['Data: ', val(date, 14)], margin: [0, 3, 0, 0] })
  return { stack }
}

function twoColumns(left, right, margin = [0, 8, 0, 6]) {
  return { columns: [{ width: '*', ...left }, { width: '*', ...right }], columnGap: 24, margin, unbreakable: true }
}

export function buildContractDefinition({ rental, company: companyIn, photoCounts = {} }) {
  const company = { ...DEFAULT_COMPANY, ...(companyIn || {}) }
  const client = rental.client || {}
  const vehicle = rental.vehicle || {}
  const id = splitIdCard(client.act_identitate)
  const returned = rental.status === 'finalizata'
  // number and date are typed in by the user; if missing they stay as lines to fill in by hand
  const contractDate = rental.data_contract ? fmtDate(rental.data_contract) : ''
  const signDate = contractDate || fmtDateOnly(rental.data_predare)
  const returnDate = returned ? fmtDateOnly(rental.data_returnare) : ''
  const nr = has(rental.numar_contract) ? String(rental.numar_contract).trim() : blank(6)
  const tarif = money(rental.tarif_zilnic)
  const agreedDays = rentalDays(rental.data_predare, rental.data_returnare_planificata)
  const equipment = rental.dotari_predare
  const fuelOut = fuelEighths(rental.combustibil_predare)
  const fuelIn = fuelEighths(rental.combustibil_primire)
  const photosKnown = photoCounts.predare !== undefined

  const equipmentRows = EQUIPMENT.map((e, i) => {
    const label = e.key === 'chei' ? `Cheie / chei (nr. ${has(rental.nr_chei) ? rental.nr_chei : blank(4)})` : e.label
    const v = equipment ? Boolean(equipment[e.key]) : null
    return [
      { text: String(i + 1) },
      { text: label },
      { stack: [box(v === true)], alignment: 'center' },
      { stack: [box(v === false)], alignment: 'center' },
    ]
  })

  const content = [
    // ---------- antet ----------
    { text: company.nume, fontSize: 14, bold: true, color: NAVY, alignment: 'center' },
    { text: nb(company.adresa), alignment: 'center', fontSize: 8 },
    { text: `Tel. ${company.telefon} · ${company.email}`, alignment: 'center', fontSize: 8 },
    { text: `${company.reg_com} · CIF ${company.cif}`, alignment: 'center', fontSize: 8 },
    { text: `IBAN ${company.iban} — ${company.banca}`, alignment: 'center', fontSize: 8 },
    { text: 'CONTRACT DE ÎNCHIRIERE AUTO', style: 'title', margin: [0, 12, 0, 2] },
    {
      text: ['Nr. ', { text: String(nr) }, ' / ', { text: contractDate || blank(14) }],
      alignment: 'center',
      bold: true,
      color: NAVY,
      margin: [0, 0, 0, 4],
    },

    // ---------- 1 ----------
    H('1. PĂRȚILE'),
    P(
      `Locator: ${company.denumire_contract}, sediul în ${company.sediu_contract}, ${company.reg_com}, CIF ${company.cif}, ` +
        `reprezentată de ${company.reprezentant} în calitate de ${company.functie}.`
    ),
    P(['Locatar: Nume ', val(client.nume, 32), ' domiciliu ', val(client.adresa, 32)]),
    P([
      'CI seria ', val(id.seria, 4), ' nr. ', val(id.nr, 10), ' CNP ', val(client.cnp, 18),
      ' tel. ', val(client.telefon, 14), ' e-mail ', val(client.email, 20),
    ]),
    P([
      'Permis categoria ', val(client.permis_categorie, 4), ' nr. ', val(client.permis_numar, 10),
      ' valabil până la ', val(client.permis_expira ? fmtDate(client.permis_expira) : '', 10),
    ]),
    P(['Șofer autorizat suplimentar (dacă e cazul): ', val(rental.sofer2_nume, 32), ' permis nr. ', val(rental.sofer2_permis, 10)]),

    // ---------- 2 ----------
    H('2. OBIECT'),
    P('Locatorul închiriază Locatarului autovehiculul:'),
    P([
      'Marcă/model ', val(vehicle.nume_model, 16), ' an ', val(vehicle.an_fabricatie, 4),
      ' nr. înmatriculare ', val(vehicle.inmatriculare, 10), ' VIN ', val(vehicle.vin, 20),
    ]),
    P(['Chiria: ', { text: `${tarif} lei/zi`, bold: true }, ' + TVA. Combustibilul nu este inclus. Autovehiculul se predă cu documentele și dotările din Anexa 1.']),

    // ---------- 3 ----------
    H('3. DURATA ȘI CALCULUL PERIOADEI DE ÎNCHIRIERE'),
    P([
      'Contractul începe la data și ora predării autovehiculului, consemnate în Anexa 1. Durata convenită este de ',
      { text: String(agreedDays), bold: true },
      ' zile.',
    ]),
    P(
      'La expirarea duratei convenite, dacă autovehiculul nu a fost restituit, închirierea se prelungește de drept, zi cu zi, la același tarif, ' +
        'până la restituirea efectivă sau până la împlinirea a 30 de zile de la predare. Pentru continuarea închirierii peste 30 de zile este ' +
        'necesar acordul scris al Locatorului, inclusiv prin SMS sau e-mail.'
    ),
    P(
      'La calculul perioadei de închiriere se includ atât ziua predării, cât și ziua restituirii autovehiculului, fiecare zi calendaristică în ' +
        'care autovehiculul se află la dispoziția Locatarului fiind considerată zi de închiriere și fiind facturată integral.'
    ),
    P(
      'Data și ora efectivă a predării și restituirii se consemnează în Anexa 1. Întârziere la retur de peste 1 oră se penalizează; ' +
        'peste 4 ore se facturează o zi întreagă.'
    ),

    // ---------- 4 ----------
    H('4. PREȚ'),
    P([
      'Chirie: ',
      { text: `${tarif} lei/zi`, bold: true },
      ' + TVA. Amenzile, taxele de drum, daunele, pierderea cheilor/documentelor și interiorul avariat sunt în sarcina Locatarului.',
    ]),
    P(
      'Autovehiculul se restituie în starea de curățenie de la predare și cu rezervorul la nivelul consemnat în Anexa 1. ' +
        'În caz contrar, Locatorul efectuează, pe seama Locatarului, serviciile de mai jos, care se facturează Locatarului ' +
        'la următoarele tarife, la care se adaugă TVA:'
    ),
    P([
      'a) curățarea autovehiculului (interior și/sau exterior), dacă este restituit murdar: ',
      { text: `${FEES.curatare} lei + TVA`, bold: true },
      ';',
    ], { margin: [10, 0, 0, 2] }),
    P([
      'b) igienizarea și dezodorizarea habitaclului, în caz de miros persistent (fumat, animale etc.): ',
      { text: `${FEES.igienizare} lei + TVA`, bold: true },
      ';',
    ], { margin: [10, 0, 0, 2] }),
    P([
      'c) alimentarea autovehiculului până la nivelul de la predare, dacă este restituit cu mai puțin combustibil: ' +
        'contravaloarea combustibilului alimentat, la prețul din documentul fiscal de achiziție (bon/factură), plus tariful serviciului de alimentare de ',
      { text: `${FEES.realimentare} lei + TVA`, bold: true },
      ' / alimentare.',
    ], { margin: [10, 0, 0, 4] }),
    P(
      'Necesitatea acestor servicii se constată la restituire, în Anexa 1 și într-un proces-verbal de constatare, susținut de fotografii. ' +
        'Refuzul Locatarului de a semna nu împiedică facturarea; în acest caz refuzul se consemnează în procesul-verbal.'
    ),

    // ---------- 5 ----------
    H('5. FOLOSIRE ȘI DAUNE'),
    P(
      'Locatarul trebuie să aibă permis valabil, să conducă legal și să nu lase mașina altor persoane în afara șoferilor trecuți la art. 1. ' +
        'Ieșirea din România doar cu acord scris.'
    ),
    P(
      'Mașina are RCA și CASCO. Franșiza și daunele neacoperite (inclusiv interior) cad în sarcina Locatarului. La accident anunță Locatorul de ' +
        'îndată și întocmește amiabilă sau proces-verbal.'
    ),
    P(
      'Este interzisă spălarea mașinii, udarea roților sau a frânelor cât timp discurile și plăcuțele sunt încinse. Deteriorarea sistemului de ' +
        'frânare din această cauză este în sarcina Locatarului.'
    ),
    P(
      'Orice observație privind starea mașinii se face la predare, în Anexa 1 și în poze. Lipsa mențiunii înseamnă predare fără avarii vizibile ' +
        'suplimentare.'
    ),

    // ---------- 6 ----------
    H('6. RETUR'),
    P('Returul se face la sediul Locatorului, cu aceleași documente, chei și dotări. Se completează Anexa 1 punctul 2. Mașina se predă curată.'),

    // ---------- 7 ----------
    H('7. FINALE'),
    P(
      'Modificările se fac în scris (inclusiv e-mail/SMS confirmat). Litigiile se soluționează amiabil sau la instanțele din Bihor. ' +
        'Contractul se încheie în 2 exemplare. Anexa 1 face parte din contract.'
    ),
    P('Locatorul prelucrează datele Locatarului doar pentru executarea contractului și facturare.'),

    // ---------- semnături ----------
    {
      unbreakable: true,
      stack: [
        H('Semnături'),
        twoColumns(
          {
            stack: [
              { text: 'LOCATOR', bold: true },
              { text: company.nume, margin: [0, 2, 0, 0] },
              { text: ['Nume: ', { text: company.reprezentant, bold: true }] },
              { text: 'Semnătură / ștampilă:', margin: [0, 6, 0, 0] },
              signatureImage(rental.semnatura_locator_predare),
              { text: ['Data: ', val(signDate, 14)] },
            ],
          },
          {
            stack: [
              { text: 'LOCATAR', bold: true },
              { text: ['Nume: ', val(client.nume, 28)], margin: [0, 2, 0, 0] },
              { text: 'Semnătură:', margin: [0, 6, 0, 0] },
              signatureImage(rental.semnatura_locatar_predare),
              { text: ['Data: ', val(signDate, 14)] },
            ],
          },
          [0, 2, 0, 0]
        ),
      ],
    },

    // ---------- Anexa 1 ----------
    { text: 'ANEXA 1 — PROCES-VERBAL DE PREDARE-PRIMIRE', style: 'title', fontSize: 13, pageBreak: 'before' },
    {
      text: ['la Contractul nr. ', { text: String(nr), bold: true }, ' / ', { text: contractDate || blank(14), bold: true }],
      alignment: 'center',
      margin: [0, 0, 0, 6],
    },

    H('1. PREDARE către Locatar'),
    P([
      'Data ', val(fmtDateOnly(rental.data_predare), 10), ' ora ', val(fmtTime(rental.data_predare), 6),
      ' locul: ', val(rental.loc_predare || 'sediul Locatorului', 26),
    ]),
    P([
      'Vehicul: ', val(vehicle.nume_model, 10), ' nr. ', val(vehicle.inmatriculare, 10),
      ' km la bord: ', val(rental.km_predare, 10), ' combustibil: ', val(fuelOut, 6), ' / 8',
    ]),
    P(['Observații / avarii la predare: ', has(rental.observatii_predare) ? val(rental.observatii_predare) : blank(60)]),
    photoSet('Set foto predare:', photoCounts.predare || 0, photosKnown),
    { text: 'Dotări predate', bold: true, color: NAVY, margin: [0, 4, 0, 3] },
    {
      table: {
        headerRows: 1,
        widths: [26, '*', 60, 60],
        body: [
          [
            { text: 'Nr.', bold: true, fillColor: FILL },
            { text: 'Denumire', bold: true, fillColor: FILL },
            { text: 'Da', bold: true, fillColor: FILL, alignment: 'center' },
            { text: 'Nu', bold: true, fillColor: FILL, alignment: 'center' },
          ],
          ...equipmentRows,
        ],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => LINE,
        vLineColor: () => LINE,
        paddingTop: () => 1.5,
        paddingBottom: () => 1.5,
      },
      fontSize: 8.5,
      margin: [0, 0, 0, 4],
    },
    twoColumns(
      signBlock('Locator (predare):', rental.semnatura_locator_predare, company.reprezentant),
      signBlock('Locatar (primire):', rental.semnatura_locatar_predare, client.nume)
    ),

    H('2. RETUR de la Locatar'),
    P(['Data ', val(returnDate, 10), ' ora ', val(returned ? fmtTime(rental.data_returnare) : '', 6)]),
    P([
      'Km la bord: ', val(returned ? rental.km_primire : '', 10),
      '   combustibil: ', val(returned ? fuelIn : '', 6), ' / 8',
      '   Zile facturabile: ', val(returned ? rental.zile_facturabile ?? rentalDays(rental.data_predare, rental.data_returnare) : '', 6),
    ]),
    P(['Observații / avarii la retur: ', returned && has(rental.observatii_primire) ? val(rental.observatii_primire) : blank(60)]),
    yesNo('Avarii noi:', returned ? Boolean(rental.avarii_noi) : null, returned && rental.avarii_noi ? '— detaliu: vezi observațiile' : `— detaliu: ${blank(36)}`),
    P(['Dotări lipsă: ', returned ? (has(rental.dotari_lipsa) ? val(rental.dotari_lipsa) : { text: 'nu', bold: true }) : blank(60)]),
    photoSet('Set foto retur:', photoCounts.primire || 0, returned && photosKnown),
    yesNo(`Curățare autovehicul (${FEES.curatare} lei + TVA):`, returned ? Boolean(rental.taxa_curatare) : null),
    yesNo(`Igienizare și dezodorizare (${FEES.igienizare} lei + TVA):`, returned ? Boolean(rental.taxa_igienizare) : null),
    yesNo(
      `Alimentare de către Locator (serviciu ${FEES.realimentare} lei + TVA, plus combustibil):`,
      returned ? Boolean(rental.realimentare) : null,
      returned && rental.realimentare && Number(rental.cost_combustibil) > 0 ? `— combustibil ${money(rental.cost_combustibil)} lei + TVA` : undefined
    ),
    twoColumns(
      signBlock('Locator (retur):', rental.semnatura_locator_retur, company.reprezentant, returnDate),
      signBlock('Locatar (predare înapoi):', rental.semnatura_locatar_retur, client.nume, returnDate)
    ),
    {
      text: 'Anexa 1 face parte integrantă din contract. Predarea și returul se semnează pe loc, la datele de mai sus.',
      fontSize: 7.5,
      italics: true,
      color: GRAY,
      margin: [0, 4, 0, 0],
    },
  ]

  return {
    pageSize: 'A4',
    pageMargins: [50, 44, 50, 44],
    info: { title: `Contract ${nr} - ${client.nume || ''}`, author: company.nume },
    defaultStyle: { font: 'Roboto', fontSize: 9.5, lineHeight: 1.15, color: TEXT },
    styles: {
      title: { fontSize: 14, bold: true, alignment: 'center', color: NAVY },
      h: { fontSize: 10.5, bold: true, color: NAVY, margin: [0, 8, 0, 3] },
      p: { margin: [0, 0, 0, 4], alignment: 'justify' },
    },
    footer: (page) => ({
      text: [`${company.nume}  ·  pag. `, { text: String(page), bold: true }],
      alignment: 'center',
      fontSize: 7,
      color: GRAY,
      margin: [0, 14, 0, 0],
    }),
    content,
  }
}


// ---------------------------------------------------------------------------------------------
// Proces-verbal de constatare la restituire — temeiul pentru facturarea serviciilor suplimentare
// (curățare, igienizare, alimentare + combustibil) prevăzute la art. 4 din contract.
// ---------------------------------------------------------------------------------------------
export function returnReportServices(rental) {
  const rows = []
  if (rental.taxa_curatare) rows.push({ name: SERVICE_NAMES.curatare + ' (interior și/sau exterior)', qty: '1', value: FEES.curatare })
  if (rental.taxa_igienizare) rows.push({ name: SERVICE_NAMES.igienizare + ' (miros persistent)', qty: '1', value: FEES.igienizare })
  if (rental.realimentare) {
    rows.push({ name: SERVICE_NAMES.realimentare, qty: '1', value: FEES.realimentare })
    const fuel = Number(rental.cost_combustibil) || 0
    rows.push({ name: SERVICE_NAMES.combustibil + ' (conform bonului fiscal)', qty: '—', value: fuel > 0 ? fuel : null })
  }
  return rows
}

export function buildReturnReportDefinition({ rental, company: companyIn, photoCounts = {} }) {
  const company = { ...DEFAULT_COMPANY, ...(companyIn || {}) }
  const client = rental.client || {}
  const vehicle = rental.vehicle || {}
  const id = splitIdCard(client.act_identitate)
  const nr = has(rental.numar_contract) ? String(rental.numar_contract).trim() : blank(6)
  const contractDate = rental.data_contract ? fmtDate(rental.data_contract) : ''
  const returnDate = rental.data_returnare ? fmtDateOnly(rental.data_returnare) : ''
  const returnTime = rental.data_returnare ? fmtTime(rental.data_returnare) : ''
  const fuelOut = fuelEighths(rental.combustibil_predare)
  const fuelIn = fuelEighths(rental.combustibil_primire)
  const services = returnReportServices(rental)
  const known = services.filter((r) => r.value !== null)
  const total = known.reduce((sum, r) => sum + r.value, 0)
  const fuelPending = services.some((r) => r.value === null)
  const photos = photoCounts.primire

  const cell = (text, extra = {}) => ({ text, ...extra })
  const tableLayout = {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => LINE,
    vLineColor: () => LINE,
    paddingTop: () => 2,
    paddingBottom: () => 2,
  }

  const findings = [
    [cell('Starea de curățenie', { bold: true }), cell(rental.taxa_curatare ? 'Autovehicul restituit murdar — necesită curățare' : 'Corespunzătoare')],
    [cell('Miros în habitaclu', { bold: true }), cell(rental.taxa_igienizare ? 'Miros persistent (fumat, animale etc.) — necesită igienizare' : 'Fără miros persistent')],
    [
      cell('Nivel combustibil', { bold: true }),
      cell([
        'la predare ', { text: fuelOut === null ? blank(3) : `${fuelOut}/8`, bold: true },
        ', la restituire ', { text: fuelIn === null ? blank(3) : `${fuelIn}/8`, bold: true },
        rental.realimentare ? ' — necesită alimentare' : '',
      ]),
    ],
    [cell('Km la bord', { bold: true }), cell(has(rental.km_primire) ? String(rental.km_primire) : blank(10))],
    [cell('Avarii noi', { bold: true }), cell(rental.avarii_noi ? 'Da — vezi observațiile' : 'Nu')],
    [cell('Dotări lipsă', { bold: true }), cell(has(rental.dotari_lipsa) ? rental.dotari_lipsa : 'Nu')],
    [cell('Observații', { bold: true }), cell(has(rental.observatii_primire) ? nb(rental.observatii_primire) : blank(40))],
    [cell('Fotografii la restituire', { bold: true }), cell(photos === undefined ? blank(4) : photos > 0 ? `${photos} ${photos === 1 ? 'fotografie păstrată' : 'fotografii păstrate'} de Locator` : 'nu s-au efectuat')],
  ]

  const serviceRows = services.length
    ? services.map((r, i) => [
        cell(String(i + 1)),
        cell(r.name),
        cell(r.qty, { alignment: 'center' }),
        cell(r.value === null ? blank(10) : `${money(r.value)} lei`, { alignment: 'right' }),
      ])
    : [[cell('—'), cell('Nu s-au constatat servicii suplimentare de facturat.', { italics: true }), cell(''), cell('')]]

  const content = [
    { text: company.nume, fontSize: 14, bold: true, color: NAVY, alignment: 'center' },
    { text: nb(company.adresa), alignment: 'center', fontSize: 8 },
    { text: `${company.reg_com} · CIF ${company.cif} · Tel. ${company.telefon}`, alignment: 'center', fontSize: 8 },
    { text: 'PROCES-VERBAL DE CONSTATARE', style: 'title', margin: [0, 10, 0, 0] },
    { text: 'la restituirea autovehiculului închiriat', alignment: 'center', bold: true, color: NAVY },
    {
      text: ['întocmit în baza art. 4 din Contractul de închiriere auto nr. ', { text: String(nr), bold: true }, ' / ', { text: contractDate || blank(14), bold: true }],
      alignment: 'center',
      margin: [0, 2, 0, 8],
    },

    P([
      'Încheiat astăzi, ', val(returnDate, 12), ', ora ', val(returnTime, 6), ', la ', val(rental.loc_predare || 'sediul Locatorului', 24),
      ', între:',
    ]),
    P(`Locator: ${company.denumire_contract}, CIF ${company.cif}, reprezentată de ${company.reprezentant}, în calitate de ${company.functie}, și`),
    P(['Locatar: ', val(client.nume, 30), ', CI seria ', val(id.seria, 4), ' nr. ', val(id.nr, 10), ', CNP ', val(client.cnp, 16), '.']),

    H('1. AUTOVEHICULUL'),
    P(['Marcă/model ', val(vehicle.nume_model, 16), ', nr. înmatriculare ', val(vehicle.inmatriculare, 10), ', VIN ', val(vehicle.vin, 20), '.']),
    P(['Predat Locatarului la data de ', val(fmtDateOnly(rental.data_predare), 12), ' și restituit Locatorului la data de ', val(returnDate, 12), '.']),

    H('2. CONSTATĂRI LA RESTITUIRE'),
    P('Părțile au verificat împreună autovehiculul și au constatat următoarele:'),
    { table: { widths: [120, '*'], body: findings }, layout: tableLayout, fontSize: 8.5, margin: [0, 0, 0, 4] },

    H('3. SERVICII SUPLIMENTARE DE FACTURAT'),
    P('Ca urmare a constatărilor de mai sus și conform art. 4 din contract, Locatorul efectuează și facturează Locatarului:'),
    {
      table: {
        headerRows: 1,
        widths: [22, '*', 50, 80],
        body: [
          [
            cell('Nr.', { bold: true, fillColor: FILL }),
            cell('Serviciu', { bold: true, fillColor: FILL }),
            cell('Cant.', { bold: true, fillColor: FILL, alignment: 'center' }),
            cell('Valoare fără TVA', { bold: true, fillColor: FILL, alignment: 'right' }),
          ],
          ...serviceRows,
          ...(services.length
            ? [[
                cell(''),
                cell('TOTAL fără TVA', { bold: true }),
                cell(''),
                cell(fuelPending ? `${money(total)} lei + combustibil` : `${money(total)} lei`, { bold: true, alignment: 'right' }),
              ]]
            : []),
        ],
      },
      layout: tableLayout,
      fontSize: 8.5,
      margin: [0, 0, 0, 3],
    },
    {
      text: 'La valorile de mai sus se adaugă TVA, conform legii. Suma se achită pe baza facturii emise de Locator și poate fi reținută din garanția constituită.',
      fontSize: 8.5,
      margin: [0, 0, 0, 6],
    },

    H('4. DECLARAȚII'),
    P(
      'Locatarul a luat cunoștință de constatările de mai sus și de fotografiile efectuate la restituire și ' +
        'acceptă facturarea serviciilor enumerate la punctul 3.'
    ),
    P(['Obiecțiunile Locatarului (dacă există): ', blank(60)]),
    line([box(false), 'Locatarul a refuzat semnarea prezentului proces-verbal (se completează de Locator).'], [0, 2, 0, 6]),
    P('Prezentul proces-verbal s-a încheiat în 2 exemplare, câte unul pentru fiecare parte, și face parte integrantă din contract.'),

    twoColumns(
      {
        stack: [
          { text: ['LOCATOR — ', { text: company.nume, bold: false }], bold: true },
          { text: ['Nume: ', { text: company.reprezentant, bold: true }], margin: [0, 2, 0, 0] },
          { text: ['Semnătură / ștampilă: ', blank(22)], margin: [0, 14, 0, 0] },
        ],
      },
      {
        stack: [
          { text: 'LOCATAR', bold: true },
          { text: ['Nume: ', val(client.nume, 28)], margin: [0, 2, 0, 0] },
          { text: ['Semnătură: ', blank(26)], margin: [0, 14, 0, 0] },
        ],
      },
      [0, 6, 0, 0]
    ),
  ]

  return {
    pageSize: 'A4',
    pageMargins: [48, 34, 48, 40],
    info: { title: `Proces-verbal constatare ${nr} - ${client.nume || ''}`, author: company.nume },
    defaultStyle: { font: 'Roboto', fontSize: 9, lineHeight: 1.1, color: TEXT },
    styles: {
      title: { fontSize: 14, bold: true, alignment: 'center', color: NAVY },
      h: { fontSize: 10.5, bold: true, color: NAVY, margin: [0, 6, 0, 3] },
      p: { margin: [0, 0, 0, 4], alignment: 'justify' },
    },
    footer: (page) => ({
      text: [`${company.nume}  ·  Proces-verbal de constatare  ·  pag. `, { text: String(page), bold: true }],
      alignment: 'center',
      fontSize: 7,
      color: GRAY,
      margin: [0, 14, 0, 0],
    }),
    content,
  }
}

let pdfMakePromise = null
function loadPdfMake() {
  // loaded only when a contract is generated, to keep the app fast
  pdfMakePromise ||= Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]).then(([pm, fonts]) => {
    const pdfMake = pm.default || pm
    pdfMake.vfs = fonts.default || fonts
    return pdfMake
  })
  return pdfMakePromise
}

export function contractPdfBlob(args) {
  return pdfBlob(buildContractDefinition(args))
}

export function returnReportPdfBlob(args) {
  return pdfBlob(buildReturnReportDefinition(args))
}

async function pdfBlob(definition) {
  const pdfMake = await loadPdfMake()
  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(definition).getBlob((blob) => resolve(blob))
    } catch (err) {
      reject(err)
    }
  })
}

export function contractLabel(rental) {
  return rental.numar_contract ? `nr. ${rental.numar_contract}` : 'fără număr'
}

// next number to suggest (only as a hint — the user types the real one)
export function suggestContractNumber(rentals) {
  const max = rentals.reduce((m, r) => {
    const n = parseInt(String(r.numar_contract || '').replace(/\D+/g, ''), 10)
    return isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return max ? String(max + 1) : ''
}

export function contractFileName(rental, prefix = 'Contract') {
  const name = (rental.client?.nume || 'client').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_')
  const nr = String(rental.numar_contract || '').replace(/[^\w-]+/g, '-')
  return `${prefix}_${nr ? `${nr}_` : ''}${name}.pdf`
}

// Opens a PDF. `win` is a tab opened synchronously on the click (avoids popup blockers on iPhone).
export function showPdf(blob, fileName, win) {
  const url = URL.createObjectURL(blob)
  if (win && !win.closed) {
    win.location.href = url
  } else {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// Share sheet on iPhone (WhatsApp, Mail…); falls back to download on computers
export async function sharePdf(blob, fileName) {
  const file = new File([blob], fileName, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }
  showPdf(blob, fileName)
  return 'downloaded'
}
