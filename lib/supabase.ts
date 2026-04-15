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
  const normalized = code.trim().toLowerCase()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .ilike('id', `${normalized}%`)
    .maybeSingle()

  if (error) throw error
  return data
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

export async function getSellers() {
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data
}
