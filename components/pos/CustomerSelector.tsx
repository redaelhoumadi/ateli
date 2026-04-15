'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { User, UserPlus, X as XIcon, Search, ChevronDown } from 'lucide-react'
import { useCartStore } from '@/hooks/useCart'
import { searchCustomers, searchCustomerByCode } from '@/lib/supabase'
import { getCustomerWithHistory, getTierForSpend } from '@/lib/customerPortal'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Button, Input, Label, Badge, Spinner, cn,
} from '@/components/ui'
import type { Customer } from '@/types'

const CODE_REGEX = /^[0-9A-Fa-f]{8}$/
const TIER_ICONS: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', vip: '💜' }

export function CustomerSelector() {
  const { customer, customerTotalSpend, setCustomer } = useCartStore()
  const [search, setSearch]         = useState('')
  const [results, setResults]       = useState<Customer[]>([])
  const [open, setOpen]             = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [creating, setCreating]     = useState(false)
  const [codeFound, setCodeFound]   = useState<Customer | null>(null)
  const [codeNotFound, setCodeNotFound] = useState(false)
  const [form, setForm]             = useState({ name: '', email: '', phone: '' })
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Click-outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isCode = CODE_REGEX.test(search.trim())

  useEffect(() => {
    const term = search.trim()
    setCodeFound(null); setCodeNotFound(false); setResults([])
    if (!term) return
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        if (CODE_REGEX.test(term)) {
          const found = await searchCustomerByCode(term)
          found ? setCodeFound(found as Customer) : setCodeNotFound(true)
        } else {
          setResults((await searchCustomers(term) as Customer[]) || [])
        }
      } catch { } finally { setLoading(false); setOpen(true) }
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const handleSelect = useCallback(async (c: Customer) => {
    setOpen(false); setSearch(''); setResults([]); setCodeFound(null); setCodeNotFound(false)
    try {
      const data = await getCustomerWithHistory(c.id)
      setCustomer(data.customer, data.totalSpend)
    } catch { setCustomer(c, 0) }
  }, [setCustomer])

  const handleCreate = async () => {
    if (!form.name || !form.email) return
    setCreating(true)
    try {
      const { registerCustomer } = await import('@/lib/customerPortal')
      const c = await registerCustomer(form)
      await handleSelect(c)
      setShowCreate(false)
      setForm({ name: '', email: '', phone: '' })
    } catch (err: any) { alert(err.message || 'Erreur') }
    finally { setCreating(false) }
  }

  // ── Customer selected ────────────────────────────────────
  if (customer) {
    const tier = getTierForSpend(customerTotalSpend)
    return (
      <div className="mx-2 sm:mx-3 mt-2 sm:mt-3 rounded-xl px-3 py-2.5 flex items-center justify-between border"
        style={{ background: tier.bg, borderColor: `${tier.color}33` }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: tier.color }}>
            {customer.name[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{customer.name}</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full border"
                style={{ color: tier.color, borderColor: `${tier.color}40`, background: 'white' }}>
                {TIER_ICONS[tier.id]} {tier.label}
                {tier.discount > 0 && ` · -${tier.discount}%`}
              </span>
            </div>
            <p className="text-xs text-gray-500">{customerTotalSpend.toFixed(0)} € cumulés</p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setCustomer(null, 0)}
          className="text-gray-400 hover:text-red-500">
          <XIcon size={14} />
        </Button>
      </div>
    )
  }

  // ── Search bar ───────────────────────────────────────────
  return (
    <div ref={wrapperRef} className="mx-2 sm:mx-3 mt-2 sm:mt-3 relative">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {isCode ? <span className="text-sm">🔑</span> : <User size={15} />}
          </span>
          <input
            type="text"
            placeholder="Nom, email, téléphone ou code client (ex. B51A3ECA)…"
            value={search}
            onChange={(e) => { setSearch(e.target.value.toUpperCase()); setOpen(false) }}
            onFocus={() => { if (search.trim()) setOpen(true) }}
            className={cn(
              'w-full pl-9 pr-10 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all',
              isCode ? 'border-gray-900 ring-1 ring-gray-900 font-mono tracking-widest font-bold' : 'border-gray-200'
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {loading ? <Spinner size="sm" /> : search ? (
              <button onClick={() => { setSearch(''); setOpen(false) }} className="text-gray-300 hover:text-gray-500 text-lg leading-none">✕</button>
            ) : null}
          </div>
        </div>
        <Button variant="outline" size="md" onClick={() => setShowCreate(true)}
          className="gap-1.5 shrink-0 px-2.5 sm:px-4">
          <UserPlus size={15} />
          <span className="hidden sm:inline">Nouveau</span>
        </Button>
      </div>

      {/* Dropdown */}
      {open && search.trim() && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {codeFound && (
            <div className="p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold px-1 mb-2">🔑 Client identifié</p>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelect(codeFound)}
                className="w-full text-left px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-colors flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{codeFound.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{codeFound.email}</p>
                </div>
                <span className="font-mono text-xs bg-white/15 px-2 py-1 rounded-lg">{codeFound.id.slice(0,8).toUpperCase()}</span>
              </button>
            </div>
          )}
          {codeNotFound && (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-semibold text-gray-700 mb-1">Code introuvable</p>
              <p className="text-xs text-gray-400">Aucun client avec le code <span className="font-mono font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{search}</span></p>
            </div>
          )}
          {!isCode && results.length > 0 && (
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
              {results.map((c) => (
                <button key={c.id} onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelect(c)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                  </div>
                  <span className="text-xs text-gray-300 font-mono">{c.id.slice(0,8).toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
          {!isCode && !loading && results.length === 0 && !codeFound && !codeNotFound && (
            <div className="p-4 text-center text-sm text-gray-400">
              Aucun client.{' '}
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowCreate(true); setOpen(false) }}
                className="text-gray-900 underline font-medium">Créer ?</button>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <Label>Nom complet <span className="text-red-400">*</span></Label>
              <Input placeholder="Jean Dupont" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Email <span className="text-red-400">*</span></Label>
              <Input type="email" placeholder="jean@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input type="tel" placeholder="06 12 34 56 78" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-800">🏷 Paliers de réduction automatique</p>
              {[['Argent',150,5],['Or',300,10],['VIP',600,15]].map(([l,s,p]) => (
                <p key={l as string} className="text-xs text-amber-700">· {l} : -{p}% dès {s}€ cumulés</p>
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.name || !form.email || creating}>
              {creating ? <><Spinner size="sm" /> Création…</> : 'Créer le compte'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
