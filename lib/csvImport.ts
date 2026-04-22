// ─── Types ────────────────────────────────────────────────────
export type CsvRow = {
  // Colonnes CSV brutes
  name:       string
  reference:  string
  price:      string
  brand:      string
  discount?:  string
  stock?:     string
  stock_min?: string
}

export type ParsedProduct = {
  name:       string
  reference:  string
  price:      number
  brand:      string   // nom de marque (pas d'ID encore)
  discount:   number | null
  stock:      number | null
  stock_min:  number | null
  // État de la ligne
  rowIndex:   number
  errors:     string[]
  warnings:   string[]
  status:     'valid' | 'error' | 'duplicate' | 'warning'
}

export type ImportResult = {
  created:   number
  updated:   number
  skipped:   number
  errors:    number
  brandCreated: number
  details:   Array<{ name: string; reference: string; status: string; message?: string }>
}

// ─── CSV Template ──────────────────────────────────────────────
export const CSV_TEMPLATE_HEADERS = ['name', 'reference', 'price', 'brand', 'discount', 'stock', 'stock_min']
export const CSV_TEMPLATE_EXAMPLE = [
  ['T-shirt oversize noir', 'TSH-001', '29.90', 'Hadda Studio', '10', '5', '2'],
  ['Bracelet jonc doré',    'BRC-001', '49.90', 'Kifahari',     '',   '3', '1'],
  ['Bougie lavande 200g',   'BOU-001', '18.00', 'Maison Éphory','',   '',  '' ],
]

export function generateCsvTemplate(): string {
  const rows = [
    CSV_TEMPLATE_HEADERS,
    ...CSV_TEMPLATE_EXAMPLE,
  ]
  return rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
}

export function downloadCsvTemplate() {
  const csv = generateCsvTemplate()
  const a   = document.createElement('a')
  a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = 'ateli-import-template.csv'
  a.click()
}

