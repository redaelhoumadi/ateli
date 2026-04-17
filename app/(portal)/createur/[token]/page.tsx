'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import {
  TrendingUp, Package, ShoppingCart, Globe, Instagram,
  ChevronDown, ChevronUp, Calendar, Wallet, BarChart2,
  RefreshCw, AlertTriangle,
} from 'lucide-react'
import { getBrandByToken, getPortalStats, getProductsByBrand, getReversements } from '@/lib/supabase'
import { Spinner, cn } from '@/components/ui'
import type { Brand, Product, Reversement } from '@/types'

// ─── Types locaux ─────────────────────────────────────────────
type Stats = {
  gross: number; items: number; salesCount: number; avgTicket: number
  monthlyChart: { month: string; fullKey: string; revenue: number }[]
  topProducts: { name: string; qty: number; revenue: number }[]
  recentSales:  { date: string; items: { name: string; qty: number; price: number }[]; total: number }[]
}

// ─── Helpers ──────────────────────────────────────────────────
const fmt      = (n: number) => n.toFixed(2) + ' €'
const fmtShort = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'k €' : n.toFixed(0) + ' €'

const CAT_COLORS: Record<string, string> = {
  Mode: '#6366f1', Bijoux: '#f59e0b', Cosmétiques: '#ec4899',
  Accessoires: '#0ea5e9', Maison: '#10b981', Art: '#8b5cf6',
  Lifestyle: '#f97316', Autre: '#6b7280',
}

