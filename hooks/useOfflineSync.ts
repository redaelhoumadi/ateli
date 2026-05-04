'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getPendingSales, markSaleSynced, markSaleError, deleteSyncedSales,
  type PendingSale,
} from '@/lib/offlineDB'
import { createSale } from '@/lib/supabase'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

type OfflineSyncState = {
  isOnline:      boolean
  pendingCount:  number
  errorCount:    number
  syncStatus:    SyncStatus
  lastSyncAt:    Date | null
  sync:          () => Promise<void>
  refreshCount:  () => Promise<void>
}

export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline]     = useState(true)
  const [pendingCount, setPending]  = useState(0)
  const [errorCount, setErrors]     = useState(0)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const syncRef = useRef(false)   // prevent concurrent syncs

  const refreshCount = useCallback(async () => {
    try {
      const sales = await getPendingSales()
      setPending(sales.filter(s => !s.synced).length)
      setErrors(sales.filter(s => s.sync_error && !s.synced).length)
    } catch {}
  }, [])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshCount()

    const onOnline  = () => { setIsOnline(true) }
    const onOffline = () => { setIsOnline(false) }
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [refreshCount])

  // Auto-sync when connection is restored
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      sync()
    }
  }, [isOnline]) // eslint-disable-line

  const sync = useCallback(async () => {
    if (syncRef.current || !navigator.onLine) return
    syncRef.current = true
    setSyncStatus('syncing')

    try {
      const sales = await getPendingSales()
      const unsynced = sales.filter(s => !s.synced)
      if (unsynced.length === 0) {
        setSyncStatus('success')
        setLastSyncAt(new Date())
        syncRef.current = false
        return
      }

      let hasErrors = false
      for (const sale of unsynced) {
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

      // Clean up synced records (keep errors for review)
      await deleteSyncedSales()
      await refreshCount()
      setSyncStatus(hasErrors ? 'error' : 'success')
      setLastSyncAt(new Date())
    } catch (e) {
      setSyncStatus('error')
    } finally {
      syncRef.current = false
    }
  }, [refreshCount])

  return { isOnline, pendingCount, errorCount, syncStatus, lastSyncAt, sync, refreshCount }
}
