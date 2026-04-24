'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Download, FileText, Table, Calendar, CheckCircle, Info } from 'lucide-react'
import { getSalesForExport } from '@/lib/supabase'
import {
  Button, Card, CardHeader, CardTitle, CardContent,
  Label, Separator, Spinner, StatCard, TooltipProvider, cn, DatePicker,
} from '@/components/ui'

const fmt = (n: number) => n.toFixed(2)

// ─── CSV Builder ──────────────────────────────────────────────
function buildSalesCSV(sales: any[]): string {
  const headers = [
    'Date', 'Heure', 'ID Vente', 'Vendeur', 'Client',
    'Produit', 'Marque', 'Référence', 'Qté', 'Prix unitaire HT',
    'Total ligne', 'Remise ligne', 'Commission boutique %', 'Part boutique', 'Part créateur',
    'Mode paiement', 'Total vente', 'Remise globale', 'Note',
  ]

  const rows: string[][] = []
  sales.forEach((sale: any) => {
    const saleDate   = new Date(sale.created_at)
    const dateStr    = saleDate.toLocaleDateString('fr-FR')
    const timeStr    = saleDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    const subtotal   = (sale.items || []).reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
    const discount   = Math.max(0, subtotal - sale.total)

    ;(sale.items || []).forEach((item: any) => {
      const lineSubtotal = item.unit_price * item.quantity
      const lineDiscount = Math.max(0, lineSubtotal - item.total_price)
      const commRate     = (item.product?.brand?.commission_rate ?? 30) / 100
      const boutique     = item.total_price * commRate
      const creator      = item.total_price - boutique

      rows.push([
        dateStr,
        timeStr,
        sale.id,
        sale.seller?.name || '',
        sale.customer?.name || '',
        item.product?.name || '',
        item.product?.brand?.name || '',
        item.product?.reference || '',
        String(item.quantity),
        fmt(item.unit_price),
        fmt(item.total_price),
        fmt(lineDiscount),
        fmt((item.product?.brand?.commission_rate ?? 30)),
        fmt(boutique),
        fmt(creator),
        sale.payment_method,
        fmt(sale.total),
        fmt(discount),
        sale.note || '',
      ])
    })

    // If sale has no items, add a summary row
    if (!sale.items || sale.items.length === 0) {
      rows.push([dateStr, timeStr, sale.id, sale.seller?.name||'', sale.customer?.name||'',
        '','','','','','','','','','', sale.payment_method, fmt(sale.total), fmt(discount), sale.note||''])
    }
  })

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  return [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
}

function buildSummaryCSV(sales: any[]): string {
  const headers = ['Date', 'Nb ventes', 'CA brut', 'Remises', 'CA net', 'Espèces', 'Carte', 'Mixte', 'Bon cadeau', 'Part boutique', 'Part créateurs']
  const byDay = new Map<string, any>()

  sales.forEach((sale: any) => {
    const key = sale.created_at.split('T')[0]
    if (!byDay.has(key)) byDay.set(key, {
      date: key, count: 0, gross: 0, discount: 0, net: 0,
      cash: 0, card: 0, mixed: 0, gift: 0, boutique: 0, creator: 0,
    })
    const d = byDay.get(key)
    const subtotal = (sale.items||[]).reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
    d.count++
    d.gross    += subtotal
    d.discount += Math.max(0, subtotal - sale.total)
    d.net      += sale.total
    if (sale.payment_method === 'cash')      d.cash += sale.total
    else if (sale.payment_method === 'card') d.card += sale.total
    else if (sale.payment_method === 'mixed') d.mixed += sale.total
    else if (sale.payment_method === 'gift_card') d.gift += sale.total
    ;(sale.items||[]).forEach((item: any) => {
      const r = (item.product?.brand?.commission_rate ?? 30) / 100
      d.boutique += item.total_price * r
      d.creator  += item.total_price * (1 - r)
    })
  })

  const rows = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)).map(d => [
    new Date(d.date).toLocaleDateString('fr-FR'),
    String(d.count), fmt(d.gross), fmt(d.discount), fmt(d.net),
    fmt(d.cash), fmt(d.card), fmt(d.mixed), fmt(d.gift),
    fmt(d.boutique), fmt(d.creator),
  ])

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  return [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
}

