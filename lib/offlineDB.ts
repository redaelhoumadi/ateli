'use client'

// ─── IndexedDB wrapper ────────────────────────────────────────
const DB_NAME    = 'ateli_pos_offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => { dbPromise = null; reject(req.error) }
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      // Pending sales queue
      if (!db.objectStoreNames.contains('pending_sales')) {
        const s = db.createObjectStore('pending_sales', { keyPath: 'id' })
        s.createIndex('created_at', 'created_at')
      }
      // Product catalog cache
      if (!db.objectStoreNames.contains('products_cache')) {
        db.createObjectStore('products_cache', { keyPath: 'id' })
      }
      // Brands cache
      if (!db.objectStoreNames.contains('brands_cache')) {
        db.createObjectStore('brands_cache', { keyPath: 'id' })
      }
      // Settings cache
      if (!db.objectStoreNames.contains('settings_cache')) {
        db.createObjectStore('settings_cache', { keyPath: 'key' })
      }
    }
  })
  return dbPromise
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode)
    const req = fn(t.objectStore(storeName))
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  }))
}

function getAll<T>(storeName: string): Promise<T[]> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, 'readonly')
    const req = t.objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror   = () => reject(req.error)
  }))
}

// ─── Pending sales ────────────────────────────────────────────
export type PendingSale = {
  id:             string          // UUID local généré offline
  created_at:     string
  seller_id:      string
  seller_name:    string
  customer_id:    string | null
  customer_name:  string | null
  total:          number
  total_items:    number
  payment_method: string
  note:           string | null
  items: Array<{
    product_id:  string
    name:        string
    brand_name:  string | null
    quantity:    number
    unit_price:  number
    total_price: number
  }>
  synced: boolean
  sync_error?: string | null
}

export async function addPendingSale(sale: PendingSale): Promise<void> {
  await tx('pending_sales', 'readwrite', s => s.put(sale))
}

export async function getPendingSales(): Promise<PendingSale[]> {
  return getAll<PendingSale>('pending_sales')
}

export async function markSaleSynced(id: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction('pending_sales', 'readwrite')
    const store = t.objectStore('pending_sales')
    const req = store.get(id)
    req.onsuccess = () => {
      const sale = req.result
      if (sale) { sale.synced = true; sale.sync_error = null; store.put(sale) }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function markSaleError(id: string, err: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction('pending_sales', 'readwrite')
    const store = t.objectStore('pending_sales')
    const req = store.get(id)
    req.onsuccess = () => {
      const sale = req.result
      if (sale) { sale.sync_error = err; store.put(sale) }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteSyncedSales(): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction('pending_sales', 'readwrite')
    const store = t.objectStore('pending_sales')
    const req = store.openCursor()
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result
      if (cursor) { if (cursor.value.synced) cursor.delete(); cursor.continue() }
      else resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

// ─── Product catalog cache ────────────────────────────────────
export async function cacheProducts(products: any[]): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction('products_cache', 'readwrite')
    const store = t.objectStore('products_cache')
    store.clear()
    products.forEach(p => store.put({ ...p, _cached_at: Date.now() }))
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

export async function getCachedProducts(): Promise<any[]> {
  try { return await getAll<any>('products_cache') }
  catch { return [] }
}

export async function cacheBrands(brands: any[]): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction('brands_cache', 'readwrite')
    const store = t.objectStore('brands_cache')
    store.clear()
    brands.forEach(b => store.put({ ...b, _cached_at: Date.now() }))
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

export async function getCachedBrands(): Promise<any[]> {
  try { return await getAll<any>('brands_cache') }
  catch { return [] }
}

// ─── Generate offline UUID ────────────────────────────────────
export function generateOfflineId(): string {
  // Prefix OFFLINE_ so we can identify offline-created records
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase()
  const ts   = Date.now().toString(36).toUpperCase()
  return `OFFLINE_${ts}_${rand}`
}
