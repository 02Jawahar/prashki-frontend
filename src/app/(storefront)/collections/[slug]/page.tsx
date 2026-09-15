import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { collectionService } from '@/services/storefront.service'
import { ProductCard } from '@/components/storefront/product-card'
import { EmptyState } from '@/components/ui'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const data = await collectionService.bySlug(slug).catch(() => null)
  if (!data) return { title: 'Collection' }

  const { collection } = data
  return {
    title: collection.seoTitle ?? `${collection.name}${collection.year ? ` — ${collection.year}` : ''}`,
    description: collection.seoDescription ?? collection.description ?? undefined,
  }
}

/**
 * One collection: its cover, its story, and the pieces carried in it.
 *
 * A collection whose pieces are all still drafts renders as the cover and the
 * copy with nothing beneath — deliberately, because that is a real state during
 * a launch and it should look like a collection being prepared rather than an
 * error page.
 */
export default async function CollectionPage({ params }: Params) {
  const { slug } = await params
  const data = await collectionService.bySlug(slug).catch(() => null)

  if (!data) notFound()

  const { collection, products } = data

  return (
    <div>
      {collection.coverImage && (
        <section className="relative h-[52vh] min-h-[360px] w-full overflow-hidden">
          <Image src={collection.coverImage} alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-ink/30" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <h1 className="display text-4xl text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)] md:text-6xl">
              {collection.name}
            </h1>
            {collection.year !== null && (
              <p className="label-caps mt-2 text-[0.72rem] text-white/90">{collection.year}</p>
            )}
          </div>
        </section>
      )}

      <div className="container-pk py-12 md:py-16">
        {!collection.coverImage && (
          <header className="mb-8 text-center">
            <h1 className="display text-3xl md:text-4xl">{collection.name}</h1>
            {collection.year !== null && (
              <p className="label-caps mt-2 text-[0.72rem] text-ink-soft">{collection.year}</p>
            )}
          </header>
        )}

        {collection.description && (
          <p className="mx-auto mb-10 max-w-2xl text-center text-sm leading-relaxed text-ink-soft">
            {collection.description}
          </p>
        )}

        {products.length === 0 ? (
          <EmptyState
            title="This collection is being prepared"
            body="The pieces will appear here as they are published."
          />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
