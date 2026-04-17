'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore, canAccess } from '@/hooks/useAuth'
import { PinLockScreen } from '@/components/auth/PinLockScreen'
import { Spinner } from '@/components/ui'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { seller, loggedIn, hydrated, hydrate } = useAuthStore()
  const pathname = usePathname()
  const router   = useRouter()

  // Lire sessionStorage une seule fois après montage côté client
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Rediriger si rôle insuffisant
  useEffect(() => {
    if (hydrated && loggedIn && seller && !canAccess(seller.role, pathname)) {
      router.replace('/pos')
    }
  }, [hydrated, loggedIn, seller, pathname, router])

  // Avant hydratation → spinner neutre identique côté SSR et client
  // (évite le mismatch d'hydratation)
  if (!hydrated) {
    return (
      <div className="h-dvh flex items-center justify-center bg-gray-50">
        <Spinner size="lg"/>
      </div>
    )
  }

  // Non connecté → écran PIN
  if (!loggedIn) {
    return <PinLockScreen/>
  }

  // Connecté mais route interdite → null (redirect en cours)
  if (seller && !canAccess(seller.role, pathname)) {
    return null
  }

  return <>{children}</>
}
