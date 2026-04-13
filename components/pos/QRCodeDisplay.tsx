'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  url?: string
}

export function QRCodeDisplay({ url }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    // Build the portal URL from the current host
    const base =
      url || (typeof window !== 'undefined' ? `${window.location.origin}/client` : '/client')
    setQrUrl(base)
  }, [url])

  // We use the free QR code API from goqr.me to generate the QR image
  const qrSrc = qrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}&margin=10&color=000000&bgcolor=FFFFFF`
    : ''

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-white border-2 border-gray-100 rounded-2xl p-4 shadow-sm">
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrSrc}
            alt="QR Code programme fidélité"
            width={160}
            height={160}
            className="rounded-lg"
          />
        ) : (
          <div className="w-40 h-40 bg-gray-100 rounded-lg animate-pulse" />
        )}
      </div>
      <p className="text-xs text-gray-400 text-center leading-relaxed max-w-[200px]">
        Scanner pour créer ou accéder à ton compte fidélité
      </p>
    </div>
  )
}
