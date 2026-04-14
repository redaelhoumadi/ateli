'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { ProductCatalog } from '@/components/pos/ProductCatalog'
import { Cart } from '@/components/pos/Cart'
import { CustomerSelector } from '@/components/pos/CustomerSelector'
import { CheckoutModal } from '@/components/pos/CheckoutModal'
import { ReceiptModal } from '@/components/pos/ReceiptModal'
import { QRCodeDisplay } from '@/components/pos/QRCodeDisplay'
import { useCartStore } from '@/hooks/useCart'
import { getSellers } from '@/lib/supabase'
import type { Seller, Sale } from '@/types'

// ── Inline SVG icons ─────────────────────────────────────────
const IconQR = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <path d="M14 14h2v2h-2zM18 14h3M14 18h3M20 18v3M17 21h3"/>
  </svg>
)

const IconBox = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
    <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
  </svg>
)

const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const IconChart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/>
    <path d="m19 9-5 5-4-4-3 3"/>
  </svg>
)

const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
)

const IconCart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
    <path d="M3 6h18"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
)

const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

export default function POSPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [showQR, setShowQR] = useState(false)
  const { setSellerId, sellerId, items, totalItems } = useCartStore()
  const cartHasItems = items.length > 0
  const [cartOpen, setCartOpen] = useState(false)
  const itemCount = totalItems()

  // Auto-open when first item added, keep open state user-controlled after that
  const prevCount = useState(0)
  useEffect(() => {
    if (items.length > 0 && !cartOpen) setCartOpen(true)
    if (items.length === 0) setCartOpen(false)
  }, [items.length])

  useEffect(() => {
    getSellers().then((data) => {
      setSellers(data || [])
      if (data && data.length > 0) setSellerId(data[0].id)
    })
  }, [setSellerId])

  const currentSeller = sellers.find((s) => s.id === sellerId)

  return (
    <div className="h-screen flex flex-col bg-gray-50">

      {/* ── POS top bar: seller + QR + cart ────────────────── */}
      <header className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* Seller select */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
            <div className="w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center shrink-0">
              <IconUser />
            </div>
            <select
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="text-sm font-medium text-gray-800 bg-transparent focus:outline-none cursor-pointer pr-1 appearance-none"
              style={{ WebkitAppearance: 'none' }}
            >
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <IconChevron />
          </div>

          {/* QR Fidélité */}
          <button
            onClick={() => setShowQR(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 active:scale-95 transition-all"
          >
            <IconQR />
            <span>QR Fidélité</span>
          </button>
        </div>

        {/* Cart toggle */}
        <button
          onClick={() => setCartOpen((v) => !v)}
          disabled={!cartHasItems}
          className={`relative flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl border transition-all active:scale-95 ${
            cartOpen && cartHasItems
              ? 'bg-gray-900 text-white border-gray-900'
              : cartHasItems
              ? 'bg-white text-gray-800 border-gray-300 hover:border-gray-900 hover:bg-gray-50'
              : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
          }`}
        >
          <IconCart />
          <span>Panier</span>
          {itemCount > 0 && (
            <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-xs font-black flex items-center justify-center ${
              cartOpen ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
            }`}>
              {itemCount}
            </span>
          )}
        </button>
      </header>

      {/* ── Main layout ──────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Catalog — takes full width when cart is hidden */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <CustomerSelector />
          <ProductCatalog />
        </div>

        {/* Cart panel — slides in/out */}
        <div
          className={`flex flex-col bg-white border-l border-gray-200 transition-all duration-300 ease-in-out overflow-hidden ${
            cartOpen && cartHasItems ? 'w-96 opacity-100' : 'w-0 opacity-0 border-l-0'
          }`}
        >
          <div className="w-96 h-full flex flex-col">
            <Cart onCheckout={() => setShowCheckout(true)} />
          </div>
        </div>
      </div>

      {/* Checkout modal */}
      {showCheckout && (
        <CheckoutModal
          onClose={() => setShowCheckout(false)}
          onSuccess={(sale) => {
            setShowCheckout(false)
            setCompletedSale(sale)
          }}
        />
      )}

      {/* Receipt modal */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          onClose={() => setCompletedSale(null)}
        />
      )}

      {/* QR Code modal */}
      {showQR && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
          onClick={(e) => e.target === e.currentTarget && setShowQR(false)}
        >
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Programme fidélité</h2>
            <p className="text-sm text-gray-500 mb-6">
              Montre ce QR code au client pour qu'il crée son compte ou accède à ses points
            </p>
            <div className="flex justify-center mb-6">
              <QRCodeDisplay />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowQR(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
              <a
                href="/qr"
                target="_blank"
                className="flex-1 py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors text-center"
              >
                Plein écran →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
