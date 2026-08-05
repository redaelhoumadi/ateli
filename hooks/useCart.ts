import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CartItem, Customer, Product, ProductVariant } from '@/types'
import { getTierForSpend } from '@/lib/customerPortal'

type CartStore = {
  items:              CartItem[]
  customer:           Customer | null
  customerTotalSpend: number
  paymentMethod:      string
  sellerId:           string

  addItem:           (product: Product, variant?: ProductVariant | null) => void
  removeItem:        (productId: string, variantId?: string | null) => void
  updateQuantity:    (productId: string, qty: number, variantId?: string | null) => void
  clearCart:         () => void
  setCustomer:       (customer: Customer | null, totalSpend?: number) => void
  setPaymentMethod:  (method: string) => void
  setSellerId:       (id: string) => void

  subtotal:              () => number
  productDiscounts:      () => number
  loyaltyDiscountPct:    () => number
  loyaltyDiscountAmount: () => number
  total:                 () => number
  totalItems:            () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items:              [],
      customer:           null,
      customerTotalSpend: 0,
      paymentMethod:      'card',
      sellerId:           '',

      addItem: (product, variant = null) => {
        const items = get().items
        // Clé unique = produit + variante (deux tailles = deux lignes)
        const match = (i: CartItem) =>
          i.product.id === product.id && (i.variant?.id ?? null) === (variant?.id ?? null)
        const existing = items.find(match)
        // Prix : variante > produit, avec remise produit appliquée
        const basePrice = variant?.price ?? product.price
        const unitPrice = product.discount
          ? basePrice * (1 - product.discount / 100)
          : basePrice

        if (existing) {
          set({
            items: items.map(i =>
              match(i)
                ? { ...i, quantity: i.quantity + 1, total_price: (i.quantity + 1) * i.unit_price }
                : i
            ),
          })
        } else {
          set({
            items: [...items, { product, variant, quantity: 1, unit_price: unitPrice, total_price: unitPrice }],
          })
        }
      },

      removeItem: (productId, variantId = null) =>
        set({ items: get().items.filter(i => !(i.product.id === productId && (i.variant?.id ?? null) === variantId)) }),

      updateQuantity: (productId, qty) => {
        if (qty <= 0) { get().removeItem(productId); return }
        set({
          items: get().items.map(i =>
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
      setSellerId:      (id) => set({ sellerId: id }),

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
    }),
    {
      name:    'ateli-cart',          // clé dans sessionStorage
      storage: createJSONStorage(() => sessionStorage),
      // On persist uniquement les données — pas les fonctions
      partialize: (state) => ({
        items:              state.items,
        customer:           state.customer,
        customerTotalSpend: state.customerTotalSpend,
        paymentMethod:      state.paymentMethod,
        sellerId:           state.sellerId,
      }),
    }
  )
)
