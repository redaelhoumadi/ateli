'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  Monitor, Package, Users, Calendar, BarChart2, QrCode, X, Menu,
  ShoppingCart, ChevronRight,
} from 'lucide-react'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
  Separator, cn,
} from '@/components/ui'

const NAV_ITEMS = [
  { href: '/pos',       label: 'Caisse POS',  icon: Monitor,    description: 'Interface de caisse' },
  { href: '/produits',  label: 'Produits',    icon: Package,    description: 'Catalogue & stocks' },
  { href: '/clients',   label: 'Clients',     icon: Users,      description: 'Programme fidélité' },
  { href: '/planning',  label: 'Planning',    icon: Calendar,   description: 'Disponibilités boutique' },
  { href: '/dashboard', label: 'Dashboard',   icon: BarChart2,  description: 'Analyse des ventes' },
]

export function Sidebar() {
  const pathname    = usePathname()
  const [open, setOpen]           = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <TooltipProvider delayDuration={300}>

      {/* ══════════════════════════════════════════════════════
          MOBILE — top bar (visible only on < lg)
      ══════════════════════════════════════════════════════ */}
      <header className="lg:hidden flex items-center justify-between bg-white border-b border-gray-100 px-4 py-3 shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
            <ShoppingCart size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none">Ateli POS</p>
            <p className="text-xs text-gray-400 leading-none mt-0.5">Concept Store</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu size={18} />
        </button>
      </header>

      {/* ══════════════════════════════════════════════════════
          MOBILE — drawer overlay + panel
      ══════════════════════════════════════════════════════ */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <div className={cn(
        'lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col shadow-2xl',
        'transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center">
              <ShoppingCart size={16} className="text-white" />
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
            <X size={16} />
          </button>
        </div>

        {/* Drawer nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <a key={item.href} href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-3 transition-all',
                  active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}>
                <Icon size={18} className={cn('shrink-0', active ? 'text-white' : 'text-gray-400 group-hover:text-gray-700')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className={cn('text-xs truncate', active ? 'text-white/60' : 'text-gray-400')}>{item.description}</p>
                </div>
                {active && <div className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />}
              </a>
            )
          })}
        </nav>

        {/* QR link */}
        <div className="px-3 py-3 border-t border-gray-100 shrink-0">
          <a href="/qr" target="_blank"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
            <QrCode size={18} className="text-gray-400 shrink-0" />
            <span className="font-medium">QR Fidélité plein écran</span>
          </a>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <p className="text-xs text-gray-300">Ateli POS · v2.0</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          DESKTOP — sidebar (hidden on mobile)
      ══════════════════════════════════════════════════════ */}
      <aside className={cn(
        'hidden lg:flex flex-col bg-white border-r border-gray-100 h-full shrink-0 transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-56'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100 shrink-0 overflow-hidden">
          <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <ShoppingCart size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-none truncate">Ateli POS</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-none">Concept Store</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon

            const linkEl = (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                  collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
                  active
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon size={18} className={cn('shrink-0', active ? 'text-white' : 'text-gray-400 group-hover:text-gray-700')} />
                {!collapsed && (
                  <>
                    <span className="text-sm font-medium truncate flex-1">{item.label}</span>
                    {active && <div className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />}
                  </>
                )}
              </a>
            )

            return collapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                <TooltipContent side="right" className="ml-1">
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-xs opacity-70">{item.description}</p>
                </TooltipContent>
              </Tooltip>
            ) : linkEl
          })}
        </nav>

        <Separator />

        {/* QR + collapse */}
        <div className={cn('px-2 py-3 space-y-0.5', collapsed && 'flex flex-col items-center')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <a href="/qr" target="_blank"
                className={cn(
                  'group flex items-center gap-3 rounded-xl transition-all text-gray-500 hover:bg-gray-100 hover:text-gray-900',
                  collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'
                )}>
                <QrCode size={18} className="shrink-0 text-gray-400 group-hover:text-gray-700" />
                {!collapsed && <span className="text-sm font-medium">QR Fidélité</span>}
              </a>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? 'right' : 'top'}>
              {collapsed ? 'QR Fidélité plein écran' : 'Ouvrir en plein écran'}
            </TooltipContent>
          </Tooltip>

          <Separator />

          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all text-gray-400 hover:bg-gray-100 hover:text-gray-700',
              collapsed && 'px-0 justify-center'
            )}
          >
            <ChevronRight
              size={16}
              className={cn('shrink-0 transition-transform duration-300', collapsed ? 'rotate-0' : 'rotate-180')}
            />
            {!collapsed && <span className="text-xs font-medium">Réduire</span>}
          </button>
        </div>

        {!collapsed && (
          <div className="px-4 py-2.5 border-t border-gray-100 shrink-0">
            <p className="text-xs text-gray-300">Ateli POS · v2.0</p>
          </div>
        )}
      </aside>

    </TooltipProvider>
  )
}
