import type { ProductQuery } from '@/services/product.service'

export type SearchParams = Record<string, string | string[] | undefined>

/**
 * Turns raw URL params into a typed, bounded product query.
 *
 * Everything is coerced and clamped here rather than trusted — the API
 * validates again, but a listing page should not forward junk.
 */
export function toProductQuery(sp: SearchParams, overrides: Partial<ProductQuery> = {}): ProductQuery {
  const one = (key: string): string | undefined => {
    const value = sp[key]
    return Array.isArray(value) ? value[0] : value
  }

  const num = (key: string): number | undefined => {
    const raw = one(key)
    if (raw === undefined || raw === '') return undefined
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined
  }

  const SORTS = new Set([
    'featured',
    'newest',
    'oldest',
    'price-asc',
    'price-desc',
    'name-asc',
    'name-desc',
  ])
  const sort = one('sort')

  return {
    q: one('q'),
    category: one('category'),
    sort: (sort && SORTS.has(sort) ? sort : 'featured') as ProductQuery['sort'],
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    inStock: one('inStock') === 'true' ? true : undefined,
    page: Math.max(1, num('page') ?? 1),
    perPage: 12,
    ...overrides,
  }
}
