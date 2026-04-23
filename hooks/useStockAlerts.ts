'use client'

import { useState, useEffect, useCallback } from 'react'
import { getLowStockProducts } from '@/lib/supabase'
import type { Product } from '@/types'

export type StockAlert = Product & {
  brand?: { id: string; name: string }
  urgency: 'critical' | 'low'   // critical = épuisé, low = stock bas
}

type StockAlertsState = {
  alerts:      StockAlert[]
  criticalCount: number
  lowCount:    number
  total:       number
  lastChecked: Date | null
  loading:     boolean
  refresh:     () => Promise<void>
}

const POLL_INTERVAL = 5 * 60 * 1000  // 5 minutes

// Singleton pour partager l'état entre composants sans re-fetch
let cachedAlerts: StockAlert[] | null = null
let lastFetch = 0
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach(fn => fn())
}

async function fetchAlerts(): Promise<StockAlert[]> {
  const data = (await getLowStockProducts()) as any[]
  const alerts: StockAlert[] = (data || []).map(p => ({
    ...p,
    urgency: p.stock === 0 ? 'critical' : 'low',
  }))
  cachedAlerts = alerts
  lastFetch = Date.now()
  notifyListeners()
  return alerts
}

export function useStockAlerts(): StockAlertsState {
  const [alerts, setAlerts]       = useState<StockAlert[]>(cachedAlerts ?? [])
  const [loading, setLoading]     = useState(!cachedAlerts)
  const [lastChecked, setLastChecked] = useState<Date | null>(cachedAlerts ? new Date(lastFetch) : null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAlerts()
      setAlerts(data)
      setLastChecked(new Date())
    } catch (e) {
      console.warn('[stockAlerts]', e)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    // Sync with shared cache
    const sync = () => {
      if (cachedAlerts) { setAlerts(cachedAlerts); setLastChecked(new Date(lastFetch)) }
    }
    listeners.add(sync)

    // Load if cache is stale or empty
    if (!cachedAlerts || Date.now() - lastFetch > POLL_INTERVAL) {
      refresh()
    }

    // Poll every 5 minutes
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_INTERVAL)

    return () => { listeners.delete(sync); clearInterval(interval) }
  }, [refresh])

  const criticalCount = alerts.filter(a => a.urgency === 'critical').length
  const lowCount      = alerts.filter(a => a.urgency === 'low').length

  return { alerts, criticalCount, lowCount, total: alerts.length, lastChecked, loading, refresh }
}

// Manual invalidation after stock update
export function invalidateStockAlerts() {
  cachedAlerts = null
  lastFetch = 0
}
