'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Printer, Mail, Share2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogTitle, DialogFooter,
  Button, Badge, Separator, cn,
} from '@/components/ui'
import { getSettings } from '@/lib/supabase'
import type { Sale } from '@/types'

const PAY: Record<string, string> = {
  card: '💳 Carte', cash: '💵 Espèces', mixed: '🔀 Mixte',
  gift_card: '🎁 Bon cadeau',
}

function buildReceiptHtml(sale: Sale, settings: Record<string,string>): string {
  const date    = new Date(sale.created_at)
  const shopName = settings.shop_name    || 'Ateli POS'
  const address  = settings.shop_address || ''
  const phone    = settings.shop_phone   || ''
  const siret    = settings.shop_siret   || ''
  const tva      = settings.shop_tva     || ''
  const msg      = settings.receipt_msg  || 'Merci de votre visite !'

  // Compute subtotal brut vs total to detect discount
  const subtotal = (sale.items || []).reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
  const discount = Math.round((subtotal - sale.total) * 100) / 100
  const hasDiscount = discount > 0.005

  const itemsHtml = (sale.items || []).map((i: any) => `
    <div class="row">
      <span class="item-name">${i.product?.name || '—'} ×${i.quantity}</span>
      <span>${i.total_price.toFixed(2)} €</span>
    </div>
    <div class="sub">${i.unit_price.toFixed(2)} € / unité${i.product?.brand?.name ? ' · ' + i.product.brand.name : ''}</div>
  `).join('')

  return `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<title>Ticket — ${shopName}</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 76mm; margin: 0 auto; padding: 4mm; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .large { font-size: 16px; font-weight: bold; }
  .xlarge { font-size: 20px; font-weight: 900; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin: 3px 0; }
  .item-name { flex: 1; margin-right: 8px; word-break: break-word; }
  .sub { color: #666; font-size: 10px; margin: 0 0 4px 4px; }
  .total-row { font-size: 15px; font-weight: 900; border-top: 2px solid #000; padding-top: 6px; margin-top: 4px; }
  .discount-row { color: #2a7a2a; }
  .small { font-size: 10px; color: #444; }
  .logo { font-size: 22px; font-weight: 900; letter-spacing: -1px; }
  .qr-hint { font-size: 9px; color: #666; margin-top: 2px; }
  .tag { display: inline-block; background: #f0f0f0; border-radius: 3px; padding: 1px 4px; font-size: 10px; }
</style>
</head><body>
  <!-- Header -->
  <div class="center" style="margin-bottom:8px;">
    <div class="logo">${shopName}</div>
    ${address ? `<div class="small">${address}</div>` : ''}
    ${phone   ? `<div class="small">Tél : ${phone}</div>` : ''}
  </div>
  <div class="line"></div>
  <div class="row small">
    <span>${date.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</span>
    <span>${date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}</span>
  </div>
  ${(sale as any).seller?.name ? `<div class="small">Vendeur : ${(sale as any).seller.name}</div>` : ''}
  ${(sale as any).customer?.name ? `<div class="small">Client : ${(sale as any).customer.name}</div>` : ''}
  <div class="line"></div>

  <!-- Items -->
  ${itemsHtml}
  <div class="line"></div>

  <!-- Totals -->
  ${hasDiscount ? `
    <div class="row small"><span>Sous-total</span><span>${subtotal.toFixed(2)} €</span></div>
    <div class="row small discount-row"><span>Remise</span><span>-${discount.toFixed(2)} €</span></div>
  ` : ''}
  <div class="row total-row"><span>TOTAL</span><span>${sale.total.toFixed(2)} €</span></div>
  <div class="row small" style="margin-top:4px;"><span>Règlement</span><span>${PAY[sale.payment_method] || sale.payment_method}</span></div>

  <!-- Legal -->
  ${siret ? `<div class="line"></div><div class="small">SIRET : ${siret}</div>` : ''}
  ${tva ? `<div class="small">TVA intracom : ${tva}</div>` : ''}

  <!-- Footer message -->
  <div class="line"></div>
  <div class="center small" style="margin:6px 0;">${msg}</div>

  <!-- Loyalty hint -->
  <div class="center" style="margin-top:8px;">
    <div class="qr-hint">🎁 Programme fidélité — Scannez le QR code en boutique</div>
  </div>
  <div class="line"></div>
  <div class="center small">Ticket à conserver · Non remboursable sauf défaut</div>
</body></html>`
}

export function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [printed, setPrinted]   = useState(false)
  const date = new Date(sale.created_at)

  useEffect(() => {
    getSettings().then(s => setSettings(s || {})).catch(() => {})
  }, [])

  const handlePrint = () => {
    const html = buildReceiptHtml(sale, settings)
    const w = window.open('', '_blank', 'width=320,height=700')
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => { w.print(); setPrinted(true) }, 400)
  }

  const loyaltyApplied = !!(sale as any).customer_id
  const subtotal = (sale.items || []).reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
  const discount = Math.round((subtotal - sale.total) * 100) / 100
  const hasDiscount = discount > 0.005

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm overflow-hidden p-0">
        <DialogTitle className="sr-only">Vente validée</DialogTitle>

        {/* Success banner */}
        <div className="bg-gray-900 px-6 py-6 text-center rounded-t-2xl">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={28} className="text-green-500"/>
          </div>
          <p className="text-white font-black text-xl">Vente validée !</p>
          <p className="text-gray-400 text-sm mt-1">
            {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            {' · '}{sale.total_items} article{sale.total_items > 1 ? 's' : ''}
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Amount */}
          <div className="text-center py-2">
            {hasDiscount && (
              <p className="text-sm text-gray-400 line-through">{subtotal.toFixed(2)} €</p>
            )}
            <p className="text-4xl font-black text-gray-900">{sale.total.toFixed(2)} €</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="secondary">{PAY[sale.payment_method] || sale.payment_method}</Badge>
              {hasDiscount && (
                <Badge variant="success" className="text-xs">-{discount.toFixed(2)} € remise</Badge>
              )}
            </div>
          </div>

          {/* Loyalty */}
          {loyaltyApplied && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-purple-700 font-semibold">🎁 Remise fidélité appliquée</p>
            </div>
          )}

          {/* Items summary */}
          {sale.items && sale.items.length > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden">
              <div className="max-h-32 overflow-y-auto divide-y divide-gray-100">
                {(sale.items as any[]).map((item, i) => (
                  <div key={i} className="flex justify-between items-center px-4 py-2 text-xs">
                    <div className="min-w-0 mr-2">
                      <p className="font-medium text-gray-900 truncate">{item.product?.name || '—'}</p>
                      {item.product?.brand?.name && (
                        <p className="text-gray-400">{item.product.brand.name} · ×{item.quantity}</p>
                      )}
                    </div>
                    <span className="font-bold text-gray-900 shrink-0">{item.total_price.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
              {hasDiscount && (
                <div className="px-4 py-2 bg-green-50 border-t border-green-100 flex justify-between text-xs text-green-700 font-semibold">
                  <span>Remise appliquée</span><span>-{discount.toFixed(2)} €</span>
                </div>
              )}
              <div className="px-4 py-2.5 bg-white border-t border-gray-100 flex justify-between text-sm font-black">
                <span>Total</span><span>{sale.total.toFixed(2)} €</span>
              </div>
            </div>
          )}

          <Separator/>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handlePrint} className={cn('gap-2 text-sm', printed && 'text-green-600 border-green-200')}>
              <Printer size={14}/>
              {printed ? 'Imprimé ✓' : 'Ticket'}
            </Button>
            <Button onClick={onClose} className="font-bold text-sm">
              Nouvelle vente →
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
