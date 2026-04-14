import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'Ateli POS',
  description: 'Point of Sale - Concept Store',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="h-screen flex overflow-hidden bg-gray-50">
        {/* Sidebar — desktop vertical, mobile burger */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {children}
        </div>
      </body>
    </html>
  )
}
