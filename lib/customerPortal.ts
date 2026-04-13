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

  const totalSpend = (sales || []).reduce((s: number, v: any) => s + v.total, 0)

  return {
    customer: customer as Customer,
    sales: (sales || []) as any[],
    totalSpend,
    currentTier: getTierForSpend(totalSpend),
    nextTier: getNextTier(totalSpend),
  }
}

// ─── Register new customer (self-service) ──────────────────────
export async function registerCustomer(data: {
  name: string
  email: string
  phone: string
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
  // Fetch all customers + their sales totals in one join
  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      sales(total)
    `)
    .order('name')

  if (error) throw error

  return (data || []).map((c: any) => {
    const totalSpend = (c.sales || []).reduce((s: number, v: any) => s + (v.total || 0), 0)
    return {
      ...c,
      sales: undefined, // strip raw sales
      totalSpend,
      tier: getTierForSpend(totalSpend),
      nextTier: getNextTier(totalSpend),
    }
  })
}