// ─── CSV Parser ────────────────────────────────────────────────
function parseValue(v: string): string {
  return v.trim().replace(/^["']|["']$/g, '').trim()
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // Normalise line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = parseCsvLine(lines[0]).map(h => parseValue(h).toLowerCase())
  const rows    = lines.slice(1).map(l => parseCsvLine(l).map(v => parseValue(v)))

  return { headers, rows }
}

// ─── Validator ────────────────────────────────────────────────
export function validateRows(
  headers: string[],
  rows: string[][],
  existingRefs: Set<string>,   // références déjà en base
  existingBrands: Map<string, string>,  // name -> id
): ParsedProduct[] {
  const REQUIRED = ['name', 'reference', 'price', 'brand']
  const nameIdx = headers.indexOf('name')
  const refIdx  = headers.indexOf('reference')
  const priceIdx = headers.indexOf('price')
  const brandIdx = headers.indexOf('brand')
  const discIdx  = headers.indexOf('discount')
  const stockIdx = headers.indexOf('stock')
  const stockMinIdx = headers.indexOf('stock_min')

  const seenRefs = new Set<string>()
  const result: ParsedProduct[] = []

  rows.forEach((row, i) => {
    const get = (idx: number) => (idx >= 0 && idx < row.length ? row[idx] : '').trim()

    const name  = get(nameIdx)
    const ref   = get(refIdx).toUpperCase()
    const price = get(priceIdx).replace(',', '.')
    const brand = get(brandIdx)
    const disc  = get(discIdx).replace(',', '.')
    const stock = get(stockIdx)
    const stockMin = get(stockMinIdx)

    const errors:   string[] = []
    const warnings: string[] = []

    // Required fields
    if (!name)  errors.push('Nom manquant')
    if (!ref)   errors.push('Référence manquante')
    if (!price) errors.push('Prix manquant')
    if (!brand) errors.push('Marque manquante')

    // Price validation
    const priceNum = parseFloat(price)
    if (price && (isNaN(priceNum) || priceNum < 0)) errors.push(`Prix invalide : "${price}"`)

    // Discount validation
    let discNum: number | null = null
    if (disc) {
      discNum = parseFloat(disc)
      if (isNaN(discNum) || discNum < 0 || discNum > 100) errors.push(`Remise invalide : "${disc}" (0-100)`)
      else discNum = Math.round(discNum)
    }

    // Stock
    let stockNum: number | null = null
    let stockMinNum: number | null = null
    if (stock) {
      stockNum = parseInt(stock)
      if (isNaN(stockNum) || stockNum < 0) errors.push(`Stock invalide : "${stock}"`)
    }
    if (stockMin) {
      stockMinNum = parseInt(stockMin)
      if (isNaN(stockMinNum) || stockMinNum < 0) errors.push(`Seuil stock invalide : "${stockMin}"`)
    }

    // Duplicate ref in CSV
    if (ref && seenRefs.has(ref)) errors.push(`Référence dupliquée dans le fichier : ${ref}`)
    if (ref) seenRefs.add(ref)

    // Existing in DB
    let status: ParsedProduct['status'] = 'valid'
    if (errors.length > 0) {
      status = 'error'
    } else if (existingRefs.has(ref)) {
      status = 'duplicate'
      warnings.push(`Référence déjà existante — sera mise à jour`)
    } else {
      if (!existingBrands.has(brand.toLowerCase())) {
        warnings.push(`Nouvelle marque : "${brand}" sera créée automatiquement`)
      }
      if (warnings.length > 0) status = 'warning'
    }

    result.push({
      name, reference: ref, price: priceNum, brand, discount: discNum,
      stock: stockNum, stock_min: stockMinNum,
      rowIndex: i + 2, // 1-based + header row
      errors, warnings, status,
    })
  })

  return result
}

// ─── Importer ────────────────────────────────────────────────
export async function importProducts(
  rows: ParsedProduct[],
  existingBrands: Map<string, string>,  // name lowercase -> id
  onProgress: (done: number, total: number) => void,
): Promise<ImportResult> {
  const { createProduct, updateProduct, createBrand, getAllProducts } = await import('./supabase')

  const result: ImportResult = {
    created: 0, updated: 0, skipped: 0, errors: 0,
    brandCreated: 0, details: [],
  }

  // 1. Get all existing products for update lookup
  const allProds = (await getAllProducts()) as any[]
  const prodByRef = new Map(allProds.map(p => [p.reference, p]))

  // 2. Ensure all brands exist
  const brandMap = new Map(existingBrands)
  const uniqueBrands = [...new Set(rows.map(r => r.brand.toLowerCase()))]
  for (const bName of uniqueBrands) {
    if (!brandMap.has(bName)) {
      try {
        const created = await createBrand(
          rows.find(r => r.brand.toLowerCase() === bName)!.brand
        ) as any
        brandMap.set(bName, created.id)
        result.brandCreated++
      } catch (e: any) {
        // Brand might have been created by another row — try fetching
      }
    }
  }

  // 3. Import rows
  const validRows = rows.filter(r => r.status !== 'error')
  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i]
    onProgress(i + 1, validRows.length)

    const brandId = brandMap.get(row.brand.toLowerCase())
    if (!brandId) {
      result.errors++
      result.details.push({ name: row.name, reference: row.reference, status: 'error', message: `Marque introuvable : ${row.brand}` })
      continue
    }

    const payload = {
      name:      row.name,
      reference: row.reference,
      price:     row.price,
      discount:  row.discount,
      brand_id:  brandId,
      stock:     row.stock,
      stock_min: row.stock_min ?? 3,
    }

    try {
      const existing = prodByRef.get(row.reference)
      if (existing) {
        await updateProduct(existing.id, payload)
        result.updated++
        result.details.push({ name: row.name, reference: row.reference, status: 'updated' })
      } else {
        await createProduct(payload)
        result.created++
        result.details.push({ name: row.name, reference: row.reference, status: 'created' })
      }
    } catch (e: any) {
      result.errors++
      result.details.push({ name: row.name, reference: row.reference, status: 'error', message: e.message })
    }
  }

  return result
}
