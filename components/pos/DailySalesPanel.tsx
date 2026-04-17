'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, RefreshCw, TrendingUp, ShoppingCart, Trash2, ChevronDown, ChevronUp, CreditCard, Banknote, Shuffle, AlertTriangle } from 'lucide-react'
import { getTodaySales, cancelSale } from '@/lib/supabase'
import { Button, Badge, Separator, ScrollArea, Spinner, cn } from '@/components/ui'

type SaleItem = { quantity: number; unit_price: number; total_price: number; product?: { name: string; brand?: { name: string } } }
type Sale = { id: string; total: number; total_items: number; payment_method: string; created_at: string; note?: string | null; customer?: { name: string } | null; seller?: { name: string } | null; items?: SaleItem[] }

const PAY_ICON: Record<string, React.ReactNode> = {
  card:  <CreditCard size={12}/>,
  cash:  <Banknote size={12}/>,
  mixed: <Shuffle size={12}/>,
}
const PAY_LABEL: Record<string, string> = { card: 'Carte', cash: 'Espèces', mixed: 'Mixte' }

function SaleRow({ sale, isLatest, onCancel }: { sale: Sale; isLatest: boolean; onCancel: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const time = new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const handleCancel = async () => {
    setCancelling(true)
    try { await cancelSale(sale.id); onCancel(sale.id) }
    catch (e: any) { alert(e.message || 'Erreur lors de l\'annulation') }
    finally { setCancelling(false); setConfirming(false) }
  }

  return (
    <div className={cn(
      'border rounded-xl overflow-hidden transition-all',
      isLatest ? 'border-indigo-200 bg-indigo-50/40' : 'border-gray-100 bg-white'
    )}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Time */}
        <div className="text-xs font-mono text-gray-400 shrink-0 w-10">{time}</div>

        {/* Payment badge */}
        <span className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
          sale.payment_method === 'card'  ? 'bg-blue-100 text-blue-700' :
          sale.payment_method === 'cash'  ? 'bg-green-100 text-green-700' :
                                            'bg-amber-100 text-amber-700'
        )}>
          {PAY_ICON[sale.payment_method]}
          <span className="hidden sm:inline">{PAY_LABEL[sale.payment_method]}</span>
        </span>

        {/* Customer */}
        <div className="flex-1 min-w-0">
          {sale.customer ? (
            <p className="text-xs font-medium text-gray-700 truncate">{sale.customer.name}</p>
          ) : (
            <p className="text-xs text-gray-400 italic">Anonyme</p>
          )}
          <p className="text-xs text-gray-400">{sale.total_items} art.</p>
        </div>

        {/* Amount */}
        <p className="text-sm font-black text-gray-900 shrink-0">{sale.total.toFixed(2)} €</p>

        {/* Expand toggle */}
        <button onClick={() => setExpanded(!expanded)}
          className="text-gray-300 hover:text-gray-600 transition-colors shrink-0">
          {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/80 px-3 py-2.5 space-y-3">
          {/* Items */}
          <div className="space-y-1">
            {(sale.items || []).map((item, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-600">
                <span className="truncate mr-2">
                  <span className="text-gray-400">{item.product?.brand?.name} · </span>
                  {item.product?.name ?? '—'} ×{item.quantity}
                </span>
                <span className="shrink-0 font-medium">{item.total_price.toFixed(2)} €</span>
              </div>
            ))}
          </div>

          {/* Note */}
          {sale.note && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-2">
              <span className="text-amber-500 text-xs shrink-0 mt-0.5">📝</span>
              <p className="text-xs text-amber-800">{sale.note}</p>
            </div>
          )}

          {/* Seller */}
          {sale.seller && (
            <p className="text-xs text-gray-400">Vendeur : {sale.seller.name}</p>
          )}

          {/* Cancel — only for latest sale */}
          {isLatest && !confirming && (
            <button onClick={() => setConfirming(true)}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors font-medium">
              <Trash2 size={11}/> Annuler cette vente
            </button>
          )}

          {/* Confirm cancel */}
          {isLatest && confirming && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500 shrink-0"/>
                <p className="text-xs font-semibold text-red-700">Annuler cette vente définitivement ?</p>
              </div>
              <p className="text-xs text-red-600">Cette action est irréversible. La vente et ses articles seront supprimés.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(false)}
                  className="flex-1 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50">
                  Non, garder
                </button>
                <button onClick={handleCancel} disabled={cancelling}
                  className="flex-1 py-1.5 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1">
                  {cancelling ? <Spinner size="sm"/> : <><Trash2 size={11}/> Oui, annuler</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type Props = { sellerId: string; onClose: () => void; newSale?: { id: string } | null }

export function DailySalesPanel({ sellerId, onClose, newSale }: Props) {
  const [sales, setSales]       = useState<Sale[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterAll, setFilterAll]   = useState(true) // all sellers or current seller

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const data = await getTodaySales(filterAll ? undefined : sellerId)
      setSales((data as Sale[]) || [])
    } finally { setLoading(false); setRefreshing(false) }
  }, [sellerId, filterAll])

  useEffect(() => { load() }, [load])

  // Reload when a new sale completes
  useEffect(() => { if (newSale) load() }, [newSale, load])

  const handleCancel = (id: string) => {
    setSales(prev => prev.filter(s => s.id !== id))
  }

  // Stats
  const totalRevenue = sales.reduce((s, v) => s + v.total, 0)
  const totalItems   = sales.reduce((s, v) => s + v.total_items, 0)
  const byPayment    = sales.reduce((acc, s) => {
    acc[s.payment_method] = (acc[s.payment_method] || 0) + s.total
    return acc
  }, {} as Record<string, number>)

  const latestId = sales[0]?.id

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Caisse du jour</h3>
          <p className="text-xs text-gray-400">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''}/>
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors p-1">
            <X size={16}/>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 shrink-0">
        <div className="px-3 py-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">CA du jour</p>
          <p className="text-base font-black text-gray-900">{totalRevenue.toFixed(2)} €</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">Ventes</p>
          <p className="text-base font-black text-gray-900">{sales.length}</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">Articles</p>
          <p className="text-base font-black text-gray-900">{totalItems}</p>
        </div>
      </div>

      {/* Payment breakdown */}
      {Object.keys(byPayment).length > 0 && (
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-3 shrink-0">
          {Object.entries(byPayment).map(([method, amount]) => (
            <div key={method} className="flex items-center gap-1.5">
              <span className={cn(
                'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
                method === 'card'  ? 'bg-blue-100 text-blue-700' :
                method === 'cash'  ? 'bg-green-100 text-green-700' :
                                     'bg-amber-100 text-amber-700'
              )}>
                {PAY_ICON[method]} {amount.toFixed(0)} €
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filter toggle */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <span className="text-xs text-gray-400 font-medium">Afficher :</span>
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          <button onClick={() => setFilterAll(true)}
            className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-all', filterAll ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            Toutes
          </button>
          <button onClick={() => setFilterAll(false)}
            className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-all', !filterAll ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            Mes ventes
          </button>
        </div>
      </div>

      {/* Sales list */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner size="md"/></div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart size={36} strokeWidth={1} className="text-gray-200 mb-3"/>
              <p className="text-sm font-semibold text-gray-600 mb-1">Aucune vente aujourd'hui</p>
              <p className="text-xs text-gray-400">Les ventes apparaîtront ici en temps réel</p>
            </div>
          ) : (
            sales.map((sale, i) => (
              <SaleRow
                key={sale.id}
                sale={sale}
                isLatest={sale.id === latestId}
                onCancel={handleCancel}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer total */}
      {sales.length > 0 && !loading && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <TrendingUp size={13}/>
              <span>Ticket moyen</span>
            </div>
            <span className="text-sm font-bold text-gray-900">
              {sales.length > 0 ? (totalRevenue / sales.length).toFixed(2) : '0.00'} €
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
