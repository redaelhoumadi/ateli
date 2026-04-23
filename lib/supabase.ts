import { createClient } from '@supabase/supabase-js'

// Lazy initialization — evite le crash au build quand les env vars ne sont pas disponibles
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.')
  }
  return createClient(url, key)
}

export const supabase = (() => {
  if (typeof window === 'undefined') {
    // Server-side: return a proxy that throws on use if env vars missing
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    if (!url || !key) {
      // Return a dummy client that won't crash at import time
      return createClient('https://placeholder.supabase.co', 'placeholder') as ReturnType<typeof createClient>
    }
    return createClient(url, key)
  }
  return getSupabaseClient()
})()

// ─── Products ────────────────────────────────────────────────

// Pour le catalogue POS — uniquement les produits actifs
export async function getProducts(brandId?: string) {
  let query = supabase
    .from('products')
    .select('*, brand:brands(id, name)')
    .neq('is_active', false)
    .order('name')

  if (brandId) {
    query = query.eq('brand_id', brandId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

// Pour la page admin produits — tous les produits (actifs + archivés)
export async function getAllProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*, brand:brands(id, name)')
    .order('name')

  if (error) throw error
  return data
}

export async function searchProducts(term: string, brandId?: string) {
  let query = supabase
    .from('products')
    .select('*, brand:brands(id, name)')
    .neq('is_active', false)
    .or(`name.ilike.%${term}%,reference.ilike.%${term}%`)
    .order('name')

  if (brandId) {
    query = query.eq('brand_id', brandId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

// ─── Brands ──────────────────────────────────────────────────
export async function getBrands() {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('name')

  if (error) throw error
  return data
}

export async function updateBrandSettings(id: string, data: {
  commission_rate?: number | null
  contact_name?:   string | null
  contact_email?:  string | null
  contact_phone?:  string | null
  iban?:           string | null
  notes?:          string | null
}) {
  const { data: brand, error } = await supabase
    .from('brands')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return brand
}

// ─── Reversements ─────────────────────────────────────────────

export async function getReversements(brandId?: string) {
  let query = supabase
    .from('reversements')
    .select('*, brand:brands(id, name, commission_rate, contact_name, contact_email, iban)')
    .order('created_at', { ascending: false })

  if (brandId) query = query.eq('brand_id', brandId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createReversement(data: {
  brand_id:      string
  period_from:   string
  period_to:     string
  gross_revenue: number
  commission:    number
  net_amount:    number
  notes?:        string | null
}) {
  const { data: rev, error } = await supabase
    .from('reversements')
    .insert([{ ...data, status: 'pending' }])
    .select()
    .single()

  if (error) throw error
  return rev
}

export async function markReversementPaid(id: string, paidBy?: string) {
  const { data, error } = await supabase
    .from('reversements')
    .update({ status: 'paid', paid_at: new Date().toISOString(), paid_by: paidBy ?? null })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteReversement(id: string) {
  const { error } = await supabase.from('reversements').delete().eq('id', id)
  if (error) throw error
}

export async function getBrandStats(dateFrom?: string, dateTo?: string) {
  // Load all sales with brand info in given period
  let query = supabase
    .from('sales')
    .select('id, total, created_at, items:sale_items(quantity, unit_price, total_price, product:products(name, brand_id, brand:brands(id, name, commission_rate)))')
    .order('created_at', { ascending: false })

  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo)   query = query.lte('created_at', dateTo)

  const { data: sales, error } = await query
  if (error) throw error

  // Load brands
  const { data: brands, error: bError } = await supabase
    .from('brands')
    .select('*')
    .order('name')

  if (bError) throw bError

  // Aggregate per brand
  const statsMap = new Map<string, {
    brand: any
    gross: number; commission: number; net: number
    items: number; sales: Set<string>
    products: Map<string, { qty: number; revenue: number }>
  }>()

  ;(brands || []).forEach(b => {
    statsMap.set(b.id, {
      brand: b,
      gross: 0, commission: 0, net: 0,
      items: 0, sales: new Set(),
      products: new Map(),
    })
  })

  ;(sales || []).forEach((sale: any) => {
    ;(sale.items || []).forEach((item: any) => {
      const brand = item.product?.brand
      if (!brand) return
      const s = statsMap.get(brand.id)
      if (!s) return

      const commRate = (brand.commission_rate ?? 30) / 100
      const itemGross = item.total_price
      const itemComm  = itemGross * commRate
      const itemNet   = itemGross - itemComm

      s.gross += itemGross
      s.commission += itemComm
      s.net += itemNet
      s.items += item.quantity
      s.sales.add(sale.id)

      const prodName = item.product?.name || '—'
      const existing = s.products.get(prodName) || { qty: 0, revenue: 0 }
      existing.qty += item.quantity
      existing.revenue += itemGross
      s.products.set(prodName, existing)
    })
  })

  return Array.from(statsMap.values())
    .filter(s => s.gross > 0 || true)
    .map(s => ({
      brand: s.brand,
      gross_revenue: Math.round(s.gross * 100) / 100,
      commission_amount: Math.round(s.commission * 100) / 100,
      net_to_pay: Math.round(s.net * 100) / 100,
      items_sold: s.items,
      sales_count: s.sales.size,
      top_products: Array.from(s.products.entries())
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    }))
    .sort((a, b) => b.gross_revenue - a.gross_revenue)
}

// ─── Brand fiche complète ─────────────────────────────────────

// ─── Portail créateur (read-only via token) ───────────────────

export async function getBrandByToken(token: string) {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('portal_token', token)
    .single()
  if (error) return null
  return data
}

export async function generatePortalToken(brandId: string) {
  // Génère un token aléatoire sécurisé (48 hex chars)
  const array = new Uint8Array(24)
  crypto.getRandomValues(array)
  const token = Array.from(array).map(b => b.toString(16).padStart(2,'0')).join('')

  const { data, error } = await supabase
    .from('brands')
    .update({ portal_token: token })
    .eq('id', brandId)
    .select()
    .single()
  if (error) throw error
  return token
}

export async function getPortalStats(brandId: string) {
  // Tout le CA de la marque + breakdown par mois
  const { data: salesData, error } = await supabase
    .from('sales')
    .select('id, created_at, items:sale_items(quantity, total_price, unit_price, product:products(id, name, brand_id))')
    .order('created_at', { ascending: false })

  if (error) throw error

  const sales = (salesData || []).filter((s: any) =>
    (s.items || []).some((i: any) => i.product?.brand_id === brandId)
  )

  let grossTotal = 0, itemsTotal = 0
  const byMonth  = new Map<string, number>()
  const byProduct = new Map<string, { name: string; qty: number; revenue: number }>()
  const recentSales: { date: string; items: { name: string; qty: number; price: number }[]; total: number }[] = []

  sales.forEach((sale: any) => {
    const brandItems = (sale.items || []).filter((i: any) => i.product?.brand_id === brandId)
    if (!brandItems.length) return

    const saleRevenue = brandItems.reduce((s: number, i: any) => s + i.total_price, 0)
    grossTotal  += saleRevenue
    itemsTotal  += brandItems.reduce((s: number, i: any) => s + i.quantity, 0)

    const monthKey = sale.created_at.slice(0, 7)
    byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + saleRevenue)

    brandItems.forEach((i: any) => {
      const existing = byProduct.get(i.product.id) || { name: i.product.name, qty: 0, revenue: 0 }
      existing.qty     += i.quantity
      existing.revenue += i.total_price
      byProduct.set(i.product.id, existing)
    })

    if (recentSales.length < 20) {
      recentSales.push({
        date:  sale.created_at,
        total: saleRevenue,
        items: brandItems.map((i: any) => ({
          name:  i.product.name,
          qty:   i.quantity,
          price: i.total_price,
        })),
      })
    }
  })

  // Monthly chart — last 6 months
  const monthlyChart = []
  for (let i = 5; i >= 0; i--) {
    const d   = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toISOString().slice(0, 7)
    monthlyChart.push({
      month:   d.toLocaleDateString('fr-FR', { month: 'short' }),
      fullKey: key,
      revenue: Math.round((byMonth.get(key) || 0) * 100) / 100,
    })
  }

  return {
    gross:       Math.round(grossTotal * 100) / 100,
    items:       itemsTotal,
    salesCount:  sales.length,
    avgTicket:   sales.length ? Math.round((grossTotal / sales.length) * 100) / 100 : 0,
    monthlyChart,
    topProducts: Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    recentSales,
  }
}


export async function getBrandById(id: string) {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function updateBrandFull(id: string, data: Partial<{
  name:            string
  description:     string | null
  logo_url:        string | null
  website:         string | null
  instagram:       string | null
  category:        string | null
  join_date:       string | null
  contract_end:    string | null
  is_active:       boolean
  commission_rate: number | null
  contact_name:    string | null
  contact_email:   string | null
  contact_phone:   string | null
  iban:            string | null
  notes:           string | null
}>) {
  const { data: brand, error } = await supabase
    .from('brands')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return brand
}

export async function getBrandSalesHistory(brandId: string, months = 6) {
  // Get monthly revenue for a specific brand over the last N months
  const from = new Date()
  from.setMonth(from.getMonth() - months)

  const { data, error } = await supabase
    .from('sales')
    .select('created_at, total, items:sale_items(total_price, product:products(brand_id))')
    .gte('created_at', from.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw error

  // Aggregate by month for this brand
  const monthly = new Map<string, number>()
  ;(data || []).forEach((sale: any) => {
    const hasBrand = (sale.items || []).some((i: any) => i.product?.brand_id === brandId)
    if (!hasBrand) return
    const key = sale.created_at.slice(0, 7) // YYYY-MM
    const brandRevenue = (sale.items || [])
      .filter((i: any) => i.product?.brand_id === brandId)
      .reduce((s: number, i: any) => s + i.total_price, 0)
    monthly.set(key, (monthly.get(key) || 0) + brandRevenue)
  })

  // Fill missing months with 0
  const result = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toISOString().slice(0, 7)
    result.push({
      month: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      key,
      revenue: Math.round((monthly.get(key) || 0) * 100) / 100,
    })
  }
  return result
}

// ─── Top produits & tendances ─────────────────────────────────

export async function getTopProducts(options: {
  dateFrom?: string
  dateTo?:   string
  limit?:    number
  brandId?:  string
} = {}) {
  const { dateFrom, dateTo, limit = 20, brandId } = options

  let query = supabase
    .from('sale_items')
    .select(`
      quantity,
      total_price,
      unit_price,
      product:products(
        id, name, reference, price, image_url,
        brand:brands(id, name)
      ),
      sale:sales(created_at)
    `)

  if (dateFrom) query = (query as any).gte('sale.created_at', dateFrom)
  if (dateTo)   query = (query as any).lte('sale.created_at', dateTo)

  const { data, error } = await query
  if (error) throw error

  // Aggregate by product
  const map = new Map<string, {
    product: any
    qty: number
    revenue: number
    orders: number
  }>()

  ;(data || []).forEach((item: any) => {
    const p = item.product
    if (!p) return
    if (brandId && p.brand?.id !== brandId) return
    const ex = map.get(p.id) || { product: p, qty: 0, revenue: 0, orders: 0 }
    ex.qty     += item.quantity
    ex.revenue += item.total_price
    ex.orders  += 1
    map.set(p.id, ex)
  })

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

export async function getTrendingProducts(options: {
  currentFrom:  string
  currentTo:    string
  previousFrom: string
  previousTo:   string
  limit?:       number
} = {
  currentFrom:  new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
  currentTo:    new Date().toISOString(),
  previousFrom: new Date(new Date().setDate(new Date().getDate() - 60)).toISOString(),
  previousTo:   new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
  limit:        10,
}) {
  const { currentFrom, currentTo, previousFrom, previousTo, limit = 10 } = options

  // Fetch both periods in parallel
  const [currentData, previousData] = await Promise.all([
    getTopProducts({ dateFrom: currentFrom, dateTo: currentTo, limit: 100 }),
    getTopProducts({ dateFrom: previousFrom, dateTo: previousTo, limit: 100 }),
  ])

  const previousMap = new Map(previousData.map(p => [p.product.id, p]))

  // Compare and compute growth
  const trends = currentData.map(curr => {
    const prev  = previousMap.get(curr.product.id)
    const prevRevenue = prev?.revenue ?? 0
    const growth = prevRevenue > 0
      ? ((curr.revenue - prevRevenue) / prevRevenue) * 100
      : curr.revenue > 0 ? 100 : 0
    return { ...curr, prevRevenue, growth, isNew: !prev }
  })

  // Also find declining products (in previous but not in current or much less)
  const currentIds = new Set(currentData.map(p => p.product.id))
  const declining  = previousData
    .filter(p => !currentIds.has(p.product.id) || (previousMap.get(p.product.id)?.revenue ?? 0) > 0)
    .map(prev => {
      const curr = currentData.find(c => c.product.id === prev.product.id)
      const growth = curr
        ? ((curr.revenue - prev.revenue) / prev.revenue) * 100
        : -100
      return { ...prev, prevRevenue: prev.revenue, revenue: curr?.revenue ?? 0, qty: curr?.qty ?? 0, growth, isNew: false }
    })
    .filter(p => p.growth < -20)
    .sort((a, b) => a.growth - b.growth)
    .slice(0, 5)

  return {
    rising:   trends.filter(t => t.growth >  20).sort((a, b) => b.growth - a.growth).slice(0, limit),
    stable:   trends.filter(t => t.growth >= -20 && t.growth <= 20).sort((a, b) => b.revenue - a.revenue).slice(0, limit),
    declining,
    newProducts: trends.filter(t => t.isNew).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  }
}

export async function getProductSalesHistory(productId: string, weeks = 8) {
  const from = new Date()
  from.setDate(from.getDate() - weeks * 7)

  const { data, error } = await supabase
    .from('sale_items')
    .select('quantity, total_price, sale:sales(created_at)')
    .eq('product_id', productId)
    .gte('sale.created_at', from.toISOString())

  if (error) throw error

  // Group by week
  const byWeek = new Map<string, { qty: number; revenue: number }>()
  ;(data || []).forEach((item: any) => {
    if (!item.sale?.created_at) return
    const d    = new Date(item.sale.created_at)
    const week = `S${Math.floor((d.getTime() - from.getTime()) / (7 * 24 * 3600 * 1000))}`
    const ex   = byWeek.get(week) || { qty: 0, revenue: 0 }
    ex.qty     += item.quantity
    ex.revenue += item.total_price
    byWeek.set(week, ex)
  })

  return Array.from({ length: weeks }, (_, i) => ({
    week: `S${i + 1}`,
    qty:     byWeek.get(`S${i}`)?.qty     ?? 0,
    revenue: byWeek.get(`S${i}`)?.revenue ?? 0,
  }))
}


export async function getProductsByBrand(brandId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('brand_id', brandId)
    .order('name')
  if (error) throw error
  return data
}

export async function uploadBrandLogo(brandId: string, file: File): Promise<string> {
  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `brand-logos/${brandId}.${ext}`
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return `${url}/storage/v1/object/public/product-images/${path}`
}


export async function createBrand(name: string) {
  const { data, error } = await supabase
    .from('brands')
    .insert([{ name }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateBrand(id: string, name: string) {
  const { data, error } = await supabase
    .from('brands')
    .update({ name })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteBrand(id: string) {
  const { error } = await supabase.from('brands').delete().eq('id', id)
  if (error) throw error
}

// ─── Product CRUD ─────────────────────────────────────────────
export async function createProduct(data: {
  name: string
  reference: string
  price: number
  discount: number | null
  brand_id: string
  image_url?: string | null
}) {
  const { data: product, error } = await supabase
    .from('products')
    .insert([data])
    .select('*, brand:brands(id, name)')
    .single()

  if (error) throw error
  return product
}

export async function updateProduct(
  id: string,
  data: {
    name: string
    reference: string
    price: number
    discount: number | null
    brand_id: string
    image_url?: string | null
  }
) {
  const { data: product, error } = await supabase
    .from('products')
    .update(data)
    .eq('id', id)
    .select('*, brand:brands(id, name)')
    .single()

  if (error) throw error
  return product
}

// Vérifie si un produit a des ventes associées
export async function productHasSales(id: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('sale_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', id)

  if (error) throw error
  return (count ?? 0) > 0
}

// Suppression physique (seulement si aucune vente liée)
export async function deleteProduct(id: string) {
  const hasSales = await productHasSales(id)
  if (hasSales) {
    throw new Error('LINKED')
  }
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

// Archivage soft (is_active = false) — préserve l'historique des ventes
export async function archiveProduct(id: string) {
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

// Réactiver un produit archivé
export async function restoreProduct(id: string) {
  const { error } = await supabase
    .from('products')
    .update({ is_active: true })
    .eq('id', id)
  if (error) throw error
}


// ─── Stock ───────────────────────────────────────────────────

export async function updateStock(productId: string, stock: number | null) {
  const { data, error } = await supabase
    .from('products')
    .update({ stock })
    .eq('id', productId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStockMin(productId: string, stockMin: number) {
  const { data, error } = await supabase
    .from('products')
    .update({ stock_min: stockMin })
    .eq('id', productId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getLowStockProducts() {
  // Produits actifs avec stock défini et stock <= stock_min
  const { data, error } = await supabase
    .from('products')
    .select('*, brand:brands(id, name)')
    .not('stock', 'is', null)
    .neq('is_active', false)
    .order('stock', { ascending: true })
  if (error) throw error
  // Filter client-side since Supabase can't do column comparisons directly
  return (data || []).filter((p: any) => p.stock <= (p.stock_min ?? 3))
}

export async function checkStockAvailability(items: Array<{ product_id: string; quantity: number }>) {
  // Returns list of products with insufficient stock
  const ids = items.map(i => i.product_id)
  const { data, error } = await supabase
    .from('products')
    .select('id, name, stock, stock_min')
    .in('id', ids)
    .not('stock', 'is', null)
  if (error) throw error

  const insufficient: { name: string; available: number; requested: number }[] = []
  ;(data || []).forEach((p: any) => {
    const item = items.find(i => i.product_id === p.id)
    if (item && p.stock < item.quantity) {
      insufficient.push({ name: p.name, available: p.stock, requested: item.quantity })
    }
  })
  return insufficient
}

export async function getStockStats() {
  const { data, error } = await supabase
    .from('products')
    .select('*, brand:brands(id, name)')
    .neq('is_active', false)
    .not('stock', 'is', null)
    .order('stock', { ascending: true })
  if (error) throw error

  const products = (data || []) as any[]
  const out      = products.filter(p => p.stock === 0)
  const low      = products.filter(p => p.stock > 0 && p.stock <= (p.stock_min ?? 3))
  const ok       = products.filter(p => p.stock > (p.stock_min ?? 3))
  const totalVal = products.reduce((s: number, p: any) => s + (p.stock ?? 0) * p.price, 0)

  return { all: products, out, low, ok, totalVal }
}


// ─── Product images (Supabase Storage) ───────────────────────
const BUCKET = 'product-images'

export function getProductImageUrl(path: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`
}

export async function uploadProductImage(
  productId: string,
  file: File
): Promise<string> {
  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${productId}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw error
  return getProductImageUrl(path)
}

export async function deleteProductImage(imageUrl: string): Promise<void> {
  // Extract path from full URL
  const parts = imageUrl.split(`/${BUCKET}/`)
  if (parts.length < 2) return
  const path = parts[1]
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

// ─── Customers ───────────────────────────────────────────────
export async function getCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name')

  if (error) throw error
  return data
}

// ─── Bons cadeaux ─────────────────────────────────────────────

function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'GC-'
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-'
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code // ex: GC-ABCD-EFGH
}

export async function createGiftCard(data: {
  initial_amount: number
  customer_name?:  string | null
  customer_email?: string | null
  message?:        string | null
  created_by?:     string | null
  expires_at?:     string | null
}) {
  let code = generateGiftCardCode()
  // En cas de collision (rare), regénérer
  let attempts = 0
  while (attempts < 5) {
    const { data: existing } = await supabase.from('gift_cards').select('id').eq('code', code).maybeSingle()
    if (!existing) break
    code = generateGiftCardCode()
    attempts++
  }
  const { data: card, error } = await supabase
    .from('gift_cards')
    .insert([{ ...data, code, balance: data.initial_amount, status: 'active' }])
    .select()
    .single()
  if (error) throw error
  return card
}

export async function getGiftCards(status?: string) {
  let query = supabase
    .from('gift_cards')
    .select('*')
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getGiftCardByCode(code: string) {
  const { data, error } = await supabase
    .from('gift_cards')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getGiftCardTransactions(giftCardId: string) {
  const { data, error } = await supabase
    .from('gift_card_transactions')
    .select('*')
    .eq('gift_card_id', giftCardId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function useGiftCard(data: {
  gift_card_id: string
  sale_id?:     string | null
  amount:       number
  note?:        string | null
}) {
  // 1. Récupérer le bon
  const { data: card, error: fetchErr } = await supabase
    .from('gift_cards')
    .select('*')
    .eq('id', data.gift_card_id)
    .single()
  if (fetchErr || !card) throw new Error('Bon cadeau introuvable')
  if (card.status !== 'active') throw new Error('Ce bon cadeau est déjà utilisé ou annulé')
  if (card.balance < data.amount) throw new Error(`Solde insuffisant (${card.balance.toFixed(2)} €)`)

  // 2. Calculer le nouveau solde
  const newBalance = Math.round((card.balance - data.amount) * 100) / 100
  const newStatus  = newBalance <= 0 ? 'used' : 'active'

  // 3. Mettre à jour le bon
  const { error: updateErr } = await supabase
    .from('gift_cards')
    .update({ balance: newBalance, status: newStatus })
    .eq('id', data.gift_card_id)
  if (updateErr) throw updateErr

  // 4. Créer la transaction
  const { data: tx, error: txErr } = await supabase
    .from('gift_card_transactions')
    .insert([{
      gift_card_id: data.gift_card_id,
      sale_id:      data.sale_id ?? null,
      amount:       data.amount,
      balance_after: newBalance,
      type:         'debit',
      note:         data.note ?? null,
    }])
    .select()
    .single()
  if (txErr) throw txErr

  return { balanceAfter: newBalance, status: newStatus, transaction: tx }
}

export async function cancelGiftCard(id: string) {
  const { data, error } = await supabase
    .from('gift_cards')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getGiftCardStats() {
  const { data, error } = await supabase
    .from('gift_cards')
    .select('*')
  if (error) throw error
  const all = data || []
  return {
    total:     all.length,
    active:    all.filter(c => c.status === 'active').length,
    used:      all.filter(c => c.status === 'used').length,
    cancelled: all.filter(c => c.status === 'cancelled').length,
    totalIssued:  all.reduce((s: number, c: any) => s + c.initial_amount, 0),
    totalBalance: all.filter((c: any) => c.status === 'active').reduce((s: number, c: any) => s + c.balance, 0),
    totalUsed:    all.reduce((s: number, c: any) => s + (c.initial_amount - c.balance), 0),
  }
}


export async function searchCustomers(term: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
    .order('name')

  if (error) throw error
  return data
}

// Code court affiché dans l'espace client : les 8 premiers chars de l'UUID en majuscule
// ex. "B51A3ECA" → id commence par "b51a3eca-..."
export async function searchCustomerByCode(code: string) {
  // Le code client = les 8 premiers caractères de l'UUID (sans tirets, insensible à la casse)
  // UUID format: b51a3eca-ea76-4b77-9fc8-c47f99c62575
  // Code affiché: B51A3ECA → correspond au début de l'UUID
  const normalized = code.trim().toLowerCase()

  // On récupère tous les clients et on filtre côté JS sur les 8 premiers chars
  // car ilike sur UUID peut être instable selon les versions Postgres/Supabase
  const { data, error } = await supabase
    .from('customers')
    .select('*')

  if (error) throw error
  if (!data) return null

  // Comparer les 8 premiers caractères de l'UUID (en ignorant les tirets si présents)
  const found = data.find(c => {
    const prefix = c.id.replace(/-/g, '').slice(0, 8).toLowerCase()
    return prefix === normalized
  })

  return found ?? null
}

export async function createCustomer(data: {
  name: string
  email: string
  phone: string
}) {
  const { data: customer, error } = await supabase
    .from('customers')
    .insert([{ ...data, points: 0 }])
    .select()
    .single()

  if (error) throw error
  return customer
}

export async function updateCustomerPoints(customerId: string, pointsDelta: number) {
  const { data: customer, error: fetchError } = await supabase
    .from('customers')
    .select('points')
    .eq('id', customerId)
    .single()

  if (fetchError) throw fetchError

  const { error } = await supabase
    .from('customers')
    .update({ points: Math.max(0, customer.points + pointsDelta) })
    .eq('id', customerId)

  if (error) throw error
}

// ─── Sales ───────────────────────────────────────────────────
export async function createSale(sale: {
  customer_id: string | null
  seller_id: string
  total: number
  total_items: number
  points_earned: number
  points_used: number
  payment_method: string
  note?: string | null
  items: Array<{
    product_id: string
    quantity: number
    unit_price: number
    total_price: number
  }>
}) {
  const { items, ...saleData } = sale

  const { data: newSale, error: saleError } = await supabase
    .from('sales')
    .insert([saleData])
    .select()
    .single()

  if (saleError) throw saleError

  const saleItems = items.map((item) => ({
    ...item,
    sale_id: newSale.id,
  }))

  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(saleItems)

  if (itemsError) throw itemsError

  // Update customer points if customer exists
  if (sale.customer_id) {
    const pointsDelta = sale.points_earned - sale.points_used
    await updateCustomerPoints(sale.customer_id, pointsDelta)
  }

  return newSale
}

export async function getSalesStats(dateFrom?: string, dateTo?: string) {
  let query = supabase
    .from('sales')
    .select('*, customer:customers(name), seller:sellers(name), items:sale_items(*, product:products(name, brand:brands(name)))')
    .order('created_at', { ascending: false })

  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)

  const { data, error } = await query
  if (error) throw error
  return data
}


// ─── Today's sales (for POS history panel) ───────────────────
export async function getTodaySales(sellerId?: string) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let query = supabase
    .from('sales')
    .select('*, customer:customers(name), seller:sellers(name), items:sale_items(*, product:products(name, brand:brands(name)))')
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false })

  if (sellerId) query = query.eq('seller_id', sellerId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function cancelSale(saleId: string) {
  // The DB trigger trg_restore_stock will automatically re-increment
  // stock when sale_items rows are deleted.
  // Delete sale items first
  const { error: itemsError } = await supabase
    .from('sale_items')
    .delete()
    .eq('sale_id', saleId)

  if (itemsError) throw itemsError

  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('id', saleId)

  if (error) throw error
}

// ─── Clôtures de caisse ───────────────────────────────────────

export async function getClotures(limit = 30) {
  const { data, error } = await supabase
    .from('clotures')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getCloturByDate(date: string) {
  const { data, error } = await supabase
    .from('clotures')
    .select('*')
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createCloture(data: {
  date: string
  opened_by?: string | null
  closed_by?: string | null
  total_card: number
  total_cash: number
  total_mixed: number
  total_revenue: number
  sales_count: number
  items_count: number
  customers_with_account: number
  fund_opening?: number | null
  fund_closing?: number | null
  fund_expected?: number | null
  fund_gap?: number | null
  notes?: string | null
}) {
  const { data: cloture, error } = await supabase
    .from('clotures')
    .upsert([{ ...data, closed_at: new Date().toISOString() }], { onConflict: 'date' })
    .select()
    .single()
  if (error) throw error
  return cloture
}

export async function getSalesByDate(date: string) {
  const dayStart = new Date(date + 'T00:00:00').toISOString()
  const dayEnd   = new Date(date + 'T23:59:59').toISOString()

  const { data, error } = await supabase
    .from('sales')
    .select('*, customer:customers(name), seller:sellers(name), items:sale_items(quantity, unit_price, total_price, product:products(name, brand:brands(name)))')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}


// ─── Settings ─────────────────────────────────────────────────

// ─── Objectifs de vente ───────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ─── Retours / Remboursements ─────────────────────────────────

export async function createReturn(data: {
  sale_id:       string
  seller_id?:    string | null
  reason?:       string | null
  refund_method: 'cash' | 'card' | 'gift_card' | 'store_credit'
  total_refund:  number
  items:         Array<{ product_id: string; name: string; qty: number; unit_price: number; refund_amount: number }>
}) {
  const { data: ret, error } = await supabase
    .from('returns')
    .insert([data])
    .select()
    .single()
  if (error) throw error

  // Restore stock for returned items
  for (const item of data.items) {
    try { await supabase.rpc('restore_stock_manual', { p_product_id: item.product_id, p_qty: item.qty }) } catch { /* best-effort */ }
  }

  return ret
}

export async function getReturnsBySale(saleId: string) {
  const { data, error } = await supabase
    .from('returns')
    .select('*')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getSaleWithItems(saleId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('*, customer:customers(name), seller:sellers(name), items:sale_items(*, product:products(id, name, price, brand:brands(name)))')
    .eq('id', saleId)
    .single()
  if (error) throw error
  return data
}

// ─── Client enrichi ───────────────────────────────────────────

export async function updateCustomerProfile(id: string, data: Partial<{
  name:      string
  email:     string
  phone:     string
  notes:     string | null
  birthday:  string | null
  address:   string | null
  instagram: string | null
  tags:      string[]
}>) {
  const { data: customer, error } = await supabase
    .from('customers')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return customer
}

export async function getCustomerSales(customerId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('*, items:sale_items(quantity, total_price, product:products(name, brand:brands(name)))')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data
}

// ─── Export comptable ─────────────────────────────────────────

export async function getSalesForExport(dateFrom: string, dateTo: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('*, customer:customers(name, email), seller:sellers(name), items:sale_items(quantity, unit_price, total_price, product:products(name, reference, brand:brands(name, commission_rate)))')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}


export async function getSalesGoals(periodType?: string) {
  let query = supabase
    .from('sales_goals')
    .select('*')
    .order('target_date', { ascending: false })
  if (periodType) query = query.eq('period_type', periodType)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function upsertSalesGoal(data: {
  period_type: 'day' | 'week' | 'month'
  target_date: string
  amount: number
  brand_id?: string | null
  note?: string | null
}) {
  const { data: goal, error } = await supabase
    .from('sales_goals')
    .upsert([{ ...data, updated_at: new Date().toISOString() }], {
      onConflict: 'period_type,target_date,brand_id',
    })
    .select()
    .single()
  if (error) throw error
  return goal
}

export async function deleteSalesGoal(id: string) {
  const { error } = await supabase.from('sales_goals').delete().eq('id', id)
  if (error) throw error
}

export async function getGoalProgress(periodType: 'day' | 'week' | 'month', referenceDate: Date = new Date()) {
  // 1. Get goal for this period
  let targetDate: string
  let dateFrom: string
  let dateTo:   string

  if (periodType === 'day') {
    const d = new Date(referenceDate)
    d.setHours(0, 0, 0, 0)
    targetDate = toISODate(d)
    dateFrom   = d.toISOString()
    const end  = new Date(d); end.setHours(23, 59, 59, 999)
    dateTo     = end.toISOString()
  } else if (periodType === 'week') {
    const start = getWeekStart(referenceDate)
    targetDate  = toISODate(start)
    dateFrom    = start.toISOString()
    const end   = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999)
    dateTo      = end.toISOString()
  } else {
    const start = getMonthStart(referenceDate)
    targetDate  = toISODate(start)
    dateFrom    = start.toISOString()
    const end   = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999)
    dateTo      = end.toISOString()
  }

  const [goalData, salesData] = await Promise.all([
    supabase.from('sales_goals').select('*').eq('period_type', periodType).eq('target_date', targetDate).is('brand_id', null).maybeSingle(),
    supabase.from('sales').select('total').gte('created_at', dateFrom).lte('created_at', dateTo),
  ])

  if (!goalData.data) return null

  const achieved = (salesData.data || []).reduce((s: number, sale: any) => s + sale.total, 0)
  const goal = goalData.data
  const pct  = goal.amount > 0 ? Math.round((achieved / goal.amount) * 100) : 0
  const remaining = Math.max(0, goal.amount - achieved)

  // Status based on time elapsed in period
  const now = new Date()
  let elapsed = 0
  if (periodType === 'day') {
    elapsed = (now.getHours() * 60 + now.getMinutes()) / (10 * 60) // 10h shop day
  } else if (periodType === 'week') {
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
    elapsed = Math.min(1, (dayOfWeek - 1) / 6)
  } else {
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    elapsed = (now.getDate() - 1) / totalDays
  }

  let status: 'ahead' | 'on_track' | 'at_risk' | 'missed' | 'exceeded'
  if (pct >= 100)              status = 'exceeded'
  else if (elapsed >= 0.95)    status = pct >= 80 ? 'on_track' : 'missed'
  else if (pct >= elapsed * 100 + 10) status = 'ahead'
  else if (pct >= elapsed * 100 - 15) status = 'on_track'
  else                         status = 'at_risk'

  return { goal, achieved: Math.round(achieved * 100) / 100, pct, remaining, status }
}

export async function getAllGoalProgress(referenceDate: Date = new Date()) {
  const [day, week, month] = await Promise.all([
    getGoalProgress('day', referenceDate),
    getGoalProgress('week', referenceDate),
    getGoalProgress('month', referenceDate),
  ])
  return { day, week, month }
}


export async function getSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('settings').select('key, value')
  if (error) throw error
  return Object.fromEntries((data || []).map(r => [r.key, r.value]))
}

export async function updateSettings(updates: Record<string, string>) {
  const rows = Object.entries(updates).map(([key, value]) => ({
    key, value, updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase
    .from('settings')
    .upsert(rows, { onConflict: 'key' })
  if (error) throw error
}

// ─── Sellers CRUD ─────────────────────────────────────────────

// ─── Auth par PIN ─────────────────────────────────────────────

export async function getSellersForLogin() {
  // Charge tous les vendeurs actifs avec leur PIN (pour l'écran de connexion)
  const { data, error } = await supabase
    .from('sellers')
    .select('id, name, role, pin, is_active')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data
}

export async function updateSellerPin(id: string, pin: string | null) {
  const { data, error } = await supabase
    .from('sellers')
    .update({ pin, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}


export async function getAllSellers() {
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function createSeller(data: {
  name: string; email?: string | null; phone?: string | null; role?: string
}) {
  const { data: seller, error } = await supabase
    .from('sellers')
    .insert([{ ...data, is_active: true, role: data.role || 'seller' }])
    .select().single()
  if (error) throw error
  return seller
}

export async function updateSeller(id: string, data: {
  name?: string; email?: string | null; phone?: string | null
  role?: string; is_active?: boolean
}) {
  const { data: seller, error } = await supabase
    .from('sellers').update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return seller
}

export async function deleteSeller(id: string) {
  const { error } = await supabase.from('sellers').delete().eq('id', id)
  if (error) throw error
}


export async function getSellers() {
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data
}