function downloadCSV(content: string, filename: string) {
  const bom  = '\uFEFF'  // UTF-8 BOM for Excel
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── MAIN PAGE ────────────────────────────────────────────────
const PRESETS = [
  { id: 'today',     label: 'Aujourd\'hui' },
  { id: 'week',      label: '7 derniers jours' },
  { id: 'month',     label: 'Ce mois' },
  { id: 'lastmonth', label: 'Mois précédent' },
  { id: 'quarter',   label: 'Ce trimestre' },
  { id: 'year',      label: 'Cette année' },
  { id: 'custom',    label: 'Personnalisé' },
]

export default function ExportPage() {
  const [preset, setPreset]     = useState('month')
  const [customFrom, setFrom]   = useState('')
  const [customTo, setTo]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [stats, setStats]       = useState<any>(null)
  const [error, setError]       = useState('')

  const getDates = () => {
    const now = new Date()
    if (preset === 'today') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return { from: d.toISOString(), to: new Date(d.getTime() + 86399999).toISOString() }
    }
    if (preset === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0)
      return { from: d.toISOString(), to: now.toISOString() }
    }
    if (preset === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: d.toISOString(), to: now.toISOString() }
    }
    if (preset === 'lastmonth') {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
      return { from: from.toISOString(), to: to.toISOString() }
    }
    if (preset === 'quarter') {
      const q = Math.floor(now.getMonth() / 3)
      const from = new Date(now.getFullYear(), q * 3, 1)
      return { from: from.toISOString(), to: now.toISOString() }
    }
    if (preset === 'year') {
      const from = new Date(now.getFullYear(), 0, 1)
      return { from: from.toISOString(), to: now.toISOString() }
    }
    return {
      from: customFrom ? new Date(customFrom).toISOString() : new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      to:   customTo   ? new Date(customTo + 'T23:59:59').toISOString() : now.toISOString(),
    }
  }

  const handlePreview = async () => {
    setLoading(true); setError(''); setStats(null)
    try {
      const { from, to } = getDates()
      const sales = await getSalesForExport(from, to)
      const arr   = (sales || []) as any[]
      const totalCA = arr.reduce((s: number, sale: any) => s + sale.total, 0)
      const totalItems = arr.reduce((s: number, sale: any) => s + sale.total_items, 0)
      const byMethod = arr.reduce((acc: any, s: any) => {
        acc[s.payment_method] = (acc[s.payment_method] || 0) + s.total
        return acc
      }, {})
      setStats({ sales: arr, count: arr.length, totalCA, totalItems, byMethod, from, to })
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleExportDetail = () => {
    if (!stats?.sales) return
    const csv = buildSalesCSV(stats.sales)
    const label = PRESETS.find(p => p.id === preset)?.label.toLowerCase().replace(/\s/g, '-') || 'periode'
    downloadCSV(csv, `ateli-ventes-detail-${label}-${new Date().toISOString().split('T')[0]}.csv`)
  }

  const handleExportSummary = () => {
    if (!stats?.sales) return
    const csv = buildSummaryCSV(stats.sales)
    const label = PRESETS.find(p => p.id === preset)?.label.toLowerCase().replace(/\s/g, '-') || 'periode'
    downloadCSV(csv, `ateli-ventes-resume-${label}-${new Date().toISOString().split('T')[0]}.csv`)
  }

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Export comptable</h1>
            <p className="text-gray-500 text-sm mt-0.5">Exportez vos ventes en CSV pour votre comptable ou logiciel de comptabilité</p>
          </div>

          {/* Period selector */}
          <Card>
            <CardHeader><CardTitle>Période</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => setPreset(p.id)}
                    className={cn('px-3.5 py-2 rounded-xl text-sm font-medium border transition-all',
                      preset === p.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
                    {p.label}
                  </button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Du</Label>
                    <DatePicker value={customFrom} onChange={e => setFrom(e)}/>
                  </div>
                  <div>
                    <Label>Au</Label>
                    <DatePicker value={customTo} onChange={e => setTo(e)} min={customFrom}/>
                  </div>
                </div>
              )}
              <Button onClick={handlePreview} disabled={loading} className="gap-2 w-full sm:w-auto">
                {loading ? <Spinner size="sm"/> : <FileText size={14}/>}
                {loading ? 'Chargement…' : 'Aperçu des données'}
              </Button>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </CardContent>
          </Card>

          {/* Stats preview */}
          {stats && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Ventes"    value={stats.count}                                          icon={<FileText size={16}/>}/>
                <StatCard label="CA total"  value={`${stats.totalCA.toFixed(0)} €`}                     icon={<CheckCircle size={16}/>}/>
                <StatCard label="Carte"     value={`${(stats.byMethod.card || 0).toFixed(0)} €`}         icon={<Table size={16}/>}/>
                <StatCard label="Espèces"   value={`${(stats.byMethod.cash || 0).toFixed(0)} €`}         icon={<Calendar size={16}/>}/>
              </div>

              {/* Export options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Detail export */}
                <Card className="border-2 border-indigo-100">
                  <CardContent className="py-5 space-y-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Table size={18} className="text-indigo-600"/>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Export détaillé</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Une ligne par article vendu avec répartition boutique/créateur. Idéal pour la comptabilité analytique.
                      </p>
                    </div>
                    <div className="text-xs text-gray-400 space-y-0.5">
                      <p>✓ Date, vendeur, client, produit, marque</p>
                      <p>✓ Prix unitaire, remises, totaux</p>
                      <p>✓ Part boutique et créateur par ligne</p>
                      <p>✓ Mode de paiement, note</p>
                    </div>
                    <Button onClick={handleExportDetail} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700">
                      <Download size={14}/> Télécharger ({stats.sales.reduce((s: number, v: any) => s + (v.items?.length || 1), 0)} lignes)
                    </Button>
                  </CardContent>
                </Card>

                {/* Summary export */}
                <Card className="border-2 border-green-100">
                  <CardContent className="py-5 space-y-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <Calendar size={18} className="text-green-600"/>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Export résumé journalier</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Une ligne par jour avec totaux agrégés. Idéal pour le journal des ventes ou rapprochement bancaire.
                      </p>
                    </div>
                    <div className="text-xs text-gray-400 space-y-0.5">
                      <p>✓ CA brut, remises, CA net</p>
                      <p>✓ Répartition par mode de paiement</p>
                      <p>✓ Part boutique et créateurs total</p>
                      <p>✓ 1 ligne = 1 jour</p>
                    </div>
                    <Button onClick={handleExportSummary} className="w-full gap-2 bg-green-600 hover:bg-green-700">
                      <Download size={14}/> Télécharger ({new Set(stats.sales.map((s: any) => s.created_at.split('T')[0])).size} jours)
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Comptable note */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                <Info size={15} className="text-blue-500 shrink-0 mt-0.5"/>
                <div className="text-xs text-blue-700 space-y-1">
                  <p className="font-semibold">Note pour votre comptable</p>
                  <p>Les fichiers CSV sont encodés en UTF-8 avec BOM pour une compatibilité optimale avec Excel et les logiciels de comptabilité (Cegid, Sage, FEC…). Le séparateur est la virgule.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
