'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getPendingSales, markSaleSynced, markSaleError, deleteSyncedSales,
  type PendingSale,
} from '@/lib/offlineDB'
import { createSale } from '@/lib/supabase'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

// ─── Singleton partagé entre toutes les instances du hook ─────
// Un seul verrou, un seul état — évite les doubles sync quand
// plusieurs composants (CheckoutModal, DailySalesPanel, Banner…)
// montent simultanément et écoutent le retour réseau.
let _syncing       = false          // verrou global
let _pendingCount  = 0
let _errorCount    = 0
let _syncStatus:   SyncStatus = 'idle'
let _lastSyncAt:   Date | null = null
let _syncScheduled = false          // un seul auto-sync planifié

// Listeners pour notifier toutes les instances React
const listeners = new Set<() => void>()
function notify() { listeners.forEach(fn => fn()) }

async function refreshSharedCount() {
  try {
    const sales = await getPendingSales()
    _pendingCount = sales.filter(s => !s.synced).length
    _errorCount   = sales.filter(s => !!s.sync_error && !s.synced).length
    notify()
  } catch {}
}

async function runSync() {
  // Verrou global — une seule exécution à la fois, tous composants confondus
  if (_syncing || !navigator.onLine) return
  _syncing = true
  _syncScheduled = false
  _syncStatus = 'syncing'
  notify()

  try {
    const sales    = await getPendingSales()
    const unsynced = sales.filter(s => !s.synced && !s.sync_error)

    if (unsynced.length === 0) {
      _syncStatus = 'success'
      _lastSyncAt = new Date()
      notify()
      return
    }

    let hasErrors = false
    for (const sale of unsynced) {
      // Double-check : si déjà synced (race condition entre onglets), skip
      if (sale.synced) continue
      try {
        await createSale({
          customer_id:    sale.customer_id,
          seller_id:      sale.seller_id,
          total:          sale.total,
          total_items:    sale.total_items,
          points_earned:  Math.floor(sale.total),
          points_used:    0,
          payment_method: sale.payment_method,
          note:           sale.note || `[Vente hors ligne ${sale.id}]`,
          items:          sale.items.map(i => ({
            product_id:  i.product_id,
            quantity:    i.quantity,
            unit_price:  i.unit_price,
            total_price: i.total_price,
          })),
        })
        await markSaleSynced(sale.id)
      } catch (e: any) {
        await markSaleError(sale.id, e.message || 'Erreur inconnue')
        hasErrors = true
      }
    }

    await deleteSyncedSales()
    await refreshSharedCount()
    _syncStatus = hasErrors ? 'error' : 'success'
    _lastSyncAt = new Date()
    notify()
  } catch {
    _syncStatus = 'error'
    notify()
  } finally {
    _syncing = false
  }
}

// Déclenche un sync après un court délai pour absorber les appels multiples
// (plusieurs composants qui montent au même moment au retour réseau)
function scheduleSync() {
  if (_syncScheduled || _syncing) return
  _syncScheduled = true
  // Délai 300ms : laisse le temps à tous les composants de se monter
  // avant de lancer la sync une seule fois
  setTimeout(() => { runSync() }, 300)
}

// ─── Hook React ───────────────────────────────────────────────
export function useOfflineSync() {
  const [, forceUpdate] = useState(0)
  const mountedRef = useRef(false)

  // S'abonner aux mises à jour du singleton
  useEffect(() => {
    mountedRef.current = true
    const listener = () => { if (mountedRef.current) forceUpdate(n => n + 1) }
    listeners.add(listener)

    // Charger le count initial au montage
    refreshSharedCount()

    return () => {
      mountedRef.current = false
      listeners.delete(listener)
    }
  }, [])

  // Détecter les changements de connectivité
  useEffect(() => {
    const onOnline = () => {
      notify() // met à jour isOnline dans tous les composants
      // Auto-sync au retour réseau — scheduleSync évite les doublons
      refreshSharedCount().then(() => {
        if (_pendingCount > 0) scheduleSync()
      })
    }
    const onOffline = () => notify()

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const sync = useCallback(async () => {
    await runSync()
  }, [])

  const refreshCount = useCallback(async () => {
    await refreshSharedCount()
  }, [])

  return {
    isOnline:     typeof window !== 'undefined' ? navigator.onLine : true,
    pendingCount: _pendingCount,
    errorCount:   _errorCount,
    syncStatus:   _syncStatus,
    lastSyncAt:   _lastSyncAt,
    sync,
    refreshCount,
  }
}
