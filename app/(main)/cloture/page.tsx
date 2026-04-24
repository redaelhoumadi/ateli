'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CheckCircle, Printer, Download, Clock, TrendingUp, ShoppingCart,
  Users, Wallet, CreditCard, Banknote, Shuffle, AlertTriangle,
  ChevronDown, ChevronUp, Calendar, Lock,
} from 'lucide-react'
import {
  getTodaySales, getSalesByDate, getSellers,
  getClotures, createCloture, getCloturByDate,
} from '@/lib/supabase'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  StatCard, Spinner, EmptyState, Separator,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  TooltipProvider, cn, DatePicker,
} from '@/components/ui'
import type { Seller, Cloture } from '@/types'

// ─── Types locaux ─────────────────────────────────────────────
type SaleItem = { quantity: number; total_price: number; product?: { name: string; brand?: { name: string } } }
type Sale = {
  id: string; total: number; total_items: number; payment_method: string
  created_at: string; note?: string | null
  customer?: { name: string } | null
  seller?: { name: string } | null
  items?: SaleItem[]
}

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) => n.toFixed(2) + ' €'
const PAY_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  card:  { bg: 'bg-blue-50',  text: 'text-blue-700',  icon: <CreditCard size={16}/>, label: 'Carte bancaire' },
  cash:  { bg: 'bg-green-50', text: 'text-green-700', icon: <Banknote size={16}/>,   label: 'Espèces' },
  mixed: { bg: 'bg-amber-50', text: 'text-amber-700', icon: <Shuffle size={16}/>,    label: 'Mixte' },
}

