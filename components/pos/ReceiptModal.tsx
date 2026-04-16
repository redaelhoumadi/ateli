'use client'

import { CheckCircle, Printer } from 'lucide-react'
import {
  Dialog, DialogContent, DialogTitle, DialogFooter,
  Button, Badge, Separator,
} from '@/components/ui'
import type { Sale } from '@/types'

export function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const date = new Date(sale.created_at)
  const PAY: Record<string, string> = { card: '💳 Carte', cash: '💵 Espèces', mixed: '🔀 Mixte' }

  const print = () => {
    const w = window.open('', '_blank', 'width=320,height=600')
    if (!w) return
    w.document.write(`<html><head><title>Ticket</title>
      <style>body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}
      h2{text-align:center;margin:0 0 4px}.center{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}
      .row{display:flex;justify-content:space-between}.total{font-weight:bold;font-size:14px}</style></head><body>
      <h2>ATELI POS</h2><p class="center">${date.toLocaleString('fr-FR')}</p>
      <div class="line"></div>
      ${(sale.items||[]).map((i:any)=>`<div class="row"><span>${i.product?.name||'—'} ×${i.quantity}</span><span>${i.total_price.toFixed(2)} €</span></div>`).join('')}
      <div class="line"></div>
      <div class="row total"><span>TOTAL</span><span>${sale.total.toFixed(2)} €</span></div>
      <div class="line"></div><p class="center">Merci de votre visite !</p></body></html>`)
    w.document.close(); w.print()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm overflow-hidden p-0">
        <DialogTitle className="sr-only">Vente validée</DialogTitle>
        {/* Success banner */}
        <div className="bg-green-500 px-6 py-6 text-center rounded-t-2xl">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={28} className="text-green-500" />
          </div>
          <p className="text-white font-black text-xl">Vente validée !</p>
          <p className="text-green-100 text-sm mt-1">
            {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {sale.total_items} article{sale.total_items > 1 ? 's' : ''}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Amount */}
          <div className="text-center">
            <p className="text-4xl font-black text-gray-900">{sale.total.toFixed(2)} €</p>
            <Badge variant="secondary" className="mt-2">{PAY[sale.payment_method] || sale.payment_method}</Badge>
          </div>

          {sale.customer_id && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-gray-500">🎁 Remise fidélité appliquée sur cette vente</p>
            </div>
          )}

          {/* Items */}
          {sale.items && sale.items.length > 0 && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="max-h-36 overflow-y-auto divide-y divide-gray-50 px-4 py-2">
                {(sale.items as any[]).map((item, i) => (
                  <div key={i} className="flex justify-between py-1.5 text-xs text-gray-600">
                    <span className="truncate mr-2">{item.product?.name || '—'} ×{item.quantity}</span>
                    <span className="shrink-0 font-medium">{item.total_price.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between text-sm font-black">
                <span>Total</span><span>{sale.total.toFixed(2)} €</span>
              </div>
            </div>
          )}

          <Separator />

          <div className="flex gap-3">
            <Button variant="outline" onClick={print} className="flex-1 gap-2">
              <Printer size={14} /> Ticket
            </Button>
            <Button onClick={onClose} className="flex-[2] font-bold">
              Nouvelle vente →
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
