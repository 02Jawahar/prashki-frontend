/** Mirrors the backend's response envelope (spec §46). */
export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: { pagination?: Pagination } & Record<string, unknown>
}

export interface ApiError {
  success: false
  error: { code: string; message: string; details?: unknown }
}

export interface Pagination {
  page: number
  perPage: number
  total: number
  pageCount: number
}

// ------------------------------------------------------------------- auth

export type UserRole = 'CUSTOMER' | 'ADMIN'

export interface AuthUser {
  id: string
  name: string
  email: string
  phone: string | null
  role: UserRole
  emailVerified: boolean
  permissions: string[]
}

// --------------------------------------------------------------- catalogue

export type ProductStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type VariantStatus = 'ACTIVE' | 'INACTIVE'

export interface CategoryRef {
  id: string
  name: string
  slug: string
}

export interface ProductListItem {
  id: string
  name: string
  slug: string
  shortDescription: string | null
  sku: string
  /** paise */
  price: number
  compareAtPrice: number | null
  discountPercent: number
  status: ProductStatus
  featured: boolean
  ratingAverage: number
  ratingCount: number
  category: CategoryRef | null
  image: string | null
  hoverImage: string | null
  inStock: boolean
  totalStock: number
  createdAt: string
  publishedAt: string | null
}

export interface ProductVariant {
  id: string
  name: string
  sku: string
  price: number
  status: VariantStatus
  position: number
  stock: number
  lowStockThreshold: number
  inStock: boolean
}

export interface ProductImage {
  id: string
  url: string
  altText: string | null
  sortOrder: number
}

export interface ProductDetail {
  id: string
  name: string
  slug: string
  description: string
  shortDescription: string | null
  sku: string
  price: number
  compareAtPrice: number | null
  discountPercent: number
  status: ProductStatus
  featured: boolean
  material: string | null
  careInstructions: string | null
  ratingAverage: number
  ratingCount: number
  seo: { title: string; description: string | null; noindex: boolean }
  category: CategoryRef | null
  images: ProductImage[]
  variants: ProductVariant[]
  inStock: boolean
  totalStock: number
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  /** Set with status SCHEDULED; a job flips it to ACTIVE when this passes. */
  scheduledFor: string | null
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  parentId: string | null
  productCount: number
  children: Array<{ id: string; name: string; slug: string; image: string | null }>
}

export interface AdminCategory {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  status: 'ACTIVE' | 'INACTIVE'
  sortOrder: number
  parent: CategoryRef | null
  productCount: number
  childCount: number
}

// --------------------------------------------------------------- inventory

export interface InventoryItem {
  variantId: string
  sku: string
  variantName: string
  productId: string
  productName: string
  productSlug: string
  productStatus: ProductStatus
  availableStock: number
  reservedStock: number
  lowStockThreshold: number
  isLow: boolean
}

export interface InventoryMovement {
  id: string
  type: 'INITIAL_STOCK' | 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'DAMAGE'
  quantity: number
  balanceAfter: number
  reason: string | null
  referenceType: string | null
  referenceId: string | null
  createdAt: string
}

// --------------------------------------------------------------- dashboard

export interface DashboardStats {
  totalProducts: number
  activeProducts: number
  totalCustomers: number
  totalOrders: number
  pendingOrders: number
  totalRevenue: number
  lowStockCount: number
  lowStockItems: Array<{
    variantId: string
    sku: string
    productName: string
    productSlug: string
    availableStock: number
    lowStockThreshold: number
  }>
}

// --------------------------------------------------------------- customers

export interface AdminCustomer {
  id: string
  name: string
  email: string
  phone: string | null
  status: 'ACTIVE' | 'SUSPENDED'
  emailVerified: boolean
  orderCount: number
  createdAt: string
  lastLoginAt: string | null
}

// ---------------------------------------------------------------- settings

export interface StoreSettings {
  'store.name'?: string
  'store.email'?: string
  'store.phone'?: string
  'store.currency'?: string
  'store.country'?: string
  'tax.default_percent'?: number
  'shipping.default_fee'?: number
  'shipping.free_threshold'?: number
  'nav.main'?: NavItem[]
  'home.sections'?: HomeSection[]
}

export interface NavItem {
  label: string
  href: string
  children?: Array<{ label: string; href: string }>
}

export type HomeSection =
  | { type: 'hero'; image: string; eyebrow: string; heading: string; body: string; ctaLabel: string; ctaHref: string }
  | { type: 'services'; items: Array<{ title: string; body: string }> }
  | { type: 'featured-products'; heading: string; limit: number }
  | { type: 'new-arrivals'; heading: string; limit: number }
  | { type: 'banner'; image: string; eyebrow: string; heading: string; body: string; ctaLabel: string; ctaHref: string }
  | { type: 'category-banner'; heading: string; slugs: string[] }
  | { type: 'newsletter'; heading: string; body: string }
  | { type: 'showcase'; heading: string; body?: string; limit?: number }

/**
 * A customer photo or clip on the showcase wall.
 *
 * Deliberately does not carry the consent fields the admin sees — how
 * permission was obtained is an internal record, not something the storefront
 * needs or should receive.
 */
export interface ShowcaseItem {
  id: string
  mediaType: 'VIDEO' | 'IMAGE'
  mediaUrl: string
  posterUrl: string | null
  altText: string
  caption: string | null
  creditName: string | null
  creditHandle: string | null
  products: Array<{
    id: string
    name: string
    slug: string
    price: number
    compareAtPrice: number | null
    image: string | null
  }>
}
