import { create } from 'zustand'
import type { CartItem, Customer, Product } from '@/types'
import { getTierForSpend } from '@/lib/customerPortal'

// ─── Fidélité : paliers basés sur le CA cumulé ────────────────
// Le palier du client est calculé depuis son historique d'achats.
// La remise s'applique automatiquement en % sur le sous-total.

type CartStore = {
  items: CartItem[]
  customer: Customer | null
  customerTotalSpend: number
  paymentMethod: string
  sellerId: string

  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, qty: number) => void
  clearCart: () => void
  setCustomer: (customer: Customer | null, totalSpend?: number) => void
  setPaymentMethod: (method: string) => void
  setSellerId: (id: string) => void

  subtotal: () => number
  productDiscounts: () => number
  loyaltyDiscountPct: () => number
  loyaltyDiscountAmount: () => number
  total: () => number
  totalItems: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  customer: null,
  customerTotalSpend: 0,
  paymentMethod: 'card',
  sellerId: '',

  addItem: (product) => {
    const items = get().items
    const existing = items.find((i) => i.product.id === product.id)
    const unitPrice = product.discount
      ? product.price * (1 - product.discount / 100)
      : product.price

    if (existing) {
      set({
        items: items.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1, total_price: (i.quantity + 1) * i.unit_price }
            : i
        ),
      })
    } else {
      set({
        items: [...items, { product, quantity: 1, unit_price: unitPrice, total_price: unitPrice }],
      })
    }
  },

  removeItem: (productId) =>
    set({ items: get().items.filter((i) => i.product.id !== productId) }),

  updateQuantity: (productId, qty) => {
    if (qty <= 0) { get().removeItem(productId); return }
    set({
      items: get().items.map((i) =>
        i.product.id === productId
          ? { ...i, quantity: qty, total_price: qty * i.unit_price }
          : i
      ),
    })
  },

  clearCart: () =>
    set({ items: [], customer: null, customerTotalSpend: 0, paymentMethod: 'card' }),

  setCustomer: (customer, totalSpend = 0) =>
    set({ customer, customerTotalSpend: totalSpend }),

  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setSellerId: (id) => set({ sellerId: id }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.total_price, 0),

  productDiscounts: () =>
    get().items.reduce((sum, i) => sum + (i.product.price * i.quantity - i.total_price), 0),

  loyaltyDiscountPct: () => {
    const { customer, customerTotalSpend } = get()
    if (!customer) return 0
    return getTierForSpend(customerTotalSpend).discount
  },

  loyaltyDiscountAmount: () => {
    const pct = get().loyaltyDiscountPct()
    return pct === 0 ? 0 : get().subtotal() * (pct / 100)
  },

  total: () => Math.max(0, get().subtotal() - get().loyaltyDiscountAmount()),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