// ─── Composants légers ────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ background: color || '#6366f1' }}>
          {icon}
        </div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function SaleRow({ sale }: { sale: Stats['recentSales'][number] }) {
  const [open, setOpen] = useState(false)
  const d = new Date(sale.date)
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left">
        <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 text-sm">🛍</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          </p>
          <p className="text-xs text-gray-400">
            {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {sale.items.reduce((s, i) => s + i.qty, 0)} article{sale.items.reduce((s, i) => s + i.qty, 0) > 1 ? 's' : ''}
          </p>
        </div>
        <p className="text-sm font-black text-gray-900 shrink-0">{fmt(sale.total)}</p>
        {open ? <ChevronUp size={14} className="text-gray-400 shrink-0"/> : <ChevronDown size={14} className="text-gray-400 shrink-0"/>}
      </button>
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5">
          {sale.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <span className="truncate mr-3">{item.name} ×{item.qty}</span>
              <span className="shrink-0 font-medium">{item.price.toFixed(2)} €</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',    label: '📊 Tableau de bord' },
  { id: 'produits',     label: '📦 Mes produits' },
  { id: 'ventes',       label: '🧾 Mes ventes' },
  { id: 'reversements', label: '💶 Reversements' },
]

// ─── MAIN PAGE ─────────────────────────────────────────────────
export default function CreateurPortalPage() {
  const { token } = useParams() as { token: string }

  const [brand, setBrand]             = useState<Brand | null>(null)
  const [stats, setStats]             = useState<Stats | null>(null)
  const [products, setProducts]       = useState<Product[]>([])
  const [reversements, setReversements] = useState<Reversement[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [notFound, setNotFound]       = useState(false)
  const [tab, setTab]                 = useState<'dashboard'|'produits'|'ventes'|'reversements'>('dashboard')

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const b = await getBrandByToken(token)
      if (!b) { setNotFound(true); return }
      setBrand(b as Brand)
      const [s, p, r] = await Promise.all([
        getPortalStats(b.id),
        getProductsByBrand(b.id),
        getReversements(b.id),
      ])
      setStats(s as Stats)
      setProducts((p as Product[]) || [])
      setReversements((r as Reversement[]) || [])
    } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [token])

  const catColor = CAT_COLORS[brand?.category ?? ''] ?? '#6366f1'
  const commRate = brand?.commission_rate ?? 30
  const netAmount = stats ? Math.round(stats.gross * (1 - commRate / 100) * 100) / 100 : 0
  const maxBar    = stats ? Math.max(...stats.monthlyChart.map(m => m.revenue), 1) : 1

  const activeProducts   = products.filter(p => p.is_active !== false)
  const archivedProducts = products.filter(p => p.is_active === false)
  const pendingRev       = reversements.filter(r => r.status === 'pending')
  const paidRev          = reversements.filter(r => r.status === 'paid')

  // ── Not found ─────────────────────────────────────────────
  if (notFound) return (
    <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <AlertTriangle size={28} className="text-red-400"/>
      </div>
      <h1 className="text-xl font-black text-gray-900 mb-2">Lien invalide</h1>
      <p className="text-sm text-gray-500 max-w-sm">
        Ce lien d'accès n'existe pas ou a été révoqué. Contactez la boutique Ateli pour obtenir un nouveau lien.
      </p>
    </div>
  )

  // ── Loading ────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto">
          <span className="text-white font-black text-2xl">A</span>
        </div>
        <Spinner size="lg"/>
        <p className="text-sm text-gray-400">Chargement de votre espace…</p>
      </div>
    </div>
  )

  if (!brand || !stats) return null

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">

      {/* ── Sticky header ── */}
      <header className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.name} className="w-9 h-9 rounded-xl object-cover border border-gray-100 shrink-0"/>
          ) : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
              style={{ background: catColor }}>
              {brand.name[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{brand.name}</p>
            <p className="text-xs text-gray-400 leading-none">Espace créateur · Ateli</p>
          </div>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="text-gray-400 hover:text-gray-700 transition-colors p-2 rounded-xl hover:bg-gray-100">
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>
        </button>
      </header>

      {/* ── Hero banner ── */}
      <div className="px-5 py-6 border-b border-gray-100 bg-white">
        <div className="max-w-2xl mx-auto">
          {/* Greeting */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Bonjour 👋</p>
              <h1 className="text-2xl font-black text-gray-900">{brand.contact_name?.split(' ')[0] || brand.name}</h1>
              {brand.category && (
                <span className="inline-block mt-1.5 text-xs font-bold px-2.5 py-1 rounded-full text-white"
                  style={{ background: catColor }}>
                  {brand.category}
                </span>
              )}
            </div>
            {pendingRev.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-center shrink-0">
                <p className="text-xs text-green-600 font-semibold mb-0.5">En attente</p>
                <p className="text-lg font-black text-green-700">
                  {fmtShort(pendingRev.reduce((s, r) => s + r.net_amount, 0))}
                </p>
              </div>
            )}
          </div>

          {/* Quick stats strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-2xl p-3.5 text-center border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">CA total</p>
              <p className="text-xl font-black text-gray-900">{fmtShort(stats.gross)}</p>
            </div>
            <div className="rounded-2xl p-3.5 text-center border text-white"
              style={{ background: catColor, borderColor: catColor }}>
              <p className="text-xs text-white/70 mb-1">Votre part ({100 - commRate}%)</p>
              <p className="text-xl font-black">{fmtShort(netAmount)}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3.5 text-center border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Articles vendus</p>
              <p className="text-xl font-black text-gray-900">{stats.items}</p>
            </div>
          </div>

          {/* Links */}
          {(brand.website || brand.instagram) && (
            <div className="flex items-center gap-3 mt-4">
              {brand.website && (
                <a href={brand.website} target="_blank" rel="noopener"
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
                  <Globe size={12}/> Site web
                </a>
              )}
              {brand.instagram && (
                <a href={`https://instagram.com/${brand.instagram.replace('@','')}`} target="_blank" rel="noopener"
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-pink-500 transition-colors">
                  <Instagram size={12}/> {brand.instagram}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="sticky top-[61px] z-10 bg-white border-b border-gray-100 px-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-0.5 overflow-x-auto -mx-5 px-5 scrollbar-hide">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={cn(
                  'whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-all',
                  tab === t.id
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-5 py-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* ══════════════════════════
              TAB DASHBOARD
          ══════════════════════════ */}
          {tab === 'dashboard' && (
            <>
              {/* 4 KPIs */}
              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="CA total" value={fmtShort(stats.gross)} color={catColor} icon={<TrendingUp size={15}/>}/>
                <KpiCard label="Votre part" value={fmtShort(netAmount)} sub={`Après ${commRate}% commission boutique`} color="#10b981" icon={<Wallet size={15}/>}/>
                <KpiCard label="Ventes" value={stats.salesCount} color="#6366f1" icon={<ShoppingCart size={15}/>}/>
                <KpiCard label="Panier moyen" value={fmtShort(stats.avgTicket)} color="#f59e0b" icon={<BarChart2 size={15}/>}/>
              </div>

              {/* Monthly chart */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-gray-900">CA des 6 derniers mois</p>
                  <p className="text-xs text-gray-400">
                    Total : {fmtShort(stats.monthlyChart.reduce((s, m) => s + m.revenue, 0))}
                  </p>
                </div>
                {stats.monthlyChart.every(m => m.revenue === 0) ? (
                  <div className="py-8 text-center">
                    <BarChart2 size={32} className="text-gray-200 mx-auto mb-2"/>
                    <p className="text-sm text-gray-400">Aucune vente sur cette période</p>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 h-36">
                    {stats.monthlyChart.map((m, i) => {
                      const pct = maxBar > 0 ? (m.revenue / maxBar) * 100 : 0
                      const isCurrentMonth = i === stats.monthlyChart.length - 1
                      return (
                        <div key={m.fullKey} className="flex-1 flex flex-col items-center gap-1.5">
                          {m.revenue > 0 && (
                            <p className="text-xs font-bold text-gray-700 text-center leading-tight">
                              {fmtShort(m.revenue)}
                            </p>
                          )}
                          <div className="w-full rounded-t-xl transition-all duration-500 min-h-[4px]"
                            style={{
                              height: `${Math.max(4, pct * 1.1)}px`,
                              maxHeight: '100px',
                              background: m.revenue > 0
                                ? isCurrentMonth ? catColor : `${catColor}99`
                                : '#F3F4F6',
                            }}/>
                          <p className="text-xs text-gray-400 text-center">{m.month}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Commission breakdown */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-sm font-bold text-gray-900 mb-4">Répartition des revenus</p>
                <div className="space-y-3">
                  {[
                    { label: 'CA brut total', value: stats.gross,                color: '#F3F4F6', textColor: 'text-gray-900', bold: false },
                    { label: `Commission Ateli (${commRate}%)`, value: stats.gross * commRate / 100, color: '#EEF2FF', textColor: 'text-indigo-700', neg: true, bold: false },
                    { label: 'Votre part nette', value: netAmount, color: catColor, textColor: 'text-white', bold: true },
                  ].map((row, i) => (
                    <div key={i} className={cn('flex items-center justify-between rounded-xl px-4 py-3', row.bold ? 'text-white' : '')}
                      style={{ background: row.color }}>
                      <p className={cn('text-sm font-medium', row.bold ? 'text-white font-bold' : 'text-gray-700')}>{row.label}</p>
                      <p className={cn('text-base font-black', row.bold ? 'text-white' : row.textColor)}>
                        {row.neg ? '-' : ''}{fmt(row.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top products */}
              {stats.topProducts.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-sm font-bold text-gray-900 mb-4">Meilleures ventes</p>
                  <div className="space-y-3">
                    {stats.topProducts.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-gray-100 text-xs font-bold text-gray-500 flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{
                                width: `${(p.revenue / stats.topProducts[0].revenue) * 100}%`,
                                background: catColor,
                              }}/>
                            </div>
                            <p className="text-xs text-gray-400 shrink-0">{p.qty} vendu{p.qty > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-gray-900 shrink-0">{fmtShort(p.revenue)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contract info */}
              {(brand.join_date || brand.contract_end) && (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
                  <Calendar size={18} className="text-gray-400 shrink-0"/>
                  <div>
                    {brand.join_date && (
                      <p className="text-xs text-gray-600">
                        En boutique depuis le <strong>{new Date(brand.join_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                      </p>
                    )}
                    {brand.contract_end && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        Contrat jusqu'au <strong>{new Date(brand.contract_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════
              TAB PRODUITS
          ══════════════════════════ */}
          {tab === 'produits' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{activeProducts.length} produit{activeProducts.length > 1 ? 's' : ''} actif{activeProducts.length > 1 ? 's' : ''}</p>
              </div>

              {products.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
                  <Package size={36} className="text-gray-200 mx-auto mb-3"/>
                  <p className="text-sm font-semibold text-gray-700">Aucun produit</p>
                  <p className="text-xs text-gray-400 mt-1">Vos produits en boutique apparaîtront ici</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeProducts.map(p => {
                    const finalPrice = p.discount ? p.price * (1 - p.discount / 100) : p.price
                    return (
                      <div key={p.id} className="bg-white border border-gray-100 rounded-2xl flex items-center gap-4 p-4 shadow-sm">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-14 h-14 rounded-xl object-cover border border-gray-100 shrink-0"/>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                            <Package size={20} className="text-gray-300"/>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{p.reference}</p>
                          {p.discount && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-lg">-{p.discount}%</span>
                              <span className="text-xs text-gray-400 line-through">{p.price.toFixed(2)} €</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-black text-gray-900">{finalPrice.toFixed(2)} €</p>
                          <p className="text-xs text-gray-400">en boutique</p>
                        </div>
                      </div>
                    )
                  })}

                  {archivedProducts.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">
                        Archivés ({archivedProducts.length})
                      </p>
                      <div className="space-y-2 opacity-50">
                        {archivedProducts.map(p => (
                          <div key={p.id} className="bg-white border border-gray-100 rounded-xl flex items-center gap-3 px-4 py-3">
                            <Package size={14} className="text-gray-300 shrink-0"/>
                            <p className="text-sm text-gray-500 flex-1 truncate line-through">{p.name}</p>
                            <p className="text-xs text-gray-400 shrink-0">{p.price.toFixed(2)} €</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════
              TAB VENTES
          ══════════════════════════ */}
          {tab === 'ventes' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{stats.recentSales.length} dernière{stats.recentSales.length > 1 ? 's' : ''} vente{stats.recentSales.length > 1 ? 's' : ''}</p>
                <p className="text-sm font-bold text-gray-900">{fmtShort(stats.gross)} au total</p>
              </div>

              {stats.recentSales.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
                  <ShoppingCart size={36} className="text-gray-200 mx-auto mb-3"/>
                  <p className="text-sm font-semibold text-gray-700">Aucune vente</p>
                  <p className="text-xs text-gray-400 mt-1">Vos ventes apparaîtront ici dès le premier achat</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.recentSales.map((sale, i) => (
                    <SaleRow key={i} sale={sale}/>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════
              TAB REVERSEMENTS
          ══════════════════════════ */}
          {tab === 'reversements' && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                  <p className="text-xs text-amber-600 font-semibold mb-1">En attente</p>
                  <p className="text-2xl font-black text-amber-700">
                    {fmtShort(pendingRev.reduce((s, r) => s + r.net_amount, 0))}
                  </p>
                  <p className="text-xs text-amber-500 mt-0.5">{pendingRev.length} versement{pendingRev.length > 1 ? 's' : ''}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                  <p className="text-xs text-green-600 font-semibold mb-1">Déjà reçu</p>
                  <p className="text-2xl font-black text-green-700">
                    {fmtShort(paidRev.reduce((s, r) => s + r.net_amount, 0))}
                  </p>
                  <p className="text-xs text-green-500 mt-0.5">{paidRev.length} versement{paidRev.length > 1 ? 's' : ''}</p>
                </div>
              </div>

              {reversements.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
                  <Wallet size={36} className="text-gray-200 mx-auto mb-3"/>
                  <p className="text-sm font-semibold text-gray-700">Aucun reversement</p>
                  <p className="text-xs text-gray-400 mt-1">La boutique n'a pas encore créé de reversement</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reversements.map(r => (
                    <div key={r.id} className={cn(
                      'bg-white border rounded-2xl p-4 shadow-sm',
                      r.status === 'paid' ? 'border-green-100' : 'border-amber-100'
                    )}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {new Date(r.period_from).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                            {' – '}
                            {new Date(r.period_to).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                        <span className={cn(
                          'text-xs font-bold px-2.5 py-1 rounded-full border shrink-0',
                          r.status === 'paid'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        )}>
                          {r.status === 'paid' ? '✓ Payé' : '⏳ En attente'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-50 rounded-xl py-2.5">
                          <p className="text-xs text-gray-400 mb-0.5">CA brut</p>
                          <p className="text-sm font-bold text-gray-900">{fmtShort(r.gross_revenue)}</p>
                        </div>
                        <div className="bg-indigo-50 rounded-xl py-2.5">
                          <p className="text-xs text-indigo-500 mb-0.5">Commission</p>
                          <p className="text-sm font-bold text-indigo-700">-{fmtShort(r.commission)}</p>
                        </div>
                        <div className={cn('rounded-xl py-2.5', r.status === 'paid' ? 'bg-green-50' : 'bg-amber-50')}>
                          <p className={cn('text-xs mb-0.5', r.status === 'paid' ? 'text-green-500' : 'text-amber-500')}>Net reçu</p>
                          <p className={cn('text-sm font-black', r.status === 'paid' ? 'text-green-700' : 'text-amber-700')}>
                            {fmtShort(r.net_amount)}
                          </p>
                        </div>
                      </div>

                      {r.status === 'paid' && r.paid_at && (
                        <p className="text-xs text-gray-400 text-center mt-2">
                          Viré le {new Date(r.paid_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* IBAN reminder */}
              {!brand.iban && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">IBAN manquant</p>
                    <p className="text-xs text-amber-700">
                      Votre IBAN n'est pas encore enregistré. Contactez la boutique Ateli pour le renseigner et recevoir vos paiements.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="py-6 text-center">
            <p className="text-xs text-gray-300">Ateli POS · Portail créateur · Données en lecture seule</p>
          </div>
        </div>
      </div>
    </div>
  )
}
