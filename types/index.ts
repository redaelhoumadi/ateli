export type Brand = {
  id: string
  name: string
  commission_rate: number | null
  contact_name:    string | null
  contact_email:   string | null
  contact_phone:   string | null
  iban:            string | null
  notes:           string | null
  // Fiche marque
  description:     string | null
  logo_url:        string | null
  website:         string | null
  instagram:       string | null
  category:        string | null
  join_date:       string | null
  contract_end:    string | null
  is_active:       boolean
  portal_token:    string | null
  created_at: string
}

export type Reversement = {
  id: string
  brand_id: string
  period_from: string
  period_to: string
  gross_revenue: number
  commission: number
  net_amount: number
  status: 'pending' | 'paid'
  paid_at: string | null
  paid_by: string | null
  notes: string | null
  created_at: string
  brand?: Brand
}

export type BrandStats = {
  brand: Brand
  gross_revenue: number
  commission_amount: number
  net_to_pay: number
  items_sold: number
  sales_count: number
  top_products: { name: string; qty: number; revenue: number }[]
}

export type Product = {
  id: string
  name: string
  reference: string
  price: number
  discount: number | null
  brand_id: string
  image_url: string | null
  is_active: boolean
  created_at: string
  brand?: Brand
}

export type Customer = {
  id: string
  name: string
  email: string
  phone: string
  points: number
  created_at: string
}

export type Seller = {
  id: string
  name: string
  email: string
  phone: string
  role: 'seller' | 'manager'
  pin: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Sale = {
  id: string
  customer_id: string | null
  seller_id: string
  total: number
  total_items: number
  points_earned: number
  points_used: number
  payment_method: string
  created_at: string
  customer?: Customer
  seller?: Seller
  items?: SaleItem[]
}

export type SaleItem = {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
  created_at: string
  product?: Product
}

export type CartItem = {
  product: Product
  quantity: number
  unit_price: number
  total_price: number
}

export type PaymentMethod = 'cash' | 'card' | 'points' | 'mixed'

export type Cloture = {
  id: string
  date: string
  opened_by: string | null
  closed_by: string | null
  total_card: number
  total_cash: number
  total_mixed: number
  total_revenue: number
  sales_count: number
  items_count: number
  customers_with_account: number
  fund_opening: number | null
  fund_closing: number | null
  fund_expected: number | null
  fund_gap: number | null
  notes: string | null
  closed_at: string
  created_at: string
}
