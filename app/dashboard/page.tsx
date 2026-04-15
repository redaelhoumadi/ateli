'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { getSalesStats, getBrands } from '@/lib/supabase'
import { getTierForSpend, REWARDS_TIERS } from '@/lib/customerPortal'

// ─── Types ────────────────────────────────────────────────────
type SaleItem = {
  quantity: number
  unit_price: number
  total_price: number
  product?: { name: string; brand?: { name: string } }
}
type Sale = {
  id: string
  total: number
  total_items: number
  payment_method: string
  created_at: string
  customer?: { name: string } | null
  seller?: { name: string } | null
  items?: SaleItem[]
}
type Brand = { id: string; name: string }

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) => n.toFixed(2) + ' €'
const fmtShort = (n: number) =>
  n >= 1000 ? (n / 1000).toFixed(1) + 'k €' : n.toFixed(0) + ' €'

const PAYMENT_LABELS: Record<string, string> = {
  card: '💳 Carte', cash: '💵 Espèces', mixed: '🔀 Mixte',
}

const TIER_ICONS: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', vip: '💜',
}

// ─── Mini sparkline SVG ───────────────────────────────────────
function Sparkline({ values, color = '#000' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const w = 80, h = 28
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - (v / max) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Bar chart horizontal ─────────────────────────────────────
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-16 text-right shrink-0">{fmtShort(value)}</span>
    </div>
  )
}

