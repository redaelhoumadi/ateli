'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useCartStore } from '@/hooks/useCart'
import { getProducts, getBrands, searchProducts } from '@/lib/supabase'
import { Input, Badge, Spinner, cn } from '@/components/ui'
import type { Product, Brand } from '@/types'

export function ProductCatalog() {
  const [products, setProducts]       = useState<Product[]>([])
  const [brands, setBrands]           = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(false)
  const addItem = useCartStore((s) => s.addItem)

  useEffect(() => { getBrands().then((d) => setBrands(d || [])) }, [])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const data = search.trim()
          ? await searchProducts(search, selectedBrand || undefined)
          : await getProducts(selectedBrand || undefined)
        setProducts(data || [])
      } finally { setLoading(false) }
    }, 200)
    return () => clearTimeout(t)
  }, [search, selectedBrand])

  const finalPrice = (p: Product) => p.discount ? p.price * (1 - p.discount / 100) : p.price

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">
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
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {products.map((p) => {
              const img  = (p as any).image_url as string | null
              const price = finalPrice(p)
              return (
                <button
                  key={p.id}
                  onClick={() => addItem(p)}
                  className="group bg-white rounded-2xl border border-gray-100 text-left hover:border-gray-300 hover:shadow-md transition-all active:scale-[0.98] overflow-hidden flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                >
                  {/* Photo */}
                  <div className="w-full aspect-square bg-gray-50 overflow-hidden relative">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={32} className="text-gray-200" />
                      </div>
                    )}
                    {p.discount && (
                      <Badge variant="destructive" className="absolute top-2 right-2 shadow-sm">
                        -{p.discount}%
                      </Badge>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 flex-1 flex flex-col gap-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">{p.brand?.name}</p>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight flex-1">{p.name}</p>
                    <p className="text-xs text-gray-400">Réf: {p.reference}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-base font-black text-gray-900">{price.toFixed(2)} €</span>
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
