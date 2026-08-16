'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, Volume2, VolumeX, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatPrice } from '@/lib/money'
import type { ShowcaseItem } from '@/types/api'

/**
 * The customer showcase — a row of vertical clips of real people in the pieces.
 *
 * Three things drive the implementation, and all three are easy to get wrong:
 *
 *   1. **Bandwidth.** Four autoplaying videos on the homepage is a lot to send
 *      to someone who scrolled past. Nothing loads until the tile is near the
 *      viewport (`preload="none"`, `src` attached on intersection), and a tile
 *      that scrolls away pauses. On a phone that is the difference between a
 *      few hundred kilobytes and several megabytes.
 *
 *   2. **Autoplay actually working.** Browsers only permit it muted, and
 *      without `playsInline` iOS hijacks the video to fullscreen. Both are
 *      non-negotiable, so sound is opt-in and lives in the lightbox.
 *
 *   3. **WCAG 2.2.2 (Pause, Stop, Hide).** Anything that moves for more than
 *      five seconds needs a way to stop it. There is a single control for the
 *      whole row, and `prefers-reduced-motion` means nothing moves at all
 *      until asked — the poster stands in, which is what the still frame is
 *      for anyway.
 */
export function ShowcaseWall({
  items,
  heading,
  body,
}: {
  items: ShowcaseItem[]
  heading: string
  body?: string
}) {
  const [playing, setPlaying] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      setReducedMotion(query.matches)
      // Someone who asked for less motion should not have to press pause.
      if (query.matches) setPlaying(false)
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  if (items.length === 0) return null

  const hasVideo = items.some((item) => item.mediaType === 'VIDEO')

  return (
    <section className="py-16 md:py-20" aria-labelledby="showcase-heading">
      <div className="container-pk">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 id="showcase-heading" className="display text-[2rem] md:text-[2.6rem]">
              {heading}
            </h2>
            {body && <p className="mt-3 max-w-md text-[0.95rem] text-ink-soft">{body}</p>}
          </div>

          {hasVideo && !reducedMotion && (
            <button
              type="button"
              onClick={() => setPlaying((current) => !current)}
              className="label-caps shrink-0 border border-rule px-3.5 py-2 text-xs transition-colors hover:bg-sage-50"
              // The label states what pressing it does, not what is happening.
              aria-label={playing ? 'Pause the showcase videos' : 'Play the showcase videos'}
            >
              {playing ? (
                <Pause className="mr-1.5 inline size-3" strokeWidth={2} />
              ) : (
                <Play className="mr-1.5 inline size-3" strokeWidth={2} />
              )}
              {playing ? 'Pause' : 'Play'}
            </button>
          )}
        </div>
      </div>

      {/*
        Full-bleed and horizontally scrollable. Snap points make a swipe on a
        phone land on a tile rather than halfway between two.
      */}
      <ul className="mt-10 flex snap-x snap-mandatory gap-px overflow-x-auto md:gap-0.5">
        {items.map((item, index) => (
          <li
            key={item.id}
            className="w-[72vw] shrink-0 snap-start sm:w-[46vw] md:w-[calc(25%-2px)]"
          >
            <ShowcaseTile
              item={item}
              playing={playing && !reducedMotion}
              onOpen={() => setOpen(index)}
            />
          </li>
        ))}
      </ul>

      {open !== null && (
        <ShowcaseLightbox
          items={items}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

/**
 * One tile.
 *
 * The poster is a real `next/image` so it is optimised and sized, and it stays
 * underneath the video rather than being handed to `poster=` — that way the
 * transition to the first frame has nothing to flash through.
 */
function ShowcaseTile({
  item,
  playing,
  onOpen,
}: {
  item: ShowcaseItem
  playing: boolean
  onOpen: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [visible, setVisible] = useState(false)

  const isVideo = item.mediaType === 'VIDEO'
  const poster = item.posterUrl ?? item.mediaUrl

  // Load only what is nearly on screen. rootMargin starts the fetch just
  // before the tile arrives so it is ready rather than blank.
  useEffect(() => {
    const element = ref.current
    if (!isVideo || !element) return

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '200px', threshold: 0.25 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [isVideo])

  useEffect(() => {
    const element = ref.current
    if (!element) return

    if (visible && playing) {
      // Autoplay can still be refused (low power mode, a data saver). That is
      // a fine outcome — the poster is already showing underneath.
      void element.play().catch(() => undefined)
    } else {
      element.pause()
    }
  }, [visible, playing])

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block aspect-9/16 w-full overflow-hidden bg-sage-100 text-left"
      aria-label={`Open: ${item.altText}`}
    >
      <Image
        src={poster}
        alt={item.altText}
        fill
        sizes="(min-width: 768px) 25vw, 72vw"
        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
      />

      {isVideo && (
        <video
          ref={ref}
          // Attached only once the tile is near the viewport.
          src={visible ? item.mediaUrl : undefined}
          className="absolute inset-0 size-full object-cover"
          muted
          loop
          playsInline
          preload="none"
          // The poster underneath carries the alt text; this is the same
          // content moving, so it is not announced twice.
          aria-hidden
          tabIndex={-1}
        />
      )}

      {/* Enough scrim for the credit to stay legible over any footage. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-ink/65 to-transparent" />

      <span className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white">
        {item.creditHandle && <span className="block text-[0.8rem] opacity-90">@{item.creditHandle}</span>}
        {item.products.length > 0 && (
          <span className="label-caps mt-1 block text-[0.65rem] opacity-80">
            Shop this look
          </span>
        )}
      </span>
    </button>
  )
}

/**
 * The expanded view: one clip at full height, with sound available and the
 * pieces in it linked.
 *
 * This is where the section earns its place — a wall of nice photography is
 * decoration, but a wall you can buy from is merchandising.
 */
function ShowcaseLightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: ShowcaseItem[]
  index: number
  onIndex: (next: number) => void
  onClose: () => void
}) {
  const item = items[index]
  const videoRef = useRef<HTMLVideoElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [muted, setMuted] = useState(true)

  const go = useCallback(
    (delta: number) => onIndex((index + delta + items.length) % items.length),
    [index, items.length, onIndex],
  )

  useEffect(() => {
    closeRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') go(1)
      if (event.key === 'ArrowLeft') go(-1)
    }

    document.addEventListener('keydown', onKey)
    // The page behind must not scroll while this is over it.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [go, onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.altText}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 p-2 text-white/80 transition-colors hover:text-white"
        aria-label="Close"
      >
        <X className="size-6" strokeWidth={1.5} />
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-2 z-10 p-2 text-white/70 transition-colors hover:text-white md:left-6"
            aria-label="Previous"
          >
            <ChevronLeft className="size-8" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-2 z-10 p-2 text-white/70 transition-colors hover:text-white md:right-6"
            aria-label="Next"
          >
            <ChevronRight className="size-8" strokeWidth={1.5} />
          </button>
        </>
      )}

      <div className="flex max-h-full w-full max-w-4xl flex-col gap-6 overflow-y-auto md:flex-row md:items-center">
        <div className="relative mx-auto aspect-9/16 w-full max-w-sm shrink-0 overflow-hidden bg-ink-soft">
          {item.mediaType === 'VIDEO' ? (
            <>
              <video
                ref={videoRef}
                key={item.id}
                src={item.mediaUrl}
                poster={item.posterUrl ?? undefined}
                className="size-full object-cover"
                autoPlay
                muted={muted}
                loop
                playsInline
                controls
              />
              <button
                type="button"
                onClick={() => setMuted((current) => !current)}
                className="absolute right-3 top-3 rounded-full bg-ink/60 p-2 text-white"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? (
                  <VolumeX className="size-4" strokeWidth={1.5} />
                ) : (
                  <Volume2 className="size-4" strokeWidth={1.5} />
                )}
              </button>
            </>
          ) : (
            <Image
              src={item.mediaUrl}
              alt={item.altText}
              fill
              sizes="(min-width: 768px) 384px, 100vw"
              className="object-cover"
            />
          )}
        </div>

        <div className="text-white md:flex-1">
          {item.creditName && (
            <p className="display text-xl">
              {item.creditName}
              {item.creditHandle && (
                <span className="ml-2 text-sm font-normal opacity-70">@{item.creditHandle}</span>
              )}
            </p>
          )}

          {item.caption && <p className="mt-3 text-[0.95rem] opacity-90">{item.caption}</p>}

          {item.products.length > 0 && (
            <div className="mt-7">
              <p className="label-caps mb-4 text-xs opacity-70">Shop this look</p>
              <ul className="space-y-3">
                {item.products.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/products/${product.slug}`}
                      className="flex items-center gap-4 border border-white/20 p-3 transition-colors hover:bg-white/10"
                      onClick={onClose}
                    >
                      <span className="relative size-16 shrink-0 overflow-hidden bg-white/10">
                        {product.image && (
                          <Image
                            src={product.image}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{product.name}</span>
                        <span className="mt-0.5 block text-sm opacity-80">
                          {formatPrice(product.price)}
                          {product.compareAtPrice && product.compareAtPrice > product.price && (
                            <span className="ml-2 line-through opacity-60">
                              {formatPrice(product.compareAtPrice)}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
