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
 * laid out beneath as photographs, and nothing else. No page heading, no blurb,
 * no caption under the tiles: Discover is a way into the clothes rather than a
 * list of collection names, so the pictures carry it alone and the only words
 * are the drop's own title.
 *
 * That leaves the range name reachable only on hover, which a touch device
 * does not have. It is the image's alt text for that reason, and the tile is a
 * link to the range either way.
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
    <div className="container-pk py-16 md:py-20">
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
                                alt={range.name}
                                fill
                                sizes="(max-width: 768px) 50vw, 25vw"
                                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                              />
                            ) : (
                              <div className="size-full bg-sage-100" />
                            )}

                            {/*
                              On hover, which drop this is and which range.
                              Written over a wash rather than straight onto the
                              photo: these are studio shots on white, and white
                              type on them is invisible without something behind
                              it.

                              Hover only, by request. The range name is the
                              image's alt text so a screen reader still reaches
                              it, and the tile links straight to that range.
                            */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/0 text-center opacity-0 transition-all duration-500 group-hover:bg-ink/40 group-hover:opacity-100 group-focus-visible:bg-ink/40 group-focus-visible:opacity-100">
                              <span className="display text-[1.35rem] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] md:text-[1.6rem]">
                                {collection.name}
                                {collection.year !== null && (
                                  <span className="ml-2 text-[0.75em]">{collection.year}</span>
                                )}
                              </span>
                              <span className="label-caps mt-2 text-[0.7rem] text-white/90">
                                {range.name}
                              </span>
                            </div>
                          </div>
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
