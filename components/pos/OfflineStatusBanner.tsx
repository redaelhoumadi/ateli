'use client'

import { useState } from 'react'
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { cn } from '@/components/ui'

export function OfflineStatusBanner() {
  const { isOnline, pendingCount, errorCount, syncStatus, lastSyncAt, sync } = useOfflineSync()

  // Hidden if online and no pending/error
  if (isOnline && pendingCount === 0 && errorCount === 0 && syncStatus !== 'syncing') return null

  return (
    <div className={cn(
      'fixed top-0 inset-x-0 z-[100] flex items-center justify-between gap-3 px-4 py-2 text-xs font-semibold transition-all',
      !isOnline
        ? 'bg-red-600 text-white'
        : syncStatus === 'syncing'
        ? 'bg-indigo-600 text-white'
        : errorCount > 0
        ? 'bg-amber-500 text-white'
        : 'bg-green-600 text-white'
    )}>
      {/* Left: status icon + message */}
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <WifiOff size={14} className="shrink-0"/>
        ) : syncStatus === 'syncing' ? (
          <RefreshCw size={14} className="animate-spin shrink-0"/>
        ) : errorCount > 0 ? (
          <AlertTriangle size={14} className="shrink-0"/>
        ) : (
          <CheckCircle size={14} className="shrink-0"/>
        )}

        <span>
          {!isOnline ? (
            <>
              Mode hors ligne
              {pendingCount > 0 && (
                <span className="ml-1.5 bg-white/20 px-2 py-0.5 rounded-full">
                  {pendingCount} vente{pendingCount > 1 ? 's' : ''} en attente de sync
                </span>
              )}
            </>
          ) : syncStatus === 'syncing' ? (
            `Synchronisation en cours… (${pendingCount} vente${pendingCount > 1 ? 's' : ''})`
          ) : errorCount > 0 ? (
            `${errorCount} vente${errorCount > 1 ? 's' : ''} non synchronisée${errorCount > 1 ? 's' : ''} — vérifiez la connexion`
          ) : (
            <>
              Synchronisation réussie
              {lastSyncAt && (
                <span className="ml-1.5 opacity-80">
                  à {lastSyncAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </>
          )}
        </span>
      </div>

      {/* Right: sync button (only when online + pending/error) */}
      {isOnline && (pendingCount > 0 || errorCount > 0) && syncStatus !== 'syncing' && (
        <button
          onClick={sync}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors shrink-0">
          <RefreshCw size={12}/>
          Synchroniser maintenant
        </button>
      )}
    </div>
  )
}
