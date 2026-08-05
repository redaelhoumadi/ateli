'use client'

import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { useCartStore } from '@/hooks/useCart'
import { getProducts, getBrands, searchProducts, applyActivePromotions, optimizeImageUrl, getVariantsForProducts } from '@/lib/supabase'
import { cacheProducts, cacheBrands, getCachedProducts, getCachedBrands } from '@/lib/offlineDB'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { Input, Badge, Spinner, cn } from '@/components/ui'
import { getStockStatus } from '@/types'
import type { Product, Brand, ProductVariant } from '@/types'
import NextImage from 'next/image'

export function ProductCatalog() {
  const [products, setProducts]       = useState<Product[]>([])
  const [brands, setBrands]           = useState<Brand[]>([])
  const { isOnline }                  = useOfflineSync()
  const [variantsMap, setVariantsMap] = useState<Record<string, ProductVariant[]>>({})
  const [sizePicker, setSizePicker]   = useState<Product | null>(null)
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(false)
  const addItem = useCartStore((s) => s.addItem)

  useEffect(() => {
    if (navigator.onLine) {
      getBrands().then(d => {
        const list = (d || []) as Brand[]
        setBrands(list)
        cacheBrands(list).catch(() => {})
      })
    } else {
      getCachedBrands().then(d => setBrands((d || []) as Brand[]))
    }
  }, [isOnline])

  // Apply active promotions silently on mount — updates product discounts
  useEffect(() => {
    applyActivePromotions().catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const data = search.trim()
          ? await searchProducts(search, selectedBrand || undefined)
          : (navigator.onLine ? await getProducts(selectedBrand || undefined) : (await getCachedProducts()).filter((p:any) => !selectedBrand || p.brand_id === selectedBrand))
        setProducts(data || [])
        if (navigator.onLine && !search.trim() && !selectedBrand) {
          cacheProducts(data || []).catch(() => {})
        }
        // Charger les variantes tailles pour ces produits
        if (navigator.onLine && (data || []).length) {
          getVariantsForProducts((data || []).map((p: any) => p.id))
            .then(m => setVariantsMap(m as Record<string, ProductVariant[]>))
            .catch(() => {})
        }
      } finally { setLoading(false) }
    }, 200)
    return () => clearTimeout(t)
  }, [search, selectedBrand])

  const finalPrice = (p: Product) => p.discount ? p.price * (1 - p.discount / 100) : p.price

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3">
      {/* Search */}
      <Input
        icon={<Search size={15} />}
        placeholder="Rechercher un produit ou référence…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Brand pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[{ id: null, name: 'Tous' }, ...brands].map((b) => (
          <button
            key={b.id ?? 'all'}
            onClick={() => setSelectedBrand(b.id)}
            className={cn(
              'shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
              selectedBrand === b.id
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400 hover:text-gray-900'
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-3">
          <Search size={40} strokeWidth={1} />
          <p className="text-sm text-gray-400 font-medium">Aucun produit trouvé</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {products.map((p) => {
              const img  = optimizeImageUrl((p as any).image_url as string | null, 300)
              const price = finalPrice(p)
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    const status = getStockStatus(p)
                    if (status === 'out') return
                    const vars = variantsMap[p.id]
                    if (vars && vars.length > 0) {
                      setSizePicker(p)   // ouvrir le sélecteur de taille
                    } else {
                      addItem(p)
                    }
                  }}
                  className={cn(
                    "group bg-white rounded-2xl border text-left transition-all overflow-hidden flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900",
                    getStockStatus(p) === 'out'
                      ? "border-red-100 opacity-70 cursor-not-allowed"
                      : "border-gray-100 hover:border-gray-300 hover:shadow-md active:scale-[0.98] cursor-pointer"
                  )}
                >
                  {/* Photo */}
                  <div className="w-full aspect-square bg-gray-50 overflow-hidden relative">
                    {img ? (
                      <NextImage
                        src={img}
                        alt={p.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 160px"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        quality={75}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={32} className="text-gray-200" />
                      </div>
                    )}
                    {/* Discount badge */}
                    {p.discount && (
                      <Badge variant="destructive" className="absolute top-2 right-2 shadow-sm">
                        -{p.discount}%
                      </Badge>
                    )}
                    {/* Stock badges */}
                    {getStockStatus(p) === 'out' && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                        <span className="bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-sm">
                          Épuisé
                        </span>
                      </div>
                    )}
                    {getStockStatus(p) === 'low' && (
                      <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                        {p.stock} restant{p.stock! > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2 sm:p-3 flex-1 flex flex-col gap-0.5 sm:gap-1">
                    <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">{p.brand?.name}</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-2 leading-tight flex-1">{p.name}</p>
                    <p className="hidden sm:block text-xs text-gray-400">Réf: {p.reference}</p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-sm sm:text-base font-black text-gray-900">{price.toFixed(2)} €</span>
                      {p.discount && <span className="text-xs text-gray-400 line-through">{p.price.toFixed(2)} €</span>}
                    </div>
                  </div>

                  <div className="w-full bg-gray-900 text-white text-xs py-2 text-center font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    + Ajouter au panier
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Sélecteur de taille ── */}
      {sizePicker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSizePicker(null)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">{sizePicker.name}</p>
                <p className="text-xs text-gray-400">Choisissez une taille</p>
              </div>
              <button onClick={() => setSizePicker(null)} className="text-gray-400 hover:text-gray-700">
                <X size={18}/>
              </button>
            </div>
            <div className="p-5 grid grid-cols-3 gap-2">
              {(variantsMap[sizePicker.id] || []).map(v => {
                const basePrice = v.price ?? sizePicker.price
                const finalP = sizePicker.discount ? basePrice * (1 - sizePicker.discount / 100) : basePrice
                const out = v.stock <= 0
                return (
                  <button key={v.id} disabled={out}
                    onClick={() => { addItem(sizePicker, v); setSizePicker(null) }}
                    className={cn('flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border-2 transition-all',
                      out
                        ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-900 hover:shadow-md active:scale-[0.96]')}>
                    <span className="text-base font-black text-gray-900">{v.size}</span>
                    <span className="text-xs font-semibold text-gray-500">{finalP.toFixed(2)} €</span>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      out ? 'bg-red-50 text-red-500' :
                      v.stock <= 2 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600')}>
                      {out ? 'Épuisé' : `${v.stock} dispo`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// needed for no-unused-vars
function Package(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const { size = 24, ...rest } = props
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
    </svg>
  )
}
