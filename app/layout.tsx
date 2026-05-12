import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ateli POS',
  description: 'Point of Sale - Concept Store',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="bg-gray-50 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
