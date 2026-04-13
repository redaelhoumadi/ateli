'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useCartStore } from '@/hooks/useCart'
import { searchCustomers, searchCustomerByCode } from '@/lib/supabase'
import { getCustomerWithHistory, getTierForSpend } from '@/lib/customerPortal'
import type { Customer } from '@/types'

const TIER_ICONS: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', vip: '💜',
}

// Code client = exactement 8 caractères hexadécimaux
const CODE_REGEX = /^[0-9A-Fa-f]{8}$/

export function CustomerSelector() {
  const { customer, customerTotalSpend, setCustomer } = useCartStore()

  const [search, setSearch]             = useState('')
  const [results, setResults]           = useState<Customer[]>([])
  const [open, setOpen]                 = useState(false)
  const [showCreate, setShowCreate]     = useState(false)
  const [loading, setLoading]           = useState(false)
  const [creating, setCreating]         = useState(false)
  const [codeFound, setCodeFound]       = useState<Customer | null>(null)
  const [codeNotFound, setCodeNotFound] = useState(false)
  const [form, setForm]                 = useState({ name: '', email: '', phone: '' })

  // Click-outside : on ferme si on clique en dehors du wrapper
  const wrapperRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isCode = CODE_REGEX.test(search.trim())

  // Recherche déclenchée à chaque frappe
  useEffect(() => {
    const term = search.trim()
    setCodeFound(null)
    setCodeNotFound(false)
    setResults([])

    if (!term) return

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        if (CODE_REGEX.test(term)) {
          const found = await searchCustomerByCode(term)
          if (found) {
            setCodeFound(found as Customer)
          } else {
            setCodeNotFound(true)
          }
        } else {
          const data = await searchCustomers(term)
          setResults((data as Customer[]) || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
        setOpen(true) // ouvrir le dropdown APRÈS avoir les résultats
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  const handleSelect = async (c: Customer) => {
    setOpen(false)
    setSearch('')
    setResults([])
    setCodeFound(null)
    setCodeNotFound(false)
    try {
      const data = await getCustomerWithHistory(c.id)
      setCustomer(data.customer, data.totalSpend)
    } catch {
      setCustomer(c, 0)
    }
  }

  const handleCreate = async () => {
    if (!form.name || !form.email) return
    setCreating(true)
    try {
      const { registerCustomer } = await import('@/lib/customerPortal')
      const c = await registerCustomer(form)
      await handleSelect(c)
      setShowCreate(false)
      setForm({ name: '', email: '', phone: '' })
    } catch (err: any) {
      alert(err.message || 'Erreur création compte')
    } finally {
      setCreating(false)
    }
  }

  // ─── Client déjà sélectionné ─────────────────────────────────
  if (customer) {
    const tier = getTierForSpend(customerTotalSpend)
    return (
      <div
        className="mx-4 mt-4 rounded-xl px-4 py-3 flex items-center justify-between border"
        style={{ background: tier.bg, borderColor: `${tier.color}33` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ background: tier.color }}
          >
            {customer.name[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{customer.name}</p>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full border"
                style={{ color: tier.color, borderColor: `${tier.color}40`, background: 'white' }}
              >
                {TIER_ICONS[tier.id]} {tier.label}
                {tier.discount > 0 && ` · -${tier.discount} %`}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {customerTotalSpend.toFixed(0)} € d'achats cumulés
            </p>
          </div>
        </div>
        <button
          onClick={() => setCustomer(null, 0)}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          ✕ Retirer
        </button>
      </div>
    )
  }

  // ─── Barre de recherche ───────────────────────────────────────
  const hasDropdown = open && search.trim().length > 0

  return (
    <div ref={wrapperRef} className="mx-4 mt-4 relative">
      <div className="flex gap-2">
        {/* Input */}
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none pointer-events-none">
            {isCode ? '🔑' : '👤'}
          </span>
          <input
            type="text"
            placeholder="Nom, email, téléphone ou code client (ex. B51A3ECA)…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value.toUpperCase())
              setOpen(false) // on fermera et rouvrira après fetch
            }}
            onFocus={() => {
              if (search.trim()) setOpen(true)
            }}
            className={`w-full pl-9 pr-10 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 transition-all ${
              isCode
                ? 'border-black ring-1 ring-black font-mono tracking-widest font-bold text-gray-900'
                : 'border-gray-200 focus:ring-black'
            }`}
          />
          {/* Spinner ou croix effacer */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {loading ? (
              <div className="w-4 h-4 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
            ) : search.trim() ? (
              <button
                onClick={() => { setSearch(''); setOpen(false) }}
                className="text-gray-300 hover:text-gray-500 text-lg leading-none"
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-black text-white text-sm rounded-xl hover:bg-gray-800 transition-colors whitespace-nowrap"
        >
          + Nouveau client
        </button>
      </div>

      {/* ─── Dropdown ─────────────────────────────────────────── */}
      {hasDropdown && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">

          {/* Code trouvé */}
          {codeFound && (
            <div className="p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold px-1 mb-2">
                🔑 Client identifié
              </p>
              <button
                onMouseDown={(e) => e.preventDefault()} // empêche le blur avant le clic
                onClick={() => handleSelect(codeFound)}
                className="w-full text-left px-4 py-3.5 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-between group"
              >
                <div>
                  <p className="text-sm font-bold">{codeFound.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{codeFound.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs bg-white/15 px-2 py-1 rounded-lg tracking-widest">
                    {codeFound.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 group-hover:text-gray-300">
                    Cliquer pour sélectionner →
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Code introuvable */}
          {codeNotFound && (
            <div className="px-4 py-5 text-center">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm font-semibold text-gray-700 mb-1">Code introuvable</p>
              <p className="text-xs text-gray-400">
                Aucun client avec le code{' '}
                <span className="font-mono font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                  {search}
                </span>
              </p>
            </div>
          )}

          {/* Résultats recherche classique */}
          {!isCode && results.length > 0 && (
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
              {results.map((c) => (
                <button
                  key={c.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(c)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                    </div>
                    <span className="text-xs text-gray-300 font-mono">
                      {c.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Recherche classique — aucun résultat */}
          {!isCode && !loading && results.length === 0 && !codeFound && !codeNotFound && (
            <div className="p-4 text-center text-sm text-gray-400">
              Aucun client trouvé.{' '}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setShowCreate(true); setOpen(false) }}
                className="text-black underline font-medium"
              >
                Créer un compte ?
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Modal création client ────────────────────────────── */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Nouveau client</h3>
            <p className="text-sm text-gray-500 mb-5">
              Créez un compte pour bénéficier des réductions fidélité
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Nom complet *</label>
                <input
                  type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jean Dupont" autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Email *</label>
                <input
                  type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jean@email.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Téléphone</label>
                <input
                  type="tel" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="06 12 34 56 78"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-amber-50 border border-amber-100 rounded-xl p-3 mt-4 space-y-1.5">
              <p className="text-xs font-semibold text-gray-700">🏷 Paliers de réduction</p>
              {[
                { label: 'Argent', spend: 150, pct: 5 },
                { label: 'Or', spend: 300, pct: 10 },
                { label: 'VIP', spend: 600, pct: 15 },
              ].map((t) => (
                <p key={t.label} className="text-xs text-gray-600">
                  · {t.label} : -{t.pct} % dès {t.spend} € d'achats cumulés
                </p>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.name || !form.email || creating}
                className="flex-1 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {creating ? 'Création...' : 'Créer le compte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
