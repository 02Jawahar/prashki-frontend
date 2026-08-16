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

  const [listing, categories, facets] = await Promise.all([
    productService.list(query),
    productService.categories().then((r) => r.data.categories).catch(() => []),
    // Filters are useful but not load-bearing: if the facet query fails the
    // grid still renders.
    productService.facets(query).then((r) => r.data).catch(() => undefined),
  ])

  const products = listing.data.products
  const pagination = listing.pagination

  return (
    <div className="container-pk py-10 md:py-14">
      <header className="mb-8 text-center">
        <h1 className="display text-[2.2rem] md:text-[2.8rem]">Shop all</h1>
        <div className="rule-dot mt-4" aria-hidden />
      </header>

      <ProductFilters
        categories={categories}
        facets={facets}
        total={pagination?.total ?? products.length}
      />

      {products.length === 0 ? (
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
