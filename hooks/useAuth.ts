import { create } from 'zustand'
import type { Seller } from '@/types'

export const ROLE_ROUTES: Record<string, string[]> = {
  seller:  ['/pos'],
  manager: ['/pos', '/produits', '/stock', '/clients', '/marques', '/reversements', '/planning', '/dashboard', '/cloture', '/parametres'],
}

export function canAccess(role: string | null, path: string): boolean {
  if (!role) return false
  const routes = ROLE_ROUTES[role] ?? []
  return routes.some(r => path === r || path.startsWith(r + '/'))
}

type AuthStore = {
  seller:    Seller | null
  loggedIn:  boolean
  hydrated:  boolean       // true une fois que sessionStorage a été lu côté client

  login:     (seller: Seller) => void
  logout:    () => void
  hydrate:   () => void    // appelé une seule fois dans AuthGuard après montage
}

function saveToSession(seller: Seller | null) {
  if (typeof window === 'undefined') return
  if (seller) sessionStorage.setItem('ateli_seller', JSON.stringify(seller))
  else        sessionStorage.removeItem('ateli_seller')
}

// ⚠ Le store démarre toujours avec seller=null / loggedIn=false
// pour que le rendu SSR et le 1er rendu client soient identiques.
// hydrate() est appelé côté client après montage pour lire sessionStorage.
export const useAuthStore = create<AuthStore>((set) => ({
  seller:   null,
  loggedIn: false,
  hydrated: false,

  hydrate: () => {
    if (typeof window === 'undefined') return
    try {
      const raw = sessionStorage.getItem('ateli_seller')
      const seller: Seller | null = raw ? JSON.parse(raw) : null
      set({ seller, loggedIn: !!seller, hydrated: true })
    } catch {
      set({ hydrated: true })
    }
  },

  login: (seller) => {
    saveToSession(seller)
    set({ seller, loggedIn: true, hydrated: true })
  },

  logout: () => {
    saveToSession(null)
    set({ seller: null, loggedIn: false, hydrated: true })
  },
}))
