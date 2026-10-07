import { useEffect, useMemo, useState } from 'react'
import { Plus, KeyRound, Phone, CalendarClock, CheckCircle2, Eye } from 'lucide-react'
import { useData } from '../context/DataContext'
import { fmtDateTime, fmtMoney } from '../lib/format'
import { Button, Card, PageHeader, EmptyState, Tabs, Plate, SearchInput, Badge } from '../components/ui'
import { RentalStatus } from '../components/StatusBits'
import HandoverForm from '../components/HandoverForm'
import ReturnForm from '../components/ReturnForm'
import RentalDetail from '../components/RentalDetail'
import { ContractSign, contractStatus, handoverDone } from '../components/Contract'
import { contractLabel } from '../lib/contract'

export default function Rentals({ params }) {
  const { rentals, reload } = useData()
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [handover, setHandover] = useState(null) // { vehicleId }
  const [returning, setReturning] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [signing, setSigning] = useState(null) // { rental, etapa }

  useEffect(() => {
    if (params?.newForVehicle || params?.newRental) setHandover({ vehicleId: params.newForVehicle })
    if (params?.openRental) setDetailId(params.openRental)
    if (params?.returnRental) {
      const r = rentals.find((x) => x.id === params.returnRental)
      if (r) setReturning(r)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const active = rentals.filter((r) => r.status === 'activa')
  const history = rentals.filter((r) => r.status !== 'activa')

  const list = useMemo(() => {
    const source = tab === 'active' ? active : history
    const q = query.trim().toLowerCase()
    if (!q) return source
    return source.filter((r) =>
      [r.vehicle?.nume_model, r.vehicle?.inmatriculare, r.client?.nume, r.client?.telefon].some(
        (v) => v && v.toLowerCase().includes(q)
      )
    )
  }, [tab, active, history, query])

  const detail = rentals.find((r) => r.id === detailId)

  return (
    <>
      <PageHeader
        title="Închirieri"
        subtitle={`${active.length} active · ${history.length} în istoric`}
        actions={
          <Button variant="success" icon={Plus} onClick={() => setHandover({})}>
            Predare nouă
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'active', label: `Active (${active.length})` },
            { value: 'history', label: `Istoric (${history.length})` },
          ]}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Caută mașină sau client…" className="sm:w-72" />
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={tab === 'active' ? 'Nicio mașină în chirie' : 'Istoric gol'}
          description={tab === 'active' ? 'Apasă „Predare nouă” când dai o mașină unui client.' : 'Închirierile finalizate apar aici.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{r.vehicle?.nume_model}</div>
                  <div className="mt-1.5">
                    <Plate>{r.vehicle?.inmatriculare}</Plate>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <RentalStatus rental={r} />
                  {r.status !== 'anulata' && (
                    <Badge tone={contractStatus(r).tone}>
                      Contract {contractLabel(r)} · {contractStatus(r).label}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">{r.client?.nume}</span>
                  {r.client?.telefon && (
                    <a href={`tel:${r.client.telefon}`} className="inline-flex items-center gap-1 text-blue-600">
                      <Phone className="h-3.5 w-3.5" /> {r.client.telefon}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {fmtDateTime(r.data_predare)} → {fmtDateTime(r.data_returnare || r.data_returnare_planificata)}
                </div>
                {r.status === 'finalizata' && (
                  <div className="text-slate-500">
                    Total: <b className="text-slate-900">{fmtMoney(r.total_final)}</b>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="secondary" icon={Eye} onClick={() => setDetailId(r.id)} className="flex-1">
                  Detalii și poze
                </Button>
                {r.status === 'activa' && (
                  <Button size="sm" icon={CheckCircle2} onClick={() => setReturning(r)} className="flex-1">
                    Primire
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {handover && (
        <HandoverForm
          initialVehicleId={handover.vehicleId}
          onClose={() => setHandover(null)}
          onDone={async (rental) => {
            setHandover(null)
            await reload()
            setTab('active')
            setDetailId(rental.id)
            setSigning({ rental, etapa: 'predare' })
          }}
        />
      )}

      {returning && (
        <ReturnForm
          rental={returning}
          onClose={() => setReturning(null)}
          onDone={async (updated) => {
            const id = returning.id
            setReturning(null)
            setDetailId(null)
            await reload()
            setTab('history')
            setDetailId(id)
            if (updated && handoverDone(updated)) setSigning({ rental: updated, etapa: 'retur' })
          }}
        />
      )}

      {detail && !returning && !signing && (
        <RentalDetail
          rental={detail}
          onClose={() => setDetailId(null)}
          onReturn={() => setReturning(detail)}
          onSign={(etapa) => setSigning({ rental: detail, etapa })}
          onRefresh={reload}
          onChanged={async () => {
            setDetailId(null)
            await reload()
          }}
        />
      )}
      {signing && (
        <ContractSign
          rental={signing.rental}
          etapa={signing.etapa}
          onClose={() => setSigning(null)}
          onSigned={() => reload()}
        />
      )}
    </>
  )
}
