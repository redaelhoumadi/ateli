'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { QrCode, ShoppingBag, History } from 'lucide-react'
import { ProductCatalog }    from '@/components/pos/ProductCatalog'
import { Cart }              from '@/components/pos/Cart'
import { CustomerSelector }  from '@/components/pos/CustomerSelector'
import { CheckoutModal }     from '@/components/pos/CheckoutModal'
import { ReceiptModal }      from '@/components/pos/ReceiptModal'
import { QRCodeDisplay }     from '@/components/pos/QRCodeDisplay'
import { DailySalesPanel }   from '@/components/pos/DailySalesPanel'
import { useCartStore }      from '@/hooks/useCart'
import { useOfflineCart }    from '@/hooks/useOfflineCart'
import { OfflineStatusBanner } from '@/components/pos/OfflineStatusBanner'
import { useAuthStore }      from '@/hooks/useAuth'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
  cn,
} from '@/components/ui'
import type { Sale } from '@/types'

export default function POSPage() {
  const [showCheckout, setShowCheckout]   = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [showQR, setShowQR]               = useState(false)
  const [cartOpen, setCartOpen]           = useState(false)
  const [historyOpen, setHistoryOpen]     = useState(false)

  const { setSellerId, sellerId, items, totalItems } = useCartStore()
  const { saveCart } = useOfflineCart()

  useEffect(() => {
    if (items.length > 0) saveCart({ items, customer: null, sellerId })
  }, [items, sellerId, saveCart])

  const cartHasItems = items.length > 0
  const itemCount    = totalItems()

  // Auto-open cart when first item added, close when cart is empty
  useEffect(() => {
    if (items.length > 0 && !cartOpen) setCartOpen(true)
    if (items.length === 0) setCartOpen(false)
  }, [items.length])

  const activeSeller = useAuthStore(s => s.seller)
  useEffect(() => {
    if (activeSeller) setSellerId(activeSeller.id)
  }, [activeSeller, setSellerId])

  const toggleCart = () => {
    setCartOpen(v => !v)
    if (!cartOpen) setHistoryOpen(false)
  }

  const toggleHistory = () => {
    setHistoryOpen(v => !v)
    if (!historyOpen) setCartOpen(false)
  }

  return (
    <TooltipProvider delayDuration={300}>
      <OfflineStatusBanner/>
      <div className="h-full flex flex-col bg-gray-50 overflow-hidden">

        {/* ── POS top bar ── */}
        <header className="bg-white border-b border-gray-100 px-3 py-2 flex items-center justify-between shrink-0 shadow-sm gap-2">

          {/* Seller info */}
          {activeSeller && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0"
                style={{ background: activeSeller.role === 'manager' ? '#4338CA' : '#374151' }}>
                {activeSeller.name[0]}
              </div>
              <div className="hidden sm:block min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{activeSeller.name}</p>
                <p className="text-[10px] text-gray-400 capitalize">{activeSeller.role === 'manager' ? '🛡 Gérant' : '👤 Vendeur'}</p>
              </div>
            </div>
          )}

          {/* Right actions — icônes uniquement */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">

            {/* QR Fidélité */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowQR(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-black transition-colors shrink-0"
                >
                  <QrCode size={17}/>
                </button>
              </TooltipTrigger>
              <TooltipContent>QR Fidélité</TooltipContent>
            </Tooltip>

            {/* Ventes du jour */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleHistory}
                  className={cn(
                    'w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0',
                    historyOpen
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <History size={17}/>
                </button>
              </TooltipTrigger>
              <TooltipContent>{historyOpen ? 'Fermer les ventes du jour' : 'Ventes du jour'}</TooltipContent>
            </Tooltip>

            {/* Panier */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleCart}
                  className={cn(
                    'relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0',
                    cartOpen && cartHasItems
                      ? 'bg-gray-900 text-white hover:bg-black'
                      : cartHasItems
                      ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      : 'bg-white border border-gray-100 text-gray-300 cursor-default'
                  )}
                  disabled={!cartHasItems}
                >
                  <ShoppingBag size={17}/>
                  {itemCount > 0 && (
                    <span className={cn(
                      'absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-black flex items-center justify-center',
                      cartOpen ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                    )}>
                      {itemCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {!cartHasItems ? 'Panier vide' : cartOpen ? 'Fermer le panier' : 'Ouvrir le panier'}
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ── Main layout ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Catalog */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <CustomerSelector/>
            <ProductCatalog/>
          </div>

          {/* History panel — desktop */}
          <div className={cn(
            'hidden lg:flex flex-col bg-white border-l border-gray-100 transition-all duration-300 ease-in-out overflow-hidden shrink-0',
            historyOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 border-l-0'
          )}>
            <div className="w-80 h-full flex flex-col">
              {historyOpen && (
                <DailySalesPanel
                  sellerId={sellerId}
                  onClose={() => setHistoryOpen(false)}
                  newSale={completedSale}
                />
              )}
            </div>
          </div>

          {/* Cart panel — desktop */}
          <div className={cn(
            'hidden lg:flex flex-col bg-white border-l border-gray-100 transition-all duration-300 ease-in-out overflow-hidden shrink-0',
            cartOpen && cartHasItems ? 'w-96 opacity-100' : 'w-0 opacity-0 border-l-0'
          )}>
            <div className="w-96 h-full flex flex-col">
              <Cart onCheckout={() => setShowCheckout(true)}/>
            </div>
          </div>
        </div>

        {/* Mobile: History bottom sheet */}
        {historyOpen && (
          <div className="lg:hidden fixed inset-0 z-30 flex flex-col" style={{top:0}}>
            <div className="flex-1 bg-black/30" onClick={() => setHistoryOpen(false)}/>
            <div className="bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
              <DailySalesPanel
                sellerId={sellerId}
                onClose={() => setHistoryOpen(false)}
                newSale={completedSale}
              />
            </div>
          </div>
        )}

        {/* Mobile: Cart bottom sheet */}
        {cartOpen && cartHasItems && (
          <div className="lg:hidden fixed inset-0 z-30 flex flex-col" style={{top:0}}>
            <div className="flex-1 bg-black/30" onClick={() => setCartOpen(false)}/>
            <div className="bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
              <Cart onCheckout={() => { setShowCheckout(true) }} onClose={() => setCartOpen(false)} isMobile/>
            </div>
          </div>
        )}

        {/* Checkout */}
        {showCheckout && (
          <CheckoutModal
            onClose={() => setShowCheckout(false)}
            onSuccess={sale => {
              setShowCheckout(false)
              setCompletedSale(sale)
              // Auto-refresh history if open
              if (historyOpen) setHistoryOpen(false)
              setTimeout(() => setHistoryOpen(true), 100)
            }}
          />
        )}

        {/* Receipt */}
        {completedSale && (
          <ReceiptModal sale={completedSale} onClose={() => setCompletedSale(null)}/>
        )}

        {/* QR modal */}
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="max-w-sm overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Programme fidélité</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5 flex flex-col items-center gap-4">
              <p className="text-sm text-gray-500 text-center">
                Le client scanne ce QR code pour créer son compte ou consulter ses avantages
              </p>
              <QRCodeDisplay/>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button variant="outline" onClick={() => setShowQR(false)} className="flex-1">Fermer</Button>
              <Button asChild className="flex-1">
                <a href="/qr" target="_blank">Plein écran →</a>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  )
}
