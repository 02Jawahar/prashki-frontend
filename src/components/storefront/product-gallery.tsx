'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ProductImage } from '@/types/api'

/** Responsive gallery: thumbnail rail on desktop, swipeable arrows on mobile. */
export function ProductGallery({ images, title }: { images: ProductImage[]; title: string }) {
  const [active, setActive] = useState(0)

  if (images.length === 0) {
    return <div className="aspect-2/3 w-full bg-sage-50" aria-hidden />
  }

  const go = (delta: number) => setActive((i) => (i + delta + images.length) % images.length)
  const current = images[active]!

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row">
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-3 overflow-x-auto lg:w-20 lg:flex-col lg:overflow-visible">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
              className={`relative aspect-2/3 w-16 shrink-0 overflow-hidden bg-sage-50 transition-opacity lg:w-full ${
                i === active ? 'opacity-100 ring-1 ring-sage-700' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="relative flex-1">
        <div className="relative aspect-2/3 overflow-hidden bg-sage-50">
          <Image
            src={current.url}
            alt={current.altText ?? title}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/85 p-2.5 transition-colors hover:bg-white"
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/85 p-2.5 transition-colors hover:bg-white"
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
