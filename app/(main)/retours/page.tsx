'use client'

export const dynamic = 'force-dynamic'

import { useState, useCallback } from 'react'
import { Search, RotateCcw, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { getSalesStats, getSaleWithItems, createReturn } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import {
  Button, Card, CardHeader, CardTitle, CardContent,
  Input, Label, Separator, Spinner, Badge, TooltipProvider, cn,
} from '@/components/ui'

const fmt = (n: number) => n.toFixed(2) + ' €'
const REFUND_METHODS = [
  { id: 'cash',     label: '💵 Espèces'   },
  { id: 'card',     label: '💳 Carte'     },
  { id: 'gift_card', label: '🎁 Bon cadeau' },
]
const REASONS = [
  'Défaut produit', 'Erreur de taille', 'Article non conforme',
  'Changement d\'avis', 'Doublon', 'Autre',
]

type SaleItem = { id?: string; product_id: string; name: string; qty: number; unit_price: number; total_price: number; brand?: string }

export default function RetoursPage() {
  const { seller } = useAuthStore()
  const [search, setSearch]       = useState('')
  const [searching, setSearching] = useState(false)
  const [sale, setSale]           = useState<any>(null)
  const [searchErr, setSearchErr] = useState('')

  // Return form state
  const [selectedItems, setSelectedItems] = useState<Map<string, { qty: number; max: number; unit_price: number; name: string }>>(new Map())
  const [reason, setReason]       = useState('')
  const [customReason, setCustomReason] = useState('')
  const [refundMethod, setRefundMethod] = useState('cash')
  const [saving, setSaving]       = useState(false)
  const [done, setDone]           = useState<any>(null)
  const [error, setError]         = useState('')

  const handleSearch = async () => {
    if (!search.trim()) return
    setSearching(true); setSearchErr(''); setSale(null); setSelectedItems(new Map()); setDone(null)
    try {
      // Search by partial sale ID or date
      const term = search.trim().toLowerCase()
      let foundSale: any = null

      // Try by sale ID prefix (UUID)
      if (term.length >= 6) {
        const data = await getSalesStats()
        foundSale = (data || []).find((s: any) =>
          s.id.toLowerCase().startsWith(term) ||
          s.id.toLowerCase().replace(/-/g,'').startsWith(term.replace(/-/g,''))
        )
      }

      if (!foundSale) {
        setSearchErr('Aucune vente trouvée. Entrez les premiers caractères de l\'ID de vente.')
        return
      }

      // Load full sale with items
      const full = await getSaleWithItems(foundSale.id)
      setSale(full)
    } catch (e: any) { setSearchErr(e.message) }
    finally { setSearching(false) }
  }

  const toggleItem = (item: any, max: number) => {
    const key = item.product.id
    const next = new Map(selectedItems)
    if (next.has(key)) next.delete(key)
    else next.set(key, { qty: 1, max, unit_price: item.unit_price, name: item.product.name })
    setSelectedItems(next)
  }

  const updateQty = (productId: string, qty: number) => {
    const next = new Map(selectedItems)
    const item = next.get(productId)
    if (!item) return
    if (qty <= 0) next.delete(productId)
    else next.set(productId, { ...item, qty: Math.min(qty, item.max) })
    setSelectedItems(next)
  }

  const totalRefund = Array.from(selectedItems.values()).reduce((s, i) => s + i.qty * i.unit_price, 0)
  const hasSelection = selectedItems.size > 0

  const handleSubmit = async () => {
    if (!sale || !hasSelection) return
    setSaving(true); setError('')
    try {
      const items = Array.from(selectedItems.entries()).map(([pid, v]) => ({
        product_id:    pid,
        name:          v.name,
        qty:           v.qty,
        unit_price:    v.unit_price,
        refund_amount: v.qty * v.unit_price,
      }))
      const finalReason = reason === 'Autre' ? customReason : reason
      const ret = await createReturn({
        sale_id:       sale.id,
        seller_id:     seller?.id ?? null,
        reason:        finalReason || null,
        refund_method: refundMethod as any,
        total_refund:  Math.round(totalRefund * 100) / 100,
        items,
      })
      setDone(ret)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const reset = () => {
    setSale(null); setSearch(''); setSelectedItems(new Map())
    setReason(''); setCustomReason(''); setDone(null); setError('')
  }

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Retours & Remboursements</h1>
            <p className="text-gray-500 text-sm mt-0.5">Recherchez une vente pour créer un retour partiel ou total</p>
          </div>

          {/* ── Done state ── */}
          {done && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-green-500"/>
              </div>
              <div>
                <p className="text-lg font-black text-gray-900">Retour enregistré</p>
                <p className="text-sm text-gray-500 mt-1">
                  Remboursement de <strong>{fmt(done.total_refund)}</strong> en {REFUND_METHODS.find(m => m.id === done.refund_method)?.label}
                </p>
              </div>
              <Button onClick={reset} className="gap-2"><RotateCcw size={14}/> Nouveau retour</Button>
            </div>
          )}

          {/* ── Search ── */}
          {!done && (
            <Card>
              <CardHeader><CardTitle>Rechercher la vente</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-gray-500">
                  Entrez l'identifiant de la vente (affiché sur le ticket, onglet Ventes du Dashboard)
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: a3f8c1… (ID de vente)"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="font-mono"
                  />
                  <Button onClick={handleSearch} disabled={searching || !search.trim()} className="gap-2 shrink-0">
                    {searching ? <Spinner size="sm"/> : <Search size={14}/>}
                    Chercher
                  </Button>
                </div>
                {searchErr && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl flex items-center gap-2">
                    <AlertTriangle size={13}/> {searchErr}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Sale found ── */}
          {sale && !done && (
            <>
              {/* Sale summary */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        Vente du {new Date(sale.created_at).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
                      </p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{sale.id.slice(0,16)}…</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {sale.customer?.name && <Badge variant="secondary" size="sm">Client : {sale.customer.name}</Badge>}
                        {sale.seller?.name && <Badge variant="secondary" size="sm">Vendeur : {sale.seller.name}</Badge>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-black text-gray-900">{fmt(sale.total)}</p>
                      <p className="text-xs text-gray-400">{sale.total_items} article{sale.total_items > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Item selector */}
              <Card>
                <CardHeader>
                  <CardTitle>Sélectionnez les articles à retourner</CardTitle>
                </CardHeader>
                <div className="divide-y divide-gray-50">
                  {(sale.items || []).map((item: any) => {
                    const pid  = item.product?.id
                    const sel  = selectedItems.get(pid)
                    const isSelected = !!sel
                    return (
                      <div key={pid} className={cn('flex items-center gap-4 px-5 py-3.5 transition-colors cursor-pointer',
                        isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50')}
                        onClick={() => toggleItem(item, item.quantity)}>
                        {/* Checkbox */}
                        <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                          isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300')}>
                          {isSelected && <CheckCircle size={12} className="text-white"/>}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.product?.name || '—'}</p>
                          <p className="text-xs text-gray-400">{item.product?.brand?.name} · {item.unit_price.toFixed(2)} € × {item.quantity}</p>
                        </div>
                        {/* Qty selector if selected */}
                        {isSelected && (
                          <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                            <button onClick={() => updateQty(pid, (sel?.qty ?? 1) - 1)}
                              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold">−</button>
                            <span className="text-sm font-bold w-6 text-center">{sel?.qty}</span>
                            <button onClick={() => updateQty(pid, (sel?.qty ?? 1) + 1)}
                              disabled={sel?.qty >= sel?.max}
                              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold disabled:opacity-30">+</button>
                          </div>
                        )}
                        {/* Price */}
                        <div className="text-right shrink-0 w-20">
                          <p className="text-sm font-bold text-gray-900">{item.total_price.toFixed(2)} €</p>
                          {isSelected && sel && sel.qty !== item.quantity && (
                            <p className="text-xs text-indigo-600 font-semibold">→ {(sel.qty * item.unit_price).toFixed(2)} €</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {hasSelection && (
                  <div className="px-5 py-3.5 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-indigo-900">
                      {Array.from(selectedItems.values()).reduce((s, i) => s + i.qty, 0)} article{Array.from(selectedItems.values()).reduce((s, i) => s + i.qty, 0) > 1 ? 's' : ''} sélectionné{Array.from(selectedItems.values()).reduce((s, i) => s + i.qty, 0) > 1 ? 's' : ''}
                    </span>
                    <span className="text-base font-black text-indigo-700">-{fmt(totalRefund)}</span>
                  </div>
                )}
              </Card>

              {/* Return form */}
              {hasSelection && (
                <Card>
                  <CardHeader><CardTitle>Détails du retour</CardTitle></CardHeader>
                  <CardContent className="space-y-5">
                    {/* Reason */}
                    <div>
                      <Label>Motif du retour</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {REASONS.map(r => (
                          <button key={r} onClick={() => setReason(r)}
                            className={cn('px-3 py-1.5 rounded-xl text-sm font-medium border transition-all',
                              reason === r ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
                            {r}
                          </button>
                        ))}
                      </div>
                      {reason === 'Autre' && (
                        <Input className="mt-2" placeholder="Précisez le motif…"
                          value={customReason} onChange={e => setCustomReason(e.target.value)}/>
                      )}
                    </div>

                    <Separator/>

                    {/* Refund method */}
                    <div>
                      <Label>Mode de remboursement</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {REFUND_METHODS.map(m => (
                          <button key={m.id} onClick={() => setRefundMethod(m.id)}
                            className={cn('py-2.5 rounded-xl text-sm font-semibold border transition-all',
                              refundMethod === m.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Separator/>

                    {/* Summary */}
                    <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Remboursement total</span>
                      <span className="text-xl font-black text-gray-900">{fmt(totalRefund)}</span>
                    </div>

                    {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setSelectedItems(new Map())} disabled={saving}>
                        <X size={14}/> Déselectionner
                      </Button>
                      <Button onClick={handleSubmit} disabled={saving || !reason} className="flex-1 gap-2">
                        {saving ? <Spinner size="sm"/> : <><RotateCcw size={14}/> Valider le retour</>}
                      </Button>
                    </div>
                    {!reason && (
                      <p className="text-xs text-amber-600 text-center">Sélectionnez un motif pour continuer</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
