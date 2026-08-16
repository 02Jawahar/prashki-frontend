import { apiClient, serverApiGet, serverApiGetOrNull } from './api-client'
import type {
  Category,
  ProductDetail,
  ProductListItem,
  ShowcaseItem,
  StoreSettings,
} from '@/types/api'

export interface ProductQuery {
  q?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  /** "size:m,size:l,colour:sage" — see the API's facet handling. */
  attributes?: string
  minRating?: number
  sort?:
    | 'featured'
    | 'newest'
    | 'oldest'
    | 'price-asc'
    | 'price-desc'
    | 'name-asc'
    | 'name-desc'
    | 'rating'
  page?: number
  perPage?: number
}

export interface FacetValue {
  slug: string
  value: string
  colorHex: string | null
  count: number
}

export interface Facets {
  attributes: Array<{ slug: string; name: string; isSwatch: boolean; values: FacetValue[] }>
  price: { min: number; max: number }
  categories: Array<{ slug: string; name: string; count: number }>
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

  /**
   * Filter options for the current result set. Counts ignore the attribute
   * selections themselves, so ticking one size does not empty the panel.
   */
  facets: (query: ProductQuery = {}) => {
    const { attributes: _selected, ...rest } = query
    return serverApiGet<Facets>(`/products/facets${productQueryString(rest)}`)
  },

  categories: () => serverApiGet<{ categories: Category[] }>('/categories'),

  categoryBySlug: (slug: string) =>
    serverApiGetOrNull<{ category: Category & { children: Category[] } }>(`/categories/${slug}`),

  settings: () => serverApiGet<{ settings: StoreSettings }>('/settings'),

  /** The customer showcase wall. Public and cached at the API. */
  showcase: (limit = 8) => serverApiGet<{ items: ShowcaseItem[] }>(`/showcase?limit=${limit}`),
}

/** Browser-side reads, e.g. the search overlay. */
export const productBrowserService = {
  search: (q: string, perPage = 6) =>
    apiClient
      .get<{ products: ProductListItem[] }>(`/products${productQueryString({ q, perPage })}`)
      .then((r) => r.data.products),
}
