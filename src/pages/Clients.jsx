import { useMemo, useState } from 'react'
import { Plus, Users, Phone, Mail, Pencil, Trash2, Save } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../components/Toast'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { fmtDate, daysUntil, plural } from '../lib/format'
import { Button, Card, PageHeader, SearchInput, EmptyState, Modal, ErrorText, Badge } from '../components/ui'
import ClientFields, { clientToForm, validateClient } from '../components/ClientFields'
import { clientName, isCompany } from '../lib/party'

function ClientForm({ client, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(() => clientToForm(client))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = async () => {
    const problem = validateClient(form)
    if (problem) return setError(problem)
    setSaving(true)
    setError(null)
    try {
      if (client) await api.updateClient(client.id, form)
      else await api.createClient(form)
      toast(client ? 'Client actualizat' : 'Client adăugat')
      onSaved()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={client ? 'Editează client' : 'Client nou'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anulează
          </Button>
          <Button icon={Save} loading={saving} onClick={submit}>
            Salvează
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ClientFields form={form} setForm={setForm} />
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}

export default function Clients() {
  const { clients, rentals, reload } = useData()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)

  const rentalCount = useMemo(() => {
    const map = {}
    for (const r of rentals) if (r.status !== 'anulata') map[r.client_id] = (map[r.client_id] || 0) + 1
    return map
  }, [rentals])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) =>
      [c.nume, c.telefon, c.email, c.firma, c.cui, c.cnp].some((v) => v && String(v).toLowerCase().includes(q))
    )
  }, [clients, query])

  const remove = async (c) => {
    if (rentals.some((r) => r.client_id === c.id)) {
      toast('Clientul are închirieri în istoric și nu poate fi șters.', 'error')
      return
    }
    if (!confirm(`Ștergi clientul ${clientName(c)}?`)) return
    try {
      await api.deleteClient(c.id)
      toast('Client șters')
      reload()
    } catch (err) {
      toast(friendlyError(err), 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Clienți"
        subtitle={plural(clients.length, 'client', 'clienți')}
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Client nou
          </Button>
        }
      />
      <SearchInput value={query} onChange={setQuery} placeholder="Caută după nume, telefon, firmă…" className="mb-5 sm:w-96" />

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Niciun client"
          description="Clienții se adaugă automat la predarea unei mașini, sau îi poți adăuga de aici."
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {visible.map((c) => {
            const licenseDays = daysUntil(c.permis_expira)
            return (
              <div key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{clientName(c)}</span>
                    {isCompany(c) ? (
                      <>
                        <Badge tone="blue">Firmă{c.cui ? ` · CUI ${c.cui}` : ''}</Badge>
                        {c.nume && c.nume !== c.firma && <span className="text-sm text-slate-500">delegat: {c.nume}</span>}
                      </>
                    ) : (
                      c.firma && <Badge tone="blue">{c.firma}</Badge>
                    )}
                    {licenseDays !== null && licenseDays < 0 && <Badge tone="red">Permis expirat</Badge>}
                    {licenseDays !== null && licenseDays >= 0 && licenseDays <= 30 && (
                      <Badge tone="amber">Permis expiră {fmtDate(c.permis_expira)}</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    {c.telefon && (
                      <a href={`tel:${c.telefon}`} className="inline-flex items-center gap-1 hover:text-blue-600">
                        <Phone className="h-3.5 w-3.5" /> {c.telefon}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-blue-600">
                        <Mail className="h-3.5 w-3.5" /> {c.email}
                      </a>
                    )}
                    <span>{plural(rentalCount[c.id] || 0, 'închiriere', 'închirieri')}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(c)}>
                    Editează
                  </Button>
                  <Button size="sm" variant="dangerGhost" icon={Trash2} onClick={() => remove(c)} aria-label="Șterge" />
                </div>
              </div>
            )
          })}
          {visible.length === 0 && <div className="p-6 text-center text-sm text-slate-500">Niciun rezultat</div>}
        </Card>
      )}

      {editing && (
        <ClientForm
          client={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </>
  )
}
