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
import Image from 'next/image'
import Logo from "@/public/images/reusable/ateli-logo.png"

type View = 'loading' | 'welcome' | 'login' | 'register' | 'dashboard'
type Tab  = 'avantage' | 'paliers' | 'historique'

type CustomerData = {
  customer: Customer
  sales: any[]
  totalSpend: number
  currentTier: (typeof REWARDS_TIERS)[number]
  nextTier: (typeof REWARDS_TIERS)[number] | null
}

const TIER_ICONS: Record<string, string> = { bronze:'🥉', silver:'🥈', gold:'🥇', vip:'💜' }

// ── Tier badge ────────────────────────────────────────────────
function TierBadge({ tier }: { tier: (typeof REWARDS_TIERS)[number] }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
      style={{ background: tier.bg, color: tier.color, borderColor: `${tier.color}33` }}>
      {TIER_ICONS[tier.id]} {tier.label}
      {tier.discount > 0 && ` · -${tier.discount}%`}
    </span>
  )
}

// ── Sale history row ──────────────────────────────────────────
function SaleRow({ sale }: { sale: any }) {
  const [open, setOpen] = useState(false)
  const date = new Date(sale.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const time = new Date(sale.created_at).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  })
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors text-left">
        {/* Icon */}
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 text-lg">
          🛍
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">{date}</p>
          <p className="text-xs text-gray-400">{time} · {sale.total_items} article{sale.total_items > 1 ? 's' : ''}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-black text-gray-900">{sale.total.toFixed(2)} €</p>
          <p className="text-xs text-gray-400">{open ? '▲' : '▼'}</p>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
          {(sale.items || []).length > 0 ? (
            (sale.items || []).map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div className="min-w-0 mr-3">
                  <p className="text-xs font-medium text-gray-800 truncate">{item.product?.name ?? '—'}</p>
                  {item.product?.brand?.name && (
                    <p className="text-xs text-gray-400">{item.product.brand.name}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-gray-700">{item.total_price.toFixed(2)} €</p>
                  <p className="text-xs text-gray-400">×{item.quantity}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">Détail non disponible</p>
          )}
          <div className="pt-2 border-t border-gray-200 flex justify-between">
            <span className="text-xs font-bold text-gray-700">Total</span>
            <span className="text-xs font-black text-gray-900">{sale.total.toFixed(2)} €</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function CustomerPortalPage() {
  const [view, setView]   = useState<View>('loading')
  const [tab, setTab]     = useState<Tab>('avantage')
  const [data, setData]   = useState<CustomerData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy]   = useState(false)
  const [contact, setContact] = useState('')
  const [regForm, setRegForm] = useState({ name: '', email: '', phone: '' })

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
    clearSession(); setData(null); setContact(''); setView('welcome')
  }

  // ── LOADING ──────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 px-5 py-4 flex items-center sticky top-0 z-10 shadow-sm justify-center">
        <div className="flex items-center gap-2.5 justify-center">
          
          <div>
            <Image
              className="w-32 b-1 -ml-2 inline"
              priority
              src={Logo}
              alt="logo"
            />
            
          </div>
        </div>
        {view === 'dashboard' && (
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-700 transition-colors py-1 px-2 absolute right-0">
            Déconnexion
          </button>
        )}
      </header>

      {/* ── WELCOME ── */}
      {view === 'welcome' && (
        <main className="flex-1 flex flex-col px-6 py-10 max-w-sm mx-auto w-full">
          <div className="text-center mb-10">
            <p className="text-5xl mb-4"></p>
            <h1 className="text-3xl font-black text-gray-900 mb-2">Programme<br/>fidélité</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Des réductions automatiques sur tous vos achats
            </p>
          </div>

          <div className="space-y-3 mb-8">
            {REWARDS_TIERS.filter(t => t.discount > 0).map(t => (
              <div key={t.id} className="flex items-center gap-4 rounded-2xl px-4 py-3.5 border"
                style={{ background: t.bg, borderColor: `${t.color}22` }}>
                <span className="text-2xl">{TIER_ICONS[t.id]}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: t.color }}>{t.label}</p>
                  <p className="text-xs text-gray-500">Dès {t.minSpend} € cumulés</p>
                </div>
                <p className="text-xl font-black" style={{ color: t.color }}>-{t.discount} %</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <button onClick={() => { setError(''); setView('login') }}
              className="w-full py-4 bg-black text-white font-bold rounded-2xl text-sm active:scale-95 transition-all">
              J'ai déjà un compte
            </button>
            <button onClick={() => { setError(''); setView('register') }}
              className="w-full py-4 bg-gray-100 text-gray-800 font-bold rounded-2xl text-sm active:scale-95 transition-all">
              Créer mon compte gratuit
            </button>
          </div>
        </main>
      )}

      {/* ── LOGIN ── */}
      {view === 'login' && (
        <main className="flex-1 flex flex-col px-6 py-8 max-w-sm mx-auto w-full">
          <button onClick={() => { setError(''); setView('welcome') }} className="text-sm text-gray-400 mb-6 self-start hover:text-gray-700 transition-colors">
            ← Retour
          </button>
          <h2 className="text-2xl font-black text-gray-900 mb-1">Me connecter</h2>
          <p className="text-sm text-gray-500 mb-8">Entre ton email, téléphone ou code client.</p>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Email, téléphone ou code client..."
              value={contact}
              onChange={(e) => setContact(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
              autoFocus
            />
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button onClick={handleLogin} disabled={busy}
              className="w-full py-4 bg-black text-white font-bold rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-all">
              {busy ? 'Connexion…' : 'Accéder à mon espace'}
            </button>
            <p className="text-center text-xs text-gray-400">
              Pas encore de compte ?{' '}
              <button onClick={() => { setError(''); setView('register') }} className="text-black font-semibold underline">
                En créer un
              </button>
            </p>
          </div>
        </main>
      )}

      {/* ── REGISTER ── */}
      {view === 'register' && (
        <main className="flex-1 flex flex-col px-6 py-8 max-w-sm mx-auto w-full">
          <button onClick={() => { setError(''); setView('welcome') }} className="text-sm text-gray-400 mb-6 self-start hover:text-gray-700 transition-colors">
            ← Retour
          </button>
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
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white" />
              </div>
            ))}

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
              className="w-full py-4 bg-black text-white font-bold rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-all">
              {busy ? 'Création du compte…' : '🎉 Créer mon compte'}
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

      {/* ══════════════════════════════════════════════════════════
          DASHBOARD — avec onglets
      ══════════════════════════════════════════════════════════ */}
      {view === 'dashboard' && data && (
        <main className="flex-1 flex flex-col max-w-sm mx-auto w-full">

          {/* ── Profile banner ── */}
          <div className="px-5 pt-6 pb-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Bonjour 👋</p>
                <h2 className="text-2xl font-black text-gray-900">{data.customer.name.split(' ')[0]}</h2>
              </div>
              <TierBadge tier={data.currentTier} />
            </div>
          </div>

          {/* ── Code client sticky card ── */}
          <div className="mx-5 mb-5 bg-gray-900 rounded-2xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/60 text-xs mb-1">Ton code caisse</p>
              <p className="font-mono text-lg font-black text-white tracking-widest">
                {data.customer.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-xs mb-1">Montre au vendeur</p>
              <p className="text-2xl">🏷</p>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="px-5 mb-5">
            <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
              {([
                { id: 'avantage',    label: '🏷 Avantage' },
                { id: 'paliers',     label: '🎯 Paliers' },
                { id: 'historique',  label: `🧾 Achats${data.sales.length > 0 ? ` (${data.sales.length})` : ''}` },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2.5 px-1 rounded-xl text-xs font-bold transition-all ${
                    tab === t.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab content ── */}
          <div className="flex-1 px-5 pb-10">

            {/* ── TAB: AVANTAGE ── */}
            {tab === 'avantage' && (
              <div className="space-y-4">
                {/* Current discount hero */}
                {data.currentTier.discount > 0 ? (
                  <div className="rounded-2xl p-6 text-white shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${data.currentTier.color}, ${data.currentTier.color}BB)` }}>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">Ta remise actuelle</p>
                    <p className="text-7xl font-black leading-none">-{data.currentTier.discount}%</p>
                    <p className="text-white/80 text-sm mt-3">appliquée automatiquement sur chaque achat en boutique</p>
                    <div className="mt-4 bg-white/20 rounded-xl px-3 py-2 text-xs text-white/80 font-medium">
                      Statut {data.currentTier.label} · {data.totalSpend.toFixed(0)} € cumulés
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm text-center">
                    <p className="text-5xl mb-3">🥉</p>
                    <p className="font-bold text-gray-900 text-lg">Statut Bronze</p>
                    <p className="text-gray-500 text-sm mt-1 leading-relaxed">
                      Tes prochains achats t'amèneront vers une remise !
                    </p>
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total dépensé</p>
                    <p className="text-2xl font-black text-gray-900">{data.totalSpend.toFixed(0)} €</p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Achats</p>
                    <p className="text-2xl font-black text-gray-900">{data.sales.length}</p>
                  </div>
                </div>

                {/* Progress toward next tier */}
                {data.nextTier ? (
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Prochain palier</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{TIER_ICONS[data.nextTier.id]}</span>
                          <p className="font-black text-base" style={{ color: data.nextTier.color }}>
                            {data.nextTier.label} — -{data.nextTier.discount}%
                          </p>
                        </div>
                      </div>
                      <p className="text-3xl font-black" style={{ color: data.nextTier.color }}>{data.nextTier.discount}%</p>
                    </div>

                    <div>
                      <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(100, ((data.totalSpend - data.currentTier.minSpend) / (data.nextTier.minSpend - data.currentTier.minSpend)) * 100)}%`,
                            background: `linear-gradient(90deg, ${data.currentTier.color}, ${data.nextTier.color})`,
                          }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                        <span>{data.totalSpend.toFixed(0)} € dépensés</span>
                        <span>objectif {data.nextTier.minSpend} €</span>
                      </div>
                    </div>

                    <div className="rounded-xl px-4 py-3 text-sm font-semibold text-center"
                      style={{ background: data.nextTier.bg, color: data.nextTier.color }}>
                      💡 Il te manque seulement{' '}
                      <span className="font-black text-base">{(data.nextTier.minSpend - data.totalSpend).toFixed(0)} €</span>{' '}
                      pour bénéficier de{' '}
                      <span className="font-black">-{data.nextTier.discount}%</span> !
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl p-5 text-center border" style={{ background: '#F5F3FF', borderColor: '#7C3AED33' }}>
                    <p className="text-2xl mb-2">💜</p>
                    <p className="font-black text-purple-800 text-lg">Statut VIP atteint !</p>
                    <p className="text-purple-600 text-sm mt-1 font-semibold">
                      Tu bénéficies de <strong>-15%</strong> sur tous tes achats.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: PALIERS ── */}
            {tab === 'paliers' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 text-center mb-4">
                  Tes achats s'accumulent automatiquement — la remise s'applique dès que tu atteins un palier.
                </p>
                {REWARDS_TIERS.map((t) => {
                  const reached   = data.totalSpend >= t.minSpend
                  const isCurrent = t.id === data.currentTier.id
                  const pct       = data.nextTier && isCurrent
                    ? Math.min(100, ((data.totalSpend - t.minSpend) / (data.nextTier.minSpend - t.minSpend)) * 100)
                    : reached ? 100 : 0

                  return (
                    <div key={t.id}
                      className={`rounded-2xl p-4 border-2 transition-all ${isCurrent ? 'shadow-md' : ''}`}
                      style={{
                        background: reached ? t.bg : '#F9FAFB',
                        borderColor: isCurrent ? t.color : reached ? `${t.color}44` : '#E5E7EB',
                        opacity: reached ? 1 : 0.55,
                      }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{TIER_ICONS[t.id]}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black" style={{ color: t.color }}>{t.label}</p>
                              {isCurrent && (
                                <span className="text-xs bg-white font-bold px-2 py-0.5 rounded-full border" style={{ color: t.color, borderColor: `${t.color}44` }}>
                                  Actuel
                                </span>
                              )}
                              {reached && !isCurrent && (
                                <span className="text-xs text-green-600 font-bold">✓ Atteint</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {t.minSpend === 0 ? 'Dès le 1er achat' : `Dès ${t.minSpend} €`}
                            </p>
                          </div>
                        </div>
                        <p className="text-2xl font-black" style={{ color: t.color }}>
                          {t.discount === 0 ? '—' : `-${t.discount}%`}
                        </p>
                      </div>

                      {/* Progress bar for current tier */}
                      {isCurrent && data.nextTier && (
                        <div>
                          <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${pct}%`,
                              background: t.color,
                            }} />
                          </div>
                          <p className="text-xs mt-1 font-medium" style={{ color: t.color }}>
                            {data.totalSpend.toFixed(0)} / {data.nextTier.minSpend} €
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── TAB: HISTORIQUE ── */}
            {tab === 'historique' && (
              <div className="space-y-3">
                {data.sales.length === 0 ? (
                  <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm mt-4">
                    <p className="text-4xl mb-3">🛍</p>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Pas encore d'achats</p>
                    <p className="text-xs text-gray-400">Tes prochains achats apparaîtront ici.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400 font-medium">{data.sales.length} achat{data.sales.length > 1 ? 's' : ''}</p>
                      <p className="text-xs font-bold text-gray-700">{data.totalSpend.toFixed(2)} € au total</p>
                    </div>
                    {data.sales.map((sale) => <SaleRow key={sale.id} sale={sale} />)}
                  </>
                )}
              </div>
            )}

          </div>
        </main>
      )}
    </div>
  )
}
