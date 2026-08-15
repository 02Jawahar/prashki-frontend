import { apiClient, serverApiGet, serverApiGetOrNull } from './api-client'
import type {
  Category,
  ProductDetail,
  ProductListItem,
  StoreSettings,
} from '@/types/api'

export interface ProductQuery {
  q?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  sort?: 'featured' | 'newest' | 'oldest' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc'
  page?: number
  perPage?: number
}

export function productQueryString(query: ProductQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '' || value === null) continue
    params.set(key, String(value))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

/** Server-side reads used by React Server Components. */
export const productService = {
  list: (query: ProductQuery = {}) =>
    serverApiGet<{ products: ProductListItem[] }>(`/products${productQueryString(query)}`),

  bySlug: (slug: string) =>
    serverApiGetOrNull<{ product: ProductDetail; related: ProductListItem[] }>(`/products/${slug}`),

  categories: () => serverApiGet<{ categories: Category[] }>('/categories'),

  categoryBySlug: (slug: string) =>
    serverApiGetOrNull<{ category: Category & { children: Category[] } }>(`/categories/${slug}`),

  settings: () => serverApiGet<{ settings: StoreSettings }>('/settings'),
}

/** Browser-side reads, e.g. the search overlay. */
export const productBrowserService = {
  search: (q: string, perPage = 6) =>
    apiClient
      .get<{ products: ProductListItem[] }>(`/products${productQueryString({ q, perPage })}`)
      .then((r) => r.data.products),
}
