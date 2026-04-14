'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// ── Icons ─────────────────────────────────────────────────────
const IconPOS = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
  </svg>
)
const IconBox = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
    <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
  </svg>
)
const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <path d="M16 2v4M8 2v4M3 10h18"/>
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
  </svg>
)
const IconChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/>
    <path d="m19 9-5 5-4-4-3 3"/>
  </svg>
)
const IconQR = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <path d="M14 14h2v2h-2zM18 14h3M14 18h3M20 18v3M17 21h3"/>
  </svg>
)
const IconMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6"/>
    <line x1="4" y1="12" x2="20" y2="12"/>
    <line x1="4" y1="18" x2="20" y2="18"/>
  </svg>
)
const IconX = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

// ── Nav items ─────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/pos',       label: 'Caisse POS',  icon: IconPOS },
  { href: '/produits',  label: 'Produits',    icon: IconBox },
  { href: '/clients',   label: 'Clients',     icon: IconUsers },
  { href: '/planning',  label: 'Planning',    icon: IconCalendar },
  { href: '/dashboard', label: 'Dashboard',   icon: IconChart },
]

type Props = {
  /** Extra slot rendered below nav items (e.g. seller selector + QR button on POS page) */
  extraBottom?: React.ReactNode
}

export function Sidebar({ extraBottom }: Props) {
  const pathname   = usePathname()
  const [open, setOpen] = useState(false)

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const NavLink = ({ item }: { item: typeof NAV_ITEMS[number] }) => {
    const active = pathname === item.href || pathname.startsWith(item.href + '/')
    const Icon = item.icon
    return (
      <a
        href={item.href}
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          active
            ? 'bg-gray-900 text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <span className={`shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-gray-700'}`}>
          <Icon />
        </span>
        <span>{item.label}</span>
        {active && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
        )}
      </a>
    )
  }

  return (
    <>
      {/* ══════════════════════════════════════════
          DESKTOP sidebar (lg+)
      ══════════════════════════════════════════ */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-white border-r border-gray-100 h-full">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white text-base font-black tracking-tight">A</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">Ateli POS</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-none">Concept Store</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>

        {/* Extra slot (seller, QR, etc.) */}
        {extraBottom && (
          <div className="px-3 py-4 border-t border-gray-100 space-y-2">
            {extraBottom}
          </div>
        )}

        {/* Bottom branding */}
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-300">Ateli POS · v2.0</p>
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          MOBILE top bar + drawer (< lg)
      ══════════════════════════════════════════ */}
      {/* Top bar */}
      <header className="lg:hidden flex items-center justify-between bg-white border-b border-gray-100 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center">
            <span className="text-white text-sm font-black">A</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none">Ateli POS</p>
            <p className="text-xs text-gray-400 leading-none mt-0.5">Concept Store</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <IconMenu />
        </button>
      </header>

      {/* Drawer overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
              <span className="text-white text-base font-black">A</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">Ateli POS</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-none">Concept Store</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {/* Drawer nav */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>

        {/* Extra slot */}
        {extraBottom && (
          <div className="px-4 py-4 border-t border-gray-100 space-y-2">
            {extraBottom}
          </div>
        )}

        {/* QR shortcut */}
        <div className="px-4 py-3 border-t border-gray-100">
          <a
            href="/qr"
            target="_blank"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <span className="text-gray-400"><IconQR /></span>
            <span>QR Fidélité plein écran</span>
          </a>
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-300">Ateli POS · v2.0</p>
        </div>
      </div>
    </>
  )
}
