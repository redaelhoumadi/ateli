export type Brand = {
  id: string
  name: string
  created_at: string
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
  role: string
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
