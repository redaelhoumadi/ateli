import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ateli — Espace fidélité',
  description: 'Votre espace fidélité Ateli',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  // Pas de sidebar — portail client autonome, scroll libre
  return (
    <div className="min-h-dvh bg-gray-50">
      {children}
    </div>
  )
}
