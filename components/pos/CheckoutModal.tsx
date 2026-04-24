'use client'

import { useState, useMemo } from 'react'
import { CreditCard, Banknote, Shuffle, X, Gift, CheckCircle } from 'lucide-react'
import { useCartStore } from '@/hooks/useCart'
import { createSale, checkStockAvailability, getGiftCardByCode, useGiftCard } from '@/lib/supabase'
import { getTierForSpend } from '@/lib/customerPortal'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Badge, Separator, Spinner, cn,
} from '@/components/ui'
import type { Sale } from '@/types'

const METHODS = [
  { id: 'card',       label: 'Carte',       Icon: CreditCard },
  { id: 'cash',       label: 'Espèces',     Icon: Banknote },
  { id: 'mixed',      label: 'Mixte',       Icon: Shuffle },
  { id: 'gift_card',  label: 'Bon cadeau',  Icon: Gift },
]
const QUICK = [5, 10, 20, 50, 100, 200]

const BRAND_COLORS = [
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#4338CA', dot: '#6366F1' },
  { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', dot: '#22C55E' },
  { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C', dot: '#F97316' },
  { bg: '#FDF4FF', border: '#E9D5FF', text: '#7E22CE', dot: '#A855F7' },
  { bg: '#FFF1F2', border: '#FECDD3', text: '#BE123C', dot: '#F43F5E' },
  { bg: '#ECFEFF', border: '#A5F3FC', text: '#0E7490', dot: '#06B6D4' },
  { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', dot: '#F59E0B' },
]

import { useOfflineCart } from '@/hooks/useOfflineCart'

export function CheckoutModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (s: Sale) => void }) {
  const {
    items, customer, customerTotalSpend, sellerId,
    paymentMethod, setPaymentMethod,
    subtotal, loyaltyDiscountPct, loyaltyDiscountAmount, total, totalItems, clearCart,
  } = useCartStore()

  const { clearSavedCart } = useOfflineCart()

  const [cash, setCash]           = useState('')
  const [discount, setDiscount]   = useState('')
  const [note, setNote]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  // Gift card
  // Mixed payment
  const [mixedCard, setMixedCard] = useState('')
  const [mixedCash, setMixedCash] = useState('')

  const [gcCode, setGcCode]         = useState('')
  const [gcData, setGcData]         = useState<any>(null)
  const [gcChecking, setGcChecking] = useState(false)
  const [gcError, setGcError]       = useState('')

  const loyPct  = loyaltyDiscountPct()
  const loyAmt  = loyaltyDiscountAmount()
  const sub     = subtotal()
  const tier    = customer ? getTierForSpend(customerTotalSpend) : null
  const manPct  = Math.min(100, Math.max(0, Number(discount) || 0))
  const manAmt  = manPct > 0 ? (sub - loyAmt) * (manPct / 100) : 0
  const tot     = Math.max(0, sub - loyAmt - manAmt)
  const change  = paymentMethod === 'cash' ? Math.max(0, Number(cash) - tot) : 0
  const gcSufficient = gcData && gcData.balance >= tot
  const mixedCardNum = Math.max(0, Number(mixedCard) || 0)
  const mixedCashNum = Math.max(0, Number(mixedCash) || 0)
  const mixedTotal   = mixedCardNum + mixedCashNum
  const mixedChange  = Math.max(0, mixedCashNum - Math.max(0, tot - mixedCardNum))
  const mixedOk      = mixedTotal >= tot - 0.005

  // Group items by brand for the recap
  const brandGroups = useMemo(() => {
    const map = new Map<string, { items: typeof items; subtotal: number; colorIdx: number }>()
    let ci = 0; const bcm = new Map<string, number>()
    items.forEach(item => {
      const brand = item.product.brand?.name ?? 'Sans marque'
      if (!bcm.has(brand)) { bcm.set(brand, ci % BRAND_COLORS.length); ci++ }
      const ex = map.get(brand)
      ex ? (ex.items.push(item), ex.subtotal += item.total_price)
         : map.set(brand, { items: [item], subtotal: item.total_price, colorIdx: bcm.get(brand)! })
    })
    return Array.from(map.entries()).map(([name, d]) => ({ name, ...d }))
  }, [items])

  const isSingleBrand = brandGroups.length <= 1
  // Apply discounts proportionally to each brand
  const totalDiscountRate = sub > 0 ? (loyAmt + manAmt) / sub : 0

  const confirm = async () => {
    if (!sellerId) { setError('Sélectionnez un vendeur'); return }
    setLoading(true); setError('')
    try {
      // Vérifier le stock avant d'encaisser
      const stockIssues = await checkStockAvailability(
        items.map(i => ({ product_id: i.product.id, quantity: i.quantity }))
      )
      if (stockIssues.length > 0) {
        const msg = stockIssues.map(s =>
          `• ${s.name} : ${s.available} en stock, ${s.requested} demandé${s.requested > 1 ? 's' : ''}`
        ).join('\n')
        setError(`Stock insuffisant :\n${msg}`)
        setLoading(false)
        return
      }
      const sale = await createSale({
        customer_id: customer?.id ?? null, seller_id: sellerId,
        total: tot, total_items: totalItems(),
        points_earned: 0, points_used: 0, payment_method: paymentMethod,
        note: note.trim() || null,
        items: items.map(i => ({ product_id: i.product.id, quantity: i.quantity, unit_price: i.unit_price, total_price: i.total_price })),
      })
      // If paid by gift card, debit it
      if (paymentMethod === 'gift_card' && gcData) {
        await useGiftCard({ gift_card_id: gcData.id, sale_id: (sale as any).id, amount: tot })
      }
      clearCart(); clearSavedCart(); onSuccess(sale as Sale)
    } catch (e: any) { setError(e.message || 'Erreur') }
    finally { setLoading(false) }
  }

  const handleCheckGc = async () => {
    if (!gcCode.trim()) return
    setGcChecking(true); setGcError(''); setGcData(null)
    try {
      const card = await getGiftCardByCode(gcCode)
      if (!card) { setGcError('Code introuvable'); return }
      if (card.status !== 'active') { setGcError('Ce bon est déjà utilisé ou annulé'); return }
      setGcData(card)
    } catch (e: any) { setGcError(e.message) }
    finally { setGcChecking(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl flex flex-col overflow-hidden" hideClose>
        <DialogTitle className="sr-only">Encaissement</DialogTitle>
        {/* Dark header */}
        <div className="bg-gray-900 px-6 py-4 rounded-t-2xl flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Encaissement</h2>
            <p className="text-gray-400 text-xs mt-0.5">{totalItems()} articles · sous-total {sub.toFixed(2)} €</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors rounded-lg p-1.5 hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {/* Customer */}
            {customer && tier ? (
              <div className="rounded-xl p-3.5 flex items-center gap-3 border"
                style={{ background: tier.bg, borderColor: `${tier.color}33` }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0"
                  style={{ background: tier.color }}>{customer.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900 truncate">{customer.name}</p>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-white shrink-0"
                      style={{ color: tier.color, borderColor: `${tier.color}40` }}>
                      {tier.label}{loyPct > 0 && ` -${loyPct}%`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{customerTotalSpend.toFixed(0)} € cumulés</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-gray-400">Vente anonyme — pas de remise fidélité</p>
              </div>
            )}

            {/* Remise commerciale */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-orange-800">Remise commerciale</p>
                {manPct > 0 && <Badge variant="warning">-{manPct}%</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input type="number" value={discount} onChange={e => setDiscount(e.target.value)}
                    placeholder="0" min="0" max="100" step="5"
                    className="w-full border border-orange-200 rounded-lg pl-3 pr-7 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-orange-500 text-sm font-bold">%</span>
                </div>
                {[5,10,15,20].map(pct => (
                  <button key={pct} onClick={() => setDiscount(String(pct))}
                    className={cn('px-2.5 py-2 text-xs font-bold rounded-lg border transition-all', manPct === pct
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-orange-600 border-orange-200 hover:border-orange-400')}>
                    -{pct}%
                  </button>
                ))}
                {manPct > 0 && <button onClick={() => setDiscount('')} className="text-xs text-orange-400 hover:text-orange-700">✕</button>}
              </div>
            </div>

            {/* Payment method */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Paiement</p>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map(({ id, label, Icon }) => (
                  <button key={id} onClick={() => setPaymentMethod(id)}
                    className={cn('flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                      paymentMethod === id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400')}>
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gift card input */}
            {paymentMethod === 'gift_card' && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={gcCode}
                    onChange={e => { setGcCode(e.target.value.toUpperCase()); setGcData(null); setGcError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleCheckGc()}
                    placeholder="Code du bon (ex: GC-ABCD-EFGH)"
                    className="flex-1 border border-purple-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white uppercase tracking-wider"
                  />
                  <button onClick={handleCheckGc} disabled={gcChecking || !gcCode.trim()}
                    className="px-4 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-all">
                    {gcChecking ? '…' : 'Vérifier'}
                  </button>
                </div>
                {gcError && <p className="text-sm text-red-600 font-medium">{gcError}</p>}
                {gcData && (
                  <div className={cn('rounded-xl p-3 border', gcSufficient ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {gcSufficient
                          ? <CheckCircle size={16} className="text-green-500 shrink-0"/>
                          : <X size={16} className="text-red-500 shrink-0"/>}
                        <div>
                          <p className="text-sm font-bold text-gray-900 font-mono">{gcData.code}</p>
                          {gcData.customer_name && <p className="text-xs text-gray-500">Pour : {gcData.customer_name}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black" style={{color: gcSufficient ? '#15803D' : '#B91C1C'}}>
                          {gcData.balance.toFixed(2)} €
                        </p>
                        <p className="text-xs text-gray-400">disponible</p>
                      </div>
                    </div>
                    {!gcSufficient && (
                      <p className="text-xs text-red-600 font-medium mt-2">
                        Solde insuffisant — manque {(tot - gcData.balance).toFixed(2)} €
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Cash calculator */}
            {paymentMethod === 'cash' && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input type="number" value={cash} onChange={e => setCash(e.target.value)}
                      placeholder={`Min. ${tot.toFixed(2)} €`} min={tot} step="0.01"
                      className="w-full border border-gray-200 rounded-xl px-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                  </div>
                  <div className="text-center shrink-0">
                    <p className="text-xs text-gray-400">Rendu</p>
                    <p className={cn('text-2xl font-black', change > 0 ? 'text-green-600' : 'text-gray-300')}>{change.toFixed(2)} €</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {QUICK.map(a => (
                    <button key={a} onClick={() => setCash(String(a))}
                      className={cn('flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all',
                        Number(cash) === a ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-500')}>
                      {a}€
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mixed payment */}
            {paymentMethod === 'mixed' && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Répartition du paiement</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">💳 Carte</label>
                    <div className="relative">
                      <input type="number" min="0" step="0.01" value={mixedCard}
                        onChange={e => { setMixedCard(e.target.value); setMixedCash('') }}
                        placeholder="0.00"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold"/>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                    </div>
                    {mixedCard !== '' && <p className="text-xs text-indigo-600 mt-1 font-medium">Espèces : <strong>{Math.max(0, tot - mixedCardNum).toFixed(2)} €</strong></p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">💵 Espèces</label>
                    <div className="relative">
                      <input type="number" min="0" step="0.01" value={mixedCash}
                        onChange={e => setMixedCash(e.target.value)}
                        placeholder={mixedCard ? Math.max(0, tot - mixedCardNum).toFixed(2) : '0.00'}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold"/>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                    </div>
                  </div>
                </div>
                <div className={cn('rounded-xl px-4 py-3 border', mixedOk ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200')}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total encaissé</span>
                    <span className={cn('font-bold', mixedOk ? 'text-green-700' : 'text-gray-700')}>{mixedTotal.toFixed(2)} €</span>
                  </div>
                  {mixedOk && mixedChange > 0.005 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500">Rendu monnaie</span>
                      <span className="font-black text-green-700">{mixedChange.toFixed(2)} €</span>
                    </div>
                  )}
                  {!mixedOk && mixedTotal > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500">Reste à payer</span>
                      <span className="font-bold text-red-600">{(tot - mixedTotal).toFixed(2)} €</span>
                    </div>
                  )}
                </div>
                <button onClick={() => { setMixedCard(tot.toFixed(2)); setMixedCash('') }} className="text-xs text-indigo-600 font-semibold hover:underline">
                  Tout en carte ({tot.toFixed(2)} €)
                </button>
              </div>
            )}

            {/* Note */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Note (optionnel)</p>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Note interne sur cette vente…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
            </div>

            {/* Recap — grouped by brand */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Récapitulatif</p>
              </div>

              {/* Brand groups */}
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {brandGroups.map(group => {
                  const p = BRAND_COLORS[group.colorIdx]
                  const brandDiscount = group.subtotal * totalDiscountRate
                  const brandNet = group.subtotal - brandDiscount
                  const hasDiscount = totalDiscountRate > 0
                  return (
                    <div key={group.name}>
                      {/* Brand header */}
                      <div className="flex items-center justify-between px-4 py-2.5"
                        style={{ background: p.bg, borderLeft: `3px solid ${p.dot}` }}>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded flex items-center justify-center text-white text-[10px] font-black shrink-0"
                            style={{ background: p.dot }}>{group.name[0]}</div>
                          <span className="text-xs font-bold" style={{ color: p.text }}>{group.name}</span>
                          <span className="text-xs opacity-60" style={{ color: p.text }}>
                            · {group.items.reduce((s, i) => s + i.quantity, 0)} art.
                          </span>
                        </div>
                        <div className="text-right">
                          {hasDiscount ? (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs line-through opacity-40" style={{ color: p.text }}>
                                {group.subtotal.toFixed(2)} €
                              </span>
                              <span className="text-sm font-black" style={{ color: p.text }}>
                                {brandNet.toFixed(2)} €
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-black" style={{ color: p.text }}>
                              {group.subtotal.toFixed(2)} €
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Articles */}
                      <div className="px-4 py-2 space-y-1"
                        style={{ background: `${p.bg}55`, borderLeft: `3px solid ${p.dot}44` }}>
                        {group.items.map(item => (
                          <div key={item.product.id} className="flex justify-between text-xs text-gray-600">
                            <span className="truncate mr-3">{item.product.name} ×{item.quantity}</span>
                            <span className="shrink-0">{item.total_price.toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Totals */}
              <div className="px-4 py-3 border-t border-gray-100 space-y-1.5 bg-white">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Sous-total</span><span>{sub.toFixed(2)} €</span>
                </div>
                {loyAmt > 0 && (
                  <div className="flex justify-between text-sm font-medium" style={{ color: tier?.color }}>
                    <span>Fidélité -{loyPct}%</span><span>-{loyAmt.toFixed(2)} €</span>
                  </div>
                )}
                {manAmt > 0 && (
                  <div className="flex justify-between text-sm font-medium text-orange-600">
                    <span>Remise -{manPct}%</span><span>-{manAmt.toFixed(2)} €</span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex justify-between text-base font-black text-gray-900">
                  <span>Total à encaisser</span><span>{tot.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-gray-100">
          <Button variant="outline" onClick={onClose} disabled={loading}>Annuler</Button>
          <Button size="lg" onClick={confirm} disabled={loading} className="flex-1 text-base font-black">
            {loading ? <><Spinner size="sm" /> Traitement…</> : `✓  Encaisser  ${tot.toFixed(2)} €`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
