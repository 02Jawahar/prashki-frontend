import type { Metadata } from 'next'
import { productService } from '@/services/product.service'
import { toProductQuery, type SearchParams } from '@/lib/product-query'
import { ProductGrid } from '@/components/storefront/product-card'
import { Pagination } from '@/components/storefront/pagination'
import { EmptyState } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: true },
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const raw = sp.q
  const term = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? ''

  const listing = term ? await productService.list(toProductQuery(sp, { perPage: 24 })) : null
  const products = listing?.data.products ?? []
  const total = listing?.pagination?.total ?? 0

  return (
    <div className="container-pk py-10 md:py-14">
      <header className="mb-10 text-center">
        <p className="eyebrow mb-3 text-sage-700">Search</p>
        <h1 className="display text-[2rem] md:text-[2.5rem]">
          {term ? `“${term}”` : 'Search the collection'}
        </h1>
        <div className="rule-dot mt-4" aria-hidden />
        {term && (
          <p className="mt-4 text-sm text-ink-soft">
            {total} {total === 1 ? 'result' : 'results'}
          </p>
        )}
      </header>

      {!term ? (
        <EmptyState title="What are you looking for?" body="Search by name, fabric or category." />
      ) : products.length === 0 ? (
        <EmptyState
          title="No results"
          body={`Nothing matches “${term}”. Try a category or a fabric instead.`}
        />
      ) : (
        <ProductGrid products={products} priorityCount={4} />
      )}

      {listing?.pagination && (
        <Pagination pagination={listing.pagination} basePath="/search" searchParams={sp} />
      )}
    </div>
  )
}
