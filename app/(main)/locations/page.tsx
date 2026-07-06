'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, X, Search, Calendar, CheckCircle, AlertTriangle,
  ArrowRight, RotateCcw, Clock, Shirt, Euro, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  getRentals, createRental, updateRentalStatus, checkRentalAvailability,
  getRentableProducts, getBrands, getCustomers, optimizeImageUrl,
} from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import { Button, Input, Spinner, ConfirmDialog, cn } from '@/components/ui'

// ─── Types ────────────────────────────────────────────────────
type RentalStatus = 'reserved' | 'ongoing' | 'returned' | 'cancelled'

type Rental = {
  id: string
  product_id: string
  brand_id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  date_from: string
  date_to: string
  returned_at: string | null
  rental_price: number
  deposit: number
  deposit_method: string
  deposit_returned: boolean
  late_fee: number
  damage_fee: number
  status: RentalStatus
  note: string | null
  condition_out: string | null
  condition_in: string | null
  created_at: string
  product?: { id: string; name: string; reference: string; image_url?: string | null } | null
  brand?:   { id: string; name: string } | null
  seller?:  { name: string } | null
}

// ─── Config ───────────────────────────────────────────────────
const STATUS_CFG: Record<RentalStatus, { label: string; color: string; bg: string; icon: string }> = {
  reserved:  { label: 'Réservée',  color: '#D97706', bg: '#FFFBEB', icon: '📅' },
  ongoing:   { label: 'En cours',  color: '#2563EB', bg: '#EFF6FF', icon: '👗' },
  returned:  { label: 'Retournée', color: '#059669', bg: '#ECFDF5', icon: '✅' },
  cancelled: { label: 'Annulée',   color: '#9CA3AF', bg: '#F9FAFB', icon: '✕' },
}

const DEPOSIT_METHODS = [
  { id: 'card',    label: '💳 Carte' },
  { id: 'cash',    label: '💵 Espèces' },
  { id: 'check',   label: '📝 Chèque' },
  { id: 'imprint', label: '🔒 Empreinte CB' },
]

// ─── Date helpers ─────────────────────────────────────────────
function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function parseLocal(s: string): Date {
  const [y,m,d] = s.split('-').map(Number)
  return new Date(y, m-1, d)
}
function fmtDate(s: string): string {
  return parseLocal(s).toLocaleDateString('fr-FR', { day:'numeric', month:'short' })
}
function fmtDateLong(s: string): string {
  return parseLocal(s).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'long' })
}
function diffDays(from: string, to: string): number {
  return Math.max(1, Math.round((parseLocal(to).getTime() - parseLocal(from).getTime()) / 86400000))
}
function isLate(r: Rental): boolean {
  if (r.status !== 'ongoing') return false
  return toLocalStr(new Date()) > r.date_to
}
function daysLate(r: Rental): number {
  if (!isLate(r)) return 0
  return Math.round((Date.now() - parseLocal(r.date_to).getTime()) / 86400000)
}

