'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  AlertTriangle, Package, TrendingDown, CheckCircle,
  Search, RefreshCw, ChevronUp, ChevronDown, Layers,
} from 'lucide-react'
import { getStockStats, updateStock, updateStockMin } from '@/lib/supabase'
import { getStockStatus } from '@/types'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  Input, StatCard, Spinner, EmptyState, TooltipProvider, cn,
} from '@/components/ui'
import type { Product } from '@/types'

const STATUS_CONFIG = {
  out:       { label: 'Épuisé',    bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-600',   dot: 'bg-red-500',   badge: 'destructive' as const },
  low:       { label: 'Stock bas', bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-600', dot: 'bg-amber-500', badge: 'warning' as const },
  ok:        { label: 'En stock',  bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-600', dot: 'bg-green-500', badge: 'success' as const },
  unmanaged: { label: 'Non géré',  bg: 'bg-gray-50',   border: 'border-gray-100',  text: 'text-gray-400',  dot: 'bg-gray-300',  badge: 'secondary' as const },
}

type StockProduct = Product & { brand?: { id: string; name: string } }

function StockRow({ product, onUpdate }: {
  product: StockProduct
  onUpdate: (id: string, stock: number | null, stockMin: number) => void
}) {
  const status    = getStockStatus(product)
  const cfg       = STATUS_CONFIG[status]
  const [editing, setEditing]   = useState(false)
  const [stockVal, setStockVal] = useState(product.stock != null ? String(product.stock) : '')
  const [minVal,   setMinVal]   = useState(String(product.stock_min ?? 3))
  const [saving,   setSaving]   = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const s = stockVal === '' ? null : Number(stockVal)
      await onUpdate(product.id, s, Number(minVal) || 3)
      setEditing(false)
    } finally { setSaving(false) }
  }

  const handleQuick = async (delta: number) => {
    if (product.stock === null) return
    const next = Math.max(0, product.stock + delta)
    setSaving(true)
    try { await onUpdate(product.id, next, product.stock_min ?? 3) }
    finally { setSaving(false) }
  }

  const img = (product as any).image_url as string | null

  return (
    <div className={cn(
      'flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors',
      status === 'out' && 'bg-red-50/30'
    )}>
      {/* Product info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Status dot */}
        <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', cfg.dot)}/>
        {/* Thumbnail */}
        <div className="w-9 h-9 rounded-xl border border-gray-100 bg-gray-50 shrink-0 overflow-hidden flex items-center justify-center">
          {img ? <img src={img} alt={product.name} className="w-full h-full object-cover"/> : <Package size={14} className="text-gray-300"/>}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-400 font-mono">{product.reference}</p>
            {product.brand && (
              <span className="text-xs text-gray-400">· {product.brand.name}</span>
            )}
          </div>
        </div>
      </div>

      {/* Price */}
      <p className="text-sm text-gray-600 shrink-0 w-20 text-right">
        {product.price.toFixed(2)} €
      </p>

      {/* Stock control */}
      <div className="flex items-center gap-2 shrink-0">
        {status === 'unmanaged' ? (
          <button onClick={() => { setStockVal('0'); setEditing(true) }}
            className="text-xs text-gray-400 hover:text-gray-700 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 hover:border-gray-500 transition-all font-medium">
            + Activer le stock
          </button>
        ) : editing ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 w-14 text-right">Stock :</span>
                <input type="number" value={stockVal} onChange={e => setStockVal(e.target.value)}
                  min="0" className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900" autoFocus/>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 w-14 text-right">Seuil :</span>
                <input type="number" value={minVal} onChange={e => setMinVal(e.target.value)}
                  min="0" className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900"/>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={handleSave} disabled={saving}
                className="text-xs bg-gray-900 text-white px-2.5 py-1.5 rounded-lg hover:bg-black transition-colors disabled:opacity-50 font-medium">
                {saving ? '…' : 'OK'}
              </button>
              <button onClick={() => setEditing(false)}
                className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Quick -/+ */}
            <button onClick={() => handleQuick(-1)} disabled={saving || product.stock === 0}
              className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors text-sm font-bold">
              −
            </button>
            <button onClick={() => setEditing(true)}
              className={cn('text-base font-black min-w-[32px] text-center rounded-lg px-2 py-0.5 transition-colors cursor-pointer hover:bg-white border',
                status === 'out' ? 'text-red-600 border-red-200 bg-red-50' :
                status === 'low' ? 'text-amber-600 border-amber-200 bg-amber-50' :
                'text-gray-900 border-transparent hover:border-gray-200')}>
              {product.stock}
            </button>
            <button onClick={() => handleQuick(1)} disabled={saving}
              className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors text-sm font-bold">
              +
            </button>
          </div>
        )}
      </div>

      {/* Status badge */}
      {status !== 'unmanaged' && (
        <div className="w-20 flex justify-end shrink-0">
          {status === 'out' && <Badge variant="destructive" size="sm">Épuisé</Badge>}
          {status === 'low' && <Badge variant="warning" size="sm">Stock bas</Badge>}
          {status === 'ok'  && <Badge variant="success" size="sm">OK</Badge>}
        </div>
      )}
    </div>
  )
}

