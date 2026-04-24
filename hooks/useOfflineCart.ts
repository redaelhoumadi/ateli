'use client'

import { useEffect, useState, useCallback } from 'react'

const OFFLINE_CART_KEY = 'ateli_offline_cart'

export type OfflineCartData = {
  items: any[]
  customer: any | null
  sellerId: string
  savedAt: string
}

export function useOfflineCart() {
  const [isOnline, setIsOnline]         = useState(true)
  const [hasSavedCart, setHasSavedCart] = useState(false)
  const [savedCart, setSavedCart]       = useState<OfflineCartData | null>(null)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    try {
      const raw = localStorage.getItem(OFFLINE_CART_KEY)
      if (raw) { setSavedCart(JSON.parse(raw)); setHasSavedCart(true) }
    } catch {}

    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const saveCart = useCallback((data: Omit<OfflineCartData, 'savedAt'>) => {
    const full: OfflineCartData = { ...data, savedAt: new Date().toISOString() }
    try { localStorage.setItem(OFFLINE_CART_KEY, JSON.stringify(full)) } catch {}
    setSavedCart(full)
    setHasSavedCart(true)
  }, [])

  const clearSavedCart = useCallback(() => {
    try { localStorage.removeItem(OFFLINE_CART_KEY) } catch {}
    setSavedCart(null)
    setHasSavedCart(false)
  }, [])

  const timeSaved = savedCart ? (() => {
    const diff = Math.floor((Date.now() - new Date(savedCart.savedAt).getTime()) / 60000)
    if (diff < 1) return "à l'instant"
    if (diff < 60) return `il y a ${diff} min`
    return `il y a ${Math.floor(diff / 60)}h`
  })() : null

  return { isOnline, hasSavedCart, savedCart, saveCart, clearSavedCart, timeSaved }
}
