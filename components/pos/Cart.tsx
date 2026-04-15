'use client'

import { useMemo } from 'react'
import { ShoppingCart, Trash2, Plus, Minus, X } from 'lucide-react'
import { useCartStore } from '@/hooks/useCart'
import { REWARDS_TIERS, getTierForSpend } from '@/lib/customerPortal'
import { Button, Badge, Separator, ScrollArea, cn } from '@/components/ui'
import type { CartItem } from '@/types'

const BRAND_COLORS = [
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#4338CA', dot: '#6366F1' },
  { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', dot: '#22C55E' },
  { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C', dot: '#F97316' },
  { bg: '#FDF4FF', border: '#E9D5FF', text: '#7E22CE', dot: '#A855F7' },
  { bg: '#FFF1F2', border: '#FECDD3', text: '#BE123C', dot: '#F43F5E' },
  { bg: '#ECFEFF', border: '#A5F3FC', text: '#0E7490', dot: '#06B6D4' },
  { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', dot: '#F59E0B' },
]

const TIER_BADGE: Record<string, { icon: string; cls: string }> = {
  bronze: { icon: '🥉', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  silver: { icon: '🥈', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
  gold:   { icon: '🥇', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  vip:    { icon: '💜', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
}

export function Cart({ onCheckout, onClose, isMobile }: { onCheckout: () => void; onClose?: () => void; isMobile?: boolean }) {
  const {
    items, customer, customerTotalSpend,
    updateQuantity, removeItem, clearCart,
    subtotal, productDiscounts, loyaltyDiscountPct, loyaltyDiscountAmount, total, totalItems,
  } = useCartStore()

  const sub      = subtotal()
  const prodDisc = productDiscounts()
  const loyPct   = loyaltyDiscountPct()
  const loyAmt   = loyaltyDiscountAmount()
  const tot      = total()
  const count    = totalItems()
  const tier     = customer ? getTierForSpend(customerTotalSpend) : null
  const nextTier = tier ? REWARDS_TIERS.find(t => t.minSpend > customerTotalSpend) ?? null : null

  const brandGroups = useMemo(() => {
    const map = new Map<string, { items: CartItem[]; subtotal: number; colorIdx: number }>()
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

  const isSingle = brandGroups.length <= 1

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} className="text-gray-500" />
          <span className="font-semibold text-gray-900 text-sm">Panier</span>
          {count > 0 && (
            <span className="w-5 h-5 bg-gray-900 text-white text-xs font-black rounded-full flex items-center justify-center">{count}</span>
          )}
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="xs" onClick={clearCart} className="text-gray-400 hover:text-red-500 gap-1">
            <Trash2 size={12} /> Vider
          </Button>
        )}
      </div>

      {/* Items */}
      <ScrollArea className="flex-1">
        <div className="py-3 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <ShoppingCart size={48} strokeWidth={1} className="mb-3" />
              <p className="text-sm text-gray-400 font-medium">Panier vide</p>
              <p className="text-xs text-gray-300 mt-1">Cliquez sur un produit pour l'ajouter</p>
            </div>
          ) : isSingle ? (
            <div className="px-4 space-y-2">
              {items.map(item => (
                <CartItemRow key={item.product.id} item={item}
                  onQty={qty => updateQuantity(item.product.id, qty)}
                  onRemove={() => removeItem(item.product.id)} />
              ))}
            </div>
          ) : brandGroups.map(group => {
            const p = BRAND_COLORS[group.colorIdx]
            const bLoy = loyPct > 0 ? group.subtotal * (loyPct / 100) : 0
            const bTot = group.subtotal - bLoy
            return (
              <div key={group.name} className="px-4">
                <div className="flex items-center justify-between px-3 py-2 rounded-t-xl border-l-4"
                  style={{ background: p.bg, borderColor: p.dot, borderTop: `1px solid ${p.border}`, borderRight: `1px solid ${p.border}`, borderBottom: 'none' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs font-black shrink-0" style={{ background: p.dot }}>{group.name[0]}</div>
                    <span className="text-xs font-bold truncate" style={{ color: p.text }}>{group.name}</span>
                    <span className="text-xs opacity-60" style={{ color: p.text }}>· {group.items.reduce((s,i)=>s+i.quantity,0)} art.</span>
                  </div>
                  <span className="text-sm font-black" style={{ color: p.text }}>
                    {loyPct > 0 ? <><span className="text-xs line-through opacity-40 mr-1">{group.subtotal.toFixed(2)}€</span>{bTot.toFixed(2)}€</> : `${group.subtotal.toFixed(2)} €`}
                  </span>
                </div>
                <div className="rounded-b-xl border-l-4 overflow-hidden divide-y"
                  style={{ background: `${p.bg}88`, borderColor: p.dot, borderRight: `1px solid ${p.border}`, borderBottom: `1px solid ${p.border}` }}>
                  {group.items.map(item => (
                    <CartItemRow key={item.product.id} item={item} compact hideBrand
                      onQty={qty => updateQuantity(item.product.id, qty)}
                      onRemove={() => removeItem(item.product.id)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Summary */}
      {items.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-3 shrink-0">
          {/* Multi-brand recap */}
          {!isSingle && (
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total par marque</p>
              </div>
              <div className="divide-y divide-gray-50">
                {brandGroups.map(group => {
                  const p = BRAND_COLORS[group.colorIdx]
                  const bLoy = loyPct > 0 ? group.subtotal * (loyPct / 100) : 0
                  const pct  = sub > 0 ? (group.subtotal / sub) * 100 : 0
                  return (
                    <div key={group.name} className="flex items-center gap-2.5 px-3 py-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.dot }} />
                      <span className="text-xs font-medium text-gray-700 flex-1 truncate">{group.name}</span>
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.dot }} />
                      </div>
                      <span className="text-xs font-bold w-16 text-right shrink-0" style={{ color: loyPct > 0 ? p.text : undefined }}>
                        {loyPct > 0 ? (group.subtotal - bLoy).toFixed(2) : group.subtotal.toFixed(2)} €
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Loyalty badge */}
          {customer && tier && (
            <div className={cn('rounded-xl px-4 py-3 border', TIER_BADGE[tier.id].cls)}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">{TIER_BADGE[tier.id].icon}</span>
                  <span className="text-xs font-bold">{customer.name} — {tier.label}</span>
                </div>
                {loyPct > 0 && <span className="text-sm font-black">-{loyPct}%</span>}
              </div>
              {loyPct === 0 && nextTier ? (
                <p className="text-xs opacity-70">💡 Il manque <strong>{(nextTier.minSpend - customerTotalSpend).toFixed(0)}€</strong> pour -{nextTier.discount}%</p>
              ) : loyPct > 0 ? (
                <p className="text-xs opacity-80 font-medium">Remise de <strong>{loyPct}%</strong> appliquée automatiquement</p>
              ) : null}
            </div>
          )}

          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500"><span>Sous-total</span><span>{sub.toFixed(2)} €</span></div>
            {prodDisc > 0 && <div className="flex justify-between text-green-600"><span>Remises produits</span><span>-{prodDisc.toFixed(2)} €</span></div>}
            {loyAmt > 0 && <div className="flex justify-between font-medium" style={{ color: tier?.color }}><span>Fidélité -{loyPct}%</span><span>-{loyAmt.toFixed(2)} €</span></div>}
          </div>

          <Separator />

          <div className="flex justify-between font-black text-base text-gray-900">
            <span>Total</span><span>{tot.toFixed(2)} €</span>
          </div>

          <Button className="w-full" size="lg" onClick={onCheckout}>
            Encaisser {tot.toFixed(2)} €
          </Button>
        </div>
      )}
    </div>
  )
}

function CartItemRow({ item, onQty, onRemove, compact = false, hideBrand = false }: {
  item: CartItem; onQty: (q: number) => void; onRemove: () => void
  compact?: boolean; hideBrand?: boolean
}) {
  return (
    <div className={cn('flex items-start gap-2.5', compact ? 'px-3 py-2.5' : 'bg-gray-50 rounded-xl p-3')}>
      <div className="flex-1 min-w-0">
        {!hideBrand && <p className="text-xs text-gray-400 truncate mb-0.5">{item.product.brand?.name}</p>}
        <p className={cn('font-medium text-gray-900 truncate', compact ? 'text-xs' : 'text-sm')}>{item.product.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">{item.unit_price.toFixed(2)} € /u</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p className={cn('font-bold text-gray-900', compact ? 'text-xs' : 'text-sm')}>{item.total_price.toFixed(2)} €</p>
        <div className="flex items-center gap-1">
          <button onClick={() => onQty(item.quantity - 1)}
            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-white rounded border border-gray-200 transition-colors">
            <Minus size={10} />
          </button>
          <span className="w-5 text-center text-xs font-semibold text-gray-800">{item.quantity}</span>
          <button onClick={() => onQty(item.quantity + 1)}
            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-white rounded border border-gray-200 transition-colors">
            <Plus size={10} />
          </button>
          <button onClick={onRemove}
            className="w-5 h-5 flex items-center justify-center text-red-400 hover:bg-red-50 rounded ml-0.5 transition-colors">
            <X size={10} />
          </button>
        </div>
      </div>
    </div>
  )
}