export default function StockPage() {
  const [allProducts, setAllProducts] = useState<StockProduct[]>([])
  const [stats, setStats] = useState<{
    all: StockProduct[]; out: StockProduct[]; low: StockProduct[]; ok: StockProduct[]; totalVal: number
  } | null>(null)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState<'all'|'out'|'low'|'ok'|'unmanaged'>('all')
  const [filterBrand, setFilterBrand]   = useState('')
  const [sortCol, setSortCol]     = useState<'name'|'stock'|'brand'>('stock')
  const [sortDir, setSortDir]     = useState<'asc'|'desc'>('asc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await getStockStats()
      setStats(s as any)
      // Load ALL products for the full table
      const { getAllProducts } = await import('@/lib/supabase')
      const all = await getAllProducts()
      setAllProducts(((all || []) as StockProduct[]).filter(p => p.is_active !== false))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const brands = useMemo(() => {
    const set = new Set(allProducts.map(p => p.brand?.name).filter(Boolean) as string[])
    return [...set].sort()
  }, [allProducts])

  const filtered = useMemo(() => {
    let list = allProducts.filter(p => {
      const ms = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.reference.toLowerCase().includes(search.toLowerCase())
      const mb = !filterBrand || p.brand?.name === filterBrand
      const mst = filterStatus === 'all' || getStockStatus(p) === filterStatus
      return ms && mb && mst
    })
    return [...list].sort((a, b) => {
      let d = 0
      if (sortCol === 'name') d = a.name.localeCompare(b.name)
      if (sortCol === 'brand') d = (a.brand?.name ?? '').localeCompare(b.brand?.name ?? '')
      if (sortCol === 'stock') {
        const sa = a.stock ?? 9999, sb = b.stock ?? 9999
        d = sa - sb
      }
      return sortDir === 'asc' ? d : -d
    })
  }, [allProducts, search, filterBrand, filterStatus, sortCol, sortDir])

  const handleUpdate = useCallback(async (id: string, stock: number | null, stockMin: number) => {
    const { updateStock: updStock, updateStockMin: updMin } = await import('@/lib/supabase')
    await updStock(id, stock)
    await updMin(id, stockMin)
    setAllProducts(prev => prev.map(p => p.id === id ? { ...p, stock, stock_min: stockMin } : p))
  }, [])

  const SortBtn = ({ col, label }: { col: typeof sortCol; label: string }) => (
    <button onClick={() => { sortCol === col ? setSortDir(d => d === 'asc' ? 'desc' : 'asc') : (setSortCol(col), setSortDir('asc')) }}
      className={cn('flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors',
        sortCol === col ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600')}>
      {label}
      {sortCol === col ? (sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>) : <ChevronDown size={11} className="opacity-30"/>}
    </button>
  )

  const managedCount = allProducts.filter(p => p.stock !== null).length
  const unmanagedCount = allProducts.filter(p => p.stock === null).length

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestion des stocks</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {managedCount} produit{managedCount > 1 ? 's' : ''} avec stock géré · {unmanagedCount} non géré{unmanagedCount > 1 ? 's' : ''}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Actualiser
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Épuisés" value={stats?.out.length ?? 0} icon={<AlertTriangle size={16} className="text-red-500"/>}/>
            <StatCard label="Stock bas" value={stats?.low.length ?? 0} icon={<TrendingDown size={16} className="text-amber-500"/>}/>
            <StatCard label="En stock" value={stats?.ok.length ?? 0} icon={<CheckCircle size={16} className="text-green-500"/>}/>
            <StatCard label="Valeur stock" value={stats ? (stats.totalVal >= 1000 ? `${(stats.totalVal/1000).toFixed(1)}k €` : `${stats.totalVal.toFixed(0)} €`) : '—'} icon={<Package size={16}/>}/>
          </div>

          {/* Alerts */}
          {(stats?.out.length ?? 0) > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-red-500 shrink-0"/>
                <p className="text-sm font-bold text-red-900">
                  {stats!.out.length} produit{stats!.out.length > 1 ? 's' : ''} épuisé{stats!.out.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {stats!.out.map(p => (
                  <span key={p.id} className="text-xs bg-red-100 text-red-700 font-semibold px-3 py-1.5 rounded-full border border-red-200">
                    {p.name}
                    {(p as any).brand?.name && <span className="text-red-400 ml-1">· {(p as any).brand.name}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(stats?.low.length ?? 0) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={16} className="text-amber-500 shrink-0"/>
                <p className="text-sm font-bold text-amber-900">
                  {stats!.low.length} produit{stats!.low.length > 1 ? 's' : ''} en stock bas
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {stats!.low.map(p => (
                  <span key={p.id} className="text-xs bg-amber-100 text-amber-700 font-semibold px-3 py-1.5 rounded-full border border-amber-200">
                    {p.name} <span className="text-amber-500">({p.stock})</span>
                    {(p as any).brand?.name && <span className="text-amber-400 ml-1">· {(p as any).brand.name}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-48">
              <Input icon={<Search size={14}/>} placeholder="Rechercher un produit…"
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            {/* Status filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              {([
                { id: 'all',       label: 'Tous' },
                { id: 'out',       label: '🔴 Épuisés' },
                { id: 'low',       label: '🟠 Stock bas' },
                { id: 'ok',        label: '🟢 En stock' },
                { id: 'unmanaged', label: '⚪ Non géré' },
              ] as const).map(f => (
                <button key={f.id} onClick={() => setFilterStatus(f.id)}
                  className={cn('px-3 py-2 rounded-xl text-sm font-medium border transition-all',
                    filterStatus === f.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
                  {f.label}
                </button>
              ))}
            </div>
            {brands.length > 1 && (
              <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Toutes les marques</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
          </div>

          {/* Table */}
          <Card className="overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex-1"><SortBtn col="name" label="Produit"/></div>
              <div className="w-20 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Prix</div>
              <div className="flex items-center gap-2 w-48 justify-end">
                <SortBtn col="stock" label="Stock"/>
              </div>
              <div className="w-20 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Statut</div>
            </div>

            {loading ? (
              <div className="py-16 flex justify-center"><Spinner size="lg"/></div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={<Package size={40} className="text-gray-200"/>}
                title="Aucun produit trouvé"
                description={filterStatus !== 'all' ? 'Essayez un autre filtre' : undefined}/>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <StockRow key={p.id} product={p} onUpdate={handleUpdate}/>
                ))}
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                {filtered.length} produit{filtered.length > 1 ? 's' : ''}
                {filterStatus !== 'all' && ` (filtre actif)`}
              </div>
            )}
          </Card>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-6 text-xs text-gray-500">
            <p className="font-semibold text-gray-400 uppercase tracking-wide">Légende</p>
            {[
              { dot: 'bg-red-500',   label: 'Épuisé — bloqué en caisse' },
              { dot: 'bg-amber-500', label: 'Stock bas — badge affiché en caisse' },
              { dot: 'bg-green-500', label: 'En stock' },
              { dot: 'bg-gray-300',  label: 'Stock non géré — toujours disponible' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <div className={cn('w-2.5 h-2.5 rounded-full', l.dot)}/>
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
