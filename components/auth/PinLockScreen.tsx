'use client'

import { useState, useEffect, useCallback } from 'react'
import { Delete, LogIn, ArrowLeft } from 'lucide-react'
import { getSellersForLogin } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import { Spinner, cn } from '@/components/ui'
import type { Seller } from '@/types'

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  manager: { label: 'Gérant',  color: '#4338CA', bg: '#EEF2FF' },
  seller:  { label: 'Vendeur', color: '#374151', bg: '#F3F4F6' },
}

// ─── Pavé numérique ───────────────────────────────────────────
function PinPad({ seller, onConfirm, onBack }: {
  seller: Seller
  onConfirm: (pin: string) => Promise<void>
  onBack: () => void
}) {
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']
  const meta = ROLE_META[seller.role] ?? ROLE_META.seller

  const press = useCallback((key: string) => {
    if (loading) return
    if (key === '⌫') { setPin(v => v.slice(0, -1)); setError(''); return }
    if (key === '') return
    setPin(v => { if (v.length >= 6) return v; return v + key })
    setError('')
  }, [loading])

  const confirm = useCallback(async (currentPin: string) => {
    if (currentPin.length < 4) return
    setLoading(true); setError('')
    try { await onConfirm(currentPin) }
    catch (e: any) { setError(e.message || 'PIN incorrect'); setPin('') }
    finally { setLoading(false) }
  }, [onConfirm])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key)
      else if (e.key === 'Backspace')    press('⌫')
      else if (e.key === 'Enter')        confirm(pin)
      else if (e.key === 'Escape')       onBack()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [press, pin, confirm, onBack])

  return (
    <div className="w-full flex flex-col items-center gap-6">
      {/* Back + identity */}
      <div className="w-full flex items-center gap-3">
        <button onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all shrink-0">
          <ArrowLeft size={18}/>
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0"
            style={{ background: meta.color }}>
            {seller.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-none truncate">{seller.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{meta.label}</p>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-3 h-10">
        {pin.length === 0 ? (
          <p className="text-sm text-gray-400 font-medium">Saisissez votre code PIN</p>
        ) : (
          Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <div key={i} className={cn('rounded-full transition-all duration-150', i < pin.length ? 'w-4 h-4 scale-110' : 'w-3.5 h-3.5 bg-gray-200')}
              style={i < pin.length ? { background: meta.color } : {}}/>
          ))
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="w-full bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-center">
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {KEYS.map((key, i) =>
          key === '' ? <div key={i}/> :
          key === '⌫' ? (
            <button key={i} onClick={() => press('⌫')} disabled={loading || pin.length === 0}
              className="h-14 flex items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 disabled:opacity-30 transition-all active:scale-95">
              <Delete size={18}/>
            </button>
          ) : (
            <button key={i} onClick={() => press(key)} disabled={loading}
              className="h-14 rounded-2xl border border-gray-200 bg-white font-bold text-xl text-gray-900 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
              {key}
            </button>
          )
        )}
      </div>

      {/* Confirm */}
      <button onClick={() => confirm(pin)} disabled={loading || pin.length < 4}
        className="w-full h-14 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
        style={{ background: pin.length >= 4 ? meta.color : '#D1D5DB' }}>
        {loading ? <Spinner size="sm"/> : <><LogIn size={18}/> Accéder</>}
      </button>
    </div>
  )
}

// ─── Grille de profils ────────────────────────────────────────
function SellerGrid({ sellers, onSelect }: { sellers: Seller[]; onSelect: (s: Seller) => void }) {
  const cols = sellers.length <= 2 ? 'grid-cols-2' :
               sellers.length === 3 ? 'grid-cols-3' : 'grid-cols-3'

  return (
    <div className="w-full space-y-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">
        Sélectionnez votre profil
      </p>
      <div className={cn('grid gap-3', cols)}>
        {sellers.map(s => {
          const meta = ROLE_META[s.role] ?? ROLE_META.seller
          return (
            <button key={s.id} onClick={() => onSelect(s)}
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-white border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all active:scale-[0.97] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-xl transition-transform group-hover:scale-105"
                style={{ background: meta.color }}>
                {s.name[0].toUpperCase()}
              </div>
              <p className="text-sm font-semibold text-gray-900 text-center leading-tight truncate max-w-full w-full px-1">
                {s.name}
              </p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Écran principal ──────────────────────────────────────────
type View = 'grid' | 'pin' | 'no-pin'

export function PinLockScreen() {
  const login = useAuthStore(s => s.login)
  const [sellers, setSellers]             = useState<Seller[]>([])
  const [selected, setSelected]           = useState<Seller | null>(null)
  const [view, setView]                   = useState<View>('grid')
  const [loadingSellers, setLoadingSellers] = useState(true)

  useEffect(() => {
    getSellersForLogin().then(d => {
      const list = (d as Seller[]) || []
      setSellers(list)
      if (list.length === 1) handleSelect(list[0])
    }).finally(() => setLoadingSellers(false))
  }, [])

  const handleSelect = (seller: Seller) => {
    setSelected(seller)
    setView(seller.pin ? 'pin' : 'no-pin')
  }

  const handleBack = () => {
    setSelected(null)
    setView('grid')
  }

  const handleConfirmPin = async (pin: string) => {
    if (!selected) return
    if (pin !== selected.pin) throw new Error('Code PIN incorrect')
    login(selected)
  }

  if (loadingSellers) return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
      <Spinner size="lg"/>
    </div>
  )

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo — uniquement sur la vue grille */}
        {view === 'grid' && (
          <div className="text-center">
            <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-white font-black text-2xl">A</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900">Ateli POS</h1>
            <p className="text-gray-500 text-sm mt-1">Qui est en caisse aujourd'hui ?</p>
          </div>
        )}

        {/* ── VUE : GRILLE ── */}
        {view === 'grid' && (
          sellers.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
              <p className="text-sm text-gray-600 font-semibold mb-2">Aucun vendeur configuré</p>
              <p className="text-xs text-gray-400">Ajoutez des vendeurs dans Paramètres → Vendeurs</p>
            </div>
          ) : (
            <SellerGrid sellers={sellers} onSelect={handleSelect}/>
          )
        )}

        {/* ── VUE : PAVÉ PIN ── */}
        {view === 'pin' && selected && (
          <PinPad seller={selected} onConfirm={handleConfirmPin} onBack={handleBack}/>
        )}

        {/* ── VUE : SANS PIN ── */}
        {view === 'no-pin' && selected && (() => {
          const meta = ROLE_META[selected.role] ?? ROLE_META.seller
          return (
            <div className="w-full flex flex-col items-center gap-6">
              <div className="w-full flex items-center gap-3">
                <button onClick={handleBack}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all shrink-0">
                  <ArrowLeft size={18}/>
                </button>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0"
                    style={{ background: meta.color }}>
                    {selected.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 leading-none truncate">{selected.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{meta.label}</p>
                  </div>
                </div>
              </div>

              <div className="w-full bg-white border border-gray-100 rounded-2xl p-6 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
                  <span className="text-2xl">🔓</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-1">Accès sans PIN</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Aucun code PIN configuré pour ce compte.
                    Définissez-en un dans Paramètres → Vendeurs.
                  </p>
                </div>
                <button onClick={() => login(selected)}
                  className="w-full h-14 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  style={{ background: meta.color }}>
                  <LogIn size={18}/> Accéder
                </button>
              </div>
            </div>
          )
        })()}

        <p className="text-center text-xs text-gray-300">Ateli POS · Concept Store</p>
      </div>
    </div>
  )
}
