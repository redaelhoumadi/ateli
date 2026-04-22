'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  Monitor, Package, Users, Calendar, BarChart2, QrCode, X, Menu,
  ShoppingCart, ChevronRight, Wallet, Lock, Settings, LogOut, Layers, Boxes, Gift, CircleDollarSign,
} from 'lucide-react'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
  Separator, cn,
} from '@/components/ui'
import { useAuthStore, ROLE_ROUTES } from '@/hooks/useAuth'

const ALL_NAV_ITEMS = [
  { href: '/pos',          label: 'Caisse POS',   icon: Monitor,   description: 'Interface de caisse' },
  { href: '/produits',     label: 'Produits',     icon: Package,   description: 'Catalogue & stocks' },
  { href: '/clients',      label: 'Clients',      icon: Users,     description: 'Programme fidélité' },
  { href: '/bons-cadeaux',  label: 'Bons cadeaux',  icon: Gift,             description: 'Créer et gérer les bons' },
  { href: '/marques',       label: 'Marques',        icon: Layers,           description: 'Fiches créateurs' },
  { href: '/commissions',   label: 'Commissions',    icon: CircleDollarSign, description: 'Taux par marque' },
  { href: '/reversements',  label: 'Reversements',   icon: Wallet,           description: 'CA & paiements créateurs' },
  { href: '/planning',     label: 'Planning',     icon: Calendar,  description: 'Disponibilités boutique' },
  { href: '/dashboard',    label: 'Dashboard',    icon: BarChart2, description: 'Analyse des ventes' },
  { href: '/cloture',      label: 'Clôture',      icon: Lock,      description: 'Clôture de caisse' },
  { href: '/parametres',   label: 'Paramètres',   icon: Settings,  description: 'Configuration boutique' },
]

const ROLE_COLORS: Record<string, string> = {
  manager: '#4338CA',
  seller:  '#374151',
}

