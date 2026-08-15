import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { productService } from '@/services/product.service'
import { toProductQuery, type SearchParams } from '@/lib/product-query'
import { ProductGrid } from '@/components/storefront/product-card'
import { SectionMedia } from '@/components/storefront/section-media'
import { ProductFilters } from '@/components/storefront/product-filters'
import { Pagination } from '@/components/storefront/pagination'
import { EmptyState } from '@/components/ui'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const res = await productService.categoryBySlug(slug)
  if (!res) return { title: 'Category' }

  return {
    title: res.data.category.name,
    description: res.data.category.description ?? undefined,
    alternates: { canonical: `/categories/${slug}` },
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { slug } = await params
  const sp = await searchParams

  const categoryRes = await productService.categoryBySlug(slug)
  if (!categoryRes) notFound()

  const category = categoryRes.data.category

  // The category comes from the route, not from the filter bar.
  const query = toProductQuery(sp, { category: slug })

  const [listing, categories] = await Promise.all([
    productService.list(query),
    productService.categories().then((r) => r.data.categories).catch(() => []),
  ])

  const products = listing.data.products
  const pagination = listing.pagination

  return (
    <div className="container-pk py-10 md:py-14">
      <header className="mb-8 text-center">
        {category.image && (
          <div className="relative mb-8 aspect-16/6 w-full overflow-hidden bg-sage-50">
            {/* Set per category in admin; may be an image or a video. */}
            <SectionMedia src={category.image} priority sizes="100vw" />
          </div>
        )}
        <h1 className="display text-[2.2rem] md:text-[2.8rem]">{category.name}</h1>
        <div className="rule-dot mt-4" aria-hidden />
        {category.description && (
          <p className="mx-auto mt-4 max-w-xl text-[0.92rem] text-ink-soft">{category.description}</p>
        )}
      </header>

      <ProductFilters
        categories={categories}
        total={pagination?.total ?? products.length}
        showCategory={false}
      />

      {products.length === 0 ? (
        <div className="py-16">
          <EmptyState
            title="Nothing here yet"
            body="This category has no products matching those filters."
          />
        </div>
      ) : (
        <div className="pt-10">
          <ProductGrid products={products} priorityCount={4} />
        </div>
      )}

      {pagination && (
        <Pagination pagination={pagination} basePath={`/categories/${slug}`} searchParams={sp} />
      )}
    </div>
  )
}
