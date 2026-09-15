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
 * A grid of covers, each revealing its name on hover. The name is also rendered
 * for screen readers and on touch, where there is no hover to reveal anything —
 * a label that only exists in a hover state is a label half the audience never
 * sees.
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
      <header className="mb-10 text-center">
        <h1 className="display text-3xl md:text-4xl">Discover</h1>
        <p className="mt-2 text-sm text-ink-soft">The collections, newest first.</p>
      </header>

      {collections.length === 0 ? (
        <EmptyState
          title="No collections yet"
          body="Collections appear here once they are published from the admin."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/collections/${collection.slug}`}
              className="group relative block aspect-[4/5] overflow-hidden bg-sage-100"
            >
              {collection.coverImage ? (
                <Image
                  src={collection.coverImage}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="size-full bg-sage-100" />
              )}

              {/*
                Dimmed on hover so the name reads against whatever the cover
                happens to be. A fixed text colour cannot survive an arbitrary
                photograph behind it.
              */}
              <div className="absolute inset-0 bg-ink/30 transition-colors duration-500 md:bg-ink/0 md:group-hover:bg-ink/35 md:group-focus-visible:bg-ink/35" />

              {/*
                Shown on hover on a pointer device, and always on touch, where
                there is no hover to reveal it. A label that exists only in a
                hover state is one half the audience never sees.
              */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-100 transition-opacity duration-500 md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
                <span className="display text-2xl text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] md:text-3xl">
                  {collection.name}
                </span>
                {collection.year !== null && (
                  <span className="label-caps mt-1.5 text-[0.7rem] text-white/90">{collection.year}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  )
}
