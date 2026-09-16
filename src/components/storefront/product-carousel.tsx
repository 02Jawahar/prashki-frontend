'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductCard } from './product-card'
import type { ProductListItem } from '@/types/api'

/**
 * A horizontal row of pieces that scrolls, the way the reference sets its new
 * arrivals.
 *
 * Native scrolling with snap points rather than a carousel library: a swipe
 * already works on every touch device, the keyboard already works, and the
 * arrows are a convenience on top rather than the only way through. A JS
 * carousel would have to reimplement all three, badly.
 *
 * The arrows hide when there is nothing in that direction, and the whole
 * control disappears when everything already fits — a disabled arrow on a row
 * that cannot scroll is furniture.
 */
export function ProductCarousel({
  products,
  priorityCount = 0,
}: {
  products: ProductListItem[]
  priorityCount?: number
}) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return

    const { scrollLeft, scrollWidth, clientWidth } = track
    setAtStart(scrollLeft <= 1)
    // A pixel of slack: fractional widths mean the end is rarely exact.
    setAtEnd(scrollLeft + clientWidth >= scrollWidth - 1)
  }, [])

  useEffect(() => {
    measure()
    const track = trackRef.current
    if (!track) return

    // Re-measured on resize as well as scroll, because how many fit changes
    // with the window and the arrows have to follow.
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [measure, products.length])

  function nudge(direction: -1 | 1) {
    const track = trackRef.current
    if (!track) return
    // One card's width, so a press lands on a card rather than between two.
    const card = track.firstElementChild as HTMLElement | null
    const step = card ? card.offsetWidth + 16 : track.clientWidth * 0.8
    track.scrollBy({ left: step * direction, behavior: 'smooth' })
  }

  if (products.length === 0) return null

  const scrollable = !(atStart && atEnd)

  return (
    <div className="relative">
      <ul
        ref={trackRef}
        onScroll={measure}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product, index) => (
          <li
            key={product.id}
            className="w-[calc(50%-0.5rem)] shrink-0 snap-start md:w-[calc(33.333%-0.75rem)] lg:w-[calc(25%-0.75rem)]"
          >
            <ProductCard
              product={product}
              priority={index < priorityCount}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            />
          </li>
        ))}
      </ul>

      {scrollable && (
        <>
          <button
            type="button"
            onClick={() => nudge(-1)}
            disabled={atStart}
            aria-label="Previous"
            className="absolute -left-2 top-[38%] hidden size-10 items-center justify-center border border-rule bg-white/95 transition-opacity hover:bg-sage-50 disabled:pointer-events-none disabled:opacity-0 lg:flex"
          >
            <ChevronLeft className="size-4" strokeWidth={1.6} />
          </button>

          <button
            type="button"
            onClick={() => nudge(1)}
            disabled={atEnd}
            aria-label="Next"
            className="absolute -right-2 top-[38%] hidden size-10 items-center justify-center border border-rule bg-white/95 transition-opacity hover:bg-sage-50 disabled:pointer-events-none disabled:opacity-0 lg:flex"
          >
            <ChevronRight className="size-4" strokeWidth={1.6} />
          </button>
        </>
      )}
    </div>
  )
}