// ─── Vente dépliable ──────────────────────────────────────────
function SaleRow({ sale }: { sale: Sale }) {
  const [open, setOpen] = useState(false)
  const time = new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const pay  = PAY_COLORS[sale.payment_method] ?? PAY_COLORS.card
  return (
    <div className="border-b border-gray-50 last:border-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left">
        <span className="text-xs text-gray-400 font-mono w-10 shrink-0">{time}</span>
        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0', pay.bg, pay.text)}>
          {pay.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {sale.customer?.name ?? <span className="text-gray-400 italic">Anonyme</span>}
          </p>
          <p className="text-xs font-mono text-gray-400">#{sale.id.replace(/-/g,'').slice(0,8).toUpperCase()}</p>
        </div>
        <p className="text-sm font-bold text-gray-900 shrink-0">{fmt(sale.total)}</p>
        {open ? <ChevronUp size={14} className="text-gray-400 shrink-0"/> : <ChevronDown size={14} className="text-gray-400 shrink-0"/>}
      </button>
      {open && (
        <div className="bg-gray-50 px-5 py-3 space-y-1.5 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
            <span className="text-xs text-gray-400">N° ticket</span>
            <button
              className="font-mono text-xs font-bold text-gray-700 hover:text-indigo-600 transition-colors"
              onClick={() => navigator.clipboard?.writeText(sale.id).catch(() => {})}
              title={sale.id}>
              {sale.id.replace(/-/g,'').slice(0,8).toUpperCase()}
              <span className="text-[9px] text-gray-300 ml-1">copier</span>
            </button>
          </div>
          {(sale.items || []).map((i, idx) => (
            <div key={idx} className="flex justify-between text-xs text-gray-600">
              <span className="truncate mr-3">{i.product?.brand?.name && <span className="text-gray-400">{i.product.brand.name} · </span>}{i.product?.name} ×{i.quantity}</span>
              <span className="shrink-0 font-medium">{i.total_price.toFixed(2)} €</span>
            </div>
          ))}
          {sale.note && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 flex items-start gap-1.5 mt-2">
              <span className="text-xs text-amber-500 shrink-0">📝</span>
              <p className="text-xs text-amber-800">{sale.note}</p>
            </div>
          )}
          {sale.seller && <p className="text-xs text-gray-400 mt-1">Vendeur : {sale.seller.name}</p>}
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function CloturePage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [sales, setSales]               = useState<Sale[]>([])
  const [sellers, setSellers]           = useState<Seller[]>([])
  const [clotures, setClotures]         = useState<Cloture[]>([])
  const [existing, setExisting]         = useState<Cloture | null>(null)
  const [loading, setLoading]           = useState(true)

  // Fond de caisse
  const [fundOpening, setFundOpening] = useState('')
  const [fundClosing, setFundClosing] = useState('')
  const [closedBy, setClosedBy]       = useState('')
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const isToday = selectedDate === new Date().toISOString().split('T')[0]

  // Load data
  const load = useCallback(async () => {
    if (!selectedDate) return   // ne pas appeler si la date est vide
    setLoading(true); setSaved(false)
    try {
      const [s, sel, cl, ex] = await Promise.all([
        getSalesByDate(selectedDate),
        getSellers(),
        getClotures(60),
        getCloturByDate(selectedDate),
      ])
      setSales((s as Sale[]) || [])
      setSellers((sel as Seller[]) || [])
      setClotures((cl as Cloture[]) || [])
      setExisting(ex as Cloture | null)
      if (ex) {
        setFundOpening(ex.fund_opening != null ? String(ex.fund_opening) : '')
        setFundClosing(ex.fund_closing != null ? String(ex.fund_closing) : '')
        setClosedBy(ex.closed_by ?? '')
        setNotes(ex.notes ?? '')
      } else {
        setFundOpening(''); setFundClosing(''); setClosedBy(''); setNotes('')
      }
    } finally { setLoading(false) }
  }, [selectedDate])

  useEffect(() => { load() }, [load])

  // Computed stats
  const stats = useMemo(() => {
    const totalCard  = sales.filter(s => s.payment_method === 'card').reduce((a, s) => a + s.total, 0)
    const totalCash  = sales.filter(s => s.payment_method === 'cash').reduce((a, s) => a + s.total, 0)
    const totalMixed = sales.filter(s => s.payment_method === 'mixed').reduce((a, s) => a + s.total, 0)
    const total      = sales.reduce((a, s) => a + s.total, 0)
    const itemsTotal = sales.reduce((a, s) => a + s.total_items, 0)
    const withCust   = sales.filter(s => s.customer).length
    const avgTicket  = sales.length ? total / sales.length : 0

    // By seller
    const bySeller = new Map<string, { name: string; count: number; total: number }>()
    sales.forEach(s => {
      const name = s.seller?.name ?? 'Inconnu'
      const ex = bySeller.get(name) || { name, count: 0, total: 0 }
      ex.count++; ex.total += s.total
      bySeller.set(name, ex)
    })

    // By brand
    const byBrand = new Map<string, number>()
    sales.forEach(s => {
      ;(s.items || []).forEach(i => {
        const b = i.product?.brand?.name ?? 'Autre'
        byBrand.set(b, (byBrand.get(b) || 0) + i.total_price)
      })
    })

    const fundExpected = (Number(fundOpening) || 0) + totalCash
    const fundGap      = fundClosing ? (Number(fundClosing) - fundExpected) : null

    return {
      totalCard, totalCash, totalMixed, total, itemsTotal, withCust, avgTicket,
      bySeller: Array.from(bySeller.values()).sort((a, b) => b.total - a.total),
      byBrand:  Array.from(byBrand.entries()).sort((a, b) => b[1] - a[1]),
      fundExpected, fundGap,
    }
  }, [sales, fundOpening, fundClosing])

  // Clôturer
  const handleCloture = async () => {
    setSaving(true)
    try {
      const cl = await createCloture({
        date: selectedDate,
        closed_by:  closedBy || null,
        total_card:  stats.totalCard,
        total_cash:  stats.totalCash,
        total_mixed: stats.totalMixed,
        total_revenue: stats.total,
        sales_count: sales.length,
        items_count: stats.itemsTotal,
        customers_with_account: stats.withCust,
        fund_opening:  fundOpening ? Number(fundOpening) : null,
        fund_closing:  fundClosing ? Number(fundClosing) : null,
        fund_expected: fundOpening ? stats.fundExpected : null,
        fund_gap:      fundClosing ? stats.fundGap : null,
        notes: notes || null,
      })
      setExisting(cl as Cloture)
      setSaved(true)
      setShowConfirm(false)
      load()
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  // Print
  const handlePrint = () => {
    const dateStr = new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const w = window.open('', '_blank', 'width=420,height=800')
    if (!w) return
    w.document.write(`
      <html><head><title>Clôture — ${dateStr}</title>
      <style>
        body{font-family:monospace;font-size:12px;width:360px;margin:0 auto;padding:16px}
        h1{font-size:16px;text-align:center;margin:0 0 4px}
        .center{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}
        .row{display:flex;justify-content:space-between;margin:3px 0}
        .bold{font-weight:bold}.big{font-size:18px;font-weight:bold;text-align:center}
        .section{margin:12px 0 4px;font-weight:bold;text-transform:uppercase;font-size:11px;letter-spacing:.05em}
        .gap-pos{color:#15803d}.gap-neg{color:#b91c1c}
      </style></head><body>
      <h1>ATELI POS</h1>
      <p class="center">Clôture de caisse</p>
      <p class="center">${dateStr}</p>
      <div class="line"></div>
      <p class="big">${fmt(stats.total)}</p>
      <div class="line"></div>
      <p class="section">Encaissements</p>
      <div class="row"><span>💳 Carte</span><span>${fmt(stats.totalCard)}</span></div>
      <div class="row"><span>💵 Espèces</span><span>${fmt(stats.totalCash)}</span></div>
      ${stats.totalMixed > 0 ? `<div class="row"><span>🔀 Mixte</span><span>${fmt(stats.totalMixed)}</span></div>` : ''}
      <div class="line"></div>
      <p class="section">Activité</p>
      <div class="row"><span>Ventes</span><span>${sales.length}</span></div>
      <div class="row"><span>Articles</span><span>${stats.itemsTotal}</span></div>
      <div class="row"><span>Ticket moyen</span><span>${fmt(stats.avgTicket)}</span></div>
      <div class="row"><span>Clients fidélité</span><span>${stats.withCust}</span></div>
      ${stats.byBrand.length > 0 ? `
      <div class="line"></div>
      <p class="section">Par marque</p>
      ${stats.byBrand.map(([b, v]) => `<div class="row"><span>${b}</span><span>${fmt(v)}</span></div>`).join('')}
      ` : ''}
      ${stats.bySeller.length > 0 ? `
      <div class="line"></div>
      <p class="section">Par vendeur</p>
      ${stats.bySeller.map(s => `<div class="row"><span>${s.name} (${s.count})</span><span>${fmt(s.total)}</span></div>`).join('')}
      ` : ''}
      ${fundOpening || fundClosing ? `
      <div class="line"></div>
      <p class="section">Fond de caisse</p>
      ${fundOpening ? `<div class="row"><span>Ouverture</span><span>${fmt(Number(fundOpening))}</span></div>` : ''}
      <div class="row"><span>Espèces encaissées</span><span>+${fmt(stats.totalCash)}</span></div>
      <div class="row bold"><span>Attendu en caisse</span><span>${fmt(stats.fundExpected)}</span></div>
      ${fundClosing ? `
      <div class="row"><span>Compté</span><span>${fmt(Number(fundClosing))}</span></div>
      <div class="row bold ${stats.fundGap !== null && stats.fundGap >= 0 ? 'gap-pos' : 'gap-neg'}">
        <span>Écart</span><span>${stats.fundGap !== null ? (stats.fundGap >= 0 ? '+' : '') + fmt(stats.fundGap) : '—'}</span>
      </div>` : ''}
      ` : ''}
      ${notes ? `<div class="line"></div><p>${notes}</p>` : ''}
      <div class="line"></div>
      ${closedBy ? `<p class="center">Clôturé par : ${closedBy}</p>` : ''}
      <p class="center">${new Date().toLocaleTimeString('fr-FR')}</p>
      </body></html>
    `)
    w.document.close(); w.print()
  }

  // Export CSV
  const exportCSV = () => {
    const rows = [
      ['Date', 'Heure', 'Client', 'Paiement', 'Articles', 'Total', 'Vendeur', 'Note'],
      ...sales.map(s => [
        selectedDate,
        new Date(s.created_at).toLocaleTimeString('fr-FR'),
        s.customer?.name || 'Anonyme',
        s.payment_method,
        String(s.total_items),
        s.total.toFixed(2),
        s.seller?.name || '',
        s.note || '',
      ])
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' }))
    a.download = `cloture-${selectedDate}.csv`
    a.click()
  }

  const alreadyClosed = !!existing
  const gapColor = stats.fundGap === null ? '' : stats.fundGap === 0 ? 'text-green-600' : stats.fundGap > 0 ? 'text-blue-600' : 'text-red-600'
  const gapBg    = stats.fundGap === null ? '' : stats.fundGap === 0 ? 'bg-green-50 border-green-200' : stats.fundGap > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Clôture de caisse</h1>
              <p className="text-gray-500 text-sm mt-0.5">Récapitulatif journalier et validation de fin de journée</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Date picker */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                <Calendar size={14} className="text-gray-400 shrink-0"/>
                <DatePicker value={selectedDate} onChange={e => setSelectedDate(e || new Date().toISOString().split('T')[0])} max={new Date().toISOString().split('T')[0]}/>
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading || sales.length === 0}>
                <Download size={14}/> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={loading || sales.length === 0}>
                <Printer size={14}/> Imprimer
              </Button>
            </div>
          </div>

          {/* Already closed banner */}
          {alreadyClosed && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                <Lock size={18} className="text-green-600"/>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-green-900">Caisse clôturée</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Le {new Date(existing!.closed_at).toLocaleDateString('fr-FR')} à {new Date(existing!.closed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {existing!.closed_by && ` · par ${existing!.closed_by}`}
                </p>
              </div>
              <Badge variant="success" className="shrink-0"><CheckCircle size={12}/> Clôturée</Badge>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg"/></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* ── LEFT COL — Stats + Sales ── */}
              <div className="lg:col-span-2 space-y-6">

                {/* KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="CA du jour"   value={fmt(stats.total)}       icon={<TrendingUp size={16}/>}/>
                  <StatCard label="Ventes"        value={sales.length}           icon={<ShoppingCart size={16}/>}/>
                  <StatCard label="Articles"      value={stats.itemsTotal}       icon={<Wallet size={16}/>}/>
                  <StatCard label="Ticket moyen"  value={fmt(stats.avgTicket)}   icon={<Users size={16}/>}/>
                </div>

                {/* Payment breakdown */}
                <Card>
                  <CardHeader><CardTitle className="flex items-center justify-between">
                    <span>Encaissements</span>
                    <span className="text-xl font-black text-gray-900">{fmt(stats.total)}</span>
                  </CardTitle></CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {[
                      { id: 'card',  value: stats.totalCard,  count: sales.filter(s => s.payment_method === 'card').length },
                      { id: 'cash',  value: stats.totalCash,  count: sales.filter(s => s.payment_method === 'cash').length },
                      { id: 'mixed', value: stats.totalMixed, count: sales.filter(s => s.payment_method === 'mixed').length },
                    ].filter(p => p.value > 0).map(p => {
                      const pay = PAY_COLORS[p.id]
                      const pct = stats.total > 0 ? (p.value / stats.total) * 100 : 0
                      return (
                        <div key={p.id} className="flex items-center gap-3">
                          <div className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg shrink-0 w-32', pay.bg, pay.text)}>
                            {pay.icon} {pay.label}
                          </div>
                          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all', p.id === 'card' ? 'bg-blue-400' : p.id === 'cash' ? 'bg-green-400' : 'bg-amber-400')}
                              style={{ width: `${pct}%` }}/>
                          </div>
                          <div className="text-right shrink-0 w-24">
                            <p className="text-sm font-bold text-gray-900">{fmt(p.value)}</p>
                            <p className="text-xs text-gray-400">{p.count} vente{p.count > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      )
                    })}
                    {sales.length === 0 && (
                      <EmptyState icon={<ShoppingCart size={32} className="text-gray-200"/>} title="Aucune vente ce jour"/>
                    )}
                  </CardContent>
                </Card>

                {/* By seller */}
                {stats.bySeller.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Par vendeur</CardTitle></CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {stats.bySeller.map((s, i) => (
                        <div key={s.name} className="flex items-center gap-3">
                          <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">{s.name[0]}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium text-gray-800">{s.name}</p>
                              <p className="text-sm font-bold text-gray-900">{fmt(s.total)}</p>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${stats.total > 0 ? (s.total / stats.total) * 100 : 0}%` }}/>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{s.count} vente{s.count > 1 ? 's' : ''} · ticket moy. {fmt(s.total / s.count)}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* By brand */}
                {stats.byBrand.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Par marque</CardTitle></CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {stats.byBrand.slice(0, 8).map(([brand, revenue], i) => {
                          const COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6']
                          const pct = stats.total > 0 ? (revenue / stats.total) * 100 : 0
                          return (
                            <div key={brand} className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }}/>
                              <p className="text-sm text-gray-700 flex-1 truncate">{brand}</p>
                              <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}/>
                              </div>
                              <p className="text-sm font-bold text-gray-900 w-20 text-right shrink-0">{fmt(revenue)}</p>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sales list */}
                {sales.length > 0 && (
                  <Card className="overflow-hidden">
                    <CardHeader><CardTitle>Détail des {sales.length} vente{sales.length > 1 ? 's' : ''}</CardTitle></CardHeader>
                    <div className="max-h-80 overflow-y-auto">
                      {sales.map(s => <SaleRow key={s.id} sale={s}/>)}
                    </div>
                  </Card>
                )}
              </div>

              {/* ── RIGHT COL — Fond de caisse + Clôture ── */}
              <div className="space-y-6">

                {/* Fond de caisse */}
                <Card>
                  <CardHeader><CardTitle>Fond de caisse</CardTitle></CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fond d'ouverture (€)</label>
                      <div className="relative">
                        <input type="number" value={fundOpening} onChange={e => setFundOpening(e.target.value)}
                          placeholder="0.00" min="0" step="0.01" disabled={alreadyClosed}
                          className="w-full border border-gray-200 rounded-xl px-4 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-60 disabled:bg-gray-50"/>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                      </div>
                    </div>

                    {fundOpening && (
                      <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                        <div className="flex justify-between text-gray-600">
                          <span>Fond ouverture</span><span>{fmt(Number(fundOpening))}</span>
                        </div>
                        <div className="flex justify-between text-green-700">
                          <span>+ Espèces encaissées</span><span>+{fmt(stats.totalCash)}</span>
                        </div>
                        <Separator/>
                        <div className="flex justify-between font-bold text-gray-900">
                          <span>Attendu en caisse</span><span>{fmt(stats.fundExpected)}</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fond compté (€)</label>
                      <div className="relative">
                        <input type="number" value={fundClosing} onChange={e => setFundClosing(e.target.value)}
                          placeholder="0.00" min="0" step="0.01" disabled={alreadyClosed}
                          className="w-full border border-gray-200 rounded-xl px-4 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-60 disabled:bg-gray-50"/>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                      </div>
                    </div>

                    {/* Gap */}
                    {fundClosing && fundOpening && (
                      <div className={cn('rounded-xl border px-4 py-3', gapBg)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {stats.fundGap === 0 ? <CheckCircle size={16} className="text-green-600"/> : <AlertTriangle size={16} className={stats.fundGap! > 0 ? 'text-blue-600' : 'text-red-600'}/>}
                            <span className="text-sm font-semibold">Écart de caisse</span>
                          </div>
                          <span className={cn('text-lg font-black', gapColor)}>
                            {stats.fundGap !== null ? (stats.fundGap > 0 ? '+' : '') + fmt(stats.fundGap) : '—'}
                          </span>
                        </div>
                        <p className="text-xs mt-1 opacity-70">
                          {stats.fundGap === 0 ? '✓ Caisse parfaite !' : stats.fundGap! > 0 ? 'Surplus en caisse' : 'Manque en caisse'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Infos clôture */}
                <Card>
                  <CardHeader><CardTitle>Informations clôture</CardTitle></CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Clôturé par</label>
                      <select value={closedBy} onChange={e => setClosedBy(e.target.value)} disabled={alreadyClosed}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white disabled:opacity-60 disabled:bg-gray-50">
                        <option value="">Sélectionner…</option>
                        {sellers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        <option value="Gérant">Gérant</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Observations</label>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} disabled={alreadyClosed}
                        placeholder="Incident, remarque, explication d'un écart…"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none disabled:opacity-60 disabled:bg-gray-50"/>
                    </div>

                    {/* Fidélité info */}
                    {stats.withCust > 0 && (
                      <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                        <p className="text-xs font-semibold text-purple-800 mb-1">🎁 Programme fidélité</p>
                        <p className="text-xs text-purple-700">
                          {stats.withCust} vente{stats.withCust > 1 ? 's' : ''} avec compte client ({Math.round((stats.withCust / (sales.length || 1)) * 100)}% du CA)
                        </p>
                      </div>
                    )}

                    {/* CTA */}
                    {!alreadyClosed ? (
                      <Button className="w-full gap-2" size="lg"
                        disabled={sales.length === 0 || saving}
                        onClick={() => setShowConfirm(true)}>
                        <Lock size={16}/>
                        Clôturer la caisse
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint}>
                          <Printer size={14}/> Imprimer
                        </Button>
                        <Button variant="outline" className="flex-1 gap-2" onClick={exportCSV}>
                          <Download size={14}/> CSV
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Historique des clôtures */}
                {clotures.filter(c => c.date !== selectedDate).length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Clôtures récentes</CardTitle></CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {clotures.filter(c => c.date !== selectedDate).slice(0, 14).map(c => (
                          <button key={c.id} onClick={() => setSelectedDate(c.date)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left">
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </p>
                              <p className="text-xs text-gray-400">{c.sales_count} ventes</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900">{fmt(c.total_revenue)}</p>
                              {c.fund_gap !== null && (
                                <p className={cn('text-xs font-semibold', c.fund_gap >= 0 ? 'text-green-600' : 'text-red-500')}>
                                  {c.fund_gap >= 0 ? '+' : ''}{fmt(c.fund_gap)}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      <Dialog open={showConfirm} onOpenChange={o => !o && setShowConfirm(false)}>
        <DialogContent className="max-w-sm overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmer la clôture</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between font-bold text-gray-900 text-base">
                  <span>CA total</span><span>{fmt(stats.total)}</span>
                </div>
                <Separator/>
                <div className="flex justify-between text-gray-600"><span>💳 Carte</span><span>{fmt(stats.totalCard)}</span></div>
                <div className="flex justify-between text-gray-600"><span>💵 Espèces</span><span>{fmt(stats.totalCash)}</span></div>
                {stats.totalMixed > 0 && <div className="flex justify-between text-gray-600"><span>🔀 Mixte</span><span>{fmt(stats.totalMixed)}</span></div>}
                <Separator/>
                <div className="flex justify-between text-gray-500"><span>Ventes</span><span>{sales.length}</span></div>
                {stats.fundGap !== null && (
                  <div className={cn('flex justify-between font-bold', gapColor)}>
                    <span>Écart de caisse</span>
                    <span>{stats.fundGap >= 0 ? '+' : ''}{fmt(stats.fundGap)}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 text-center">
                La caisse sera marquée comme clôturée. Vous pourrez toujours consulter et imprimer le récapitulatif.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleCloture} disabled={saving} className="gap-2">
              {saving ? <><Spinner size="sm"/> Clôture…</> : <><Lock size={14}/> Confirmer la clôture</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
