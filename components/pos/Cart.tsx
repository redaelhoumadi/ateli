'use client'

import { useMemo } from 'react'
import { useCartStore } from '@/hooks/useCart'
import { REWARDS_TIERS, getTierForSpend } from '@/lib/customerPortal'
import type { CartItem } from '@/types'

type Props = { onCheckout: () => void }

// Palette de couleurs par marque (cyclique)
const BRAND_COLORS = [
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#4338CA', dot: '#6366F1' },
  { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', dot: '#22C55E' },
  { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C', dot: '#F97316' },
  { bg: '#FDF4FF', border: '#E9D5FF', text: '#7E22CE', dot: '#A855F7' },
  { bg: '#FFF1F2', border: '#FECDD3', text: '#BE123C', dot: '#F43F5E' },
  { bg: '#ECFEFF', border: '#A5F3FC', text: '#0E7490', dot: '#06B6D4' },
  { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', dot: '#F59E0B' },
  { bg: '#F0FDF4', border: '#6EE7B7', text: '#065F46', dot: '#10B981' },
]

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-orange-50 text-orange-700 border-orange-200',
  silver: 'bg-gray-100 text-gray-600 border-gray-300',
  gold:   'bg-amber-50 text-amber-700 border-amber-200',
  vip:    'bg-purple-50 text-purple-700 border-purple-200',
}

export function Cart({ onCheckout }: Props) {
  const {
    items,
    customer,
    customerTotalSpend,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    productDiscounts,
    loyaltyDiscountPct,
    loyaltyDiscountAmount,
    total,
    totalItems,
  } = useCartStore()

  const sub       = subtotal()
  const prodDisc  = productDiscounts()
  const loyPct    = loyaltyDiscountPct()
  const loyAmt    = loyaltyDiscountAmount()
  const tot       = total()
  const itemCount = totalItems()

  const tier     = customer ? getTierForSpend(customerTotalSpend) : null
  const nextTier = tier
    ? REWARDS_TIERS.find((t) => t.minSpend > customerTotalSpend) ?? null
    : null

  // ── Group items by brand ───────────────────────────────────
  const brandGroups = useMemo(() => {
    const map = new Map<string, { items: CartItem[]; subtotal: number; colorIdx: number }>()
    let colorIdx = 0
    const brandColorMap = new Map<string, number>()

    items.forEach((item) => {
      const brand = item.product.brand?.name ?? 'Sans marque'
      if (!brandColorMap.has(brand)) {
        brandColorMap.set(brand, colorIdx % BRAND_COLORS.length)
        colorIdx++
      }
      const existing = map.get(brand)
      if (existing) {
        existing.items.push(item)
        existing.subtotal += item.total_price
      } else {
        map.set(brand, {
          items: [item],
          subtotal: item.total_price,
          colorIdx: brandColorMap.get(brand)!,
        })
      }
    })
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }))
  }, [items])

  const isSingleBrand = brandGroups.length <= 1

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Panier</h2>
          <p className="text-xs text-gray-500">
            {itemCount} article{itemCount > 1 ? 's' : ''}
            {brandGroups.length > 1 && (
              <span className="ml-1 text-gray-400">· {brandGroups.length} marques</span>
            )}
          </p>
        </div>
        {items.length > 0 && (
          <button onClick={clearCart} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            Vider
          </button>
        )}
      </div>

      {/* ── Items ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300">
            <span className="text-5xl mb-3">🛒</span>
            <p className="text-sm text-gray-400">Panier vide</p>
            <p className="text-xs text-gray-300 mt-1">Cliquez sur un produit pour l'ajouter</p>
          </div>
        ) : isSingleBrand ? (
          /* ── Single brand: flat list (no group header) ── */
          <div className="px-4 space-y-2">
            {items.map((item) => (
              <CartItemRow
                key={item.product.id}
                item={item}
                onQty={(qty) => updateQuantity(item.product.id, qty)}
                onRemove={() => removeItem(item.product.id)}
              />
            ))}
          </div>
        ) : (
          /* ── Multi-brand: grouped ── */
          brandGroups.map((group) => {
            const palette = BRAND_COLORS[group.colorIdx]
            // Apply loyalty discount proportionally to brand subtotal
            const brandLoyDiscount = loyPct > 0 ? group.subtotal * (loyPct / 100) : 0
            const brandTotal = group.subtotal - brandLoyDiscount

            return (
              <div key={group.name} className="px-4">
                {/* Brand header */}
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-t-xl border-l-4"
                  style={{
                    background: palette.bg,
                    borderColor: palette.dot,
                    borderTop: `1px solid ${palette.border}`,
                    borderRight: `1px solid ${palette.border}`,
                    borderBottom: 'none',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs font-black shrink-0"
                      style={{ background: palette.dot }}
                    >
                      {group.name[0]}
                    </div>
                    <span className="text-xs font-bold" style={{ color: palette.text }}>
                      {group.name}
                    </span>
                    <span className="text-xs font-medium opacity-60" style={{ color: palette.text }}>
                      · {group.items.reduce((s, i) => s + i.quantity, 0)} art.
                    </span>
                  </div>
                  <div className="text-right">
                    {loyPct > 0 ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs line-through opacity-50" style={{ color: palette.text }}>
                          {group.subtotal.toFixed(2)} €
                        </span>
                        <span className="text-sm font-black" style={{ color: palette.text }}>
                          {brandTotal.toFixed(2)} €
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-black" style={{ color: palette.text }}>
                        {group.subtotal.toFixed(2)} €
                      </span>
                    )}
                  </div>
                </div>

                {/* Brand items */}
                <div
                  className="rounded-b-xl border-l-4 overflow-hidden"
                  style={{
                    background: `${palette.bg}88`,
                    borderColor: palette.dot,
                    borderRight: `1px solid ${palette.border}`,
                    borderBottom: `1px solid ${palette.border}`,
                  }}
                >
                  <div className="divide-y" style={{ borderColor: `${palette.border}88` }}>
                    {group.items.map((item) => (
                      <CartItemRow
                        key={item.product.id}
                        item={item}
                        onQty={(qty) => updateQuantity(item.product.id, qty)}
                        onRemove={() => removeItem(item.product.id)}
                        compact
                        hideBrand
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Summary ─────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">

          {/* Brand totals recap (multi-brand only) */}
          {!isSingleBrand && (
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total par marque</p>
              </div>
              <div className="divide-y divide-gray-50">
                {brandGroups.map((group) => {
                  const palette = BRAND_COLORS[group.colorIdx]
                  const brandLoyDiscount = loyPct > 0 ? group.subtotal * (loyPct / 100) : 0
                  const brandTotal = group.subtotal - brandLoyDiscount
                  const brandPct = sub > 0 ? (group.subtotal / sub) * 100 : 0

                  return (
                    <div key={group.name} className="flex items-center gap-2.5 px-3 py-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: palette.dot }}
                      />
                      <span className="text-xs font-medium text-gray-700 flex-1 truncate">
                        {group.name}
                      </span>
                      {/* Mini bar */}
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${brandPct}%`, background: palette.dot }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-900 w-16 text-right shrink-0">
                        {loyPct > 0 ? (
                          <span style={{ color: palette.text }}>{brandTotal.toFixed(2)} €</span>
                        ) : (
                          `${group.subtotal.toFixed(2)} €`
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Loyalty tier badge */}
          {customer && tier && (
            <div className={`rounded-xl px-4 py-3 border ${TIER_COLORS[tier.id]}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {tier.id === 'bronze' && '🥉'}
                    {tier.id === 'silver' && '🥈'}
                    {tier.id === 'gold'   && '🥇'}
                    {tier.id === 'vip'    && '💜'}
                  </span>
                  <span className="text-xs font-bold">{customer.name} — {tier.label}</span>
                </div>
                {loyPct > 0 && (
                  <span className="text-sm font-black">-{loyPct} %</span>
                )}
              </div>
              {loyPct === 0 ? (
                nextTier && (
                  <p className="text-xs opacity-70">
                    💡 Il manque <strong>{(nextTier.minSpend - customerTotalSpend).toFixed(0)} €</strong> pour -{nextTier.discount} %
                  </p>
                )
              ) : (
                <p className="text-xs opacity-80 font-medium">
                  Remise fidélité de <strong>{loyPct} %</strong> appliquée automatiquement
                </p>
              )}
            </div>
          )}

          {/* Totals */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Sous-total</span>
              <span>{sub.toFixed(2)} €</span>
            </div>
            {prodDisc > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Remises produits</span>
                <span>-{prodDisc.toFixed(2)} €</span>
              </div>
            )}
            {loyAmt > 0 && (
              <div className="flex justify-between text-sm font-medium" style={{ color: tier?.color }}>
                <span>Remise fidélité ({loyPct} %)</span>
                <span>-{loyAmt.toFixed(2)} €</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>{tot.toFixed(2)} €</span>
            </div>
          </div>

          <button
            onClick={onCheckout}
            className="w-full bg-black text-white py-3.5 rounded-xl font-semibold hover:bg-gray-800 transition-all text-sm"
          >
            Encaisser {tot.toFixed(2)} €
          </button>
        </div>
      )}
    </div>
  )
}

// ── Reusable item row ─────────────────────────────────────────
function CartItemRow({
  item,
  onQty,
  onRemove,
  compact = false,
  hideBrand = false,
}: {
  item: CartItem
  onQty: (qty: number) => void
  onRemove: () => void
  compact?: boolean
  hideBrand?: boolean
}) {
  return (
    <div className={`flex items-start gap-2.5 ${compact ? 'px-3 py-2.5' : 'bg-gray-50 rounded-xl p-3'}`}>
      <div className="flex-1 min-w-0">
        {!hideBrand && (
          <p className="text-xs text-gray-400 truncate mb-0.5">{item.product.brand?.name}</p>
        )}
        <p className={`font-medium text-gray-900 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
          {item.product.name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{item.unit_price.toFixed(2)} € / u</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p className={`font-bold text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>
          {item.total_price.toFixed(2)} €
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onQty(item.quantity - 1)}
            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-white rounded border border-gray-200 text-xs font-bold transition-colors"
          >−</button>
          <span className="w-5 text-center text-xs font-semibold text-gray-800">{item.quantity}</span>
          <button
            onClick={() => onQty(item.quantity + 1)}
            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-white rounded border border-gray-200 text-xs font-bold transition-colors"
          >+</button>
          <button
            onClick={onRemove}
            className="w-5 h-5 flex items-center justify-center text-red-400 hover:bg-red-50 rounded text-xs ml-0.5 transition-colors"
          >✕</button>
        </div>
      </div>
    </div>
  )
}
