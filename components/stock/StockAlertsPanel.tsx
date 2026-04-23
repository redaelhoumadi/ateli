'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Package, AlertTriangle, RefreshCw, ArrowRight,
  TrendingDown, CheckCircle,
} from 'lucide-react'
import { updateStock, updateStockMin } from '@/lib/supabase'
import { useStockAlerts, invalidateStockAlerts } from '@/hooks/useStockAlerts'
import { cn } from '@/components/ui'
import type { StockAlert } from '@/hooks/useStockAlerts'

// ─── Quick stock adjust ──────────────────────────────────────
function AlertCard({ alert, onUpdated }: { alert: StockAlert; onUpdated: () => void }) {
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)
  const isCritical = alert.urgency === 'critical'

  const handleQuickAdd = async (qty: number) => {
    setSaving(true)
    try {
      const newStock = (alert.stock ?? 0) + qty
      await updateStock(alert.id, newStock)
      invalidateStockAlerts()
      setDone(true)
      setTimeout(() => { setDone(false); onUpdated() }, 1500)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const img = (alert as any).image_url as string | null

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-3 transition-all',
      done ? 'bg-green-50 border-green-200 opacity-60' :
      isCritical ? 'bg-red-50 border-red-200' :
                   'bg-amber-50 border-amber-200'
    )}>
      {/* Product info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl border border-white/80 bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
          {img
            ? <img src={img} alt={alert.name} className="w-full h-full object-cover"/>
            : <Package size={16} className="text-gray-300"/>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{alert.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {alert.brand && <span className="text-xs text-gray-500">{alert.brand.name}</span>}
            <span className="text-gray-300">·</span>
            <span className={cn('text-xs font-bold',
              isCritical ? 'text-red-600' : 'text-amber-600')}>
              {isCritical ? '0 restant' : `${alert.stock} restant${alert.stock! > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
        {done && <CheckCircle size={16} className="text-green-500 shrink-0"/>}
      </div>

      {/* Quick restock buttons */}
      {!done && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
            Ajouter au stock
          </p>
          <div className="flex gap-2">
            {[1, 3, 5, 10].map(qty => (
              <button key={qty} onClick={() => handleQuickAdd(qty)} disabled={saving}
                className={cn(
                  'flex-1 h-8 rounded-xl text-xs font-bold border transition-all active:scale-95',
                  isCritical
                    ? 'bg-white text-red-700 border-red-200 hover:bg-red-100'
                    : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-100',
                  'disabled:opacity-40'
                )}>
                {saving ? '…' : `+${qty}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────
type Props = {
  open:    boolean
  onClose: () => void
}

export function StockAlertsPanel({ open, onClose }: Props) {
  const router = useRouter()
  const { alerts, criticalCount, lowCount, loading, lastChecked, refresh } = useStockAlerts()
  const [filter, setFilter] = useState<'all' | 'critical' | 'low'>('all')

  const displayed = filter === 'all'      ? alerts
                  : filter === 'critical' ? alerts.filter(a => a.urgency === 'critical')
                                          : alerts.filter(a => a.urgency === 'low')

  const handleGoToStock = () => { onClose(); router.push('/stock?filter=out') }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose}/>

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center',
              criticalCount > 0 ? 'bg-red-100' : 'bg-amber-100')}>
              <AlertTriangle size={16} className={criticalCount > 0 ? 'text-red-500' : 'text-amber-500'}/>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Alertes stock</p>
              <p className="text-xs text-gray-400">
                {alerts.length === 0 ? 'Tout va bien' : `${alerts.length} produit${alerts.length > 1 ? 's' : ''} à traiter`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
            </button>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* Summary strip */}
        {alerts.length > 0 && (
          <div className="flex border-b border-gray-100 shrink-0">
            {[
              { id: 'all',      label: 'Tous',       count: alerts.length,  color: 'text-gray-700' },
              { id: 'critical', label: 'Épuisés',    count: criticalCount,  color: 'text-red-600'  },
              { id: 'low',      label: 'Stock bas',  count: lowCount,       color: 'text-amber-600'},
            ].filter(f => f.count > 0 || f.id === 'all').map(f => (
              <button key={f.id}
                onClick={() => setFilter(f.id as typeof filter)}
                className={cn(
                  'flex-1 py-3 text-xs font-semibold border-b-2 transition-all',
                  filter === f.id ? `border-gray-900 ${f.color}` : 'border-transparent text-gray-400 hover:text-gray-600'
                )}>
                <span className={cn('text-base font-black block', filter === f.id ? f.color : 'text-gray-500')}>
                  {f.count}
                </span>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && alerts.length === 0 ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-700 rounded-full animate-spin"/>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle size={24} className="text-green-500"/>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Aucune alerte</p>
                <p className="text-xs text-gray-400 mt-1">Tous les stocks gérés sont au-dessus de leur seuil</p>
              </div>
              {lastChecked && (
                <p className="text-xs text-gray-300">
                  Vérifié à {lastChecked.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Aucun produit dans cette catégorie</p>
            </div>
          ) : (
            displayed.map(alert => (
              <AlertCard key={alert.id} alert={alert} onUpdated={refresh}/>
            ))
          )}
        </div>

        {/* Footer */}
        {alerts.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 shrink-0 space-y-2">
            <button onClick={handleGoToStock}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors">
              <span>Gérer tous les stocks</span>
              <ArrowRight size={15}/>
            </button>
            {lastChecked && (
              <p className="text-center text-[10px] text-gray-300">
                Mis à jour à {lastChecked.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
