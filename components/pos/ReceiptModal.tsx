'use client'

import type { Sale } from '@/types'

type Props = { sale: Sale; onClose: () => void }

export function ReceiptModal({ sale, onClose }: Props) {
  const date = new Date(sale.created_at)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Success header */}
        <div className="bg-green-500 px-6 py-5 text-center">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-green-500 text-2xl">✓</span>
          </div>
          <p className="text-white font-bold text-lg">Vente validée !</p>
          <p className="text-green-100 text-sm">{date.toLocaleString('fr-FR')}</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Sale summary */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total articles</span>
              <span className="font-medium">{sale.total_items}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Paiement</span>
              <span className="font-medium capitalize">{sale.payment_method}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100">
              <span>Total encaissé</span>
              <span>{sale.total.toFixed(2)} €</span>
            </div>
          </div>

          {/* Loyalty reminder if customer */}
          {sale.customer_id && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-gray-500">
                🎁 La remise fidélité a été appliquée automatiquement
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => window.print()}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
              🖨 Ticket
            </button>
            <button onClick={onClose}
              className="flex-[2] py-2.5 bg-black text-white rounded-xl text-sm font-bold hover:bg-gray-800">
              Nouvelle vente
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
