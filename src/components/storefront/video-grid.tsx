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
 * "Interest" is hover on a pointer device. A touch device has no hover, so
 * there the film on screen starts itself — one at a time, whichever the
 * carousel is centred on. A tile that only reacted to hover was a still image
 * on every phone, which is most of the audience.
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
    <section className="w-full">
      {/*
        One film at a time on a phone, four across on a desktop.
        
        These are 9:16, so two side by side on a phone leaves each about the
        width of a thumb — the garment, which is the entire point, becomes
        unreadable. The reference gives its hero the full width on mobile; this
        does the same and lets the other three be swiped to, with snap points so
        a swipe lands on a film rather than between two.
      */}
      <div className="flex snap-x snap-mandatory gap-0.5 overflow-x-auto md:grid md:grid-cols-4 md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {data.items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="w-[88%] shrink-0 snap-center md:w-auto">
            <Tile item={item} reducedMotion={reducedMotion} priority={index < 2} />
          </div>
        ))}
      </div>

      {/*
        The name sits below the films, not across them.
        
        It used to be laid over the row, which is what the reference does — but
        these are studio shots on near-white, and type over them fought the
        clothes for every pixel it covered. Below, it also gets somewhere to
        go: a click on a film should not navigate, so this is the only line on
        the row a customer can act on.
      */}
      {data.heading && (
        <div className="container-pk py-10 text-center md:py-14">
          <p className="display text-[1.6rem] md:text-[2rem]">{data.heading}</p>
          {data.captionHref && (
            <Link
              href={data.captionHref}
              className="label-caps link-underline mt-3 inline-block text-ink"
            >
              {data.captionLabel || 'Shop now'}
            </Link>
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  /** Stays false until someone shows interest, so the file is never fetched. */
  const [wanted, setWanted] = useState(false)
  /**
   * Whether the video has actually painted a frame.
   *
   * This is what hides the poster — not the hover. These files are several
   * megabytes, so between wanting one and seeing it there are seconds of
   * buffering, and a poster hidden on hover leaves a white rectangle for all
   * of it. The still stays put until there is something to replace it with.
   */
  const [painted, setPainted] = useState(false)

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
    video.currentTime = 0
    // Back to the poster — the exact still the tile had before anyone touched
    // it. The file stays buffered, so hovering again resumes at once.
    setPainted(false)
  }, [])

  useEffect(() => {
    if (wanted) videoRef.current?.play().catch(() => undefined)
  }, [wanted])

  /**
   * On a phone, the film on screen plays itself.
   *
   * Hover is what starts these on a desktop, and a touch device has no hover —
   * so without this the whole row is four still images to most of the
   * audience, and nothing on the page suggests otherwise. A tap works, but
   * only for someone who guesses there is something to tap.
   *
   * Only the tile actually in view, and only one at a time. The row is a snap
   * carousel on mobile, so a 60% threshold catches the centred film and no
   * other. Playing all four would be tens of megabytes of someone's mobile
   * data for three films they are not looking at.
   *
   * Scoped to `(hover: none)` rather than a screen width, because the question
   * is whether this device can hover at all — a narrow window on a laptop
   * still has a pointer, and hover is the better behaviour there.
   */
  useEffect(() => {
    if (reducedMotion) return

    const element = containerRef.current
    if (!element) return
    if (!window.matchMedia('(hover: none)').matches) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) play()
        else stop()
      },
      { threshold: 0.6 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [reducedMotion, play, stop])

  /*
   * A div, not a link. These films are the top of the page and a stray click
   * while watching one should not navigate away — the reference behaves the
   * same way. They are still focusable so a keyboard can start them, but they
   * go nowhere.
   */
  return (
    <div
      ref={containerRef}
      className="group relative block aspect-[9/16] overflow-hidden bg-sage-100"
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      // Kept alongside the in-view autoplay above: it restarts a film someone
      // scrolled past and came back to before the observer catches up.
      onTouchStart={play}
      tabIndex={0}
      role="img"
      aria-label={item.label}
    >
      <Image
        src={item.poster}
        alt={item.label}
        fill
        priority={priority}
        sizes="(max-width: 768px) 88vw, 25vw"
        className={`object-cover transition-opacity duration-500 ${painted ? 'opacity-0' : 'opacity-100'}`}
      />

      {wanted && !reducedMotion && (
        <video
          ref={videoRef}
          src={item.video}
          muted
          loop
          playsInline
          preload="none"
          // Painting is what the poster waits for. `playing` rather than
          // `canplay`: canplay fires while the frame on screen may still be
          // nothing.
          onPlaying={() => setPainted(true)}
          // A film that will not load leaves the still showing rather than a
          // blank tile. Nothing on this page is worth a white rectangle.
          onError={() => setPainted(false)}
          onStalled={() => setPainted(false)}
          // Hidden whenever the poster is showing. The element stays mounted
          // so the file is not fetched twice, but it must not sit on top of
          // the still — it is a paused first frame, and the poster is the
          // chosen one. Without this, leaving the tile left the wrong picture
          // behind no matter what the poster did.
          className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${
            painted ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden
        />
      )}

      {item.label && (
        <span className="absolute bottom-4 left-4 right-4 text-[0.78rem] text-white opacity-0 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)] transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          {item.label}
        </span>
      )}
    </div>
  )
}
