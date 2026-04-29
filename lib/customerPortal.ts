import { supabase } from './supabase'
import type { Customer, Sale } from '@/types'

// ─── Rewards tiers ─────────────────────────────────────────────
export const REWARDS_TIERS = [
  {
    id: 'bronze',
    label: 'Bronze',
    minSpend: 0,
    discount: 0,
    color: '#CD7F32',
    bg: '#FDF3E7',
    nextLabel: null,
  },
  {
    id: 'silver',
    label: 'Argent',
    minSpend: 150,
    discount: 5,
    color: '#9E9E9E',
    bg: '#F5F5F5',
    nextLabel: 'Argent — 5% de réduction',
  },
  {
    id: 'gold',
    label: 'Or',
    minSpend: 300,
    discount: 10,
    color: '#D4AF37',
    bg: '#FFFBEA',
    nextLabel: 'Or — 10% de réduction',
  },
  {
    id: 'vip',
    label: 'VIP',
    minSpend: 600,
    discount: 15,
    color: '#7C3AED',
    bg: '#F5F3FF',
    nextLabel: 'VIP — 15% de réduction',
  },
]

export function getTierForSpend(totalSpend: number) {
  let tier = REWARDS_TIERS[0]
  for (const t of REWARDS_TIERS) {
    if (totalSpend >= t.minSpend) tier = t
  }
  return tier
}

export function getNextTier(totalSpend: number) {
  for (const t of REWARDS_TIERS) {
    if (totalSpend < t.minSpend) return t
  }
  return null // already at VIP
}

// ─── Find customer by email or phone ───────────────────────────
export async function findCustomerByContact(value: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .or(`email.ilike.${value.trim()},phone.eq.${value.trim()}`)
    .maybeSingle()

  if (error) throw error
  return data as Customer | null
}

// ─── Get customer with full history ────────────────────────────
export async function getCustomerWithHistory(customerId: string) {
  const [{ data: customer, error: ce }, { data: sales, error: se }] =
    await Promise.all([
      supabase.from('customers').select('*').eq('id', customerId).single(),
      supabase
        .from('sales')
        .select(
          `id, total, total_items, points_earned, points_used, payment_method, created_at,
           items:sale_items(quantity, unit_price, total_price, product:products(name, brand:brands(name)))`
        )
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

  if (ce) throw ce
  if (se) throw se

  // Déduire les retours pour le bon calcul du palier fidélité
  const saleIds = (sales || []).map((s: any) => s.id)
  let totalRefund = 0
  if (saleIds.length > 0) {
    const { data: returns } = await supabase
      .from('returns')
      .select('total_refund')
      .in('sale_id', saleIds)
    totalRefund = (returns || []).reduce((s: number, r: any) => s + r.total_refund, 0)
  }

  const grossSpend = (sales || []).reduce((s: number, v: any) => s + v.total, 0)
  const totalSpend = Math.max(0, grossSpend - totalRefund)

  // Also expose the returns list for display
  const { data: returnsList } = saleIds.length > 0
    ? await supabase.from('returns').select('*').in('sale_id', saleIds).order('created_at', { ascending: false })
    : { data: [] }

  return {
    customer: customer as Customer,
    sales: (sales || []) as any[],
    returns: (returnsList || []) as any[],
    totalSpend,
    currentTier: getTierForSpend(totalSpend),
    nextTier:    getNextTier(totalSpend),
  }
}

// ─── Register new customer (self-service) ──────────────────────
export async function registerCustomer(data: {
  name:              string
  email:             string
  phone:             string
  sendWelcomeEmail?: boolean  // défaut true si email présent
}) {
  // Check email uniqueness
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .ilike('email', data.email.trim())
    .maybeSingle()

  if (existing) throw new Error('Un compte existe déjà avec cet email.')

  const { data: customer, error } = await supabase
    .from('customers')
    .insert([{ name: data.name.trim(), email: data.email.trim().toLowerCase(), phone: data.phone.trim(), points: 0 }])
    .select()
    .single()

  if (error) throw error

  // Envoyer l'email de bienvenue si activé (ne bloque pas la création en cas d'échec)
  const shouldSend = data.sendWelcomeEmail !== false && data.email.trim()
  if (shouldSend && typeof window !== 'undefined') {
    try {
      // Récupérer les settings boutique pour personnaliser l'email
      const { getSettings } = await import('./supabase')
      const settings = (await getSettings().catch(() => ({}))) as Record<string, string>
      const emailEnabled = settings['email_welcome_enabled'] !== 'false'

      if (emailEnabled) {
        const { sendWelcomeEmail } = await import('./emailSender')
        sendWelcomeEmail({
          customerName:  (customer as Customer).name,
          customerEmail: (customer as Customer).email,
          customerId:    (customer as Customer).id,
          shopName:      settings['shop_name']    || 'Ateli',
          shopEmail:     settings['shop_email']   || '',
          shopAddress:   settings['shop_address'] || '',
          fromEmail:     settings['email_from']   || undefined,
        }).catch(err => console.warn('[welcome email]', err))
        // Fire-and-forget — ne bloque pas la création du compte
      }
    } catch (err) {
      console.warn('[welcome email setup]', err)
    }
  }

  return customer as Customer
}

// ─── Persist session in localStorage (client-side only) ────────
export const SESSION_KEY = 'ateli_customer_id'

export function saveSession(customerId: string) {
  if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, customerId)
}

export function loadSession(): string | null {
  if (typeof window !== 'undefined') return localStorage.getItem(SESSION_KEY)
  return null
}

export function clearSession() {
  if (typeof window !== 'undefined') localStorage.removeItem(SESSION_KEY)
}

// ─── All customers with their total spend (for admin page) ─────
export async function getCustomersWithSpend() {
  // Fetch customers + sales + returns in parallel
  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      sales(id, total)
    `)
    .order('name')

  if (error) throw error

  // Fetch all returns once, grouped by sale_id
  const saleIds = (data || []).flatMap((c: any) => (c.sales || []).map((s: any) => s.id))
  let returnsBySaleId: Record<string, number> = {}

  if (saleIds.length > 0) {
    const { data: returns } = await supabase
      .from('returns')
      .select('sale_id, total_refund')
      .in('sale_id', saleIds)

    for (const r of returns || []) {
      returnsBySaleId[r.sale_id] = (returnsBySaleId[r.sale_id] || 0) + r.total_refund
    }
  }

  return (data || []).map((c: any) => {
    const grossSpend  = (c.sales || []).reduce((s: number, v: any) => s + (v.total || 0), 0)
    const totalRefund = (c.sales || []).reduce((s: number, v: any) => s + (returnsBySaleId[v.id] || 0), 0)
    const totalSpend  = Math.max(0, grossSpend - totalRefund)
    return {
      ...c,
      sales: undefined,
      totalSpend,
      tier:     getTierForSpend(totalSpend),
      nextTier: getNextTier(totalSpend),
    }
  })
}
