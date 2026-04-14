'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { getCustomersWithSpend } from '@/lib/customerPortal'
import { REWARDS_TIERS, getTierForSpend, getNextTier } from '@/lib/customerPortal'

type CustomerWithSpend = {
  id: string
  name: string
  email: string
  phone: string
  created_at: string
  totalSpend: number
  tier: (typeof REWARDS_TIERS)[number]
  nextTier: (typeof REWARDS_TIERS)[number] | null
}

const TIER_ICONS: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', vip: '💜',
}

export default function ClientsPage() {
  const [customers, setCustomers] = useState<CustomerWithSpend[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterTier, setFilterTier] = useState<string>('')
  const [selected, setSelected]   = useState<CustomerWithSpend | null>(null)

  useEffect(() => {
    getCustomersWithSpend()
      .then((data) => setCustomers(data as CustomerWithSpend[]))
      .finally(() => setLoading(false))
  }, [])

  // ── Filtering (client-side — données déjà chargées) ──────────
  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
      const matchTier = !filterTier || c.tier.id === filterTier
      return matchSearch && matchTier
    })
  }, [customers, search, filterTier])

  // ── KPIs ─────────────────────────────────────────────────────
  const totalSpendAll = customers.reduce((s, c) => s + c.totalSpend, 0)
  const byTier = REWARDS_TIERS.map((t) => ({
    ...t,
    count: customers.filter((c) => c.tier.id === t.id).length,
  }))

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-gray-500 text-sm mt-0.5">Programme de fidélité par paliers</p>
          </div>
        </div>

        {/* ── KPIs ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Total clients</p>
            <p className="text-3xl font-bold text-gray-900">{customers.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">CA cumulé clients</p>
            <p className="text-3xl font-bold text-gray-900">{totalSpendAll.toFixed(0)} €</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Clients avec remise</p>
            <p className="text-3xl font-bold text-green-600">
              {customers.filter((c) => c.tier.discount > 0).length}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Panier moyen</p>
            <p className="text-3xl font-bold text-gray-900">
              {customers.length ? (totalSpendAll / customers.length).toFixed(0) : 0} €
            </p>
          </div>
        </div>

        {/* ── Tier repartition ────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {byTier.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterTier(filterTier === t.id ? '' : t.id)}
              className={`rounded-2xl p-4 border-2 text-left transition-all ${
                filterTier === t.id ? 'border-current shadow-md scale-[1.02]' : 'border-transparent'
              }`}
              style={{ background: t.bg, borderColor: filterTier === t.id ? t.color : 'transparent' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{TIER_ICONS[t.id]}</span>
                <span
                  className="text-xs font-black px-2 py-0.5 rounded-full"
                  style={{ background: `${t.color}22`, color: t.color }}
                >
                  {t.discount > 0 ? `-${t.discount} %` : '—'}
                </span>
              </div>
              <p className="text-lg font-black" style={{ color: t.color }}>{t.count}</p>
              <p className="text-xs font-semibold" style={{ color: t.color }}>{t.label}</p>
              {t.minSpend > 0 && (
                <p className="text-xs mt-0.5" style={{ color: `${t.color}99` }}>dès {t.minSpend} €</p>
              )}
            </button>
          ))}
        </div>

        {/* ── Search ──────────────────────────────────────── */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Nom, email ou téléphone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          {filterTier && (
            <button
              onClick={() => setFilterTier('')}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap"
            >
              ✕ Retirer filtre
            </button>
          )}
        </div>

        {/* ── Table ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-3.5 uppercase tracking-wide">Client</th>
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-3.5 uppercase tracking-wide">Contact</th>
                <th className="text-center text-xs font-medium text-gray-500 px-6 py-3.5 uppercase tracking-wide">Palier</th>
                <th className="text-right text-xs font-medium text-gray-500 px-6 py-3.5 uppercase tracking-wide">CA cumulé</th>
                <th className="text-center text-xs font-medium text-gray-500 px-6 py-3.5 uppercase tracking-wide">Remise</th>
                <th className="text-right text-xs font-medium text-gray-500 px-6 py-3.5 uppercase tracking-wide">Membre depuis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400 text-sm">
                    Aucun client trouvé
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => setSelected(c)}
                  >
                    {/* Nom */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                          style={{ background: c.tier.color }}
                        >
                          {c.name[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    {/* Contact */}
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{c.email}</p>
                      {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                    </td>
                    {/* Tier badge */}
                    <td className="px-6 py-4 text-center">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: c.tier.bg, color: c.tier.color, border: `1px solid ${c.tier.color}33` }}
                      >
                        {TIER_ICONS[c.tier.id]} {c.tier.label}
                      </span>
                    </td>
                    {/* CA cumulé */}
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {c.totalSpend.toFixed(0)} €
                      </span>
                      {/* Progress bar vers prochain palier */}
                      {c.nextTier && (
                        <div className="mt-1.5 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, ((c.totalSpend - c.tier.minSpend) / (c.nextTier.minSpend - c.tier.minSpend)) * 100)}%`,
                              background: c.nextTier.color,
                            }}
                          />
                        </div>
                      )}
                    </td>
                    {/* Remise */}
                    <td className="px-6 py-4 text-center">
                      {c.tier.discount > 0 ? (
                        <span
                          className="text-sm font-black"
                          style={{ color: c.tier.color }}
                        >
                          -{c.tier.discount} %
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    {/* Date */}
                    <td className="px-6 py-4 text-right text-sm text-gray-500">
                      {new Date(c.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/50">
              <p className="text-xs text-gray-400">
                {filtered.length} client{filtered.length > 1 ? 's' : ''}
                {(search || filterTier) && ` · ${customers.length} au total`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal détail client ──────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header coloré selon tier */}
            <div className="px-6 py-5 flex items-start justify-between"
              style={{ background: selected.tier.bg }}>
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl text-white font-black shadow-md"
                  style={{ background: selected.tier.color }}
                >
                  {selected.name[0]}
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">{selected.name}</h3>
                  <span
                    className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full mt-1"
                    style={{ background: 'white', color: selected.tier.color, border: `1px solid ${selected.tier.color}33` }}
                  >
                    {TIER_ICONS[selected.tier.id]} {selected.tier.label}
                    {selected.tier.discount > 0 && ` · -${selected.tier.discount} %`}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Remise active */}
              {selected.tier.discount > 0 ? (
                <div
                  className="rounded-2xl p-4 text-center"
                  style={{ background: selected.tier.bg, border: `1px solid ${selected.tier.color}33` }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: selected.tier.color }}>
                    Remise fidélité active
                  </p>
                  <p className="text-5xl font-black" style={{ color: selected.tier.color }}>
                    -{selected.tier.discount} %
                  </p>
                  <p className="text-xs mt-1" style={{ color: `${selected.tier.color}99` }}>
                    appliquée automatiquement en caisse
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl p-4 text-center bg-gray-50 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Statut Bronze</p>
                  <p className="text-sm text-gray-500">
                    Pas encore de remise — encore{' '}
                    <strong>{(150 - selected.totalSpend).toFixed(0)} €</strong> pour -5 %
                  </p>
                </div>
              )}

              {/* Progression vers le prochain palier */}
              {selected.nextTier && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Progression vers {selected.nextTier.label}</span>
                    <span className="font-bold" style={{ color: selected.nextTier.color }}>
                      {selected.totalSpend.toFixed(0)} / {selected.nextTier.minSpend} €
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((selected.totalSpend - selected.tier.minSpend) / (selected.nextTier.minSpend - selected.tier.minSpend)) * 100)}%`,
                        background: `linear-gradient(90deg, ${selected.tier.color}, ${selected.nextTier.color})`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-center font-semibold" style={{ color: selected.nextTier.color }}>
                    Il manque {(selected.nextTier.minSpend - selected.totalSpend).toFixed(0)} € pour -{selected.nextTier.discount} %
                  </p>
                </div>
              )}

              {/* Infos contact */}
              <div className="space-y-2 text-sm border-t border-gray-100 pt-4">
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium text-gray-900">{selected.email}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Téléphone</span>
                  <span className="font-medium text-gray-900">{selected.phone || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">CA cumulé</span>
                  <span className="font-bold text-gray-900">{selected.totalSpend.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Code client</span>
                  <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-lg text-xs">
                    {selected.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Membre depuis</span>
                  <span className="font-medium text-gray-900">
                    {new Date(selected.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
