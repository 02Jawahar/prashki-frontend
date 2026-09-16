import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { collectionService } from '@/services/storefront.service'
import { EmptyState } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Discover',
  description: 'The collections, newest first.',
}

/**
 * The collections archive (M23).
 *
 * Each drop is a titled block — its name and year — with the ranges it contains
 * laid out beneath as photographs. Discover is a way into the clothes rather
 * than a list of collection names, so the pictures carry it and the range name
 * sits under each one, the way the reference sets it.
 *
 * A collection whose pieces are all still drafts shows its title and nothing
 * else. That is a real state during a launch, and it should read as a
 * collection being prepared rather than as an error.
 */
export default async function DiscoverPage() {
  const collections = await collectionService.list().catch(() => null)

  if (collections === null) {
    return (
      <div className="container-pk py-16">
        <EmptyState
          title="We couldn't load the collections"
          body="Something went wrong at our end. Try again in a moment."
        />
      </div>
    )
  }

  return (
    <div className="container-pk py-12 md:py-16">
      <header className="mb-12 text-center">
        <h1 className="display text-3xl md:text-4xl">Discover</h1>
        <p className="mt-2 text-sm text-ink-soft">The collections, newest first.</p>
      </header>

      {collections.length === 0 ? (
        <EmptyState
          title="No collections yet"
          body="Collections appear here once they are published from the admin."
        />
      ) : (
        <div className="space-y-20">
          {collections.map((collection) => {
            const ranges = collection.categories ?? []

            return (
              <section key={collection.id}>
                <div className="mb-8 text-center">
                  <Link href={`/collections/${collection.slug}`} className="group inline-block">
                    <h2 className="display text-[1.9rem] transition-colors group-hover:text-sage-700 md:text-[2.4rem]">
                      {collection.name}
                      {collection.year !== null && (
                        <span className="ml-3 align-middle text-[0.8em] text-ink-soft">
                          {collection.year}
                        </span>
                      )}
                    </h2>
                  </Link>

                  {collection.description && (
                    <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">
                      {collection.description}
                    </p>
                  )}
                </div>

                {ranges.length === 0 ? (
                  <p className="text-center text-sm text-ink-soft">
                    This collection is being prepared.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
                    {ranges.map((range) => (
                      <li key={range.id}>
                        <Link
                          href={`/products?category=${range.slug}&collection=${collection.slug}`}
                          className="group block"
                        >
                          <div className="relative aspect-[3/4] overflow-hidden bg-sage-100">
                            {range.image ? (
                              <Image
                                src={range.image}
                                alt=""
                                fill
                                sizes="(max-width: 768px) 50vw, 25vw"
                                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                              />
                            ) : (
                              <div className="size-full bg-sage-100" />
                            )}
                          </div>

                          {/*
                            Under the tile, not over it. A name laid over a
                            photograph has to survive whatever that photograph
                            turns out to be, and these are studio shots on white
                            where light text disappears entirely.
                          */}
                          <p className="mt-3 text-center">
                            <span className="display text-[1.05rem] transition-colors group-hover:text-sage-700">
                              {range.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-ink-soft">
                              {range.count} piece{range.count === 1 ? '' : 's'}
                            </span>
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