// ─── Sale detail modal ────────────────────────────────────────
function SaleModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const date = new Date(sale.created_at)
  const brandBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    ;(sale.items || []).forEach((i) => {
      const b = i.product?.brand?.name || 'Autre'
      map.set(b, (map.get(b) || 0) + i.total_price)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [sale])

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-black px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-white font-bold text-lg">{fmt(sale.total)}</p>
            <p className="text-gray-400 text-sm">
              {date.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Client', value: sale.customer?.name || 'Anonyme' },
              { label: 'Vendeur', value: sale.seller?.name || '—' },
              { label: 'Paiement', value: PAYMENT_LABELS[sale.payment_method] || sale.payment_method },
            ].map((m) => (
              <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">{m.label}</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Articles</p>
            <div className="space-y-1.5">
              {(sale.items || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                      ×{item.quantity}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.product?.name || '—'}</p>
                      {item.product?.brand?.name && (
                        <p className="text-xs text-gray-400">{item.product.brand.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-gray-900">{fmt(item.total_price)}</p>
                    {item.quantity > 1 && (
                      <p className="text-xs text-gray-400">{fmt(item.unit_price)} /u</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Brand breakdown */}
          {brandBreakdown.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Par marque</p>
              <div className="space-y-2">
                {brandBreakdown.map(([brand, total]) => (
                  <div key={brand} className="flex justify-between items-center py-1">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">{brand}</span>
                    <span className="text-sm font-bold text-gray-900">{fmt(total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between items-center pt-3 border-t border-gray-100">
            <span className="text-base font-bold text-gray-900">Total encaissé</span>
            <span className="text-xl font-black text-gray-900">{fmt(sale.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function DashboardPage() {
  const [sales, setSales]   = useState<Sale[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today')
  const [filterBrand, setFilterBrand]     = useState<string>('')
  const [filterPayment, setFilterPayment] = useState<string>('')
  const [selectedSale, setSelectedSale]   = useState<Sale | null>(null)
  const [activeTab, setActiveTab]         = useState<'overview' | 'brands' | 'sales' | 'loyalty'>('overview')

  // ── Load data ───────────────────────────────────────────────
  useEffect(() => {
    getBrands().then((b) => setBrands((b as Brand[]) || []))
  }, [])

  useEffect(() => {
    const now = new Date()
    let dateFrom: string | undefined

    if (period === 'today') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    } else if (period === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 7); dateFrom = d.toISOString()
    } else if (period === 'month') {
      const d = new Date(now); d.setMonth(d.getMonth() - 1); dateFrom = d.toISOString()
    }
    // 'all' → no dateFrom

    setLoading(true)
    getSalesStats(dateFrom)
      .then((data) => setSales((data as unknown as Sale[]) || []))
      .finally(() => setLoading(false))
  }, [period])

  // ── Filtered sales ──────────────────────────────────────────
  const filtered = useMemo(() => {
    return sales.filter((s) => {
      const matchPayment = !filterPayment || s.payment_method === filterPayment
      const matchBrand = !filterBrand || (s.items || []).some(
        (i) => i.product?.brand?.name === filterBrand
      )
      return matchPayment && matchBrand
    })
  }, [sales, filterBrand, filterPayment])

  // ── KPIs ────────────────────────────────────────────────────
  const totalRevenue = filtered.reduce((s, v) => s + v.total, 0)
  const totalItems   = filtered.reduce((s, v) => s + v.total_items, 0)
  const avgTicket    = filtered.length ? totalRevenue / filtered.length : 0
  const withCustomer = filtered.filter((s) => s.customer).length
  const fidelityRate = filtered.length ? Math.round((withCustomer / filtered.length) * 100) : 0

  // ── Revenue by brand ─────────────────────────────────────────
  const brandRevenue = useMemo(() => {
    const map = new Map<string, { revenue: number; qty: number; txCount: number }>()
    filtered.forEach((sale) => {
      const brandsInSale = new Set<string>()
      ;(sale.items || []).forEach((item) => {
        const b = item.product?.brand?.name || 'Autre'
        brandsInSale.add(b)
        const cur = map.get(b) || { revenue: 0, qty: 0, txCount: 0 }
        cur.revenue += item.total_price
        cur.qty += item.quantity
        map.set(b, cur)
      })
      brandsInSale.forEach((b) => {
        const cur = map.get(b)!
        cur.txCount++
      })
    })
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [filtered])

  const maxBrandRevenue = brandRevenue[0]?.revenue || 1

  // ── Revenue by payment ───────────────────────────────────────
  const paymentRevenue = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach((s) => map.set(s.payment_method, (map.get(s.payment_method) || 0) + s.total))
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [filtered])

  // ── Top products ─────────────────────────────────────────────
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; brand: string; qty: number; revenue: number }>()
    filtered.forEach((sale) => {
      ;(sale.items || []).forEach((item) => {
        const key = item.product?.name || '—'
        const brand = item.product?.brand?.name || '—'
        const cur = map.get(key) || { name: key, brand, qty: 0, revenue: 0 }
        cur.qty += item.quantity
        cur.revenue += item.total_price
        map.set(key, cur)
      })
    })
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [filtered])

  // ── Hourly distribution (today only) ─────────────────────────
  const hourlyData = useMemo(() => {
    const hours = Array(24).fill(0)
    filtered.forEach((s) => {
      const h = new Date(s.created_at).getHours()
      hours[h] += s.total
    })
    return hours
  }, [filtered])
  const peakHour = hourlyData.indexOf(Math.max(...hourlyData))

  // ── Loyalty breakdown ─────────────────────────────────────────
  const loyaltyStats = useMemo(() => {
    const tiers = new Map<string, { count: number; revenue: number }>()
    REWARDS_TIERS.forEach((t) => tiers.set(t.id, { count: 0, revenue: 0 }))
    tiers.set('anonymous', { count: 0, revenue: 0 })

    filtered.forEach((sale) => {
      if (!sale.customer) {
        tiers.get('anonymous')!.count++
        tiers.get('anonymous')!.revenue += sale.total
      }
      // Note: we don't have totalSpend per sale, so this is an approximation
    })
    return tiers
  }, [filtered])

  // ─────────────────────────────────────────────────────────────
  const BRAND_COLORS = [
    '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
    '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-8xl mx-auto px-6 py-8">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Dashboard</h1>
            <p className="text-gray-500 text-sm">Analyse des ventes · {filtered.length} transaction{filtered.length > 1 ? 's' : ''}</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Period */}
            <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1">
              {([
                ['today', "Aujourd'hui"],
                ['week', '7 jours'],
                ['month', '30 jours'],
                ['all', 'Tout'],
              ] as const).map(([p, label]) => (
                <button key={p} onClick={() => setPeriod(p as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    period === p ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Brand filter */}
            <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black">
              <option value="">Toutes les marques</option>
              {brands.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>

            {/* Payment filter */}
            <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black">
              <option value="">Tous paiements</option>
              <option value="card">💳 Carte</option>
              <option value="cash">💵 Espèces</option>
              <option value="mixed">🔀 Mixte</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── KPI row ─────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Chiffre d\'affaires', value: fmt(totalRevenue), sub: `${filtered.length} ventes`, color: '#10b981', sparkColor: '#10b981' },
                { label: 'Ticket moyen', value: fmt(avgTicket), sub: `${totalItems} articles`, color: '#6366f1', sparkColor: '#6366f1' },
                { label: 'Articles vendus', value: totalItems.toString(), sub: `${(totalItems / (filtered.length || 1)).toFixed(1)} / vente`, color: '#f59e0b', sparkColor: '#f59e0b' },
                { label: 'CA / marque top', value: brandRevenue[0] ? fmtShort(brandRevenue[0].revenue) : '—', sub: brandRevenue[0]?.name || '—', color: '#0ea5e9', sparkColor: '#0ea5e9' },
                { label: 'Taux fidélité', value: `${fidelityRate} %`, sub: `${withCustomer} avec compte`, color: '#8b5cf6', sparkColor: '#8b5cf6' },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">{kpi.label}</p>
                  <p className="text-2xl font-black text-gray-900 mb-1">{kpi.value}</p>
                  <p className="text-xs text-gray-400">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* ── Tabs ────────────────────────────────────── */}
            <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 mb-6 w-fit">
              {([
                ['overview',  '📊 Vue générale'],
                ['brands',    '🏷 Par marque'],
                ['sales',     '🧾 Ventes'],
                ['loyalty',   '🎁 Fidélité'],
              ] as const).map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab as any)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* ════════════════════════════════════════════
                TAB: OVERVIEW
            ════════════════════════════════════════════ */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Hourly chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-bold text-gray-900">Ventes par heure</h3>
                      {peakHour > 0 && hourlyData[peakHour] > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Pic à {peakHour}h · {fmtShort(hourlyData[peakHour])}
                        </p>
                      )}
                    </div>
                  </div>
                  {hourlyData.every((v) => v === 0) ? (
                    <div className="flex items-center justify-center h-32 text-gray-300 text-sm">
                      Aucune vente sur cette période
                    </div>
                  ) : (
                    <div className="flex items-end gap-1 h-36">
                      {hourlyData.slice(8, 22).map((val, i) => {
                        const hour = i + 8
                        const pct = hourlyData[peakHour] > 0 ? (val / hourlyData[peakHour]) * 100 : 0
                        return (
                          <div key={hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                            {val > 0 && (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">
                                {fmtShort(val)}
                              </div>
                            )}
                            <div
                              className="w-full rounded-t-md transition-all duration-500"
                              style={{
                                height: `${Math.max(pct, val > 0 ? 4 : 0)}%`,
                                background: hour === peakHour ? '#000' : '#e5e7eb',
                              }}
                            />
                            {(hour % 2 === 0) && (
                              <span className="text-xs text-gray-400">{hour}h</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Payment breakdown */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <h3 className="font-bold text-gray-900 mb-5">Modes de paiement</h3>
                  {paymentRevenue.length === 0 ? (
                    <p className="text-sm text-gray-300 text-center py-8">—</p>
                  ) : (
                    <div className="space-y-4">
                      {paymentRevenue.map(([method, rev]) => {
                        const count = filtered.filter((s) => s.payment_method === method).length
                        const pct = totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0
                        return (
                          <div key={method}>
                            <div className="flex justify-between text-sm mb-1.5">
                              <span className="font-medium text-gray-700">{PAYMENT_LABELS[method] || method}</span>
                              <span className="font-bold text-gray-900">{fmt(rev)}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-black rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{count} transaction{count > 1 ? 's' : ''} · {pct.toFixed(0)} %</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Top products (quick view) */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">Top 10 produits</h3>
                    <button onClick={() => setActiveTab('brands')}
                      className="text-xs text-gray-400 hover:text-black transition-colors">
                      Voir par marque →
                    </button>
                  </div>
                  {topProducts.length === 0 ? (
                    <p className="text-center py-8 text-gray-400 text-sm">Aucune vente sur cette période</p>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide w-8">#</th>
                          <th className="text-left text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide">Produit</th>
                          <th className="text-left text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide">Marque</th>
                          <th className="text-right text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide">Qté</th>
                          <th className="text-right text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide">CA</th>
                          <th className="text-right text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide">Part</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {topProducts.map((p, i) => {
                          const share = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0
                          return (
                            <tr key={p.name} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-3 text-sm font-bold text-gray-300">#{i + 1}</td>
                              <td className="px-6 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                              <td className="px-6 py-3">
                                <span className="text-xs bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded-full">{p.brand}</span>
                              </td>
                              <td className="px-6 py-3 text-right text-sm text-gray-700 font-medium">{p.qty}</td>
                              <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{fmt(p.revenue)}</td>
                              <td className="px-6 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-black rounded-full" style={{ width: `${share}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-400 w-8">{share.toFixed(0)} %</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════
                TAB: BRANDS
            ════════════════════════════════════════════ */}
            {activeTab === 'brands' && (
              <div className="space-y-6">
                {/* Brand cards */}
                {brandRevenue.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
                    Aucune vente sur cette période
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {brandRevenue.map((b, i) => {
                        const color = BRAND_COLORS[i % BRAND_COLORS.length]
                        const share = totalRevenue > 0 ? (b.revenue / totalRevenue) * 100 : 0
                        return (
                          <div key={b.name} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-300 transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black"
                                style={{ background: color }}>
                                {b.name[0]}
                              </div>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: `${color}15`, color }}>
                                #{i + 1}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-gray-900 mb-0.5 truncate">{b.name}</p>
                            <p className="text-xl font-black text-gray-900">{fmtShort(b.revenue)}</p>
                            <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-gray-400">
                              <span>{b.qty} art.</span>
                              <span>{share.toFixed(0)} % du CA</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Brand comparison bars */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                      <h3 className="font-bold text-gray-900 mb-5">CA par marque</h3>
                      <div className="space-y-3">
                        {brandRevenue.map((b, i) => {
                          const color = BRAND_COLORS[i % BRAND_COLORS.length]
                          return (
                            <div key={b.name} className="flex items-center gap-4">
                              <span className="text-sm font-medium text-gray-700 w-28 shrink-0 truncate">{b.name}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${(b.revenue / maxBrandRevenue) * 100}%`, background: color }} />
                              </div>
                              <div className="text-right shrink-0 w-20">
                                <p className="text-sm font-black text-gray-900">{fmtShort(b.revenue)}</p>
                                <p className="text-xs text-gray-400">{b.qty} art. · {b.txCount} tx</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Grand total */}
                      <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-700">Total toutes marques</span>
                        <span className="text-lg font-black text-gray-900">{fmt(totalRevenue)}</span>
                      </div>
                    </div>

                    {/* Products by brand */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="font-bold text-gray-900">Détail produits par marque</h3>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {brandRevenue.map((b, bi) => {
                          const color = BRAND_COLORS[bi % BRAND_COLORS.length]
                          const brandProducts = topProducts.filter((p) => p.brand === b.name)
                          if (brandProducts.length === 0) return null
                          return (
                            <div key={b.name} className="px-6 py-4">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                                <span className="text-sm font-bold" style={{ color }}>{b.name}</span>
                                <span className="text-xs text-gray-400 ml-auto">{fmtShort(b.revenue)} total</span>
                              </div>
                              <div className="space-y-1.5 pl-5">
                                {brandProducts.map((p) => (
                                  <div key={p.name} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700 truncate mr-4">{p.name}</span>
                                    <div className="flex items-center gap-4 shrink-0">
                                      <span className="text-gray-400 text-xs">×{p.qty}</span>
                                      <span className="font-semibold text-gray-900">{fmt(p.revenue)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════
                TAB: SALES
            ════════════════════════════════════════════ */}
            {activeTab === 'sales' && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">
                    Toutes les ventes
                    <span className="ml-2 text-sm font-normal text-gray-400">({filtered.length})</span>
                  </h3>
                  <p className="text-xs text-gray-400">Cliquer sur une ligne pour voir le détail</p>
                </div>

                {filtered.length === 0 ? (
                  <p className="text-center py-12 text-gray-400 text-sm">Aucune vente sur cette période</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide">Date & heure</th>
                        <th className="text-left text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide">Client</th>
                        <th className="text-left text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide">Vendeur</th>
                        <th className="text-left text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide">Paiement</th>
                        <th className="text-left text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide">Marques</th>
                        <th className="text-right text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide">Art.</th>
                        <th className="text-right text-xs text-gray-500 px-6 py-3 font-medium uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((sale) => {
                        const salebrands = [...new Set(
                          (sale.items || []).map((i) => i.product?.brand?.name).filter(Boolean)
                        )]
                        return (
                          <tr key={sale.id}
                            className="hover:bg-gray-50 transition-colors cursor-pointer group"
                            onClick={() => setSelectedSale(sale)}>
                            <td className="px-6 py-3.5 text-sm text-gray-600">
                              {new Date(sale.created_at).toLocaleString('fr-FR', {
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </td>
                            <td className="px-6 py-3.5 text-sm">
                              {sale.customer ? (
                                <span className="font-medium text-gray-900">{sale.customer.name}</span>
                              ) : (
                                <span className="text-gray-400 italic">Anonyme</span>
                              )}
                            </td>
                            <td className="px-6 py-3.5 text-sm text-gray-600">
                              {sale.seller?.name || '—'}
                            </td>
                            <td className="px-6 py-3.5">
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full capitalize">
                                {PAYMENT_LABELS[sale.payment_method] || sale.payment_method}
                              </span>
                            </td>
                            <td className="px-6 py-3.5">
                              <div className="flex flex-wrap gap-1">
                                {salebrands.slice(0, 3).map((b) => (
                                  <span key={b} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                    {b}
                                  </span>
                                ))}
                                {salebrands.length > 3 && (
                                  <span className="text-xs text-gray-400">+{salebrands.length - 3}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-right text-sm text-gray-700">{sale.total_items}</td>
                            <td className="px-6 py-3.5 text-right">
                              <span className="text-sm font-black text-gray-900">{fmt(sale.total)}</span>
                              <span className="ml-2 text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {/* Totals row */}
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={5} className="px-6 py-3 text-sm font-bold text-gray-700">
                          Total · {filtered.length} vente{filtered.length > 1 ? 's' : ''}
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{totalItems}</td>
                        <td className="px-6 py-3 text-right text-base font-black text-gray-900">{fmt(totalRevenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════
                TAB: LOYALTY
            ════════════════════════════════════════════ */}
            {activeTab === 'loyalty' && (
              <div className="space-y-6">
                {/* Fidelity rate */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Taux de fidélisation</p>
                    <p className="text-5xl font-black text-gray-900">{fidelityRate} %</p>
                    <p className="text-sm text-gray-500 mt-2">des ventes avec un compte client</p>
                    <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-black rounded-full transition-all" style={{ width: `${fidelityRate}%` }} />
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Ventes avec compte</p>
                    <p className="text-5xl font-black text-gray-900">{withCustomer}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      CA = {fmt(filtered.filter(s => s.customer).reduce((s, v) => s + v.total, 0))}
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Ventes anonymes</p>
                    <p className="text-5xl font-black text-gray-900">{filtered.length - withCustomer}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      CA = {fmt(filtered.filter(s => !s.customer).reduce((s, v) => s + v.total, 0))}
                    </p>
                  </div>
                </div>

                {/* Tiers reminder */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <h3 className="font-bold text-gray-900 mb-5">Barème de réduction fidélité</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {REWARDS_TIERS.map((t) => {
                      const icons: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', vip: '💜' }
                      return (
                        <div key={t.id} className="rounded-2xl p-4 border text-center"
                          style={{ background: t.bg, borderColor: `${t.color}30` }}>
                          <span className="text-3xl">{icons[t.id]}</span>
                          <p className="font-black text-lg mt-2" style={{ color: t.color }}>{t.label}</p>
                          <p className="text-2xl font-black mt-1" style={{ color: t.color }}>
                            {t.discount > 0 ? `-${t.discount} %` : '—'}
                          </p>
                          <p className="text-xs mt-2" style={{ color: `${t.color}99` }}>
                            {t.minSpend === 0 ? 'Dès le 1er achat' : `Dès ${t.minSpend} € cumulés`}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-4">
                    La remise est appliquée automatiquement en caisse selon le CA cumulé du client
                  </p>
                </div>

                {/* Clients with account in this period */}
                {filtered.filter(s => s.customer).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900">Clients ayant acheté sur la période</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {/* Group by customer name */}
                      {Object.entries(
                        filtered
                          .filter(s => s.customer)
                          .reduce((acc: Record<string, { name: string; count: number; revenue: number }>, s) => {
                            const name = s.customer!.name
                            if (!acc[name]) acc[name] = { name, count: 0, revenue: 0 }
                            acc[name].count++
                            acc[name].revenue += s.total
                            return acc
                          }, {})
                      )
                      .sort((a, b) => b[1].revenue - a[1].revenue)
                      .slice(0, 15)
                      .map(([_, c]) => (
                        <div key={c.name} className="px-6 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                              {c.name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{c.name}</p>
                              <p className="text-xs text-gray-400">{c.count} achat{c.count > 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-gray-900">{fmt(c.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sale detail modal */}
      {selectedSale && (
        <SaleModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}
    </div>
  )
}
