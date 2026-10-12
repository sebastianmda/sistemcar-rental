// Locatarul poate fi persoană fizică (PF) sau persoană juridică (PJ, o firmă).
// La PJ, mașina se predă unui delegat; datele lui se păstrează pe fiecare închiriere (delegat_*).

export const isCompany = (client) => client?.tip_client === 'PJ'

// numele afișat peste tot în aplicație: firma pentru PJ, numele persoanei pentru PF
export function clientName(client) {
  if (!client) return ''
  return isCompany(client) && client.firma ? client.firma : client.nume || ''
}

// delegatul implicit salvat la firmă (în coloanele de persoană ale clientului)
export function defaultDelegate(client) {
  const sameAsCompany = client && client.nume && client.firma && client.nume.trim() === client.firma.trim()
  return {
    delegat_nume: sameAsCompany ? '' : client?.nume || '',
    delegat_cnp: client?.cnp || '',
    delegat_act: client?.act_identitate || '',
    delegat_telefon: client?.telefon || '',
    delegat_permis_numar: client?.permis_numar || '',
    delegat_permis_categorie: client?.permis_categorie || 'B',
    delegat_permis_expira: client?.permis_expira ? String(client.permis_expira).slice(0, 10) : '',
    delegatie: '',
  }
}

export const EMPTY_DELEGATE = defaultDelegate(null)

// persoana fizică ce semnează și conduce: clientul (PF) sau delegatul firmei (PJ)
export function contractPerson(rental) {
  const client = rental?.client || {}
  if (!isCompany(client)) {
    return {
      nume: client.nume,
      cnp: client.cnp,
      act: client.act_identitate,
      telefon: client.telefon,
      email: client.email,
      adresa: client.adresa,
      permis_numar: client.permis_numar,
      permis_categorie: client.permis_categorie,
      permis_expira: client.permis_expira,
    }
  }
  const d = rental.delegat_nume ? rental : null
  const fallback = defaultDelegate(client)
  return {
    nume: d ? rental.delegat_nume : fallback.delegat_nume,
    cnp: d ? rental.delegat_cnp : fallback.delegat_cnp,
    act: d ? rental.delegat_act : fallback.delegat_act,
    telefon: d ? rental.delegat_telefon : fallback.delegat_telefon,
    email: client.email,
    adresa: null,
    permis_numar: d ? rental.delegat_permis_numar : fallback.delegat_permis_numar,
    permis_categorie: d ? rental.delegat_permis_categorie : fallback.delegat_permis_categorie,
    permis_expira: d ? rental.delegat_permis_expira : fallback.delegat_permis_expira,
    delegatie: rental.delegatie,
  }
}
