import { daysUntil, daysLabel, fmtDate, fmtDateTime } from './format'
import { clientName } from './party'

export const DOCUMENTS = [
  { key: 'rca_expira', label: 'RCA', required: true },
  { key: 'itp_expira', label: 'ITP', required: true },
  { key: 'rovinieta_expira', label: 'Rovinietă', required: true },
  { key: 'casco_expira', label: 'CASCO', required: false },
]

// Notification thresholds, in days
export const WARNING_DAYS = 30
export const CRITICAL_DAYS = 7

// expired | critical (<=7 days) | warning (<=30 days) | ok | missing
export function docLevel(days) {
  if (days === null) return 'missing'
  if (days < 0) return 'expired'
  if (days <= CRITICAL_DAYS) return 'critical'
  if (days <= WARNING_DAYS) return 'warning'
  return 'ok'
}

export function vehicleDocs(vehicle) {
  return DOCUMENTS
    .filter((doc) => doc.required || vehicle[doc.key])
    .map((doc) => {
      const days = daysUntil(vehicle[doc.key])
      return { ...doc, date: vehicle[doc.key], days, level: docLevel(days) }
    })
}

const ORDER = { expired: 0, overdue: 0, critical: 1, warning: 2, missing: 3 }

export function computeAlerts(vehicles, rentals) {
  const alerts = []

  for (const vehicle of vehicles) {
    for (const doc of vehicleDocs(vehicle)) {
      if (doc.level === 'ok') continue
      alerts.push({
        id: `${vehicle.id}-${doc.key}`,
        kind: 'document',
        level: doc.level,
        vehicle,
        title: `${doc.label} · ${vehicle.nume_model} (${vehicle.inmatriculare})`,
        detail: doc.level === 'missing'
          ? `Data de expirare ${doc.label} nu este completată`
          : `${daysLabel(doc.days)} — ${fmtDate(doc.date)}`,
        days: doc.days ?? 9999,
      })
    }
  }

  const now = new Date()
  for (const rental of rentals) {
    if (rental.status !== 'activa') continue
    const due = new Date(rental.data_returnare_planificata)
    const hours = (due - now) / 3600000
    const name = rental.vehicle ? `${rental.vehicle.nume_model} (${rental.vehicle.inmatriculare})` : 'Vehicul'
    if (hours < 0) {
      alerts.push({
        id: `rental-${rental.id}`,
        kind: 'rental',
        level: 'overdue',
        rental,
        title: `Returnare întârziată · ${name}`,
        detail: `Trebuia returnată la ${fmtDateTime(rental.data_returnare_planificata)} — ${clientName(rental.client)}`,
        days: -1,
      })
    } else if (hours <= 24) {
      alerts.push({
        id: `rental-${rental.id}`,
        kind: 'rental',
        level: 'warning',
        rental,
        title: `Returnare în următoarele 24h · ${name}`,
        detail: `${fmtDateTime(rental.data_returnare_planificata)} — ${clientName(rental.client)}`,
        days: 0,
      })
    }
  }

  return alerts.sort((a, b) => (ORDER[a.level] - ORDER[b.level]) || (a.days - b.days))
}

export function urgentCount(alerts) {
  return alerts.filter((a) => a.level !== 'missing').length
}
