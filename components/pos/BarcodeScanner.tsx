'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ScanLine, CheckCircle, AlertTriangle, Zap } from 'lucide-react'
import { getProductByBarcode } from '@/lib/supabase'
import { getCachedProducts } from '@/lib/offlineDB'
import { useCartStore } from '@/hooks/useCart'
import { cn } from '@/components/ui'
import type { Product } from '@/types'

// ─── Find product by barcode/reference ───────────────────────
async function findProduct(code: string): Promise<Product | null> {
  const term = code.trim()
  if (!term) return null
  if (navigator.onLine) {
    try { const p = await getProductByBarcode(term); if (p) return p as Product } catch {}
  }
  try {
    const cached = await getCachedProducts()
    const q = term.toLowerCase()
    return (cached.find((p: any) =>
      p.reference?.toLowerCase() === q || p.barcode?.toLowerCase() === q
    ) as Product) || null
  } catch { return null }
}

type Feedback = { type: 'success' | 'error' | 'duplicate'; msg: string } | null

export function BarcodeScanner({ onClose }: { onClose: () => void }) {
  const addItem   = useCartStore(s => s.addItem)
  const cartItems = useCartStore(s => s.items)

  const videoRef   = useRef<HTMLVideoElement>(null)
  const stopFnRef  = useRef<(() => void) | null>(null)  // ZXing stop handle
  // Douchette: buffer keystrokes
  const hhBuf      = useRef('')
  const hhTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Anti-doublon
  const lastCode   = useRef('')
  const lastTime   = useRef(0)

  const [ready, setReady]           = useState(false)
  const [camError, setCamError]     = useState<string | null>(null)
  const [feedback, setFeedback]     = useState<Feedback>(null)
  const [count, setCount]           = useState(0)
  const [mode, setMode]             = useState<'camera' | 'manual'>('camera')
  const [manual, setManual]         = useState('')
  const [searching, setSearching]   = useState(false)
  const [torch, setTorch]           = useState(false)
  const [torchOk, setTorchOk]       = useState(false)
  const manualRef = useRef<HTMLInputElement>(null)

  // ── Process a scanned code (any source) ──────────────────────
  const handleCode = useCallback(async (raw: string) => {
    const code = raw.trim()
    if (!code || code.length < 3) return
    const now = Date.now()
    if (code === lastCode.current && now - lastTime.current < 2000) return
    lastCode.current = code
    lastTime.current = now

    setSearching(true)
    setFeedback(null)
    try {
      const product = await findProduct(code)
      if (!product) {
        setFeedback({ type: 'error', msg: `Produit introuvable — "${code}"` })
        return
      }
      const inCart = cartItems.find(i => i.product.id === product.id)
      if (inCart && product.stock != null && inCart.quantity >= product.stock) {
        setFeedback({ type: 'duplicate', msg: `Stock max atteint — ${product.name}` })
        return
      }
      addItem(product)
      setCount(n => n + 1)
      setFeedback({ type: 'success', msg: `✓  ${product.name}  •  ${product.price.toFixed(2)} €` })
    } catch (e: any) {
      setFeedback({ type: 'error', msg: `Erreur : ${e.message}` })
    } finally {
      setSearching(false)
      // Auto-clear feedback
      setTimeout(() => setFeedback(null), feedback?.type === 'error' ? 3000 : 2000)
    }
  }, [addItem, cartItems, feedback?.type])

  // ── Start ZXing camera scanner ────────────────────────────────
  // Uses decodeFromConstraints — the only method that works reliably on
  // iOS Safari AND Android Chrome. No BarcodeDetector dependency.
  const startCamera = useCallback(async () => {
    setCamError(null)
    setReady(false)
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()

      // Probe torch support before starting
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        const track = probe.getVideoTracks()[0]
        const caps  = (track?.getCapabilities?.() as any)
        if (caps?.torch) setTorchOk(true)
        probe.getTracks().forEach(t => t.stop())
      } catch {}

      // decodeFromConstraints gives us a stop handle + works on iOS
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        videoRef.current!,
        (result, err) => {
          if (result) handleCode(result.getText())
          // err here is just "no barcode in frame", ignore
        }
      )

      stopFnRef.current = () => controls.stop()
      setReady(true)
    } catch (e: any) {
      const msg =
        e.name === 'NotAllowedError'
          ? 'Accès caméra refusé.\nDans Safari : Réglages → Safari → Caméra → Autoriser'
          : e.name === 'NotFoundError'
          ? 'Aucune caméra détectée sur cet appareil.'
          : `Erreur caméra : ${e.message}`
      setCamError(msg)
    }
  }, [handleCode])

  const stopCamera = useCallback(() => {
    if (stopFnRef.current) { stopFnRef.current(); stopFnRef.current = null }
    setReady(false)
  }, [])

  const toggleTorch = useCallback(async () => {
    if (!videoRef.current) return
    const stream = (videoRef.current as any).srcObject as MediaStream
    const track  = stream?.getVideoTracks()[0]
    if (!track) return
    try { await (track as any).applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(v => !v) } catch {}
  }, [torch])

  // ── Douchette USB/BT keyboard listener ───────────────────────
  // A barcode gun sends keystrokes very fast then Enter.
  // We buffer and flush either on Enter or after 100ms silence.
  useEffect(() => {
    if (mode !== 'camera') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'Enter') {
        const buf = hhBuf.current.trim()
        if (buf.length >= 3) handleCode(buf)
        hhBuf.current = ''
        if (hhTimer.current) clearTimeout(hhTimer.current)
        return
      }
      if (e.key.length === 1) {
        hhBuf.current += e.key
        if (hhTimer.current) clearTimeout(hhTimer.current)
        hhTimer.current = setTimeout(() => {
          const buf = hhBuf.current.trim()
          if (buf.length >= 6) handleCode(buf)
          hhBuf.current = ''
        }, 100)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); if (hhTimer.current) clearTimeout(hhTimer.current) }
  }, [mode, handleCode])

  // ── Lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'camera') startCamera()
    else { stopCamera(); setTimeout(() => manualRef.current?.focus(), 150) }
    return () => stopCamera()
  }, [mode]) // eslint-disable-line

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/90 shrink-0">
        <div className="flex items-center gap-3">
          <ScanLine size={18} className="text-white shrink-0"/>
          <div>
            <p className="text-sm font-bold text-white">Scanner</p>
            <p className="text-xs text-gray-400">
              {count > 0 ? `${count} article${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''}` :
               mode === 'camera' ? 'Pointez la caméra vers le code-barres' : 'Saisie manuelle ou douchette'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {torchOk && mode === 'camera' && (
            <button onClick={toggleTorch}
              className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                torch ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white')}>
              <Zap size={16}/>
            </button>
          )}
          {/* Camera ↔ Manual toggle */}
          <button onClick={() => setMode(m => m === 'camera' ? 'manual' : 'camera')}
            title={mode === 'camera' ? 'Saisie manuelle' : 'Activer la caméra'}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
            {mode === 'camera' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            )}
          </button>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
            <X size={16}/>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">

        {/* ─── CAMERA ─── */}
        {mode === 'camera' && (
          <>
            <video ref={videoRef} playsInline muted autoPlay
              className="absolute inset-0 w-full h-full object-cover"/>

            {ready && (
              <div className="relative z-10 pointer-events-none">
                {/* Viewfinder frame */}
                <div className="relative w-72 h-52 sm:w-80 sm:h-60">
                  <div className="absolute inset-0" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)', borderRadius: 12 }}/>
                  {(['tl','tr','bl','br'] as const).map(p => (
                    <div key={p} className={cn('absolute w-7 h-7 border-white',
                      p==='tl' ? 'top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-lg' :
                      p==='tr' ? 'top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-lg' :
                      p==='bl' ? 'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-lg' :
                                 'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-lg')}/>
                  ))}
                  {/* Animated scan line */}
                  <div className="absolute left-2 right-2" style={{
                    height: 2, background: 'linear-gradient(90deg,transparent,#4ade80,transparent)',
                    boxShadow: '0 0 8px #4ade80', animation: 'scan 1.8s ease-in-out infinite', top: '50%',
                  }}/>
                </div>
                <p className="text-center text-white/50 text-xs mt-4">EAN-13 · EAN-8 · Code 128 · QR</p>
              </div>
            )}

            {/* Camera error */}
            {camError && (
              <div className="z-10 flex flex-col items-center gap-4 px-8 max-w-xs text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center">
                  <AlertTriangle size={28} className="text-red-400"/>
                </div>
                <p className="text-white text-sm font-semibold whitespace-pre-line leading-relaxed">{camError}</p>
                <button onClick={() => setMode('manual')}
                  className="bg-white text-black text-sm font-bold px-6 py-2.5 rounded-xl">
                  Saisie manuelle
                </button>
                <button onClick={startCamera}
                  className="text-white/60 text-xs underline">
                  Réessayer
                </button>
              </div>
            )}

            {/* Loading */}
            {!ready && !camError && (
              <div className="z-10 flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin"/>
                <p className="text-white/60 text-sm">Chargement du scanner…</p>
                <p className="text-white/30 text-xs">ZXing · Compatible iOS &amp; Android</p>
              </div>
            )}
          </>
        )}

        {/* ─── MANUAL / DOUCHETTE ─── */}
        {mode === 'manual' && (
          <div className="z-10 w-full max-w-sm px-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>
              </div>
              <p className="text-white font-bold text-sm">Saisie manuelle</p>
              <p className="text-gray-400 text-xs mt-1">Ou connectez une douchette USB / Bluetooth</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-gray-400 flex gap-2">
              <span className="text-indigo-400 shrink-0 mt-px">ℹ</span>
              <span><strong className="text-white">Douchette connectée ?</strong> Cliquez dans le champ puis scannez — le code est envoyé comme une frappe clavier.</span>
            </div>
            <div className="flex gap-2">
              <input ref={manualRef} type="text" value={manual}
                onChange={e => setManual(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !searching && manual.trim() && handleCode(manual.trim()).then(() => setManual(''))}
                placeholder="Référence ou EAN-13…"
                autoComplete="off" autoCorrect="off" spellCheck={false}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:border-indigo-400 transition-all"/>
              <button
                onClick={() => { if (manual.trim()) handleCode(manual.trim()).then(() => setManual('')) }}
                disabled={searching || !manual.trim()}
                className="w-12 h-[52px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl flex items-center justify-center text-white transition-all">
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
            'absolute bottom-24 inset-x-4 z-30 flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold shadow-2xl',
            feedback.type === 'success'   ? 'bg-green-500 text-white' :
            feedback.type === 'duplicate' ? 'bg-amber-400 text-black' : 'bg-red-500 text-white'
          )}>
            {feedback.type === 'success' ? <CheckCircle size={18} className="shrink-0"/> : <AlertTriangle size={18} className="shrink-0"/>}
            <span>{feedback.msg}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 bg-black/90 px-5 py-4 flex items-center justify-between" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <p className="text-xs text-gray-500">
          {mode === 'camera' ? '📷 iOS Safari · Android · Desktop' : '⌨️ Clavier · Douchette USB/BT'}
        </p>
        <button onClick={onClose}
          className="bg-white text-black text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">
          Terminer ({count} article{count !== 1 ? 's' : ''})
        </button>
      </div>

      <style>{`@keyframes scan { 0%,100%{transform:translateY(-36px)}50%{transform:translateY(36px)} }`}</style>
    </div>
  )
}
