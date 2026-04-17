'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Download, Settings, ChevronDown, ChevronUp, CheckCircle,
  Wallet, TrendingUp, Package, Clock, Plus, Trash2, X,
  Calendar, BadgeEuro,
} from 'lucide-react'
import {
  getBrandStats, getBrands, updateBrandSettings,
  getReversements, createReversement, markReversementPaid, deleteReversement,
} from '@/lib/supabase'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Input, Label, Separator, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  StatCard, Spinner, EmptyState, TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, cn,
} from '@/components/ui'
import type { Brand, BrandStats, Reversement } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────
const fmt     = (n: number) => n.toFixed(2) + ' €'
const fmtShort = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'k €' : n.toFixed(2) + ' €'
const PERIODS = [
  { id: 'month',  label: 'Ce mois' },
  { id: 'last',   label: 'Mois dernier' },
  { id: 'q',      label: 'Ce trimestre' },
  { id: 'custom', label: 'Période perso' },
]

function getPeriodDates(period: string): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  if (period === 'month') {
    return {
      from: new Date(y, m, 1).toISOString(),
      to:   new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
    }
  }
  if (period === 'last') {
    return {
      from: new Date(y, m - 1, 1).toISOString(),
      to:   new Date(y, m, 0, 23, 59, 59).toISOString(),
    }
  }
  if (period === 'q') {
    const q = Math.floor(m / 3)
    return {
      from: new Date(y, q * 3, 1).toISOString(),
      to:   new Date(y, q * 3 + 3, 0, 23, 59, 59).toISOString(),
    }
  }
  return { from: '', to: '' }
}

function periodLabel(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  return `${new Date(from).toLocaleDateString('fr-FR', opts)} → ${new Date(to).toLocaleDateString('fr-FR', opts)}`
}