export function Sidebar() {
  const pathname  = usePathname()
  const { seller, logout } = useAuthStore()
  const [open, setOpen]           = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Filter nav items based on role
  const allowedRoutes = seller ? (ROLE_ROUTES[seller.role] ?? ['/pos']) : ['/pos']
  const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => allowedRoutes.includes(item.href))

  const sellerColor = seller ? (ROLE_COLORS[seller.role] ?? '#374151') : '#374151'

  // ── Seller profile block ──────────────────────────────
  const ProfileBlock = ({ compact = false }: { compact?: boolean }) => (
    <div className={cn('flex items-center gap-3', compact && 'justify-center')}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0"
        style={{ background: sellerColor }}>
        {seller?.name?.[0]?.toUpperCase() ?? '?'}
      </div>
      {!compact && (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{seller?.name ?? '—'}</p>
          <p className="text-xs text-gray-400 capitalize">{seller?.role === 'manager' ? '🛡 Gérant' : '👤 Vendeur'}</p>
        </div>
      )}
    </div>
  )

  // ── Logout button ─────────────────────────────────────
  const LogoutBtn = ({ iconOnly = false }: { iconOnly?: boolean }) => (
    <button onClick={logout}
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition-all text-sm font-medium w-full',
        iconOnly && 'px-0 justify-center'
      )}>
      <LogOut size={15} className="shrink-0"/>
      {!iconOnly && 'Changer de vendeur'}
    </button>
  )

  return (
    <TooltipProvider delayDuration={300}>

      {/* ══════════════════════════════════════════════════════
          MOBILE — top bar
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
        <div className="flex items-center gap-2">
          {seller && (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
              style={{ background: sellerColor }}>
              {seller.name[0].toUpperCase()}
            </div>
          )}
          <button onClick={() => setOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            aria-label="Ouvrir le menu">
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* MOBILE — drawer overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}/>
      )}

      <div className={cn(
        'lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col shadow-2xl',
        'transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <ProfileBlock/>
          <button onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <X size={16}/>
          </button>
        </div>

        {/* Drawer nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href)
            const Icon   = item.icon
            return (
              <a key={item.href} href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-3 transition-all',
                  active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}>
                <Icon size={18} className={cn('shrink-0', active ? 'text-white' : 'text-gray-400 group-hover:text-gray-700')}/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className={cn('text-xs truncate', active ? 'text-white/60' : 'text-gray-400')}>{item.description}</p>
                </div>
                {active && <div className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0"/>}
              </a>
            )
          })}
        </nav>

        {/* QR */}
        {allowedRoutes.includes('/pos') && (
          <div className="px-3 py-2 border-t border-gray-100 shrink-0">
            <a href="/qr" target="_blank"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              <QrCode size={18} className="text-gray-400 shrink-0"/>
              <span className="font-medium">QR Fidélité plein écran</span>
            </a>
          </div>
        )}

        <div className="px-3 pb-3 shrink-0 border-t border-gray-100 pt-2">
          <LogoutBtn/>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          DESKTOP — sidebar
      ══════════════════════════════════════════════════════ */}
      <aside className={cn(
        'hidden lg:flex flex-col bg-white border-r border-gray-100 h-full shrink-0 transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-56'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100 shrink-0 overflow-hidden">
          <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <ShoppingCart size={16} className="text-white"/>
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
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href)
            const Icon   = item.icon

            const linkEl = (
              <a key={item.href} href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                  collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
                  active ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}>
                <Icon size={18} className={cn('shrink-0', active ? 'text-white' : 'text-gray-400 group-hover:text-gray-700')}/>
                {!collapsed && (
                  <>
                    <span className="text-sm font-medium truncate flex-1">{item.label}</span>
                    {active && <div className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0"/>}
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

        <Separator/>

        {/* Bottom: QR + profile + logout + collapse */}
        <div className={cn('px-2 py-3 space-y-1', collapsed && 'flex flex-col items-center')}>
          {/* QR */}
          {allowedRoutes.includes('/pos') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <a href="/qr" target="_blank"
                  className={cn(
                    'group flex items-center gap-3 rounded-xl transition-all text-gray-500 hover:bg-gray-100 hover:text-gray-900',
                    collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'
                  )}>
                  <QrCode size={18} className="shrink-0 text-gray-400 group-hover:text-gray-700"/>
                  {!collapsed && <span className="text-sm font-medium">QR Fidélité</span>}
                </a>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? 'right' : 'top'}>
                {collapsed ? 'QR Fidélité plein écran' : 'Ouvrir en plein écran'}
              </TooltipContent>
            </Tooltip>
          )}

          <Separator/>

          {/* Seller profile */}
          {!collapsed ? (
            <div className="px-3 py-2">
              <ProfileBlock/>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="px-0 py-2 cursor-default flex justify-center">
                  <ProfileBlock compact/>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{seller?.name} · {seller?.role}</TooltipContent>
            </Tooltip>
          )}

          {/* Logout */}
          <Tooltip>
            <TooltipTrigger asChild>
              {collapsed ? (
                <button onClick={logout}
                  className="w-full flex justify-center py-2 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-all">
                  <LogOut size={15}/>
                </button>
              ) : <LogoutBtn/>}
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Changer de vendeur</TooltipContent>}
          </Tooltip>

          <Separator/>

          {/* Collapse */}
          <button onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'group w-full flex items-center gap-3 rounded-xl px-3 py-2 transition-all text-gray-400 hover:bg-gray-100 hover:text-gray-700',
              collapsed && 'px-0 justify-center'
            )}>
            <ChevronRight size={16} className={cn('shrink-0 transition-transform duration-300', collapsed ? 'rotate-0' : 'rotate-180')}/>
            {!collapsed && <span className="text-xs font-medium">Réduire</span>}
          </button>
        </div>
      </aside>

    </TooltipProvider>
  )
}
