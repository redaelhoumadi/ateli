import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'Ateli POS',
  description: 'Point of Sale - Concept Store',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="h-dvh flex flex-col lg:flex-row overflow-hidden bg-gray-50">
        {/* Sidebar — renders mobile top-bar + desktop sidebar */}
        <Sidebar />
        {/* Page content — fills remaining space, scrolls internally */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
          {children}
        </div>
      </body>
    </html>
  )
}
