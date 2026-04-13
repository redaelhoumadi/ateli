'use client'

import { useState, useEffect } from 'react'
import { useCartStore } from '@/hooks/useCart'
import { getProducts, getBrands, searchProducts } from '@/lib/supabase'
import type { Product, Brand } from '@/types'

export function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const addItem = useCartStore((s) => s.addItem)

  useEffect(() => {
    getBrands().then((data) => setBrands(data || []))
  }, [])

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        if (search.trim()) {
          const data = await searchProducts(search)
          setProducts(data || [])
        } else {
          const data = await getProducts(selectedBrand || undefined)
          setProducts(data || [])
        }
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [search, selectedBrand])

  const finalPrice = (p: Product) =>
    p.discount ? p.price * (1 - p.discount / 100) : p.price

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          🔍
        </span>
        <input
          type="text"
          placeholder="Rechercher un produit ou référence..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      {/* Brand filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setSelectedBrand(null)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            selectedBrand === null
              ? 'bg-black text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
          }`}
        >
          Tous
        </button>
        {brands.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedBrand(b.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedBrand === b.id
                ? 'bg-black text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <span className="text-4xl mb-3">📦</span>
              <p className="text-sm">Aucun produit trouvé</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addItem(p)}
                  className="group bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-black hover:shadow-md transition-all active:scale-95"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {p.brand?.name}
                    </span>
                    {p.discount && (
                      <span className="text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
                        -{p.discount}%
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-2 leading-tight">
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-400 mb-3">Réf: {p.reference}</p>

                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold text-gray-900">
                      {finalPrice(p).toFixed(2)} €
                    </span>
                    {p.discount && (
                      <span className="text-xs text-gray-400 line-through">
                        {p.price.toFixed(2)} €
                      </span>
                    )}
                  </div>

                  <div className="mt-3 w-full bg-black text-white text-xs py-1.5 rounded-lg text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    + Ajouter au panier
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
