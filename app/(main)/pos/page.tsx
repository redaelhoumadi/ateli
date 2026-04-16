'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { QrCode, ShoppingBag, ChevronDown, Monitor } from 'lucide-react'
import { ProductCatalog } from '@/components/pos/ProductCatalog'
import { Cart } from '@/components/pos/Cart'
import { CustomerSelector } from '@/components/pos/CustomerSelector'
import { CheckoutModal } from '@/components/pos/CheckoutModal'
import { ReceiptModal } from '@/components/pos/ReceiptModal'
import { QRCodeDisplay } from '@/components/pos/QRCodeDisplay'
import { useCartStore } from '@/hooks/useCart'
import { getSellers } from '@/lib/supabase'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, Badge, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Separator, cn,
} from '@/components/ui'
import type { Seller, Sale } from '@/types'

export default function POSPage() {
  const [sellers, setSellers]           = useState<Seller[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [showQR, setShowQR]             = useState(false)
  const [cartOpen, setCartOpen]         = useState(false)

  const { setSellerId, sellerId, items, totalItems } = useCartStore()
  const cartHasItems = items.length > 0
  const itemCount    = totalItems()

  useEffect(() => {
    if (items.length > 0 && !cartOpen) setCartOpen(true)
    if (items.length === 0) setCartOpen(false)
  }, [items.length])

  useEffect(() => {
    getSellers().then(data => {
      setSellers(data || [])
      if (data && data.length > 0) setSellerId(data[0].id)
    })
  }, [setSellerId])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-full flex flex-col bg-gray-50 overflow-hidden">

        {/* ── POS top bar ── */}
        <header className="bg-white border-b border-gray-100 px-3 py-2 flex items-center justify-between shrink-0 shadow-sm gap-2">
          {/* Seller select */}
          <div className="flex items-center gap-2 min-w-0">
            <Select value={sellerId} onValueChange={setSellerId}>
              <SelectTrigger className="w-32 sm:w-40 h-8 text-xs border-gray-200 rounded-lg">
                <SelectValue placeholder="Vendeur…" />
              </SelectTrigger>
              <SelectContent>
                {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Right: QR + Cart */}
          <div className="flex items-center gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="default" size="sm" onClick={() => setShowQR(true)} className="gap-1.5 px-2.5 sm:px-3.5">
                  <QrCode size={14} />
                  <span className="hidden sm:inline">QR Fidélité</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Afficher le QR code client</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={cartOpen && cartHasItems ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCartOpen(v => !v)}
                  disabled={!cartHasItems}
                  className={cn('gap-1.5 px-2.5 sm:px-3.5 relative', !cartHasItems && 'opacity-40 cursor-not-allowed')}
                >
                  <ShoppingBag size={14} />
                  <span className="hidden sm:inline">Panier</span>
                  {itemCount > 0 && (
                    <span className={cn(
                      'min-w-[18px] h-[18px] px-1 rounded-full text-xs font-black flex items-center justify-center',
                      cartOpen ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                    )}>
                      {itemCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{cartOpen ? 'Fermer le panier' : 'Ouvrir le panier'}</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ── Main layout ── */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <CustomerSelector />
            <ProductCatalog />
          </div>

          {/* Cart panel — sidebar on desktop, overlay on mobile */}
          {/* Mobile overlay cart */}
          {cartOpen && cartHasItems && (
            <div className="lg:hidden fixed inset-0 z-30 flex flex-col" style={{top:0}}>
              <div className="flex-1 bg-black/30" onClick={() => setCartOpen(false)} />
              <div className="bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
                <Cart onCheckout={() => { setShowCheckout(true) }} onClose={() => setCartOpen(false)} isMobile />
              </div>
            </div>
          )}
          {/* Desktop sidebar cart */}
          <div className={cn(
            'hidden lg:flex flex-col bg-white border-l border-gray-100 transition-all duration-300 ease-in-out overflow-hidden shrink-0',
            cartOpen && cartHasItems ? 'w-96 opacity-100' : 'w-0 opacity-0 border-l-0'
          )}>
            <div className="w-96 h-full flex flex-col">
              <Cart onCheckout={() => setShowCheckout(true)} />
            </div>
          </div>
        </div>

        {/* Checkout */}
        {showCheckout && (
          <CheckoutModal
            onClose={() => setShowCheckout(false)}
            onSuccess={sale => { setShowCheckout(false); setCompletedSale(sale) }}
          />
        )}

        {/* Receipt */}
        {completedSale && (
          <ReceiptModal sale={completedSale} onClose={() => setCompletedSale(null)} />
        )}

        {/* QR modal */}
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Programme fidélité</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5 flex flex-col items-center gap-4">
              <p className="text-sm text-gray-500 text-center">
                Le client scanne ce QR code pour créer son compte ou consulter ses avantages
              </p>
              <QRCodeDisplay />
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
