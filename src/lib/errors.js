// Turns technical errors into clear Romanian messages
export function friendlyError(err) {
  if (!err) return 'A apărut o eroare necunoscută.'
  const msg = String(err.message || err.error_description || err)
  const code = err.code || ''

  if (code === '23505') {
    if (msg.includes('inmatriculare')) return 'Există deja un vehicul cu acest număr de înmatriculare.'
    if (msg.includes('rentals_one_active')) return 'Acest vehicul are deja o închiriere activă.'
    return 'Înregistrarea există deja.'
  }
  if (code === '23503') return 'Nu se poate șterge: există închirieri asociate.'
  if (code === '22007' || code === '22008') return 'Una dintre date este invalidă.'
  if (code === '42501' || msg.includes('row-level security')) return 'Nu ai drepturi pentru această acțiune. Deconectează-te și intră din nou.'
  if ((code === 'PGRST204' || code === '42703') && /tip_client|reg_com|sediu|delegat/.test(msg)) {
    return 'Baza de date nu este actualizată pentru firme. Rulează SUPABASE_UPDATE_V7.sql în Supabase.'
  }
  if (code === 'PGRST204' || code === 'PGRST205' || code === '42P01' || code === '42703') {
    return 'Baza de date nu este actualizată. Rulează scriptul SUPABASE_SETUP_V2.sql în Supabase.'
  }
  if (msg.includes('Invalid login credentials')) return 'Email sau parolă greșită.'
  if (msg.includes('Email not confirmed')) return 'Contul nu este confirmat. Bifează „Auto Confirm User” când creezi utilizatorul în Supabase.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Nu există conexiune la internet.'
  if (msg.includes('Payload too large') || msg.includes('exceeded the maximum')) return 'Fișierul este prea mare (maxim 50 MB).'
  if (msg.toLowerCase().includes('bucket not found')) return 'Spațiul de stocare nu există. Rulează scriptul SUPABASE_SETUP_V2.sql în Supabase.'
  return msg
}
