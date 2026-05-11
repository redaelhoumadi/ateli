'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Camera, CameraOff, ScanLine, CheckCircle, AlertTriangle } from 'lucide-react'
import { getProductByBarcode } from '@/lib/supabase'
import { getCachedProducts } from '@/lib/offlineDB'
import { useCartStore } from '@/hooks/useCart'
import { cn } from '@/components/ui'
import type { Product } from '@/types'

// ─── Check BarcodeDetector support ───────────────────────────
function isBarcodeDetectorSupported() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

// ─── Find product in cache by barcode/reference ──────────────
async function findProduct(barcode: string): Promise<Product | null> {
  // 1. Try Supabase (online)
  if (navigator.onLine) {
    try {
      const p = await getProductByBarcode(barcode)
      if (p) return p as Product
    } catch {}
  }
  // 2. Fallback: search local cache
  try {
    const cached = await getCachedProducts()
    const term   = barcode.toLowerCase()
    const found  = cached.find(p =>
      p.reference?.toLowerCase() === term ||
      (p as any).barcode?.toLowerCase() === term
    )
    return found || null
  } catch { return null }
}

type FeedbackState = {
  type:    'success' | 'error' | 'duplicate'
  message: string
} | null

type Props = { onClose: () => void }

export function BarcodeScanner({ onClose }: Props) {
  const addItem     = useCartStore(s => s.addItem)
  const cartItems   = useCartStore(s => s.items)

  const videoRef   = useRef<HTMLVideoElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const scanLoopRef = useRef<number | null>(null)
  const lastCodeRef = useRef<string>('')     // évite les doublons rapides
  const lastTimeRef = useRef<number>(0)

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [feedback, setFeedback]       = useState<FeedbackState>(null)
  const [manualMode, setManualMode]   = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [searching, setSearching]     = useState(false)
  const [scannedCount, setScannedCount] = useState(0)
  const [torchOn, setTorchOn]         = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const manualRef = useRef<HTMLInputElement>(null)

  // ── Start camera ──
  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',   // caméra arrière sur mobile
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraReady(true)
      }

      // Check torch support
      const track = stream.getVideoTracks()[0]
      const caps   = track?.getCapabilities?.() as any
      if (caps?.torch) setTorchSupported(true)
    } catch (e: any) {
      const msg = e.name === 'NotAllowedError'
        ? 'Autorisation caméra refusée. Vérifiez les paramètres du navigateur.'
        : e.name === 'NotFoundError'
        ? 'Aucune caméra détectée sur cet appareil.'
        : `Erreur caméra : ${e.message}`
      setCameraError(msg)
    }
  }, [])

  // ── Stop camera ──
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraReady(false)
  }, [])

  // ── Toggle torch ──
  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !torchOn }] })
      setTorchOn(!torchOn)
    } catch {}
  }, [torchOn])

  // ── Handle detected barcode ──
  const handleBarcode = useCallback(async (rawCode: string) => {
    const code = rawCode.trim()
    if (!code) return

    // Anti-doublon : ignorer le même code dans les 2 secondes
    const now = Date.now()
    if (code === lastCodeRef.current && now - lastTimeRef.current < 2000) return
    lastCodeRef.current = code
    lastTimeRef.current = now

    setSearching(true)
    setFeedback(null)

    try {
      const product = await findProduct(code)

      if (!product) {
        setFeedback({ type: 'error', message: `"${code}" — Produit introuvable` })
        setTimeout(() => setFeedback(null), 2500)
        return
      }

      // Check if already max qty in cart
      const inCart = cartItems.find(i => i.product.id === product.id)
      if (inCart && product.stock !== null && inCart.quantity >= product.stock) {
        setFeedback({ type: 'duplicate', message: `Stock max atteint pour "${product.name}"` })
        setTimeout(() => setFeedback(null), 2000)
        return
      }

      addItem(product)
      setScannedCount(n => n + 1)
      setFeedback({ type: 'success', message: `✓ ${product.name}  +${product.price.toFixed(2)} €` })
      setTimeout(() => setFeedback(null), 1800)
    } catch (e: any) {
      setFeedback({ type: 'error', message: `Erreur : ${e.message}` })
      setTimeout(() => setFeedback(null), 2500)
    } finally {
      setSearching(false)
    }
  }, [addItem, cartItems])

  // ── BarcodeDetector scan loop ──
  useEffect(() => {
    if (!cameraReady || manualMode || !isBarcodeDetectorSupported()) return

    try {
      detectorRef.current = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e', 'itf', 'codabar'],
      })
    } catch { return }

    const scan = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        scanLoopRef.current = requestAnimationFrame(scan)
        return
      }
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current)
        if (barcodes.length > 0) {
          await handleBarcode(barcodes[0].rawValue)
        }
      } catch {}
      scanLoopRef.current = requestAnimationFrame(scan)
    }

    scanLoopRef.current = requestAnimationFrame(scan)
    return () => { if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current) }
  }, [cameraReady, manualMode, handleBarcode])

  // ── Lifecycle ──
  useEffect(() => {
    if (!manualMode) startCamera()
    else {
      stopCamera()
      setTimeout(() => manualRef.current?.focus(), 100)
    }
    return () => stopCamera()
  }, [manualMode]) // eslint-disable-line

  // ── Manual submit ──
  const handleManualSubmit = async () => {
    if (!manualInput.trim()) return
    await handleBarcode(manualInput.trim())
    setManualInput('')
  }

  const nativeSupported = isBarcodeDetectorSupported()

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 shrink-0">
        <div className="flex items-center gap-3">
          <ScanLine size={18} className="text-white"/>
          <div>
            <p className="text-sm font-bold text-white">Scanner code-barres</p>
            <p className="text-xs text-gray-400">
              {scannedCount > 0
                ? `${scannedCount} article${scannedCount > 1 ? 's' : ''} ajouté${scannedCount > 1 ? 's' : ''}`
                : nativeSupported ? 'Pointez la caméra vers un code-barres' : 'Saisie manuelle'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Torch toggle */}
          {torchSupported && !manualMode && (
            <button onClick={toggleTorch}
              className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                torchOn ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white hover:bg-white/20')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
              </svg>
            </button>
          )}
          {/* Toggle camera/manual */}
          <button onClick={() => setManualMode(!manualMode)}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
            title={manualMode ? 'Retour caméra' : 'Saisie manuelle'}>
            {manualMode ? <Camera size={16}/> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>}
          </button>
          {/* Close */}
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
            <X size={16}/>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">

        {/* ── Camera mode ── */}
        {!manualMode && (
          <>
            {/* Video feed */}
            <video
              ref={videoRef}
              playsInline muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Viewfinder overlay */}
            {cameraReady && (
              <div className="relative z-10 flex flex-col items-center gap-4">
                {/* Scan frame */}
                <div className="relative w-64 h-64 sm:w-80 sm:h-80">
                  {/* Corner brackets */}
                  {[
                    'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
                    'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
                    'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
                    'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
                  ].map((cls, i) => (
                    <div key={i} className={`absolute w-8 h-8 border-white ${cls}`}/>
                  ))}
                  {/* Animated scan line */}
                  <div className="absolute inset-x-4 h-0.5 bg-green-400 opacity-80 animate-[scan_2s_ease-in-out_infinite]"
                    style={{ top: '50%', animation: 'scanline 2s ease-in-out infinite',
                      boxShadow: '0 0 8px #4ade80, 0 0 20px #4ade8066' }}/>
                  {/* Darkened sides */}
                  <div className="absolute inset-0 rounded-xl ring-[9999px] ring-black/60"/>
                </div>

                {!nativeSupported && (
                  <div className="bg-amber-500/90 text-black text-xs font-bold px-4 py-2 rounded-xl max-w-xs text-center">
                    ⚠️ Votre navigateur ne supporte pas la détection automatique.
                    Utilisez la saisie manuelle (icône clavier).
                  </div>
                )}
              </div>
            )}

            {/* Camera error */}
            {cameraError && (
              <div className="z-10 flex flex-col items-center gap-4 text-center px-8">
                <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center">
                  <CameraOff size={28} className="text-red-400"/>
                </div>
                <p className="text-white text-sm font-semibold">{cameraError}</p>
                <button onClick={() => setManualMode(true)}
                  className="flex items-center gap-2 bg-white text-black text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg> Saisie manuelle
                </button>
              </div>
            )}

            {/* Loading */}
            {!cameraReady && !cameraError && (
              <div className="z-10 flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin"/>
                <p className="text-white/60 text-sm">Démarrage de la caméra…</p>
              </div>
            )}
          </>
        )}

        {/* ── Manual mode ── */}
        {manualMode && (
          <div className="z-10 w-full max-w-sm px-6 space-y-4">
            <div className="text-center mb-2">
              <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-300"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>
              </div>
              <p className="text-white font-bold">Saisie manuelle</p>
              <p className="text-gray-400 text-xs mt-1">Entrez la référence ou le code-barres</p>
            </div>
            <div className="flex gap-2">
              <input
                ref={manualRef}
                type="text"
                value={manualInput}
                onChange={e => setManualInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                placeholder="Ex: REF123 ou 5901234123457"
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all"
              />
              <button onClick={handleManualSubmit} disabled={searching || !manualInput.trim()}
                className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl flex items-center justify-center text-white transition-all">
                {searching
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>}
              </button>
            </div>
          </div>
        )}

        {/* Feedback toast */}
        {feedback && (
          <div className={cn(
            'absolute bottom-24 inset-x-4 z-20 flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold shadow-2xl transition-all',
            feedback.type === 'success'
              ? 'bg-green-500 text-white'
              : feedback.type === 'duplicate'
              ? 'bg-amber-500 text-black'
              : 'bg-red-500 text-white'
          )}>
            {feedback.type === 'success' && <CheckCircle size={18} className="shrink-0"/>}
            {feedback.type !== 'success' && <AlertTriangle size={18} className="shrink-0"/>}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 bg-black/80 px-5 py-4 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {nativeSupported && !manualMode
            ? '📷 Détection automatique activée'
            : '⌨️ Saisie manuelle'}
        </div>
        <button onClick={onClose}
          className="flex items-center gap-2 bg-white text-black text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">
          Terminer ({scannedCount} article{scannedCount !== 1 ? 's' : ''})
        </button>
      </div>

      <style>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(-60px); opacity: 0.9; }
          50% { transform: translateY(60px); opacity: 0.9; }
        }
      `}</style>
    </div>
  )
}
