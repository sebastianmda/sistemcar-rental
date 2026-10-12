import { useCallback, useEffect, useState } from 'react'
import { Phone, Mail, Ban, CheckCircle2 } from 'lucide-react'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { fmtDateTime, fmtKm, fmtMoney, rentalDays } from '../lib/format'
import { useToast } from './Toast'
import { Modal, Button, Card, InfoRow, Plate, Spinner, ErrorText } from './ui'
import { RentalStatus, LicenseWarning } from './StatusBits'
import { MediaGallery } from './Media'
import { ContractCard } from './Contract'
import { contractLabel } from '../lib/contract'
import { fuelLabel, FEES } from '../lib/rentalTerms'
import { clientName, contractPerson, isCompany } from '../lib/party'

export default function RentalDetail({ rental, onClose, onReturn, onChanged, onSign, onRefresh }) {
  const toast = useToast()
  const [media, setMedia] = useState(null)
  const [mediaError, setMediaError] = useState(null)

  const loadMedia = useCallback(async () => {
    try {
      setMedia(await api.listMedia(rental.id))
      setMediaError(null)
    } catch (err) {
      setMediaError(friendlyError(err))
      setMedia([])
    }
  }, [rental.id])

  useEffect(() => {
    loadMedia()
  }, [loadMedia])

  const cancel = async () => {
    if (!confirm('Anulezi această închiriere? Mașina redevine disponibilă.')) return
    try {
      await api.cancelRental(rental)
      toast('Închiriere anulată')
      onChanged()
    } catch (err) {
      toast(friendlyError(err), 'error')
    }
  }

  const active = rental.status === 'activa'
  const days = rentalDays(rental.data_predare, rental.data_returnare || rental.data_returnare_planificata)
  const byStage = (etapa) => (media || []).filter((m) => m.etapa === etapa)

  return (
    <Modal
      open
      onClose={onClose}
      title={`${rental.vehicle?.nume_model ?? 'Vehicul'}`}
      subtitle={`Contract ${contractLabel(rental)} · din ${fmtDateTime(rental.data_predare)}`}
      size="xl"
      footer={
        active ? (
          <>
            <Button variant="dangerGhost" icon={Ban} onClick={cancel}>
              Anulează închirierea
            </Button>
            <Button icon={CheckCircle2} onClick={onReturn}>
              Primire mașină
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Închide
          </Button>
        )
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Plate>{rental.vehicle?.inmatriculare}</Plate>
          <RentalStatus rental={rental} />
          <LicenseWarning client={rental.client} />
        </div>

        {rental.status !== 'anulata' && <ContractCard rental={rental} onSign={onSign} onChanged={onRefresh} />}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-500">Client</h4>
            <div className="font-semibold text-slate-900">{clientName(rental.client)}</div>
            {isCompany(rental.client) && (
              <div className="text-sm text-slate-600">
                CUI {rental.client.cui || '—'}
                {contractPerson(rental).nume ? ` · delegat: ${contractPerson(rental).nume}` : ''}
              </div>
            )}
            {rental.client?.telefon && (
              <a href={`tel:${rental.client.telefon}`} className="mt-1 flex items-center gap-1.5 text-sm text-blue-600">
                <Phone className="h-3.5 w-3.5" /> {rental.client.telefon}
              </a>
            )}
            {rental.client?.email && (
              <a href={`mailto:${rental.client.email}`} className="mt-1 flex items-center gap-1.5 text-sm text-blue-600">
                <Mail className="h-3.5 w-3.5" /> {rental.client.email}
              </a>
            )}
          </Card>
          <Card className="px-4 py-3">
            <h4 className="mb-1 text-sm font-semibold text-slate-500">Predare</h4>
            <InfoRow label="Data">{fmtDateTime(rental.data_predare)}</InfoRow>
            <InfoRow label="Km">{fmtKm(rental.km_predare)}</InfoRow>
            <InfoRow label="Combustibil">{fuelLabel(rental.combustibil_predare)}</InfoRow>
            <InfoRow label="Retur planificat">{fmtDateTime(rental.data_returnare_planificata)}</InfoRow>
          </Card>
          <Card className="px-4 py-3">
            <h4 className="mb-1 text-sm font-semibold text-slate-500">Primire</h4>
            <InfoRow label="Data">{fmtDateTime(rental.data_returnare)}</InfoRow>
            <InfoRow label="Km">{fmtKm(rental.km_primire)}</InfoRow>
            <InfoRow label="Combustibil">{rental.combustibil_primire ? fuelLabel(rental.combustibil_primire) : '—'}</InfoRow>
            <InfoRow label="Parcurși">
              {rental.km_primire !== null && rental.km_predare !== null ? fmtKm(rental.km_primire - rental.km_predare) : '—'}
            </InfoRow>
          </Card>
        </div>

        <Card className="px-4 py-3">
          <InfoRow label="Tarif zilnic">{fmtMoney(rental.tarif_zilnic)}</InfoRow>
          <InfoRow label={active ? 'Zile (planificat)' : 'Zile facturabile'}>{rental.zile_facturabile ?? days}</InfoRow>
          <InfoRow label="Garanție">{fmtMoney(rental.garantie)}</InfoRow>
          {rental.taxa_curatare && <InfoRow label="Curățenie">{fmtMoney(FEES.curatare)}</InfoRow>}
          {rental.taxa_igienizare && <InfoRow label="Igienizare">{fmtMoney(FEES.igienizare)}</InfoRow>}
          {rental.realimentare && (
            <InfoRow label="Alimentare de către Locator">{fmtMoney(FEES.realimentare + Number(rental.cost_combustibil || 0))}</InfoRow>
          )}
          {rental.dotari_lipsa && <InfoRow label="Dotări lipsă">{rental.dotari_lipsa}</InfoRow>}
          <InfoRow label={active ? 'Total estimat (fără TVA)' : 'Total (fără TVA)'}>
            <span className="text-base">{fmtMoney(active ? days * rental.tarif_zilnic : rental.total_final)}</span>
          </InfoRow>
        </Card>

        {(rental.observatii_predare || rental.observatii_primire) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {rental.observatii_predare && (
              <Card className="p-4 text-sm">
                <div className="mb-1 font-semibold text-slate-500">Observații la predare</div>
                <p className="whitespace-pre-wrap text-slate-800">{rental.observatii_predare}</p>
              </Card>
            )}
            {rental.observatii_primire && (
              <Card className="p-4 text-sm">
                <div className="mb-1 font-semibold text-slate-500">Observații la primire</div>
                <p className="whitespace-pre-wrap text-slate-800">{rental.observatii_primire}</p>
              </Card>
            )}
          </div>
        )}

        <ErrorText>{mediaError}</ErrorText>
        {media === null ? (
          <Spinner label="Se încarcă pozele…" />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Poze la predare ({byStage('predare').length})</h4>
              <MediaGallery rentalId={rental.id} etapa="predare" items={byStage('predare')} onChanged={loadMedia} />
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Poze la primire ({byStage('primire').length})</h4>
              {rental.status === 'activa' ? (
                <p className="text-sm text-slate-500">Se adaugă la primirea mașinii.</p>
              ) : (
                <MediaGallery rentalId={rental.id} etapa="primire" items={byStage('primire')} onChanged={loadMedia} />
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