// ─── Rental card ──────────────────────────────────────────────
function RentalCard({ rental, onStart, onReturn, onCancel }: {
  rental: Rental
  onStart: () => void
  onReturn: () => void
  onCancel: () => void
}) {
  const [open, setOpen]           = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const late   = isLate(rental)
  const status = late
    ? { label: `En retard +${daysLate(rental)}j`, color: '#DC2626', bg: '#FEF2F2', icon: '⚠️' }
    : STATUS_CFG[rental.status]
  const days   = diffDays(rental.date_from, rental.date_to)
  const img    = optimizeImageUrl(rental.product?.image_url ?? null, 80)

  return (
    <div className={cn('border rounded-2xl overflow-hidden bg-white transition-all',
      late ? 'border-red-300 shadow-red-50 shadow-lg' : 'border-gray-100')}>
      <button onClick={() => setOpen(!open)} className="w-full text-left">
        <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
          {/* Photo */}
          <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center relative">
            {img
              ? <img src={img} alt="" className="w-full h-full object-cover"/>
              : <Shirt size={18} className="text-gray-300"/>}
          </div>
          {/* Infos */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900 truncate">{rental.product?.name ?? 'Robe'}</p>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ color: status.color, background: status.bg }}>
                {status.icon} {status.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {rental.customer_name} · {fmtDate(rental.date_from)} → {fmtDate(rental.date_to)} · {days}j
            </p>
          </div>
          {/* Price */}
          <div className="text-right shrink-0">
            <p className="text-sm font-black text-gray-900">{rental.rental_price.toFixed(0)} €</p>
            <p className="text-[10px] text-gray-400">caution {rental.deposit.toFixed(0)} €</p>
          </div>
          {open ? <ChevronUp size={14} className="text-gray-400 shrink-0"/> : <ChevronDown size={14} className="text-gray-400 shrink-0"/>}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white rounded-xl px-3 py-2 border border-gray-100">
              <p className="text-gray-400">Sortie</p>
              <p className="font-bold text-gray-900">{fmtDateLong(rental.date_from)}</p>
            </div>
            <div className="bg-white rounded-xl px-3 py-2 border border-gray-100">
              <p className="text-gray-400">Retour prévu</p>
              <p className={cn('font-bold', late ? 'text-red-600' : 'text-gray-900')}>{fmtDateLong(rental.date_to)}</p>
            </div>
            <div className="bg-white rounded-xl px-3 py-2 border border-gray-100">
              <p className="text-gray-400">Caution ({DEPOSIT_METHODS.find(m => m.id === rental.deposit_method)?.label ?? rental.deposit_method})</p>
              <p className="font-bold text-gray-900">
                {rental.deposit.toFixed(2)} €
                {rental.status === 'returned' && (
                  <span className={cn('ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                    rental.deposit_returned ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                    {rental.deposit_returned ? 'Rendue' : 'Non rendue'}
                  </span>
                )}
              </p>
            </div>
            <div className="bg-white rounded-xl px-3 py-2 border border-gray-100">
              <p className="text-gray-400">Marque</p>
              <p className="font-bold text-gray-900">{rental.brand?.name ?? '—'}</p>
            </div>
          </div>

          {/* Fees if any */}
          {(rental.late_fee > 0 || rental.damage_fee > 0) && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs space-y-1">
              {rental.late_fee > 0   && <p className="text-red-700 font-semibold">Pénalité retard : +{rental.late_fee.toFixed(2)} €</p>}
              {rental.damage_fee > 0 && <p className="text-red-700 font-semibold">Retenue dommage : +{rental.damage_fee.toFixed(2)} €</p>}
            </div>
          )}

          {/* Conditions */}
          {(rental.condition_out || rental.condition_in) && (
            <div className="text-xs space-y-1">
              {rental.condition_out && <p className="text-gray-500"><strong>État sortie :</strong> {rental.condition_out}</p>}
              {rental.condition_in  && <p className="text-gray-500"><strong>État retour :</strong> {rental.condition_in}</p>}
            </div>
          )}

          {rental.note && <p className="text-xs text-gray-500 italic">"{rental.note}"</p>}
          {rental.customer_phone && <p className="text-xs text-gray-400">📞 {rental.customer_phone}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {rental.status === 'reserved' && (
              <>
                <Button size="sm" onClick={onStart} className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700">
                  <ArrowRight size={12}/> Départ location
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmCancel(true)}
                  className="text-gray-500">Annuler</Button>
              </>
            )}
            {rental.status === 'ongoing' && (
              <Button size="sm" onClick={onReturn} className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700">
                <RotateCcw size={12}/> Enregistrer le retour
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => { setConfirmCancel(false); onCancel() }}
        title="Annuler cette location ?"
        description={`La réservation de ${rental.customer_name} sera annulée.`}
        confirmLabel="Annuler la location"
        variant="danger"
      />
    </div>
  )
}

// ─── Return modal ─────────────────────────────────────────────
function ReturnModal({ rental, onDone, onClose }: {
  rental: Rental
  onDone: () => void
  onClose: () => void
}) {
  const late = isLate(rental)
  const [lateFee, setLateFee]       = useState(late ? String(daysLate(rental) * 10) : '0')
  const [damageFee, setDamageFee]   = useState('0')
  const [conditionIn, setConditionIn] = useState('')
  const [depositReturned, setDepositReturned] = useState(true)
  const [saving, setSaving]         = useState(false)

  const handleReturn = async () => {
    setSaving(true)
    try {
      await updateRentalStatus(rental.id, 'returned', {
        returned_at:      new Date().toISOString(),
        late_fee:         Number(lateFee)   || 0,
        damage_fee:       Number(damageFee) || 0,
        condition_in:     conditionIn.trim() || null,
        deposit_returned: depositReturned,
      })
      onDone()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-900">Retour — {rental.product?.name}</p>
            <p className="text-xs text-gray-400">{rental.customer_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18}/></button>
        </div>

        <div className="p-5 space-y-4">
          {late && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500 shrink-0"/>
              <p className="text-sm text-red-700 font-semibold">
                Retour en retard de {daysLate(rental)} jour{daysLate(rental) > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Fees */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Pénalité retard (€)</label>
              <Input type="number" min="0" step="0.01" value={lateFee} onChange={e => setLateFee(e.target.value)}/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Retenue dommage (€)</label>
              <Input type="number" min="0" step="0.01" value={damageFee} onChange={e => setDamageFee(e.target.value)}/>
            </div>
          </div>

          {/* Condition */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">État au retour</label>
            <textarea rows={2} value={conditionIn} onChange={e => setConditionIn(e.target.value)}
              placeholder="Ex: Parfait état / tache sur l'ourlet…"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
          </div>

          {/* Deposit return */}
          <button onClick={() => setDepositReturned(v => !v)}
            className={cn('w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all',
              depositReturned ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50')}>
            <span className="text-sm font-semibold text-gray-800">
              Caution {rental.deposit.toFixed(2)} € {depositReturned ? 'rendue au client' : 'conservée'}
            </span>
            <span className={cn('w-10 h-6 rounded-full relative transition-all',
              depositReturned ? 'bg-green-500' : 'bg-amber-400')}>
              <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all',
                depositReturned ? 'left-[18px]' : 'left-0.5')}/>
            </span>
          </button>

          {/* Summary */}
          {(Number(lateFee) > 0 || Number(damageFee) > 0) && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between text-gray-500">
                <span>Location</span><span>{rental.rental_price.toFixed(2)} €</span>
              </div>
              {Number(lateFee) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Pénalité retard</span><span>+{Number(lateFee).toFixed(2)} €</span>
                </div>
              )}
              {Number(damageFee) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Dommage</span><span>+{Number(damageFee).toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between font-black text-gray-900 pt-1 border-t border-gray-200">
                <span>Total</span>
                <span>{(rental.rental_price + Number(lateFee) + Number(damageFee)).toFixed(2)} €</span>
              </div>
            </div>
          )}

          <Button onClick={handleReturn} disabled={saving} className="w-full gap-2 bg-green-600 hover:bg-green-700" size="lg">
            {saving ? <Spinner size="sm"/> : <><CheckCircle size={15}/> Confirmer le retour</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── New rental form ──────────────────────────────────────────
function NewRentalForm({ onSave, onCancel, sellerId }: {
  onSave: () => void
  onCancel: () => void
  sellerId: string | null
}) {
  const [products, setProducts]   = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [productId, setProductId] = useState('')
  const [custSearch, setCustSearch] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerName, setCustomerName]   = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const today = toLocalStr(new Date())
  const [dateFrom, setDateFrom]   = useState(today)
  const [dateTo, setDateTo]       = useState(today)
  const [price, setPrice]         = useState('')
  const [deposit, setDeposit]     = useState('')
  const [depositMethod, setDepositMethod] = useState('card')
  const [conditionOut, setConditionOut]   = useState('')
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [availability, setAvailability]   = useState<{ available: boolean; conflicts: any[] } | null>(null)

  useEffect(() => {
    getRentableProducts().then(d => setProducts(d as any[]))
    getCustomers().then(d => setCustomers((d as any[]) || []))
  }, [])

  const product = products.find(p => p.id === productId)
  const days    = dateFrom && dateTo ? diffDays(dateFrom, dateTo) : 0

  // Auto-fill price/deposit from product settings
  useEffect(() => {
    if (product) {
      if (product.rental_price_day != null && days > 0) setPrice(String(product.rental_price_day * days))
      if (product.rental_deposit != null) setDeposit(String(product.rental_deposit))
    }
  }, [productId, days]) // eslint-disable-line

  // Check availability live
  useEffect(() => {
    if (productId && dateFrom && dateTo && dateTo >= dateFrom) {
      checkRentalAvailability(productId, dateFrom, dateTo)
        .then(setAvailability)
        .catch(() => setAvailability(null))
    } else setAvailability(null)
  }, [productId, dateFrom, dateTo])

  const filteredCustomers = custSearch.trim()
    ? customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase())).slice(0, 5)
    : []

  const handleSave = async () => {
    if (!productId)            return setError('Sélectionnez une robe')
    if (!customerName.trim())  return setError('Renseignez le nom du client')
    if (!dateFrom || !dateTo || dateTo < dateFrom) return setError('Vérifiez les dates')
    if (!price || Number(price) <= 0) return setError('Renseignez le prix')

    setSaving(true); setError('')
    try {
      await createRental({
        product_id:     productId,
        brand_id:       product.brand_id,
        customer_id:    customerId,
        customer_name:  customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        seller_id:      sellerId,
        date_from:      dateFrom,
        date_to:        dateTo,
        rental_price:   Number(price),
        deposit:        Number(deposit) || 0,
        deposit_method: depositMethod,
        note:           note.trim() || null,
        condition_out:  conditionOut.trim() || null,
      })
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white border border-indigo-100 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Nouvelle location</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X size={16}/></button>
      </div>

      {/* Product select */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-1">Robe / article *</label>
        <select value={productId} onChange={e => setProductId(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">— Choisir un article louable</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.brand?.name}){p.rental_price_day ? ` — ${p.rental_price_day}€/j` : ''}
            </option>
          ))}
        </select>
        {products.length === 0 && (
          <p className="text-xs text-amber-600 mt-1.5">
            ⚠ Aucun article louable. Activez "louable" sur les produits concernés dans la page Produits.
          </p>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Départ *</label>
          <input type="date" value={dateFrom} min={today}
            onChange={e => { setDateFrom(e.target.value); if (e.target.value > dateTo) setDateTo(e.target.value) }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Retour *</label>
          <input type="date" value={dateTo} min={dateFrom}
            onChange={e => setDateTo(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
        </div>
      </div>

      {/* Availability indicator */}
      {availability && (
        <div className={cn('rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2',
          availability.available ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
          {availability.available
            ? <><CheckCircle size={15}/> Disponible sur cette période ({days}j)</>
            : <><AlertTriangle size={15}/> Déjà louée : {(availability.conflicts[0] as any)?.customer_name} du {fmtDate((availability.conflicts[0] as any)?.date_from)} au {fmtDate((availability.conflicts[0] as any)?.date_to)}</>}
        </div>
      )}

      {/* Customer */}
      <div className="relative">
        <label className="text-xs font-semibold text-gray-500 block mb-1">Client *</label>
        <Input value={customerName}
          onChange={e => { setCustomerName(e.target.value); setCustSearch(e.target.value); setCustomerId(null) }}
          placeholder="Nom du client (recherche auto)"/>
        {filteredCustomers.length > 0 && !customerId && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {filteredCustomers.map(c => (
              <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerName(c.name); setCustomerPhone(c.phone ?? ''); setCustSearch('') }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between">
                <span className="font-medium text-gray-900">{c.name}</span>
                <span className="text-xs text-gray-400">{c.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Téléphone (recommandé)"/>

      {/* Price + deposit */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Prix location (€) *</label>
          <Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
            placeholder={product?.rental_price_day ? `${product.rental_price_day}€/j × ${days}j` : '0.00'}/>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Caution (€)</label>
          <Input type="number" min="0" step="0.01" value={deposit} onChange={e => setDeposit(e.target.value)}/>
        </div>
      </div>

      {/* Deposit method */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-1.5">Mode de caution</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DEPOSIT_METHODS.map(m => (
            <button key={m.id} onClick={() => setDepositMethod(m.id)}
              className={cn('px-2 py-2 rounded-xl text-xs font-bold border-2 transition-all',
                depositMethod === m.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-300')}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Condition + note */}
      <Input value={conditionOut} onChange={e => setConditionOut(e.target.value)} placeholder="État à la sortie (ex: parfait état)"/>
      <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note interne (optionnel)"/>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="flex-1">Annuler</Button>
        <Button onClick={handleSave}
          disabled={saving || (availability !== null && !availability.available)}
          className="flex-1 gap-2">
          {saving ? <Spinner size="sm"/> : <><Calendar size={14}/> Réserver</>}
        </Button>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function LocationsPage() {
  const { seller } = useAuthStore()
  const [rentals, setRentals]   = useState<Rental[]>([])
  const [brands, setBrands]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [returning, setReturning] = useState<Rental | null>(null)
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterBrand, setFilterBrand]   = useState('all')
  const [search, setSearch]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, b] = await Promise.all([getRentals(), getBrands()])
      setRentals(r as Rental[])
      setBrands(b as any[])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleStart = async (id: string) => {
    await updateRentalStatus(id, 'ongoing')
    load()
  }
  const handleCancel = async (id: string) => {
    await updateRentalStatus(id, 'cancelled')
    load()
  }

  const filtered = useMemo(() => {
    let list = rentals
    if (filterStatus === 'active')   list = list.filter(r => r.status === 'reserved' || r.status === 'ongoing')
    else if (filterStatus === 'late') list = list.filter(r => isLate(r))
    else if (filterStatus !== 'all')  list = list.filter(r => r.status === filterStatus)
    if (filterBrand !== 'all') list = list.filter(r => r.brand_id === filterBrand)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.customer_name.toLowerCase().includes(q) ||
        r.product?.name?.toLowerCase().includes(q) ||
        r.brand?.name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [rentals, filterStatus, filterBrand, search])

  // KPIs
  const ongoingCount  = rentals.filter(r => r.status === 'ongoing').length
  const reservedCount = rentals.filter(r => r.status === 'reserved').length
  const lateCount     = rentals.filter(r => isLate(r)).length
  const monthRevenue  = rentals
    .filter(r => {
      if (r.status === 'cancelled') return false
      const d = parseLocal(r.date_from)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, r) => s + r.rental_price + (r.late_fee ?? 0) + (r.damage_fee ?? 0), 0)

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
            <p className="text-sm text-gray-500 mt-0.5">Robes de soirée & articles en location</p>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="gap-2 shrink-0">
              <Plus size={15}/> Nouvelle location
            </Button>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-blue-600">{ongoingCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">En cours</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-amber-500">{reservedCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Réservées</p>
          </div>
          <div className={cn('border rounded-2xl p-4 text-center shadow-sm',
            lateCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100')}>
            <p className={cn('text-2xl font-black', lateCount > 0 ? 'text-red-600' : 'text-gray-300')}>{lateCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">En retard</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-gray-900">{monthRevenue.toFixed(0)} €</p>
            <p className="text-xs text-gray-400 mt-0.5">CA du mois</p>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <NewRentalForm
            sellerId={seller?.id ?? null}
            onSave={() => { setShowForm(false); load() }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher (client, robe, marque)…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"/>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 flex-wrap">
              {[
                { id: 'active',    label: 'Actives' },
                { id: 'late',      label: '⚠ Retards' },
                { id: 'reserved',  label: 'Réservées' },
                { id: 'ongoing',   label: 'En cours' },
                { id: 'returned',  label: 'Retournées' },
                { id: 'all',       label: 'Toutes' },
              ].map(f => (
                <button key={f.id} onClick={() => setFilterStatus(f.id)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    filterStatus === f.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700')}>
                  {f.label}
                </button>
              ))}
            </div>
            {brands.length > 0 && (
              <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none">
                <option value="all">Toutes les marques</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg"/></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
            <p className="text-3xl mb-3">👗</p>
            <p className="text-sm font-semibold text-gray-700">
              {filterStatus === 'late' ? 'Aucun retard — parfait !' : 'Aucune location'}
            </p>
            {!showForm && filterStatus !== 'late' && (
              <button onClick={() => setShowForm(true)}
                className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                + Créer la première location
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <RentalCard
                key={r.id}
                rental={r}
                onStart={() => handleStart(r.id)}
                onReturn={() => setReturning(r)}
                onCancel={() => handleCancel(r.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Return modal */}
      {returning && (
        <ReturnModal
          rental={returning}
          onClose={() => setReturning(null)}
          onDone={() => { setReturning(null); load() }}
        />
      )}
    </div>
  )
}
