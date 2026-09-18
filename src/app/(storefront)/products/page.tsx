import type { Metadata } from 'next'
import { productService } from '@/services/product.service'
import { toProductQuery, type SearchParams } from '@/lib/product-query'
import { ProductGrid } from '@/components/storefront/product-card'
import { ProductFilters } from '@/components/storefront/product-filters'
import { Pagination } from '@/components/storefront/pagination'
import { EmptyState } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Shop all',
  description: 'The full collection — dresses, kurta sets, co-ords, sarees and accessories.',
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const query = toProductQuery(sp)

  /**
   * The listing is the one call this page cannot do without, but an
   * unreachable API used to throw straight out of the component and hand the
   * customer Next's "This page couldn't load" screen — the whole shop gone
   * because one request failed.
   *
   * Caught here so the page still renders. `null` and `[]` are kept apart on
   * purpose: an empty array means the catalogue genuinely has nothing to
   * show, `null` means we could not ask. Telling a customer "no products
   * match" when the API is down is worse than saying nothing, because it
   * reads as an answer.
   */
  const [listing, categories, facets] = await Promise.all([
    productService.list(query).catch(() => null),
    productService.categories().then((r) => r.data.categories).catch(() => []),
    // Filters are useful but not load-bearing: if the facet query fails the
    // grid still renders.
    productService.facets(query).then((r) => r.data).catch(() => undefined),
  ])

  const products = listing?.data.products ?? null
  const pagination = listing?.pagination

  /**
   * What the customer actually asked for, named.
   *
   * "Shop all" over a filtered grid is a small lie, and the one that made a
   * broken filter hard to spot: the page said Shop all and showed everything,
   * which is exactly what it says when nothing is filtered.
   *
   * Several categories that share a name — Skirt Co-ord exists under three
   * ranges — collapse to that name rather than listing it three times.
   */
  const named = [
    ...(query.category ? [query.category] : []),
    ...(query.categories ? query.categories.split(',') : []),
  ]
  const flat = categories.flatMap((c) => [c, ...(c.children ?? [])])
  const names = [...new Set(named.map((slug) => flat.find((c) => c.slug === slug)?.name).filter(Boolean))]
  /**
   * Long Dresses and Short Dresses are both dresses, and the link that asks
   * for both is called Dresses. When every name ends in the same word, that
   * word is the heading — otherwise they are joined.
   */
  const lastWords = names.map((n) => n!.split(' ').pop())
  const shared = names.length > 1 && new Set(lastWords).size === 1 ? lastWords[0]! : null

  const heading =
    shared ?? (names.length > 0 ? names.join(' & ') : query.q ? `“${query.q}”` : 'Shop all')

  return (
    <div className="container-pk py-10 md:py-14">
      <header className="mb-8 text-center">
        <h1 className="display text-[2.2rem] md:text-[2.8rem]">{heading}</h1>
        <div className="rule-dot mt-4" aria-hidden />
      </header>

      <ProductFilters
        categories={categories}
        facets={facets}
        total={pagination?.total ?? products?.length ?? 0}
      />

      {products === null ? (
        <div className="py-16">
          <EmptyState
            title="We couldn’t load the collection"
            body="Something went wrong at our end, not yours. Please refresh in a moment."
          />
        </div>
      ) : products.length === 0 ? (
        <div className="py-16">
          <EmptyState
            title="No products match those filters"
            body="Try widening your selection or clearing the filters."
          />
        </div>
      ) : (
        <div className="pt-10">
          <ProductGrid products={products} priorityCount={4} />
        </div>
      )}

      {pagination && <Pagination pagination={pagination} basePath="/products" searchParams={sp} />}
    </div>
  )
}
