'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { QRCodeDisplay } from '@/components/pos/QRCodeDisplay'
import { REWARDS_TIERS } from '@/lib/customerPortal'

export default function QRPage() {
  const [portalUrl, setPortalUrl] = useState('')

  useEffect(() => {
    setPortalUrl(`${window.location.origin}/client`)
  }, [])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-8 py-12">
      {/* Brand */}
      <div className="mb-10 text-center">
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-black text-2xl font-black">A</span>
        </div>
        <h1 className="text-white text-2xl font-black tracking-tight">Programme fidélité</h1>
        <p className="text-gray-400 text-sm mt-1">Gagne des points à chaque achat</p>
      </div>

      {/* QR */}
      <QRCodeDisplay url={portalUrl} />

      {/* URL fallback */}
      {portalUrl && (
        <p className="text-gray-600 text-xs font-mono mt-4">{portalUrl}</p>
      )}

      {/* Tiers preview */}
      <div className="mt-10 w-full max-w-xs space-y-2.5">
        {REWARDS_TIERS.filter(t => t.discount > 0).map(t => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-2xl px-4 py-3"
            style={{ background: `${t.color}15`, border: `1px solid ${t.color}30` }}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">
                {t.id === 'silver' && '🥈'}
                {t.id === 'gold' && '🥇'}
                {t.id === 'vip' && '💜'}
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: t.color }}>{t.label}</p>
                <p className="text-xs" style={{ color: `${t.color}99` }}>dès {t.minSpend} € d'achats</p>
              </div>
            </div>
            <p className="text-lg font-black" style={{ color: t.color }}>-{t.discount} %</p>
          </div>
        ))}
      </div>

      {/* Nav back */}
      <a
        href="/pos"
        className="mt-12 text-gray-600 text-xs hover:text-gray-400 transition-colors"
      >
        ← Retour au POS
      </a>
    </div>
  )
}