// ─── Brand settings modal ──────────────────────────────────────
function BrandSettingsModal({ brand, onClose, onSave }: {
  brand: Brand
  onClose: () => void
  onSave: (b: Brand) => void
}) {
  const [form, setForm] = useState({
    commission_rate: String(brand.commission_rate ?? 30),
    contact_name:   brand.contact_name  ?? '',
    contact_email:  brand.contact_email ?? '',
    contact_phone:  brand.contact_phone ?? '',
    iban:           brand.iban          ?? '',
    notes:          brand.notes         ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSave = async () => {
    const rate = Number(form.commission_rate)
    if (isNaN(rate) || rate < 0 || rate > 100) return setError('Taux entre 0 et 100 %')
    setSaving(true); setError('')
    try {
      const updated = await updateBrandSettings(brand.id, {
        commission_rate: rate,
        contact_name:   form.contact_name   || null,
        contact_email:  form.contact_email  || null,
        contact_phone:  form.contact_phone  || null,
        iban:           form.iban           || null,
        notes:          form.notes          || null,
      })
      onSave(updated as Brand)
      onClose()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  })

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paramètres — {brand.name}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            {/* Commission */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <Label>Taux de commission boutique (%)</Label>
              <div className="relative mt-1">
                <Input type="number" min="0" max="100" step="0.5" {...f('commission_rate')}/>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 font-bold text-sm">%</span>
              </div>
              {Number(form.commission_rate) > 0 && (
                <p className="text-xs text-indigo-600 mt-2 font-medium">
                  → La boutique garde {form.commission_rate}%, le créateur reçoit {(100 - Number(form.commission_rate)).toFixed(1)}%
                </p>
              )}
            </div>

            <Separator/>

            {/* Contact */}
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Contact créateur</p>
            <div><Label>Nom du créateur</Label><Input placeholder="Marie Dupont" {...f('contact_name')}/></div>
            <div><Label>Email</Label><Input type="email" placeholder="marie@brand.com" {...f('contact_email')}/></div>
            <div><Label>Téléphone</Label><Input type="tel" placeholder="06 12 34 56 78" {...f('contact_phone')}/></div>

            <Separator/>

            {/* Payment */}
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Coordonnées bancaires</p>
            <div>
              <Label>IBAN</Label>
              <Input placeholder="FR76 3000 6000 0112 3456 7890 189" {...f('iban')} className="font-mono text-sm"/>
            </div>
            <div>
              <Label>Notes internes</Label>
              <textarea {...f('notes')} rows={2} placeholder="Conditions particulières, délai de paiement…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm"/> : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create reversement modal ──────────────────────────────────
function CreateReversementModal({ stats, from, to, onClose, onCreated }: {
  stats: BrandStats; from: string; to: string
  onClose: () => void; onCreated: () => void
}) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const commRate = stats.brand.commission_rate ?? 30

  const handleCreate = async () => {
    setSaving(true)
    try {
      await createReversement({
        brand_id:      stats.brand.id,
        period_from:   from.split('T')[0],
        period_to:     to.split('T')[0],
        gross_revenue: stats.gross_revenue,
        commission:    stats.commission_amount,
        net_amount:    stats.net_to_pay,
        notes:         notes || null,
      })
      onCreated()
      onClose()
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un reversement</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black" style={{background:'#6366f1'}}>{stats.brand.name[0]}</div>
                <p className="font-bold text-gray-900">{stats.brand.name}</p>
              </div>
              {[
                ['CA brut', fmt(stats.gross_revenue)],
                [`Commission boutique (${commRate}%)`, `-${fmt(stats.commission_amount)}`],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm text-gray-600">
                  <span>{l}</span><span>{v}</span>
                </div>
              ))}
              <Separator/>
              <div className="flex justify-between text-base font-black text-green-700">
                <span>À reverser</span><span>{fmt(stats.net_to_pay)}</span>
              </div>
            </div>

            {stats.brand.iban && (
              <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                <p className="text-xs text-green-700 font-semibold mb-1">IBAN</p>
                <p className="font-mono text-sm text-green-900">{stats.brand.iban}</p>
              </div>
            )}

            <div>
              <Label>Note (optionnel)</Label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Référence virement, commentaire…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleCreate} disabled={saving} className="gap-2">
            {saving ? <Spinner size="sm"/> : <><Plus size={14}/>Créer le reversement</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Brand card ────────────────────────────────────────────────
function BrandCard({ stats, periodFrom, periodTo, onSettingsClick, onCreateRev, onRefresh }: {
  stats: BrandStats
  periodFrom: string; periodTo: string
  onSettingsClick: () => void
  onCreateRev: () => void
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const commRate  = stats.brand.commission_rate ?? 30
  const hasRev    = stats.gross_revenue > 0

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0"
          style={{background: '#6366f1'}}>{stats.brand.name[0]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-gray-900 truncate">{stats.brand.name}</p>
            <Badge variant="secondary" size="sm">{commRate}% commission</Badge>
          </div>
          {stats.brand.contact_name && (
            <p className="text-xs text-gray-400">{stats.brand.contact_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onSettingsClick}><Settings size={14}/></Button>
            </TooltipTrigger>
            <TooltipContent>Paramètres marque</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon-sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </Button>
        </div>
      </div>

      {/* Main figures */}
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">CA brut</p>
          <p className="text-lg font-black text-gray-900">{fmtShort(stats.gross_revenue)}</p>
          <p className="text-xs text-gray-400">{stats.items_sold} art. · {stats.sales_count} ventes</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">Commission ({commRate}%)</p>
          <p className="text-lg font-black text-indigo-600">-{fmtShort(stats.commission_amount)}</p>
          <p className="text-xs text-gray-400">pour la boutique</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">À reverser</p>
          <p className="text-lg font-black text-green-600">{fmtShort(stats.net_to_pay)}</p>
          <p className="text-xs text-gray-400">{(100 - commRate).toFixed(0)}% au créateur</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 py-2 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full flex">
              <div className="bg-indigo-400 h-full" style={{width:`${commRate}%`}}/>
              <div className="bg-green-400 h-full flex-1"/>
            </div>
          </div>
          <p className="text-xs text-gray-500 shrink-0">
            <span className="text-indigo-600 font-semibold">{commRate}% boutique</span>
            {' · '}
            <span className="text-green-600 font-semibold">{(100-commRate).toFixed(0)}% créateur</span>
          </p>
        </div>
      </div>

      {/* Top products (expanded) */}
      {expanded && stats.top_products.length > 0 && (
        <div className="border-t border-gray-100">
          <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Top articles</p>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.top_products.map(p => (
              <div key={p.name} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.qty} vendu{p.qty > 1 ? 's' : ''}</p>
                </div>
                <p className="text-sm font-bold text-gray-700">{fmt(p.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
        {stats.brand.iban ? (
          <p className="text-xs text-gray-400 font-mono truncate">{stats.brand.iban.slice(0, 20)}…</p>
        ) : (
          <button onClick={onSettingsClick} className="text-xs text-amber-600 font-semibold hover:text-amber-800 transition-colors">
            ⚠ IBAN manquant — configurer
          </button>
        )}
        {hasRev && (
          <Button size="sm" onClick={onCreateRev} className="gap-1.5 ml-3 shrink-0">
            <Plus size={13}/>Reversement
          </Button>
        )}
      </div>
    </Card>
  )
}

// ─── MAIN PAGE ─────────────────────────────────────────────────
export default function RevergementsPage() {
  const [stats, setStats]               = useState<BrandStats[]>([])
  const [brands, setBrands]             = useState<Brand[]>([])
  const [reversements, setReversements] = useState<Reversement[]>([])
  const [loading, setLoading]           = useState(true)
  const [period, setPeriod]             = useState('month')
  const [customFrom, setCustomFrom]     = useState('')
  const [customTo, setCustomTo]         = useState('')
  const [settingsBrand, setSettingsBrand] = useState<Brand | null>(null)
  const [createRevStats, setCreateRevStats] = useState<BrandStats | null>(null)
  const [activeTab, setActiveTab]       = useState<'stats'|'history'>('stats')
  const [filterStatus, setFilterStatus] = useState<'all'|'pending'|'paid'>('all')

  const { from, to } = useMemo(() => {
    if (period === 'custom') return { from: customFrom ? new Date(customFrom + 'T00:00:00').toISOString() : '', to: customTo ? new Date(customTo + 'T23:59:59').toISOString() : '' }
    return getPeriodDates(period)
  }, [period, customFrom, customTo])

  const load = useCallback(async () => {
    if (period === 'custom' && (!customFrom || !customTo)) return
    setLoading(true)
    try {
      const [s, b, r] = await Promise.all([
        getBrandStats(from || undefined, to || undefined),
        getBrands(),
        getReversements(),
      ])
      setStats(s as BrandStats[])
      setBrands((b as Brand[]) || [])
      setReversements((r as Reversement[]) || [])
    } finally { setLoading(false) }
  }, [from, to, period, customFrom, customTo])

  useEffect(() => { load() }, [load])

  const totalGross   = stats.reduce((s, b) => s + b.gross_revenue, 0)
  const totalComm    = stats.reduce((s, b) => s + b.commission_amount, 0)
  const totalNet     = stats.reduce((s, b) => s + b.net_to_pay, 0)
  const activeBrands = stats.filter(s => s.gross_revenue > 0).length

  const filteredRevs = reversements.filter(r => filterStatus === 'all' || r.status === filterStatus)

  const pendingTotal = reversements.filter(r => r.status === 'pending').reduce((s, r) => s + r.net_amount, 0)

  const handleMarkPaid = async (id: string) => {
    try {
      await markReversementPaid(id, 'Gérant')
      setReversements(prev => prev.map(r => r.id === id ? { ...r, status: 'paid' as const, paid_at: new Date().toISOString() } : r))
    } catch (e: any) { alert(e.message) }
  }

  const handleDeleteRev = async (id: string) => {
    if (!confirm('Supprimer ce reversement ?')) return
    try {
      await deleteReversement(id)
      setReversements(prev => prev.filter(r => r.id !== id))
    } catch (e: any) { alert(e.message) }
  }

  const exportCSV = () => {
    const rows = [
      ['Marque','Contact','CA brut','Commission','Net à reverser','Articles','Ventes','IBAN'],
      ...stats.filter(s => s.gross_revenue > 0).map(s => [
        s.brand.name,
        s.brand.contact_name || '',
        s.gross_revenue.toFixed(2),
        s.commission_amount.toFixed(2),
        s.net_to_pay.toFixed(2),
        String(s.items_sold),
        String(s.sales_count),
        s.brand.iban || '',
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = `reversements-${from.split('T')[0] || 'periode'}.csv`
    a.click()
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reversements</h1>
              <p className="text-gray-500 text-sm mt-0.5">CA par marque et montants à reverser aux créateurs</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Period */}
              <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-0.5">
                {PERIODS.map(p => (
                  <button key={p.id} onClick={() => setPeriod(p.id)}
                    className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                      period === p.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}>
                    {p.label}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
                  <span className="text-xs text-gray-400">Du</span>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    className="text-sm text-gray-700 bg-transparent focus:outline-none cursor-pointer"/>
                  <span className="text-xs text-gray-400">au</span>
                  <input type="date" value={customTo} min={customFrom} max={new Date().toISOString().split('T')[0]}
                    onChange={e => setCustomTo(e.target.value)}
                    className="text-sm text-gray-700 bg-transparent focus:outline-none cursor-pointer"/>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading || stats.length === 0}>
                <Download size={14}/> Export CSV
              </Button>
            </div>
          </div>

          {/* Period label */}
          {(from && to) && (
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <Calendar size={12}/> {periodLabel(from, to)}
            </p>
          )}

          {/* Alert: reversements en attente */}
          {pendingTotal > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Clock size={18} className="text-amber-600"/>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-900">
                  {reversements.filter(r => r.status === 'pending').length} reversement{reversements.filter(r => r.status === 'pending').length > 1 ? 's' : ''} en attente de paiement
                </p>
                <p className="text-xs text-amber-700 mt-0.5">Total : <strong>{fmt(pendingTotal)}</strong> à virer</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveTab('history')}
                className="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0">
                Voir →
              </Button>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="CA brut période" value={loading ? '…' : fmtShort(totalGross)} icon={<TrendingUp size={18}/>}/>
            <StatCard label="Commission boutique" value={loading ? '…' : fmtShort(totalComm)} icon={<BadgeEuro size={18}/>}/>
            <StatCard label="Total à reverser" value={loading ? '…' : fmtShort(totalNet)} icon={<Wallet size={18}/>}/>
            <StatCard label="Marques actives" value={loading ? '…' : activeBrands} icon={<Package size={18}/>}/>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 w-fit">
            {[
              { id: 'stats',   label: '📊 Par marque' },
              { id: 'history', label: `🧾 Historique${reversements.length > 0 ? ` (${reversements.length})` : ''}` },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  activeTab === t.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── TAB: STATS PAR MARQUE ── */}
          {activeTab === 'stats' && (
            <>
              {loading ? (
                <div className="flex justify-center py-20"><Spinner size="lg"/></div>
              ) : stats.filter(s => s.gross_revenue > 0).length === 0 ? (
                <EmptyState icon={<Wallet size={40} className="text-gray-200"/>}
                  title="Aucune vente sur cette période"
                  description="Modifiez la période pour voir les reversements"/>
              ) : (
                <div className="space-y-4">
                  {stats.filter(s => s.gross_revenue > 0).map(s => (
                    <BrandCard
                      key={s.brand.id}
                      stats={s}
                      periodFrom={from}
                      periodTo={to}
                      onSettingsClick={() => setSettingsBrand(
                        brands.find(b => b.id === s.brand.id) ?? s.brand as Brand
                      )}
                      onCreateRev={() => setCreateRevStats(s)}
                      onRefresh={load}
                    />
                  ))}

                  {/* Brands with 0 sales */}
                  {stats.filter(s => s.gross_revenue === 0).length > 0 && (
                    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
                      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Marques sans ventes ({stats.filter(s => s.gross_revenue === 0).length})
                        </p>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {stats.filter(s => s.gross_revenue === 0).map(s => (
                          <div key={s.brand.id} className="flex items-center justify-between px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400">{s.brand.name[0]}</div>
                              <p className="text-sm text-gray-500">{s.brand.name}</p>
                            </div>
                            <Button variant="ghost" size="icon-sm" onClick={() => setSettingsBrand(brands.find(b => b.id === s.brand.id) ?? s.brand as Brand)}>
                              <Settings size={13}/>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary table */}
                  <Card className="overflow-hidden">
                    <CardHeader><CardTitle>Récapitulatif</CardTitle></CardHeader>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            {['Marque','CA brut','Commission','Net à reverser','IBAN'].map(h => (
                              <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {stats.filter(s => s.gross_revenue > 0).map(s => (
                            <tr key={s.brand.id} className="hover:bg-gray-50">
                              <td className="px-5 py-3 font-medium text-gray-900">{s.brand.name}</td>
                              <td className="px-5 py-3 text-gray-600">{fmt(s.gross_revenue)}</td>
                              <td className="px-5 py-3 text-indigo-600 font-medium">-{fmt(s.commission_amount)}</td>
                              <td className="px-5 py-3 text-green-700 font-bold">{fmt(s.net_to_pay)}</td>
                              <td className="px-5 py-3 text-gray-400 font-mono text-xs">{s.brand.iban ? s.brand.iban.slice(0, 18) + '…' : '—'}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 border-t-2 border-gray-200">
                            <td className="px-5 py-3 font-black text-gray-900">Total</td>
                            <td className="px-5 py-3 font-bold text-gray-900">{fmt(totalGross)}</td>
                            <td className="px-5 py-3 font-bold text-indigo-700">-{fmt(totalComm)}</td>
                            <td className="px-5 py-3 font-black text-green-700 text-base">{fmt(totalNet)}</td>
                            <td/>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}

          {/* ── TAB: HISTORIQUE ── */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {(['all','pending','paid'] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={cn('px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-all',
                      filterStatus === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
                    {s === 'all' ? 'Tous' : s === 'pending' ? '⏳ En attente' : '✓ Payés'}
                  </button>
                ))}
              </div>

              {filteredRevs.length === 0 ? (
                <EmptyState icon={<Clock size={40} className="text-gray-200"/>}
                  title="Aucun reversement"
                  description="Créez votre premier reversement depuis l'onglet Par marque"/>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {['Marque','Période','CA brut','Commission','Net à verser','Statut','Actions'].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredRevs.map(r => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3.5 font-medium text-gray-900">
                              {(r as any).brand?.name ?? '—'}
                            </td>
                            <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                              {new Date(r.period_from).toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}
                              {' → '}
                              {new Date(r.period_to).toLocaleDateString('fr-FR', {day:'numeric',month:'short',year:'numeric'})}
                            </td>
                            <td className="px-5 py-3.5 text-gray-600">{fmt(r.gross_revenue)}</td>
                            <td className="px-5 py-3.5 text-indigo-600">-{fmt(r.commission)}</td>
                            <td className="px-5 py-3.5 font-bold text-green-700">{fmt(r.net_amount)}</td>
                            <td className="px-5 py-3.5">
                              {r.status === 'paid' ? (
                                <Badge variant="success" className="gap-1">
                                  <CheckCircle size={11}/> Payé
                                </Badge>
                              ) : (
                                <Badge variant="warning">⏳ En attente</Badge>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                {r.status === 'pending' && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="xs" variant="outline" onClick={() => handleMarkPaid(r.id)}
                                        className="text-green-700 border-green-200 hover:border-green-500 gap-1">
                                        <CheckCircle size={11}/> Marquer payé
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Marquer comme viré</TooltipContent>
                                  </Tooltip>
                                )}
                                {r.status === 'paid' && r.paid_at && (
                                  <span className="text-xs text-gray-400">
                                    {new Date(r.paid_at).toLocaleDateString('fr-FR')}
                                  </span>
                                )}
                                <Button size="icon-sm" variant="ghost" onClick={() => handleDeleteRev(r.id)}
                                  className="text-red-400 hover:text-red-600 hover:bg-red-50">
                                  <Trash2 size={12}/>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Brand settings modal */}
      {settingsBrand && (
        <BrandSettingsModal
          brand={settingsBrand}
          onClose={() => setSettingsBrand(null)}
          onSave={updated => {
            setBrands(prev => prev.map(b => b.id === updated.id ? updated : b))
            setSettingsBrand(null)
            load()
          }}
        />
      )}

      {/* Create reversement modal */}
      {createRevStats && (
        <CreateReversementModal
          stats={createRevStats}
          from={from}
          to={to}
          onClose={() => setCreateRevStats(null)}
          onCreated={() => { setCreateRevStats(null); load(); setActiveTab('history') }}
        />
      )}
    </TooltipProvider>
  )
}
