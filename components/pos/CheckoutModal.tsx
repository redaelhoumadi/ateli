'use client'

import { useState } from 'react'
import { useCartStore } from '@/hooks/useCart'
import { createSale } from '@/lib/supabase'
import { getTierForSpend } from '@/lib/customerPortal'
import type { Sale } from '@/types'

type Props = { onClose: () => void; onSuccess: (sale: Sale) => void }

const PAYMENT_METHODS = [
  { id: 'card',  label: 'Carte bancaire', icon: '💳' },
  { id: 'cash',  label: 'Espèces',        icon: '💵' },
  { id: 'mixed', label: 'Mixte',          icon: '🔀' },
]

export function CheckoutModal({ onClose, onSuccess }: Props) {
  const {
    items, customer, customerTotalSpend, sellerId,
    paymentMethod, setPaymentMethod,
    subtotal, loyaltyDiscountPct, loyaltyDiscountAmount, total, totalItems,
    clearCart,
  } = useCartStore()

  const [cashGiven, setCashGiven] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const tot    = total()
  const loyPct = loyaltyDiscountPct()
  const loyAmt = loyaltyDiscountAmount()
  const change = paymentMethod === 'cash' ? Math.max(0, Number(cashGiven) - tot) : 0
  const tier   = customer ? getTierForSpend(customerTotalSpend) : null

  const handleConfirm = async () => {
    if (!sellerId) { setError('Veuillez sélectionner un vendeur'); return }
    setLoading(true); setError('')
    try {
      const sale = await createSale({
        customer_id:    customer?.id ?? null,
        seller_id:      sellerId,
        total:          tot,
        total_items:    totalItems(),
        points_earned:  0,   // plus de points — système % uniquement
        points_used:    0,
        payment_method: paymentMethod,
        items: items.map((i) => ({
          product_id:  i.product.id,
          quantity:    i.quantity,
          unit_price:  i.unit_price,
          total_price: i.total_price,
        })),
      })
      clearCart()
      onSuccess(sale as Sale)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la vente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-black px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Encaissement</h2>
          <p className="text-gray-400 text-sm">{totalItems()} articles · {tot.toFixed(2)} € TTC</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Customer + tier recap */}
          {customer && tier ? (
            <div className="rounded-xl p-4 flex items-center gap-3 border"
              style={{ background: tier.bg, borderColor: `${tier.color}33` }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                style={{ background: tier.color }}>
                {customer.name[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{customer.name}</p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-white"
                    style={{ color: tier.color, borderColor: `${tier.color}40` }}>
                    {tier.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {customerTotalSpend.toFixed(0)} € cumulés
                </p>
              </div>
              {loyPct > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Remise fidélité</p>
                  <p className="text-xl font-black" style={{ color: tier.color }}>-{loyPct} %</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">
                Vente sans compte client — aucune remise fidélité appliquée
              </p>
            </div>
          )}

          {/* Payment method */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Mode de paiement</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    paymentMethod === m.id
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}>
                  <span className="text-xl">{m.icon}</span>
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cash calculator */}
          {paymentMethod === 'cash' && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Calculer la monnaie</p>
              <div className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <input type="number" value={cashGiven}
                    onChange={(e) => setCashGiven(e.target.value)}
                    placeholder="Somme remise" min={tot} step="0.50"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Rendu</p>
                  <p className={`text-xl font-bold ${change > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {change.toFixed(2)} €
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[20, 50, 100, 200].map((amt) => (
                  <button key={amt} onClick={() => setCashGiven(String(amt))}
                    className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:border-gray-400">
                    {amt} €
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Order summary */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-2">
            {items.map((item) => (
              <div key={item.product.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.product.name} × {item.quantity}</span>
                <span className="font-medium">{item.total_price.toFixed(2)} €</span>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100 space-y-1">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Sous-total</span>
                <span>{subtotal().toFixed(2)} €</span>
              </div>
              {loyAmt > 0 && (
                <div className="flex justify-between text-sm font-semibold" style={{ color: tier?.color }}>
                  <span>Remise fidélité -{loyPct} %</span>
                  <span>-{loyAmt.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-1">
                <span>Total</span>
                <span>{tot.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">{error}</p>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Annuler
            </button>
            <button onClick={handleConfirm} disabled={loading}
              className="flex-grow-[2] flex-1 py-3 bg-black text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50">
              {loading ? 'Traitement...' : `✓ Confirmer ${tot.toFixed(2)} €`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
