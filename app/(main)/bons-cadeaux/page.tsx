'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Gift, Plus, Search, Printer, X, CheckCircle,
  Clock, Ban, TrendingUp, Wallet, Copy,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  getGiftCards, createGiftCard, cancelGiftCard,
  getGiftCardTransactions, getGiftCardStats, getSellers,
} from '@/lib/supabase'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Input, Label, Separator, StatCard, Spinner, EmptyState,
  TooltipProvider, cn, DatePicker,
} from '@/components/ui'
import type { GiftCard, GiftCardTransaction, Seller } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) => n.toFixed(2) + ' €'

const STATUS_CONFIG = {
  active:    { label: 'Actif',    variant: 'success'   as const, icon: <CheckCircle size={11}/> },
  used:      { label: 'Épuisé',   variant: 'secondary' as const, icon: <Clock size={11}/> },
  expired:   { label: 'Expiré',   variant: 'warning'   as const, icon: <Clock size={11}/> },
  cancelled: { label: 'Annulé',   variant: 'destructive' as const, icon: <Ban size={11}/> },
}

// ─── Print gift card ──────────────────────────────────────────
function printGiftCard(card: GiftCard, shopName = 'Ateli') {
  const w = window.open('', '_blank', 'width=420,height=600')
  if (!w) return
  const expiry = card.expires_at
    ? `Valable jusqu'au ${new Date(card.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'Sans date d\'expiration'
  w.document.write(`
    <html><head><title>Bon cadeau — ${card.code}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,sans-serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
      .card{background:white;border-radius:16px;width:360px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.15)}
      .header{background:#111;padding:28px 24px;text-align:center}
      .logo{font-size:28px;font-weight:900;color:white;letter-spacing:-1px}
      .subtitle{font-size:12px;color:rgba(255,255,255,.5);margin-top:4px}
      .body{padding:24px}
      .amount{font-size:48px;font-weight:900;color:#111;text-align:center;margin:16px 0}
      .code-wrap{background:#f5f5f5;border-radius:12px;padding:16px;text-align:center;margin:16px 0}
      .code-label{font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
      .code{font-family:monospace;font-size:22px;font-weight:900;color:#111;letter-spacing:2px}
      .info{font-size:12px;color:#666;margin-top:4px}
      .footer{border-top:1px solid #eee;padding:16px 24px;text-align:center}
      .footer p{font-size:11px;color:#999}
      .to{font-size:13px;color:#555;text-align:center;margin-bottom:4px}
      .message{font-size:13px;color:#333;text-align:center;font-style:italic;margin:8px 0}
    </style>
    </head><body>
    <div class="card">
      <div class="header">
        <div class="logo">${shopName}</div>
        <div class="subtitle">Bon cadeau</div>
      </div>
      <div class="body">
        <div class="amount">${card.initial_amount.toFixed(2)} €</div>
        ${card.customer_name ? `<p class="to">Pour : <strong>${card.customer_name}</strong></p>` : ''}
        ${card.message ? `<p class="message">"${card.message}"</p>` : ''}
        <div class="code-wrap">
          <p class="code-label">Code à présenter en caisse</p>
          <p class="code">${card.code}</p>
          <p class="info">${expiry}</p>
        </div>
      </div>
      <div class="footer">
        <p>Utilisable en une ou plusieurs fois · Non remboursable</p>
        <p style="margin-top:4px">© ${shopName} Concept Store</p>
      </div>
    </div>
    </body></html>
  `)
  w.document.close()
  setTimeout(() => w.print(), 300)
}

// ─── Card detail row ──────────────────────────────────────────
function GiftCardRow({ card, onCancel, onPrint }: {
  card: GiftCard
  onCancel: (id: string) => void
  onPrint:  (card: GiftCard) => void
}) {
  const [expanded, setExpanded]         = useState(false)
  const [transactions, setTransactions] = useState<GiftCardTransaction[]>([])
  const [loadingTx, setLoadingTx]       = useState(false)
  const [copied, setCopied]             = useState(false)
  const [cancelling, setCancelling]     = useState(false)
  const cfg = STATUS_CONFIG[card.status]
  const usedAmount = card.initial_amount - card.balance
  const usedPct    = card.initial_amount > 0 ? (usedAmount / card.initial_amount) * 100 : 0

  const handleExpand = async () => {
    setExpanded(!expanded)
    if (!expanded && transactions.length === 0) {
      setLoadingTx(true)
      try { setTransactions((await getGiftCardTransactions(card.id) as GiftCardTransaction[]) || []) }
      finally { setLoadingTx(false) }
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(card.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCancel = async () => {
    if (!confirm(`Annuler le bon ${card.code} ? Cette action est irréversible.`)) return
    setCancelling(true)
    try { onCancel(card.id) } finally { setCancelling(false) }
  }

  return (
    <div className={cn('border rounded-2xl overflow-hidden transition-all',
      card.status === 'active' ? 'border-gray-100 bg-white' :
      card.status === 'used'   ? 'border-gray-100 bg-gray-50 opacity-70' :
      'border-gray-100 bg-gray-50 opacity-50')}>

      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Gift icon */}
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          card.status === 'active' ? 'bg-purple-100' : 'bg-gray-100')}>
          <Gift size={18} className={card.status === 'active' ? 'text-purple-600' : 'text-gray-400'}/>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-gray-900">{card.code}</span>
            <Badge variant={cfg.variant} size="sm" className="gap-1">{cfg.icon} {cfg.label}</Badge>
            {card.customer_name && (
              <span className="text-xs text-gray-500">· {card.customer_name}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-gray-400">
              Créé le {new Date(card.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              {card.created_by && ` · ${card.created_by}`}
            </p>
            {card.expires_at && (
              <p className={cn('text-xs font-medium', new Date(card.expires_at) < new Date() ? 'text-red-500' : 'text-gray-400')}>
                Exp. {new Date(card.expires_at).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
          {/* Progress bar */}
          {usedAmount > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, usedPct)}%` }}/>
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {fmt(usedAmount)} utilisé
              </span>
            </div>
          )}
        </div>

        {/* Amounts */}
        <div className="text-right shrink-0">
          {card.status === 'active' && card.balance < card.initial_amount && (
            <p className="text-xs text-gray-400 line-through">{fmt(card.initial_amount)}</p>
          )}
          <p className={cn('text-base font-black',
            card.status === 'active' ? 'text-gray-900' : 'text-gray-400')}>
            {fmt(card.balance)}
          </p>
          <p className="text-xs text-gray-400">{card.status === 'active' ? 'restant' : fmt(card.initial_amount)}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleCopy}
            className={cn('w-7 h-7 flex items-center justify-center rounded-lg transition-all text-xs',
              copied ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700')}>
            <Copy size={13}/>
          </button>
          {card.status === 'active' && (
            <button onClick={() => onPrint(card)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all">
              <Printer size={13}/>
            </button>
          )}
          <button onClick={handleExpand}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-all">
            {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-4">
          {card.message && (
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 font-medium mb-1">Message</p>
              <p className="text-sm text-gray-700 italic">"{card.message}"</p>
            </div>
          )}

          {/* Transactions */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Historique d'utilisation
            </p>
            {loadingTx ? (
              <div className="flex justify-center py-4"><Spinner size="sm"/></div>
            ) : transactions.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">Aucune utilisation</p>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <div key={tx.id} className="bg-white border border-gray-100 rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-700">
                        {tx.type === 'debit' ? 'Utilisation en caisse' : 'Remboursement'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(tx.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {' à '}
                        {new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-bold', tx.type === 'debit' ? 'text-red-600' : 'text-green-600')}>
                        {tx.type === 'debit' ? '-' : '+'}{fmt(tx.amount)}
                      </p>
                      <p className="text-xs text-gray-400">Solde : {fmt(tx.balance_after)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cancel */}
          {card.status === 'active' && (
            <div className="flex justify-end">
              <button onClick={handleCancel} disabled={cancelling}
                className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors flex items-center gap-1">
                <Ban size={11}/> Annuler ce bon cadeau
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Create modal ─────────────────────────────────────────────
function CreateModal({ sellers, onClose, onCreated }: {
  sellers: Seller[]
  onClose: () => void
  onCreated: (card: GiftCard) => void
}) {
  const [amount, setAmount]    = useState('')
  const [name, setName]        = useState('')
  const [email, setEmail]      = useState('')
  const [message, setMessage]  = useState('')
  const [seller, setSeller]    = useState(sellers[0]?.name ?? '')
  const [expiry, setExpiry]    = useState('')
  const [saving, setSaving]    = useState(false)
  const [created, setCreated]  = useState<GiftCard | null>(null)
  const [error, setError]      = useState('')
  const PRESETS = [10, 20, 30, 50, 75, 100, 150, 200]

  const handleCreate = async () => {
    if (!amount || Number(amount) <= 0) return setError('Montant invalide')
    setSaving(true); setError('')
    try {
      const card = await createGiftCard({
        initial_amount: Number(amount),
        customer_name:  name  || null,
        customer_email: email || null,
        message:        message || null,
        created_by:     seller || null,
        expires_at:     expiry || null,
      })
      setCreated(card as GiftCard)
      onCreated(card as GiftCard)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (created) {
    return (
      <Dialog open onOpenChange={o => !o && onClose()}>
        <DialogContent className="max-w-sm overflow-y-auto">
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={28} className="text-green-500"/>
            </div>
            <div>
              <p className="text-lg font-black text-gray-900">Bon créé !</p>
              <p className="text-sm text-gray-500 mt-1">Valeur : <strong>{fmt(Number(amount))}</strong></p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4">
              <p className="text-xs text-gray-400 font-medium mb-2">Code</p>
              <p className="font-mono text-2xl font-black text-gray-900 tracking-widest">{created.code}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => printGiftCard(created)} className="flex-1 gap-2">
                <Printer size={14}/> Imprimer
              </Button>
              <Button onClick={onClose} className="flex-1">Fermer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un bon cadeau</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-5">
            {/* Amount */}
            <div>
              <Label>Montant <span className="text-red-400">*</span></Label>
              <div className="relative mt-1 mb-3">
                <Input type="number" min="1" step="5" placeholder="0.00"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  className="pr-8 text-xl font-black"/>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
              </div>
              {/* Presets */}
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map(p => (
                  <button key={p} onClick={() => setAmount(String(p))}
                    className={cn('py-2 rounded-xl text-sm font-bold border transition-all',
                      Number(amount) === p
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300')}>
                    {p} €
                  </button>
                ))}
              </div>
            </div>

            <Separator/>

            {/* Beneficiary */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Bénéficiaire (optionnel)</p>
              <div><Label>Nom</Label><Input placeholder="Marie Dupont" value={name} onChange={e => setName(e.target.value)}/></div>
              <div><Label>Email</Label><Input type="email" placeholder="marie@email.com" value={email} onChange={e => setEmail(e.target.value)}/></div>
              <div>
                <Label>Message personnalisé</Label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
                  placeholder="Joyeux anniversaire ! Profite bien…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"/>
              </div>
            </div>

            <Separator/>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vendu par</Label>
                <select value={seller} onChange={e => setSeller(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="">—</option>
                  {sellers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Date d'expiration</Label>
                <DatePicker value={expiry} onChange={e => setExpiry(e)} min={new Date().toISOString().split('T')[0]}/>
              </div>
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleCreate} disabled={!amount || Number(amount) <= 0 || saving}
            className="gap-2 bg-purple-600 hover:bg-purple-700">
            {saving ? <Spinner size="sm"/> : <><Gift size={14}/> Créer le bon</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── MAIN PAGE ─────────────────────────────────────────────────
export default function BonsCadeauxPage() {
  const [cards, setCards]       = useState<GiftCard[]>([])
  const [sellers, setSellers]   = useState<Seller[]>([])
  const [stats, setStats]       = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState<'all'|'active'|'used'|'cancelled'>('all')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, sel, s] = await Promise.all([getGiftCards(), getSellers(), getGiftCardStats()])
      setCards((c as GiftCard[]) || [])
      setSellers((sel as Seller[]) || [])
      setStats(s)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => cards.filter(c => {
    const ms = !search || c.code.includes(search.toUpperCase()) ||
      c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_email?.toLowerCase().includes(search.toLowerCase())
    const mst = filterStatus === 'all' || c.status === filterStatus
    return ms && mst
  }), [cards, search, filterStatus])

  const handleCancel = async (id: string) => {
    await cancelGiftCard(id)
    setCards(prev => prev.map(c => c.id === id ? { ...c, status: 'cancelled' as const } : c))
    load()
  }

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bons cadeaux</h1>
              <p className="text-gray-500 text-sm mt-0.5">Créez et gérez les bons cadeaux de la boutique</p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="gap-2 bg-purple-600 hover:bg-purple-700">
              <Plus size={14}/> Créer un bon cadeau
            </Button>
          </div>

          {/* KPIs */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Bons actifs"      value={stats.active}                                  icon={<Gift size={16}/>}/>
              <StatCard label="Émis au total"    value={fmt(stats.totalIssued)}                        icon={<TrendingUp size={16}/>}/>
              <StatCard label="Solde en cours"   value={fmt(stats.totalBalance)}                       icon={<Wallet size={16}/>}/>
              <StatCard label="Utilisé"          value={fmt(stats.totalUsed)}                          icon={<CheckCircle size={16}/>}/>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-40">
              <Input icon={<Search size={14}/>} placeholder="Code, nom ou email…"
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <div className="flex gap-1.5">
              {([
                { id: 'all',       label: 'Tous' },
                { id: 'active',    label: '✓ Actifs' },
                { id: 'used',      label: 'Épuisés' },
                { id: 'cancelled', label: 'Annulés' },
              ] as const).map(f => (
                <button key={f.id} onClick={() => setFilterStatus(f.id)}
                  className={cn('px-3.5 py-2 rounded-xl text-sm font-medium border transition-all',
                    filterStatus === f.id
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300')}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards list */}
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg"/></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Gift size={40} className="text-gray-200"/>}
              title={search || filterStatus !== 'all' ? 'Aucun résultat' : 'Aucun bon cadeau'}
              description={filterStatus === 'all' && !search ? 'Créez votre premier bon cadeau' : undefined}
              action={filterStatus === 'all' && !search ? (
                <Button onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700">
                  <Plus size={14}/> Créer un bon cadeau
                </Button>
              ) : undefined}/>
          ) : (
            <div className="space-y-3">
              {filtered.map(card => (
                <GiftCardRow
                  key={card.id}
                  card={card}
                  onCancel={handleCancel}
                  onPrint={c => printGiftCard(c)}
                />
              ))}
              <p className="text-xs text-gray-400 text-center pt-2">
                {filtered.length} bon{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateModal
          sellers={sellers}
          onClose={() => setShowCreate(false)}
          onCreated={card => {
            setCards(prev => [card, ...prev])
            load()
          }}
        />
      )}
    </TooltipProvider>
  )
}
