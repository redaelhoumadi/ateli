'use client'

import { useState, useEffect, useCallback } from 'react'
import { Delete, LogIn } from 'lucide-react'
import { getSellersForLogin } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import { Spinner, cn } from '@/components/ui'
import type { Seller } from '@/types'

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  manager: { label: 'Gérant', color: '#4338CA', bg: '#EEF2FF' },
  seller:  { label: 'Vendeur', color: '#374151', bg: '#F3F4F6' },
}

function PinPad({ value, onChange, onConfirm, error, loading }: {
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  error: string
  loading: boolean
}) {
  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  const press = useCallback((key: string) => {
    if (loading) return
    if (key === '⌫') { onChange(value.slice(0, -1)); return }
    if (key === '')  return
    if (value.length >= 6) return
    const next = value + key
    onChange(next)
  }, [value, onChange, loading])

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key)
      else if (e.key === 'Backspace')    press('⌫')
      else if (e.key === 'Enter' && value.length >= 4) onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [press, value, onConfirm])

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Dots */}
      <div className="flex items-center gap-3 h-12">
        {value.length === 0 ? (
          <p className="text-sm text-gray-400 font-medium">Saisissez votre code PIN</p>
        ) : (
          Array.from({ length: Math.max(4, value.length) }).map((_, i) => (
            <div key={i} className={cn(
              'w-3.5 h-3.5 rounded-full transition-all duration-150',
              i < value.length ? 'bg-gray-900 scale-110' : 'bg-gray-200'
            )}/>
          ))
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 w-full text-center">
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {KEYS.map((key, i) => (
          key === '' ? (
            <div key={i}/>
          ) : key === '⌫' ? (
            <button key={i} onClick={() => press('⌫')} disabled={loading || value.length === 0}
              className="h-14 flex items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 disabled:opacity-30 transition-all active:scale-95">
              <Delete size={18}/>
            </button>
          ) : (
            <button key={i} onClick={() => press(key)} disabled={loading}
              className={cn(
                'h-14 rounded-2xl border font-bold text-xl transition-all active:scale-95',
                'bg-white border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-gray-300',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                'disabled:opacity-50'
              )}>
              {key}
            </button>
          )
        ))}
      </div>

      {/* Confirm */}
      {value.length >= 4 && (
        <button onClick={onConfirm} disabled={loading}
          className={cn(
            'w-full max-w-xs h-14 rounded-2xl font-bold text-white text-base',
            'bg-gray-900 hover:bg-black transition-all active:scale-[0.98]',
            'flex items-center justify-center gap-2 disabled:opacity-60'
          )}>
          {loading ? <Spinner size="sm"/> : <><LogIn size={18}/> Entrer</>}
        </button>
      )}
    </div>
  )
}

function SellerAvatar({ seller, selected, onClick }: {
  seller: Seller; selected: boolean; onClick: () => void
}) {
  const meta = ROLE_LABELS[seller.role] ?? ROLE_LABELS.seller
  return (
    <button onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 p-3 rounded-2xl transition-all',
        selected
          ? 'bg-gray-900 ring-2 ring-gray-900 ring-offset-2'
          : 'bg-white border border-gray-100 hover:border-gray-300 hover:shadow-sm'
      )}>
      <div className={cn(
        'w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-white shrink-0'
      )} style={{ background: selected ? '#fff' : meta.color }}>
        <span style={{ color: selected ? meta.color : '#fff' }}>
          {seller.name[0].toUpperCase()}
        </span>
      </div>
      <p className={cn('text-xs font-semibold text-center leading-tight max-w-[80px] truncate',
        selected ? 'text-white' : 'text-gray-800')}>
        {seller.name}
      </p>
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
        style={{
          background: selected ? 'rgba(255,255,255,0.2)' : meta.bg,
          color: selected ? '#fff' : meta.color,
        }}>
        {meta.label}
      </span>
    </button>
  )
}

export function PinLockScreen() {
  const login = useAuthStore(s => s.login)
  const [sellers, setSellers]         = useState<Seller[]>([])
  const [selected, setSelected]       = useState<Seller | null>(null)
  const [pin, setPin]                 = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [loadingSellers, setLoadingSellers] = useState(true)

  useEffect(() => {
    getSellersForLogin()
      .then(d => {
        const sellers = (d as Seller[]) || []
        setSellers(sellers)
        // Auto-select if only one seller
        if (sellers.length === 1) setSelected(sellers[0])
      })
      .finally(() => setLoadingSellers(false))
  }, [])

  const handlePinChange = (v: string) => {
    setPin(v)
    setError('')
  }

  const handleConfirm = useCallback(async () => {
    if (!selected) return
    if (pin.length < 4) return setError('Le PIN doit faire au moins 4 chiffres')
    setLoading(true); setError('')
    try {
      // If seller has no PIN set, any 4-digit code works (first-time setup)
      if (!selected.pin) {
        login(selected)
        return
      }
      if (pin !== selected.pin) {
        setError('Code PIN incorrect')
        setPin('')
        return
      }
      login(selected)
    } finally { setLoading(false) }
  }, [selected, pin, login])

  // Auto-login if seller has no PIN
  const handleSelectSeller = (seller: Seller) => {
    setSelected(seller)
    setPin('')
    setError('')
  }

  if (loadingSellers) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <Spinner size="lg"/>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center">
          <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-black text-2xl">A</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900">Ateli POS</h1>
          <p className="text-gray-500 text-sm mt-1">Qui est en caisse aujourd'hui ?</p>
        </div>

        {/* Seller picker */}
        {sellers.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
            <p className="text-sm text-gray-600 font-semibold mb-2">Aucun vendeur configuré</p>
            <p className="text-xs text-gray-400">Ajoutez des vendeurs dans Paramètres → Vendeurs</p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 text-center">Sélectionnez votre profil</p>
            <div className={cn(
              'grid gap-3',
              sellers.length <= 3 ? 'grid-cols-3' :
              sellers.length <= 4 ? 'grid-cols-4' : 'grid-cols-4'
            )}>
              {sellers.map(s => (
                <SellerAvatar
                  key={s.id}
                  seller={s}
                  selected={selected?.id === s.id}
                  onClick={() => handleSelectSeller(s)}
                />
              ))}
            </div>
          </div>
        )}

        {/* PIN pad */}
        {selected && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                style={{ background: ROLE_LABELS[selected.role]?.color ?? '#374151' }}>
                {selected.name[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{selected.name}</p>
                <p className="text-xs text-gray-400">{ROLE_LABELS[selected.role]?.label}</p>
              </div>
            </div>

            {!selected.pin ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-xl">🔓</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Pas de PIN configuré</p>
                  <p className="text-xs text-gray-500">Accès libre — configurez un PIN dans Paramètres pour sécuriser ce compte.</p>
                </div>
                <button onClick={() => login(selected)}
                  className="w-full h-12 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <LogIn size={16}/> Accéder
                </button>
              </div>
            ) : (
              <PinPad
                value={pin}
                onChange={handlePinChange}
                onConfirm={handleConfirm}
                error={error}
                loading={loading}
              />
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-300">Ateli POS · Concept Store</p>
      </div>
    </div>
  )
}
