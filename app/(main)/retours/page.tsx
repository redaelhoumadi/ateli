'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import {
  Search, RotateCcw, CheckCircle, AlertTriangle, X,
  Clock, Package, ChevronDown, ChevronUp,
} from 'lucide-react'
import { getSalesStats, getSaleWithItems, createReturn, getAllReturns } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import {
  Button, Card, CardHeader, CardTitle, CardContent,
  Input, Label, Separator, Spinner, Badge, TooltipProvider, cn,
} from '@/components/ui'
import type { Return } from '@/types'

const fmt = (n: number) => n.toFixed(2) + ' €'
const REFUND_METHODS = [
  { id: 'cash',      label: '💵 Espèces'    },
  { id: 'card',      label: '💳 Carte'      },
  { id: 'gift_card', label: '🎁 Bon cadeau' },
]
const REFUND_LABELS: Record<string, string> = {
  cash: '💵 Espèces', card: '💳 Carte', gift_card: '🎁 Bon cadeau', store_credit: '🏪 Avoir',
}
const REASONS = [
  'Défaut produit', 'Erreur de taille', 'Article non conforme',
  "Changement d'avis", 'Doublon', 'Autre',
]

// ─── Return history row ───────────────────────────────────────
function ReturnRow({ ret }: { ret: any }) {
  const [open, setOpen] = useState(false)
  const date = new Date(ret.created_at)
  return (
    <div className={cn('border rounded-2xl overflow-hidden transition-all', open ? 'border-gray-200 shadow-sm' : 'border-gray-100')}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
        <div className="w-9 h-9 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center shrink-0">
          <RotateCcw size={15} className="text-red-500"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900">
              {(ret.items || []).length} article{(ret.items || []).length > 1 ? 's' : ''} retourné{(ret.items || []).length > 1 ? 's' : ''}
            </p>
            <Badge variant="secondary" size="sm">{REFUND_LABELS[ret.refund_method] || ret.refund_method}</Badge>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {date.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            {' · '}{date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
            {ret.seller?.name && ` · ${ret.seller.name}`}
          </p>
          {ret.reason && <p className="text-xs text-gray-500 mt-0.5 italic">"{ret.reason}"</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-black text-red-600">-{fmt(ret.total_refund)}</p>
          <p className="text-xs text-gray-400">remboursé</p>
        </div>
        <div className="text-gray-400 shrink-0">
          {open ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">N° vente associée</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-gray-700">#{ret.sale_id.replace(/-/g,'').slice(0,8).toUpperCase()}</span>
              <button onClick={() => navigator.clipboard?.writeText(ret.sale_id).catch(()=>{})} className="text-gray-300 hover:text-indigo-500 transition-colors">copier</button>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Articles retournés</p>
            <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
              {(ret.items || []).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                      <Package size={11} className="text-gray-400"/>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.unit_price.toFixed(2)} € × {item.qty}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-red-600 shrink-0 ml-3">-{item.refund_amount.toFixed(2)} €</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            <span className="text-sm font-bold text-gray-700">Total remboursé</span>
            <span className="text-lg font-black text-red-600">-{fmt(ret.total_refund)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Mode de remboursement</span>
            <span className="font-semibold">{REFUND_LABELS[ret.refund_method]}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── New return form ──────────────────────────────────────────
function NewReturnForm({ onCreated }: { onCreated: () => void }) {
  const { seller } = useAuthStore()
  const [search, setSearch]           = useState('')
  const [searching, setSearching]     = useState(false)
  const [sale, setSale]               = useState<any>(null)
  const [searchErr, setSearchErr]     = useState('')
  const [selectedItems, setSelectedItems] = useState<Map<string, {qty:number;max:number;unit_price:number;name:string}>>(new Map())
  const [reason, setReason]           = useState('')
  const [customReason, setCustomReason] = useState('')
  const [refundMethod, setRefundMethod] = useState('cash')
  const [saving, setSaving]           = useState(false)
  const [done, setDone]               = useState<any>(null)
  const [error, setError]             = useState('')

  const handleSearch = async () => {
    if (!search.trim()) return
    setSearching(true); setSearchErr(''); setSale(null); setSelectedItems(new Map()); setDone(null)
    try {
      const term = search.trim().toLowerCase().replace(/-/g,'')
      if (term.length < 6) { setSearchErr('Saisissez au moins 6 caractères'); return }
      const data = await getSalesStats()
      const found = (data || []).find((s: any) => {
        const id = s.id.toLowerCase().replace(/-/g,'')
        return id.startsWith(term) || id.slice(0,8) === term
      })
      if (!found) { setSearchErr('Aucune vente trouvée. Vérifiez le N° ticket.'); return }
      setSale(await getSaleWithItems(found.id))
    } catch (e: any) { setSearchErr(e.message) }
    finally { setSearching(false) }
  }

  const toggleItem = (item: any) => {
    const next = new Map(selectedItems)
    const pid = item.product.id
    if (next.has(pid)) next.delete(pid)
    else next.set(pid, { qty:1, max:item.quantity, unit_price:item.unit_price, name:item.product.name })
    setSelectedItems(next)
  }

  const updateQty = (pid: string, qty: number) => {
    const next = new Map(selectedItems)
    const item = next.get(pid)
    if (!item) return
    if (qty <= 0) next.delete(pid)
    else next.set(pid, { ...item, qty: Math.min(qty, item.max) })
    setSelectedItems(next)
  }

  const totalRefund = Array.from(selectedItems.values()).reduce((s,i) => s + i.qty * i.unit_price, 0)
  const hasSelection = selectedItems.size > 0

  const handleSubmit = async () => {
    if (!sale || !hasSelection) return
    setSaving(true); setError('')
    try {
      const items = Array.from(selectedItems.entries()).map(([pid, v]) => ({
        product_id: pid, name: v.name, qty: v.qty, unit_price: v.unit_price, refund_amount: v.qty * v.unit_price,
      }))
      const ret = await createReturn({
        sale_id: sale.id, seller_id: seller?.id ?? null,
        reason: (reason === 'Autre' ? customReason : reason) || null,
        refund_method: refundMethod as any,
        total_refund: Math.round(totalRefund * 100) / 100, items,
      })
      setDone(ret); onCreated()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const reset = () => { setSale(null); setSearch(''); setSelectedItems(new Map()); setReason(''); setCustomReason(''); setDone(null); setError('') }

  if (done) return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center space-y-4">
      <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
        <CheckCircle size={28} className="text-green-500"/>
      </div>
      <div>
        <p className="text-lg font-black text-gray-900">Retour enregistré</p>
        <p className="text-sm text-gray-500 mt-1">Remboursement de <strong>{fmt(done.total_refund)}</strong> en {REFUND_LABELS[done.refund_method]}</p>
      </div>
      <Button onClick={reset} className="gap-2"><RotateCcw size={14}/> Nouveau retour</Button>
    </div>
  )

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Rechercher la vente</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">Entrez le <strong>N° ticket</strong> (8 caractères, sur le ticket imprimé ou Dashboard → Ventes)</p>
          <div className="flex gap-2">
            <Input placeholder="Ex: A3F8C1E2" value={search} onChange={e => setSearch(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} className="font-mono uppercase tracking-wider"/>
            <Button onClick={handleSearch} disabled={searching || !search.trim()} className="gap-2 shrink-0">
              {searching ? <Spinner size="sm"/> : <Search size={14}/>} Chercher
            </Button>
          </div>
          {searchErr && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl flex items-center gap-2"><AlertTriangle size={13}/> {searchErr}</p>}
        </CardContent>
      </Card>

      {sale && (
        <>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-gray-900">Vente du {new Date(sale.created_at).toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long'})}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-sm font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">#{sale.id.replace(/-/g,'').slice(0,8).toUpperCase()}</span>
                  </div>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
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

          <Card>
            <CardHeader><CardTitle>Articles à retourner</CardTitle></CardHeader>
            <div className="divide-y divide-gray-50">
              {(sale.items || []).map((item: any) => {
                const pid = item.product?.id
                const sel = selectedItems.get(pid)
                return (
                  <div key={pid} className={cn('flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors', sel?'bg-indigo-50':'hover:bg-gray-50')} onClick={() => toggleItem(item)}>
                    <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all', sel?'bg-indigo-600 border-indigo-600':'border-gray-300')}>
                      {sel && <CheckCircle size={12} className="text-white"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.product?.name}</p>
                      <p className="text-xs text-gray-400">{item.product?.brand?.name} · {item.unit_price.toFixed(2)} € × {item.quantity}</p>
                    </div>
                    {sel && (
                      <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => updateQty(pid, sel.qty-1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold">−</button>
                        <span className="text-sm font-bold w-6 text-center">{sel.qty}</span>
                        <button onClick={() => updateQty(pid, sel.qty+1)} disabled={sel.qty>=sel.max} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold disabled:opacity-30">+</button>
                      </div>
                    )}
                    <div className="text-right shrink-0 w-20">
                      <p className="text-sm font-bold text-gray-900">{item.total_price.toFixed(2)} €</p>
                      {sel && sel.qty !== item.quantity && <p className="text-xs text-indigo-600">→ {(sel.qty * item.unit_price).toFixed(2)} €</p>}
                    </div>
                  </div>
                )
              })}
            </div>
            {hasSelection && (
              <div className="px-5 py-3.5 bg-indigo-50 border-t border-indigo-100 flex justify-between">
                <span className="text-sm font-bold text-indigo-900">{Array.from(selectedItems.values()).reduce((s,i)=>s+i.qty,0)} article{Array.from(selectedItems.values()).reduce((s,i)=>s+i.qty,0)>1?'s':''} sélectionné{Array.from(selectedItems.values()).reduce((s,i)=>s+i.qty,0)>1?'s':''}</span>
                <span className="text-base font-black text-indigo-700">-{fmt(totalRefund)}</span>
              </div>
            )}
          </Card>

          {hasSelection && (
            <Card>
              <CardHeader><CardTitle>Détails du retour</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label>Motif du retour</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {REASONS.map(r => (
                      <button key={r} onClick={() => setReason(r)} className={cn('px-3 py-1.5 rounded-xl text-sm font-medium border transition-all', reason===r?'bg-gray-900 text-white border-gray-900':'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>{r}</button>
                    ))}
                  </div>
                  {reason === 'Autre' && <Input className="mt-2" placeholder="Précisez le motif…" value={customReason} onChange={e => setCustomReason(e.target.value)}/>}
                </div>
                <Separator/>
                <div>
                  <Label>Mode de remboursement</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {REFUND_METHODS.map(m => (
                      <button key={m.id} onClick={() => setRefundMethod(m.id)} className={cn('py-2.5 rounded-xl text-sm font-semibold border transition-all', refundMethod===m.id?'bg-gray-900 text-white border-gray-900':'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>{m.label}</button>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Remboursement total</span>
                  <span className="text-xl font-black text-red-600">-{fmt(totalRefund)}</span>
                </div>
                {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setSelectedItems(new Map())} disabled={saving}><X size={14}/> Déselectionner</Button>
                  <Button onClick={handleSubmit} disabled={saving || !reason} className="flex-1 gap-2">
                    {saving ? <Spinner size="sm"/> : <><RotateCcw size={14}/> Valider le retour</>}
                  </Button>
                </div>
                {!reason && <p className="text-xs text-amber-600 text-center">Sélectionnez un motif pour continuer</p>}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function RetoursPage() {
  const [tab, setTab]               = useState<'nouveau'|'historique'>('nouveau')
  const [returns, setReturns]       = useState<any[]>([])
  const [loading, setLoading]       = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const totalRefunded = returns.reduce((s, r) => s + r.total_refund, 0)

  useEffect(() => {
    if (tab === 'historique' || refreshKey > 0) {
      setLoading(true)
      getAllReturns().then(d => setReturns((d as any[]) || [])).finally(() => setLoading(false))
    }
  }, [tab, refreshKey])

  const handleCreated = () => {
    setRefreshKey(k => k + 1)
    setTimeout(() => setTab('historique'), 1500)
  }

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Retours & Remboursements</h1>
            <p className="text-gray-500 text-sm mt-0.5">Créez des retours et consultez l'historique complet</p>
          </div>

          <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 w-fit">
            {([
              { id: 'nouveau',     label: '↩ Nouveau retour' },
              { id: 'historique',  label: '🕐 Historique' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
                  tab === t.id ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {t.label}
                {t.id === 'historique' && returns.length > 0 && (
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-bold', tab==='historique'?'bg-white/20 text-white':'bg-gray-100 text-gray-600')}>{returns.length}</span>
                )}
              </button>
            ))}
          </div>

          {tab === 'nouveau' && <NewReturnForm onCreated={handleCreated}/>}

          {tab === 'historique' && (
            <div className="space-y-4">
              {returns.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-black text-gray-900">{returns.length}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Retours total</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-black text-red-600">-{totalRefunded.toFixed(0)} €</p>
                    <p className="text-xs text-red-400 mt-0.5">Remboursé total</p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-black text-gray-900">{returns.length > 0 ? (totalRefunded/returns.length).toFixed(0) : '—'} €</p>
                    <p className="text-xs text-gray-400 mt-0.5">Moy. par retour</p>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-16"><Spinner size="lg"/></div>
              ) : returns.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
                  <RotateCcw size={40} className="text-gray-200 mx-auto mb-3"/>
                  <p className="text-sm font-semibold text-gray-700">Aucun retour enregistré</p>
                  <p className="text-xs text-gray-400 mt-1">Les retours apparaîtront ici</p>
                </div>
              ) : (
                <div className="space-y-3 ">
                  {returns.map(r => <ReturnRow key={r.id} ret={r}/>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
