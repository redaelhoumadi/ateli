'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Search, Package, Clock, CheckCircle, X, ChevronDown, ChevronUp,
  User, Phone, Calendar, Tag, CreditCard, Banknote, Gift, AlertTriangle,
  ShoppingCart, RotateCcw, Save, Trash2,
} from 'lucide-react'
import {
  getReservations, createReservation, updateReservationStatus,
  getProducts, getCustomers,
} from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import {
  Button, Card, CardHeader, CardTitle, CardContent,
  Input, Label, Spinner, Badge, DatePicker, ConfirmDialog,
  Dialog, DialogContent, DialogTitle,
  TooltipProvider, Separator, cn,
} from '@/components/ui'
import type { Reservation, ReservationItem, Product } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) => n.toFixed(2) + ' €'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'En attente',  color: '#d97706', bg: '#FFFBEB', icon: '⏳' },
  confirmed: { label: 'Confirmée',   color: '#2563eb', bg: '#EFF6FF', icon: '✅' },
  completed: { label: 'Encaissée',   color: '#059669', bg: '#ECFDF5', icon: '🎉' },
  cancelled: { label: 'Annulée',     color: '#6b7280', bg: '#F9FAFB', icon: '✗'  },
  expired:   { label: 'Expirée',     color: '#dc2626', bg: '#FEF2F2', icon: '⚠️' },
}

const PAY_ICONS: Record<string, any> = {
  cash: Banknote, card: CreditCard, gift_card: Gift,
}
const PAY_LABELS: Record<string, string> = {
  cash: 'Espèces', card: 'Carte', gift_card: 'Bon cadeau',
}

function daysUntil(dateStr: string) {
  const diff = Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
  if (diff < 0) return { label: 'Expirée', urgent: true }
  if (diff === 0) return { label: 'Aujourd\'hui', urgent: true }
  if (diff === 1) return { label: 'Demain', urgent: true }
  return { label: `${diff} jours`, urgent: false }
}

