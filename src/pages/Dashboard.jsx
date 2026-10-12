import { useMemo } from 'react'
import { Car, CheckCircle2, KeyRound, Wrench, Wallet, Bell, ShieldX, ShieldAlert, Clock, ShieldQuestion, Plus, ChevronRight } from 'lucide-react'
import { useData } from '../context/DataContext'
import { fmtMoney, fmtDateTime, fmtDateOnly } from '../lib/format'
import { Button, Card, PageHeader, Plate, cx } from '../components/ui'
import { RentalStatus } from '../components/StatusBits'
import { clientName } from '../lib/party'

const LEVEL_STYLE = {
  expired: { icon: ShieldX, box: 'bg-red-50 text-red-600', label: 'Expirat', pill: 'bg-red-600 text-white' },
  overdue: { icon: Clock, box: 'bg-red-50 text-red-600', label: 'Întârziere', pill: 'bg-red-600 text-white' },
  critical: { icon: ShieldAlert, box: 'bg-orange-50 text-orange-600', label: '≤ 7 zile', pill: 'bg-orange-500 text-white' },
  warning: { icon: ShieldAlert, box: 'bg-amber-50 text-amber-600', label: '≤ 30 zile', pill: 'bg-amber-400 text-amber-950' },
  missing: { icon: ShieldQuestion, box: 'bg-slate-100 text-slate-500', label: 'Lipsă', pill: 'bg-slate-200 text-slate-700' },
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cx('rounded-lg p-2', tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-bold text-slate-900">{value}</div>
          <div className="truncate text-xs text-slate-500">{label}</div>
        </div>
      </div>
    </Card>
  )
}

export default function Dashboard({ navigate }) {
  const { vehicles, rentals, alerts, urgent } = useData()

  const active = rentals.filter((r) => r.status === 'activa')
  const monthIncome = useMemo(() => {
    const now = new Date()
    return rentals
      .filter((r) => r.status === 'finalizata' && r.data_returnare)
      .filter((r) => {
        const d = new Date(r.data_returnare)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((sum, r) => sum + Number(r.total_final || 0), 0)
  }, [rentals])

  const now = new Date()
  const weekday = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'][now.getDay()]
  const today = `${weekday}, ${fmtDateOnly(now)}`

  return (
    <>
      <PageHeader
        title="Panou de control"
        subtitle={today}
        actions={
          <Button variant="success" icon={Plus} onClick={() => navigate('rentals', { newRental: true })}>
            Predare nouă
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={Car} label="Vehicule în flotă" value={vehicles.length} tone="bg-slate-100 text-slate-700" />
        <Stat icon={CheckCircle2} label="Disponibile" value={vehicles.filter((v) => v.status === 'Disponibil').length} tone="bg-emerald-50 text-emerald-600" />
        <Stat icon={KeyRound} label="În chirie" value={vehicles.filter((v) => v.status === 'În chirie').length} tone="bg-blue-50 text-blue-600" />
        <Stat icon={Wrench} label="În service" value={vehicles.filter((v) => v.status === 'Service').length} tone="bg-amber-50 text-amber-600" />
        <div className="col-span-2 lg:col-span-1">
          <Stat icon={Wallet} label="Încasări luna aceasta" value={fmtMoney(monthIncome)} tone="bg-violet-50 text-violet-600" />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Alerte</h2>
            {urgent > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">{urgent}</span>}
          </div>
          {alerts.length === 0 ? (
            <Card className="flex items-center gap-3 p-5 text-sm text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Toate documentele sunt valabile peste 30 de zile.
            </Card>
          ) : (
            <Card className="divide-y divide-slate-100">
              {alerts.map((a) => {
                const s = LEVEL_STYLE[a.level]
                const Icon = s.icon
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => (a.kind === 'rental' ? navigate('rentals', { openRental: a.rental.id }) : navigate('fleet'))}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className={cx('rounded-lg p-2', s.box)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{a.title}</div>
                      <div className="truncate text-xs text-slate-500">{a.detail}</div>
                    </div>
                    <span className={cx('hidden whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold sm:inline', s.pill)}>
                      {s.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </button>
                )
              })}
            </Card>
          )}
        </section>

        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">În chirie acum</h2>
            <button type="button" onClick={() => navigate('rentals')} className="text-sm font-medium text-blue-600">
              Vezi toate
            </button>
          </div>
          {active.length === 0 ? (
            <Card className="p-5 text-sm text-slate-500">Nicio mașină în chirie.</Card>
          ) : (
            <Card className="divide-y divide-slate-100">
              {active.slice(0, 8).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate('rentals', { openRental: r.id })}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Plate>{r.vehicle?.inmatriculare}</Plate>
                      <span className="truncate text-sm font-medium text-slate-900">{clientName(r.client)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Retur: {fmtDateTime(r.data_returnare_planificata)}</div>
                  </div>
                  <RentalStatus rental={r} />
                </button>
              ))}
            </Card>
          )}
        </section>
      </div>
    </>
  )
}
