import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ateli POS',
  description: 'Point of Sale - Concept Store',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 antialiased">
        {children}
      </body>
    </html>
  )
}