// ─── Reservation card ─────────────────────────────────────────
function ReservationCard({ res, onUpdated }: { res: Reservation; onUpdated: () => void }) {
  const [open, setOpen]         = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [confirmCancel, setConfirmCancel]     = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const cfg    = STATUS_CONFIG[res.status]
  const due    = daysUntil(res.reserved_until)
  const remaining = Math.max(0, res.total - res.deposit)
  const isActive  = res.status === 'confirmed' || res.status === 'pending'

  const handleCancel = async () => {
    setConfirmCancel(false)
    setCancelling(true)
    try { await updateReservationStatus(res.id, 'cancelled'); onUpdated() }
    catch (e: any) { alert(e.message) }
    finally { setCancelling(false) }
  }

  const handleComplete = async () => {
    setConfirmComplete(false)
    setCompleting(true)
    try { await updateReservationStatus(res.id, 'completed'); onUpdated() }
    catch (e: any) { alert(e.message) }
    finally { setCompleting(false) }
  }

  return (
    <div className={cn('border rounded-2xl overflow-hidden transition-all bg-white',
      open ? 'border-gray-200 shadow-md' : 'border-gray-100 shadow-sm hover:border-gray-200')}>

      {/* Header row */}
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 px-5 py-4 text-left">
        {/* Status dot */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base"
          style={{ background: cfg.bg }}>
          {cfg.icon}
        </div>

        {/* Client info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900">{res.customer_name}</p>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ color: cfg.color, background: cfg.bg }}>
              {cfg.label}
            </span>
            {isActive && due.urgent && (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                🔴 {due.label}
              </span>
            )}
            {isActive && !due.urgent && (
              <span className="text-xs text-gray-400">{due.label}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <p className="text-xs text-gray-400">
              {(res.items || []).length} article{(res.items || []).length > 1 ? 's' : ''} · {fmt(res.total)}
            </p>
            {res.deposit > 0 && (
              <p className="text-xs text-indigo-600 font-semibold">Dépôt {fmt(res.deposit)}</p>
            )}
            {res.customer_phone && (
              <p className="text-xs text-gray-400">{res.customer_phone}</p>
            )}
          </div>
        </div>

        {/* Right: remaining + toggle */}
        <div className="text-right shrink-0">
          {isActive && remaining > 0 ? (
            <>
              <p className="text-sm font-black text-gray-900">{fmt(remaining)}</p>
              <p className="text-xs text-gray-400">à encaisser</p>
            </>
          ) : isActive ? (
            <p className="text-xs font-bold text-green-600">Entièrement payée</p>
          ) : null}
        </div>
        <div className="text-gray-400 shrink-0">
          {open ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50">

          {/* Articles */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Articles réservés</p>
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
              {(res.items || []).map((item: ReservationItem, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover"/>
                      : <Package size={14} className="text-gray-400"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                    {item.brand && <p className="text-xs text-gray-400">{item.brand}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{(item.unit_price * item.qty).toFixed(2)} €</p>
                    <p className="text-xs text-gray-400">×{item.qty} · {item.unit_price.toFixed(2)} €</p>
                  </div>
                </div>
              ))}
              <div className="px-4 py-2.5 bg-gray-50 flex justify-between font-bold">
                <span className="text-sm">Total</span>
                <span className="text-sm">{fmt(res.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Dépôt versé</p>
              <p className="text-lg font-black text-gray-900">{fmt(res.deposit)}</p>
              {res.deposit_method && (
                <p className="text-xs text-gray-400 mt-0.5">{PAY_LABELS[res.deposit_method]}</p>
              )}
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Reste à payer</p>
              <p className={cn('text-lg font-black', remaining > 0 ? 'text-gray-900' : 'text-green-600')}>
                {remaining > 0 ? fmt(remaining) : 'Rien 🎉'}
              </p>
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Date limite de retrait</span>
              <span className="font-semibold text-gray-800">
                {new Date(res.reserved_until + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
              </span>
            </div>
            {res.note && (
              <div className="flex gap-2">
                <span>Note</span>
                <span className="font-semibold text-gray-800 flex-1 text-right">{res.note}</span>
              </div>
            )}
            {res.seller?.name && (
              <div className="flex justify-between">
                <span>Créée par</span>
                <span className="font-semibold text-gray-800">{res.seller.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>ID réservation</span>
              <span className="font-mono font-bold text-gray-700">#{res.id.replace(/-/g,'').slice(0,8).toUpperCase()}</span>
            </div>
          </div>

          {/* Actions */}
          {isActive && (
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setConfirmCancel(true)} disabled={cancelling}
                className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
                {cancelling ? <Spinner size="sm"/> : <><X size={13}/> Annuler</>}
              </Button>
              <Button size="sm" onClick={() => setConfirmComplete(true)} disabled={completing}
                className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700">
                {completing ? <Spinner size="sm"/> : <><CheckCircle size={13}/> Marquer encaissée</>}
              </Button>
            </div>
          )}

          {/* Confirm dialogs */}
          <ConfirmDialog
            open={confirmCancel}
            onCancel={() => setConfirmCancel(false)}
            onConfirm={handleCancel}
            title="Annuler la réservation ?"
            description="Les articles seront remis en stock. Cette action est irréversible."
            confirmLabel="Oui, annuler"
            cancelLabel="Garder"
            variant="danger"
          />
          <ConfirmDialog
            open={confirmComplete}
            onCancel={() => setConfirmComplete(false)}
            onConfirm={handleComplete}
            title="Marquer comme encaissée ?"
            description={`Confirmer l'encaissement de ${res.customer_name} pour ${fmt(res.total)} ?${remaining > 0 ? ` Reste à payer : ${fmt(remaining)}.` : ''}`}
            confirmLabel="Confirmer l'encaissement"
            cancelLabel="Annuler"
          />
        </div>
      )}
    </div>
  )
}

// ─── New reservation modal ─────────────────────────────────────
function NewReservationModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: () => void
}) {
  const { seller } = useAuthStore()
  const [products, setProducts]     = useState<Product[]>([])
  const [customers, setCustomers]   = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Form state
  const [customerName, setCustomerName]   = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerId, setCustomerId]       = useState<string | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerList, setShowCustomerList] = useState(false)

  const [productSearch, setProductSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState<ReservationItem[]>([])

  const [reservedUntil, setReservedUntil] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })
  const [deposit, setDeposit]           = useState('')
  const [depositMethod, setDepositMethod] = useState<'cash'|'card'|'gift_card'>('cash')
  const [note, setNote]                 = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  useEffect(() => {
    Promise.all([getProducts(), getCustomers()])
      .then(([p, c]) => { setProducts((p as Product[]) || []); setCustomers((c as any[]) || []) })
      .finally(() => setLoadingData(false))
  }, [])

  // Product search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return []
    const q = productSearch.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(q) && (p.stock === null || p.stock > 0)
    ).slice(0, 8)
  }, [products, productSearch])

  // Customer search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return []
    const q = customerSearch.toLowerCase()
    return customers.filter((c: any) =>
      c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
    ).slice(0, 5)
  }, [customers, customerSearch])

  const addItem = (product: Product) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) return prev.map(i => i.product_id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, {
        product_id: product.id,
        name: product.name,
        brand: (product as any).brand?.name ?? null,
        qty: 1,
        unit_price: product.price,
        image_url: (product as any).image_url ?? null,
      }]
    })
    setProductSearch('')
  }

  const removeItem = (pid: string) => setSelectedItems(prev => prev.filter(i => i.product_id !== pid))
  const updateQty  = (pid: string, qty: number) => {
    if (qty <= 0) return removeItem(pid)
    setSelectedItems(prev => prev.map(i => i.product_id === pid ? { ...i, qty } : i))
  }

  const total        = selectedItems.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const depositNum   = Math.max(0, Number(deposit) || 0)
  const remaining    = Math.max(0, total - depositNum)
  const hasDeposit   = depositNum > 0
  const canSave      = customerName.trim() && selectedItems.length > 0 && reservedUntil

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true); setError('')
    try {
      await createReservation({
        customer_id:    customerId,
        customer_name:  customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        items:          selectedItems,
        total,
        deposit:        depositNum,
        deposit_method: hasDeposit ? depositMethod : null,
        reserved_until: reservedUntil,
        note:           note.trim() || null,
        seller_id:      seller?.id ?? null,
      })
      onCreated(); onClose()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden flex flex-col max-h-[90vh]" hideClose>
        <DialogTitle className="sr-only">Nouvelle réservation</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Tag size={18} className="text-indigo-600"/>
            </div>
            <div>
              <p className="text-base font-black text-gray-900">Nouvelle mise de côté</p>
              <p className="text-xs text-gray-400">Réservation avec ou sans acompte</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X size={18}/></button>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-16"><Spinner size="lg"/></div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

            {/* ─── Client ─── */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Client</p>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <Input className="pl-9" placeholder="Nom du client *" value={customerName}
                  onChange={e => {
                    setCustomerName(e.target.value)
                    setCustomerSearch(e.target.value)
                    setShowCustomerList(true)
                    setCustomerId(null)
                  }}/>
                {showCustomerList && filteredCustomers.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {filteredCustomers.map((c: any) => (
                      <button key={c.id} onClick={() => {
                        setCustomerName(c.name); setCustomerPhone(c.phone || '')
                        setCustomerId(c.id); setShowCustomerList(false); setCustomerSearch('')
                      }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">{c.name[0]}</div>
                        <div><p className="text-sm font-semibold text-gray-900">{c.name}</p><p className="text-xs text-gray-400">{c.phone || c.email}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <Input className="pl-9" placeholder="Téléphone (optionnel)" value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}/>
              </div>
            </div>

            <Separator/>

            {/* ─── Products ─── */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Articles à réserver</p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <Input className="pl-9" placeholder="Rechercher un produit…" value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}/>
                {filteredProducts.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {filteredProducts.map(p => (
                      <button key={p.id} onClick={() => addItem(p)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-left">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-400">{(p as any).brand?.name} · {p.price.toFixed(2)} €</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{p.price.toFixed(2)} €</p>
                          {p.stock !== null && <p className="text-xs text-gray-400">Stock : {p.stock}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected items */}
              {selectedItems.length > 0 && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
                  {selectedItems.map(item => (
                    <div key={item.product_id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.unit_price.toFixed(2)} € / unité</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => updateQty(item.product_id, item.qty - 1)}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold">−</button>
                        <span className="text-sm font-bold w-6 text-center">{item.qty}</span>
                        <button onClick={() => updateQty(item.product_id, item.qty + 1)}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold">+</button>
                      </div>
                      <p className="text-sm font-bold text-gray-900 w-16 text-right shrink-0">
                        {(item.qty * item.unit_price).toFixed(2)} €
                      </p>
                      <button onClick={() => removeItem(item.product_id)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={14}/></button>
                    </div>
                  ))}
                  <div className="px-4 py-2.5 flex justify-between font-black bg-white">
                    <span className="text-sm text-gray-700">Total</span>
                    <span className="text-sm text-gray-900">{fmt(total)}</span>
                  </div>
                </div>
              )}
            </div>

            <Separator/>

            {/* ─── Date ─── */}
            <div className="space-y-2">
              <Label>Date limite de retrait *</Label>
              <DatePicker
                value={reservedUntil}
                onChange={setReservedUntil}
                min={new Date().toISOString().split('T')[0]}
                placeholder="Choisir une date"
              />
            </div>

            <Separator/>

            {/* ─── Deposit ─── */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Acompte (optionnel)</p>
              <div className="relative">
                <Input type="number" min="0" step="0.01" placeholder="0.00"
                  value={deposit} onChange={e => setDeposit(e.target.value)}
                  className="pr-8 text-xl font-black"/>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
              </div>
              {hasDeposit && total > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cash','card','gift_card'] as const).map(m => {
                      const Icon = PAY_ICONS[m]
                      return (
                        <button key={m} onClick={() => setDepositMethod(m)}
                          className={cn('flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border transition-all',
                            depositMethod === m ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
                          <Icon size={14}/> {PAY_LABELS[m]}
                        </button>
                      )
                    })}
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex justify-between">
                    <span className="text-sm font-semibold text-gray-700">Reste à payer lors du retrait</span>
                    <span className="text-base font-black text-indigo-700">{fmt(remaining)}</span>
                  </div>
                </>
              )}
              {/* Quick deposit presets */}
              {total > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {[0.3, 0.5, 1].map(pct => (
                    <button key={pct} onClick={() => setDeposit((total * pct).toFixed(2))}
                      className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:border-gray-400 bg-white text-gray-600">
                      {Math.round(pct * 100)}% ({(total * pct).toFixed(0)} €)
                    </button>
                  ))}
                  <button onClick={() => setDeposit(total.toFixed(2))}
                    className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:border-gray-400 bg-white text-gray-600">
                    Totalité
                  </button>
                </div>
              )}
            </div>

            <Separator/>

            {/* ─── Note ─── */}
            <div className="space-y-2">
              <Label>Note interne (optionnel)</Label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Ex: Couleur préférée, taille souhaitée…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !canSave} className="flex-1 gap-2">
            {saving ? <Spinner size="sm"/> : <><Save size={14}/> Confirmer la réservation</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState<string>('active')
  const [search, setSearch]             = useState('')
  const [showNew, setShowNew]           = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const status = filter === 'active' ? undefined : filter === 'done' ? undefined : filter
      const data   = await getReservations(filter === 'active' || filter === 'done' ? undefined : filter)
      const filtered = filter === 'active'
        ? (data || []).filter((r: any) => r.status === 'confirmed' || r.status === 'pending')
        : filter === 'done'
        ? (data || []).filter((r: any) => r.status === 'completed' || r.status === 'cancelled' || r.status === 'expired')
        : (data || [])
      setReservations(filtered as Reservation[])
    } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const displayed = useMemo(() => {
    if (!search.trim()) return reservations
    const q = search.toLowerCase()
    return reservations.filter(r =>
      r.customer_name.toLowerCase().includes(q) ||
      r.customer_phone?.includes(q) ||
      r.id.replace(/-/g,'').slice(0,8).toLowerCase().includes(q)
    )
  }, [reservations, search])

  // KPIs
  const active    = reservations.filter(r => r.status === 'confirmed' || r.status === 'pending')
  const urgent    = active.filter(r => daysUntil(r.reserved_until).urgent)
  const totalDeposits = active.reduce((s, r) => s + r.deposit, 0)
  const totalPending  = active.reduce((s, r) => s + Math.max(0, r.total - r.deposit), 0)

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Réservations</h1>
              <p className="text-gray-500 text-sm mt-0.5">Mises de côté et acomptes</p>
            </div>
            <Button onClick={() => setShowNew(true)} className="gap-2 shrink-0">
              <Plus size={15}/> Nouvelle réservation
            </Button>
          </div>

          {/* KPIs */}
          {active.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'En cours',    value: active.length,               color: 'text-gray-900' },
                { label: 'Urgentes',    value: urgent.length,               color: urgent.length > 0 ? 'text-red-600' : 'text-gray-400' },
                { label: 'Dépôts reçus', value: `${totalDeposits.toFixed(0)} €`, color: 'text-indigo-700' },
                { label: 'Reste à encaisser', value: `${totalPending.toFixed(0)} €`, color: 'text-gray-900' },
              ].map(k => (
                <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                  <p className={cn('text-2xl font-black', k.color)}>{k.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabs + search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5">
              {[
                { id: 'active', label: '🟢 En cours' },
                { id: 'done',   label: '✓ Terminées' },
              ].map(t => (
                <button key={t.id} onClick={() => setFilter(t.id)}
                  className={cn('px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                    filter === t.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700')}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <Input placeholder="Nom, téléphone ou N° réservation…" className="pl-9"
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg"/></div>
          ) : displayed.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
              <Tag size={40} className="text-gray-200 mx-auto mb-3"/>
              <p className="text-sm font-semibold text-gray-700">
                {filter === 'active' ? 'Aucune réservation en cours' : 'Aucune réservation terminée'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {filter === 'active' ? 'Cliquez sur "Nouvelle réservation" pour commencer' : ''}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayed.map(r => (
                <ReservationCard key={r.id} res={r} onUpdated={load}/>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <NewReservationModal onClose={() => setShowNew(false)} onCreated={load}/>
      )}
    </TooltipProvider>
  )
}
