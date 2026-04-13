'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import {
  findCustomerByContact,
  registerCustomer,
  getCustomerWithHistory,
  saveSession,
  loadSession,
  clearSession,
  getTierForSpend,
  getNextTier,
  REWARDS_TIERS,
} from '@/lib/customerPortal'
import type { Customer } from '@/types'

type View = 'loading' | 'welcome' | 'login' | 'register' | 'dashboard'

type CustomerData = {
  customer: Customer
  sales: any[]
  totalSpend: number
  currentTier: (typeof REWARDS_TIERS)[number]
  nextTier: (typeof REWARDS_TIERS)[number] | null
}

// ── Tier badge ──────────────────────────────────────────────────
function TierBadge({ tier }: { tier: (typeof REWARDS_TIERS)[number] }) {
  const icons: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', vip: '💜' }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
      style={{ background: tier.bg, color: tier.color, borderColor: `${tier.color}33` }}>
      {icons[tier.id]} {tier.label}
      {tier.discount > 0 && ` · -${tier.discount} %`}
    </span>
  )
}

// ── Progress toward next tier ───────────────────────────────────
function RewardProgress({ totalSpend, currentTier, nextTier }: {
  totalSpend: number
  currentTier: (typeof REWARDS_TIERS)[number]
  nextTier: (typeof REWARDS_TIERS)[number] | null
}) {
  const icons: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', vip: '💜' }

  if (!nextTier) {
    return (
      <div className="rounded-2xl p-5 text-center border"
        style={{ background: '#F5F3FF', borderColor: '#7C3AED33' }}>
        <p className="text-2xl mb-2">💜</p>
        <p className="font-black text-purple-800 text-lg">Statut VIP atteint !</p>
        <p className="text-purple-600 text-sm mt-1 font-semibold">
          Tu bénéficies de <strong>-15 %</strong> sur tous tes achats.
        </p>
      </div>
    )
  }

  const from = currentTier.minSpend
  const to   = nextTier.minSpend
  const pct  = Math.min(100, ((totalSpend - from) / (to - from)) * 100)
  const remaining = (to - totalSpend).toFixed(2)

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Next tier info */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Prochain palier</p>
          <div className="flex items-center gap-2">
            <span className="text-xl">{icons[nextTier.id]}</span>
            <p className="font-black text-base" style={{ color: nextTier.color }}>
              {nextTier.label} — -{nextTier.discount} %
            </p>
          </div>
        </div>
        <p className="text-2xl font-black" style={{ color: nextTier.color }}>{nextTier.discount} %</p>
      </div>

      {/* Bar */}
      <div>
        <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${currentTier.color}, ${nextTier.color})`,
            }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1.5">
          <span>{totalSpend.toFixed(0)} € dépensés</span>
          <span>objectif {to} €</span>
        </div>
      </div>

      {/* Motivational callout */}
      <div className="rounded-xl px-4 py-3 text-sm font-semibold text-center"
        style={{ background: nextTier.bg, color: nextTier.color }}>
        💡 Il te manque seulement{' '}
        <span className="font-black text-base">{remaining} €</span>{' '}
        d'achats pour bénéficier de{' '}
        <span className="font-black">-{nextTier.discount} %</span> sur toutes tes commandes !
      </div>
    </div>
  )
}

// ── Sale history row ────────────────────────────────────────────
function SaleRow({ sale }: { sale: any }) {
  const [open, setOpen] = useState(false)
  const date = new Date(sale.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors">
        <div className="text-left">
          <p className="text-sm font-bold text-gray-900">{sale.total.toFixed(2)} €</p>
          <p className="text-xs text-gray-400">{date} · {sale.total_items} article{sale.total_items > 1 ? 's' : ''}</p>
        </div>
        <span className="text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 space-y-1.5">
          {(sale.items || []).map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <span>{item.product?.name ?? '—'} × {item.quantity}</span>
              <span>{item.total_price.toFixed(2)} €</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MAIN PAGE ───────────────────────────────────────────────────
export default function CustomerPortalPage() {
  const [view, setView]   = useState<View>('loading')
  const [data, setData]   = useState<CustomerData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy]   = useState(false)
  const [contact, setContact] = useState('')
  const [regForm, setRegForm] = useState({ name: '', email: '', phone: '' })

  // Auto-login
  useEffect(() => {
    const id = loadSession()
    if (id) {
      getCustomerWithHistory(id)
        .then((d) => { setData(d); setView('dashboard') })
        .catch(() => { clearSession(); setView('welcome') })
    } else {
      setView('welcome')
    }
  }, [])

  const handleLogin = async () => {
    if (!contact.trim()) return setError('Saisis ton email ou ton téléphone')
    setBusy(true); setError('')
    try {
      const customer = await findCustomerByContact(contact)
      if (!customer) { setError('Aucun compte trouvé. Tu peux en créer un !'); return }
      const d = await getCustomerWithHistory(customer.id)
      saveSession(customer.id); setData(d); setView('dashboard')
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  const handleRegister = async () => {
    if (!regForm.name.trim()) return setError('Ton prénom est requis')
    if (!regForm.email.includes('@')) return setError('Email invalide')
    setBusy(true); setError('')
    try {
      const customer = await registerCustomer(regForm)
      const d = await getCustomerWithHistory(customer.id)
      saveSession(customer.id); setData(d); setView('dashboard')
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  const handleLogout = () => {
    clearSession(); setData(null); setContact(''); setRegForm({ name: '', email: '', phone: '' }); setView('welcome')
  }

  // ── Loading ─────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-black">A</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none">Ateli</p>
            <p className="text-xs text-gray-400 leading-none mt-0.5">Espace fidélité</p>
          </div>
        </div>
        {view === 'dashboard' && (
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-700">
            Déconnexion
          </button>
        )}
      </header>

      {/* ── WELCOME ── */}
      {view === 'welcome' && (
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-sm mx-auto w-full">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <span className="text-4xl font-black text-white">A</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Programme fidélité</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Plus tu achètes, plus tu économises. Des réductions automatiques selon ton niveau.
            </p>
          </div>

          {/* Tiers preview */}
          <div className="w-full bg-white rounded-2xl border border-gray-100 p-4 mb-8 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Paliers de réduction</p>
            {REWARDS_TIERS.filter(t => t.discount > 0).map(t => {
              const icons: Record<string, string> = { silver: '🥈', gold: '🥇', vip: '💜' }
              return (
                <div key={t.id} className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ background: t.bg }}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{icons[t.id]}</span>
                    <div>
                      <p className="text-xs font-bold" style={{ color: t.color }}>{t.label}</p>
                      <p className="text-xs text-gray-400">dès {t.minSpend} € d'achats</p>
                    </div>
                  </div>
                  <p className="text-xl font-black" style={{ color: t.color }}>-{t.discount} %</p>
                </div>
              )
            })}
          </div>

          <div className="w-full space-y-3">
            <button onClick={() => { setError(''); setView('register') }}
              className="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-sm active:scale-95 transition-all">
              Créer mon compte gratuitement
            </button>
            <button onClick={() => { setError(''); setView('login') }}
              className="w-full py-3.5 border border-gray-200 text-gray-700 font-medium rounded-2xl text-sm hover:bg-gray-50">
              J'ai déjà un compte
            </button>
          </div>
        </main>
      )}

      {/* ── LOGIN ── */}
      {view === 'login' && (
        <main className="flex-1 flex flex-col px-6 py-8 max-w-sm mx-auto w-full">
          <button onClick={() => { setError(''); setView('welcome') }} className="text-sm text-gray-400 mb-6 self-start">← Retour</button>
          <h2 className="text-2xl font-black text-gray-900 mb-1">Content de te revoir !</h2>
          <p className="text-sm text-gray-500 mb-8">Email ou numéro de téléphone pour accéder à ton espace.</p>
          <div className="space-y-4">
            <input type="text" value={contact} onChange={(e) => setContact(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="jean@email.com ou 06 12 34 56 78" autoFocus
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
                {error.includes('Aucun') && (
                  <button onClick={() => { setError(''); setView('register') }}
                    className="text-sm text-red-700 font-semibold underline mt-1">
                    Créer un compte →
                  </button>
                )}
              </div>
            )}
            <button onClick={handleLogin} disabled={busy}
              className="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-all">
              {busy ? 'Connexion...' : 'Accéder à mon espace'}
            </button>
          </div>
        </main>
      )}

      {/* ── REGISTER ── */}
      {view === 'register' && (
        <main className="flex-1 flex flex-col px-6 py-8 max-w-sm mx-auto w-full">
          <button onClick={() => { setError(''); setView('welcome') }} className="text-sm text-gray-400 mb-6 self-start">← Retour</button>
          <h2 className="text-2xl font-black text-gray-900 mb-1">Créer mon compte</h2>
          <p className="text-sm text-gray-500 mb-8">Gratuit. Des réductions automatiques dès 150 € d'achats.</p>
          <div className="space-y-4">
            {[
              { label: 'Prénom et nom *', key: 'name', type: 'text', placeholder: 'Jean Dupont' },
              { label: 'Email *', key: 'email', type: 'email', placeholder: 'jean@email.com' },
              { label: 'Téléphone', key: 'phone', type: 'tel', placeholder: '06 12 34 56 78' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-700 mb-2">{label}</label>
                <input type={type} value={(regForm as any)[key]} placeholder={placeholder}
                  onChange={(e) => setRegForm({ ...regForm, [key]: e.target.value })}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
            ))}

            {/* Tiers reminder */}
            <div className="bg-gray-50 rounded-2xl px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-600 mb-2">🎁 Tes avantages</p>
              {REWARDS_TIERS.filter(t => t.discount > 0).map(t => (
                <p key={t.id} className="text-xs font-medium" style={{ color: t.color }}>
                  · {t.label} : -{t.discount} % automatique dès {t.minSpend} €
                </p>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button onClick={handleRegister} disabled={busy}
              className="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-all">
              {busy ? 'Création du compte...' : '🎉 Créer mon compte'}
            </button>
            <p className="text-center text-xs text-gray-400">
              Déjà un compte ?{' '}
              <button onClick={() => { setError(''); setView('login') }} className="text-black font-semibold underline">
                Me connecter
              </button>
            </p>
          </div>
        </main>
      )}

      {/* ── DASHBOARD ── */}
      {view === 'dashboard' && data && (
        <main className="flex-1 flex flex-col px-5 py-6 max-w-sm mx-auto w-full space-y-5">
          {/* Welcome */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Bonjour 👋</p>
              <h2 className="text-2xl font-black text-gray-900">{data.customer.name.split(' ')[0]}</h2>
            </div>
            <TierBadge tier={data.currentTier} />
          </div>

          {/* Current discount card */}
          {data.currentTier.discount > 0 ? (
            <div className="rounded-2xl p-5 shadow-lg text-white"
              style={{ background: `linear-gradient(135deg, ${data.currentTier.color}, ${data.currentTier.color}CC)` }}>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">Ta remise actuelle</p>
              <p className="text-6xl font-black leading-none">-{data.currentTier.discount} %</p>
              <p className="text-white/80 text-sm mt-2">
                appliquée automatiquement sur chaque achat en boutique
              </p>
              <div className="mt-4 bg-white/20 rounded-xl px-3 py-2 text-xs text-white/80">
                Statut {data.currentTier.label} · {data.totalSpend.toFixed(0)} € cumulés
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
              <p className="text-4xl mb-2">🥉</p>
              <p className="font-bold text-gray-900 text-lg">Statut Bronze</p>
              <p className="text-gray-500 text-sm mt-1">
                Tu es au départ — tes prochains achats te rapprocheront d'une remise !
              </p>
            </div>
          )}

          {/* Progress toward next tier */}
          <RewardProgress
            totalSpend={data.totalSpend}
            currentTier={data.currentTier}
            nextTier={data.nextTier}
          />

          {/* All tiers overview */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Tous les paliers</p>
            <div className="space-y-2.5">
              {REWARDS_TIERS.map((t) => {
                const icons: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', vip: '💜' }
                const reached = data.totalSpend >= t.minSpend
                const isCurrent = t.id === data.currentTier.id
                return (
                  <div key={t.id}
                    className={`flex items-center justify-between rounded-xl px-3 py-3 border transition-all ${
                      isCurrent ? 'border-2' : 'border'
                    }`}
                    style={{
                      background: reached ? t.bg : '#F9F9F9',
                      borderColor: isCurrent ? t.color : `${t.color}22`,
                      opacity: reached ? 1 : 0.45,
                    }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{icons[t.id]}</span>
                      <div>
                        <p className="text-sm font-bold" style={{ color: t.color }}>{t.label}</p>
                        <p className="text-xs text-gray-500">
                          {t.minSpend === 0 ? 'Dès le 1er achat' : `Dès ${t.minSpend} €`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black" style={{ color: t.color }}>
                        {t.discount === 0 ? '—' : `-${t.discount} %`}
                      </p>
                      {reached && (
                        <p className="text-xs text-green-500 font-semibold">✓ Atteint</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Dépensé</p>
              <p className="text-2xl font-black text-gray-900">{data.totalSpend.toFixed(0)} €</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Achats</p>
              <p className="text-2xl font-black text-gray-900">{data.sales.length}</p>
            </div>
          </div>

          {/* History */}
          {data.sales.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Historique</p>
              <div className="space-y-2">
                {data.sales.map((sale) => <SaleRow key={sale.id} sale={sale} />)}
              </div>
            </div>
          )}

          {data.sales.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
              <p className="text-3xl mb-3">🛍</p>
              <p className="text-sm font-semibold text-gray-700 mb-1">Pas encore d'achats</p>
              <p className="text-xs text-gray-400">Tes prochains achats apparaîtront ici.</p>
            </div>
          )}

          {/* ID code for cashier */}
          <div className="bg-black rounded-2xl px-5 py-4 text-center">
            <p className="text-white font-semibold text-sm mb-0.5">Montre ce code au vendeur</p>
            <p className="text-gray-400 text-xs mb-3">pour lier ton compte à ta vente</p>
            <div className="bg-white rounded-xl py-3 px-4">
              <p className="font-mono text-sm font-bold text-gray-900 tracking-widest">
                {data.customer.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          <div className="h-6" />
        </main>
      )}
    </div>
  )
}
