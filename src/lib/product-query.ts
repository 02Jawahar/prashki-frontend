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
    'rating',
  ])
  const sort = one('sort')

  /**
   * Facets arrive as "size:m,colour:sage". Anything that is not a clean
   * slug:slug pair is dropped rather than forwarded — the API would reject it,
   * and a malformed filter should narrow nothing rather than error the page.
   */
  const attributes = one('attributes')
    ?.split(',')
    .map((pair) => pair.trim().toLowerCase())
    .filter((pair) => /^[a-z0-9-]+:[a-z0-9-]+$/.test(pair))
    .join(',')

  const rating = num('minRating')

  return {
    q: one('q'),
    category: one('category'),
    sort: (sort && SORTS.has(sort) ? sort : 'featured') as ProductQuery['sort'],
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    inStock: one('inStock') === 'true' ? true : undefined,
    attributes: attributes || undefined,
    minRating: rating && rating >= 1 && rating <= 5 ? rating : undefined,
    page: Math.max(1, num('page') ?? 1),
    perPage: 12,
    ...overrides,
  }
}
