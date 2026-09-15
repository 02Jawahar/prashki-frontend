'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HomeSection } from '@/types/api'

type VideoGridData = Extract<HomeSection, { type: 'video-grid' }>

/**
 * A row of vertical films across the top of the homepage, playing on hover.
 *
 * Nothing plays on load, and nothing is even fetched on load. Four autoplaying
 * films is tens of megabytes before a visitor has asked for anything, on a page
 * most of them reach over mobile data — so each tile ships its poster, and the
 * video is requested the first time someone shows interest in it.
 *
 * "Interest" is hover on a pointer device and a tap on a touch one, because
 * touch devices have no hover: a tile that only reacts to hover is a still
 * image on every phone, which is most of the audience.
 *
 * Anyone who has asked their system for reduced motion gets the posters and no
 * video at all. That preference is usually set by people for whom movement is
 * genuinely unpleasant, so it is honoured rather than softened.
 */
export function VideoGrid({ data }: { data: VideoGridData }) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(query.matches)

    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  if (data.items.length === 0) return null

  return (
    <section className="relative w-full">
      <div className="grid grid-cols-2 gap-0.5 md:grid-cols-4">
        {data.items.map((item, index) => (
          <Tile key={`${item.label}-${index}`} item={item} reducedMotion={reducedMotion} priority={index < 2} />
        ))}
      </div>

      {/*
        The title sits over the row rather than above it, which is what the
        reference does and why the row reads as one image rather than four.
        `pointer-events-none` keeps it from swallowing the hover it covers.
      */}
      {(data.eyebrow || data.heading) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {data.eyebrow && (
            <p className="label-caps mb-2 text-[0.7rem] text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">
              {data.eyebrow}
            </p>
          )}
          {data.heading && (
            <h1 className="display text-4xl text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.55)] md:text-6xl">
              {data.heading}
            </h1>
          )}
        </div>
      )}
    </section>
  )
}

function Tile({
  item,
  reducedMotion,
  priority,
}: {
  item: VideoGridData['items'][number]
  reducedMotion: boolean
  priority: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  /** Stays false until someone shows interest, so the file is never fetched. */
  const [wanted, setWanted] = useState(false)

  const play = useCallback(() => {
    if (reducedMotion) return
    setWanted(true)
    // The element does not exist on the first hover — mounting it is what this
    // call triggers — so the effect below starts it instead.
    videoRef.current?.play().catch(() => undefined)
  }, [reducedMotion])

  const stop = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    // Back to the first frame, so the tile matches its poster again rather
    // than freezing mid-gesture.
    video.currentTime = 0
  }, [])

  useEffect(() => {
    if (wanted) videoRef.current?.play().catch(() => undefined)
  }, [wanted])

  return (
    <Link
      href={item.href || '/products'}
      className="group relative block aspect-[9/16] overflow-hidden bg-sage-100"
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      // Touch has no hover. A tap starts the film; the link still works on the
      // second tap, which is the behaviour people expect from a video tile.
      onTouchStart={play}
      aria-label={item.label}
    >
      <Image
        src={item.poster}
        alt={item.label}
        fill
        priority={priority}
        sizes="(max-width: 768px) 50vw, 25vw"
        className={`object-cover transition-opacity duration-500 ${wanted ? 'opacity-0' : 'opacity-100'}`}
      />

      {wanted && !reducedMotion && (
        <video
          ref={videoRef}
          src={item.video}
          poster={item.poster}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 size-full object-cover"
          aria-hidden
        />
      )}

      {item.label && (
        <span className="absolute bottom-4 left-4 right-4 text-[0.78rem] text-white opacity-0 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)] transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          {item.label}
        </span>
      )}
    </Link>
  )
}
