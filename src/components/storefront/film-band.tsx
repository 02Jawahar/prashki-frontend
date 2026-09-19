'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import type { HomeSection } from '@/types/api'

type FilmBandData = Extract<HomeSection, { type: 'film-band' }>

/**
 * One film across the full width of the page, in whatever shape it was shot.
 *
 * It runs the full width and is not cropped to get there. Both of those at
 * once only work because the film is delivered already widened: the footage
 * sits whole in the middle of a wider frame with its own blurred edges
 * extending to the sides. Cropping the film itself was tried and cuts the
 * subtitles off the bottom edge, or the speaker's head off the top.
 *
 * Someone is speaking in it, so it carries sound. Autoplay is only permitted
 * muted, so it starts silent with a control to turn sound on — and the
 * subtitles mean the film still reads with the sound off.
 *
 * Nothing is fetched until the band is nearly on screen. It is the heaviest
 * thing on the homepage, and most visitors never scroll this far; loading it
 * on arrival would cost them megabytes for something they never see.
 */
export function FilmBand({ data }: { data: FilmBandData }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [near, setNear] = useState(false)
  const [muted, setMuted] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReducedMotion(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  const play = useCallback(() => {
    // Autoplay can still be refused — low power mode, a data saver. The poster
    // is showing underneath either way, so a refusal costs nothing.
    void videoRef.current?.play().catch(() => undefined)
  }, [])

  useEffect(() => {
    const element = videoRef.current
    if (!element || reducedMotion) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          // Only flips the flag. Playing here would run against a video that
          // has no source yet — the src is attached on the render this
          // triggers, not on this one — and the observer would not fire again
          // to try a second time, because the band is still on screen.
          setNear(true)
        } else {
          // A band scrolled past stops decoding. On a phone that is the
          // difference between a warm device and a flat battery.
          element.pause()
        }
      },
      { rootMargin: '300px', threshold: 0.1 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [reducedMotion])

  /**
   * Start it once the source is actually on the element.
   *
   * This runs after the render that attaches `src`, which is the render the
   * observer asked for. `onCanPlay` backs it up: a browser that refuses the
   * first attempt — because it has no data yet — gets a second once it does.
   */
  useEffect(() => {
    if (near && !reducedMotion) play()
  }, [near, reducedMotion, play])

  return (
    <section className="mt-16 bg-shell md:mt-20">
      <div className="relative w-full">
        <video
          ref={videoRef}
          // Attached only once the band is nearly in view.
          src={near && !reducedMotion ? data.video : undefined}
          poster={data.poster}
          muted={muted}
          loop
          playsInline
          preload="none"
          onCanPlay={play}
          aria-label={data.heading || 'Studio film'}
          // Full width, its own height. The film is already the shape of the
          // band, so nothing needs cropping or capping here.
          className="block h-auto w-full"
        />

        {near && !reducedMotion && (
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current
              if (!video) return
              video.muted = !video.muted
              setMuted(video.muted)
            }}
            // The label says what pressing it does, not what is happening.
            aria-label={muted ? 'Turn the sound on' : 'Turn the sound off'}
            className="absolute bottom-4 right-4 flex size-10 items-center justify-center rounded-full bg-ink/45 text-white backdrop-blur-sm transition-colors hover:bg-ink/65"
          >
            {muted ? (
              <VolumeX className="size-4" strokeWidth={1.7} />
            ) : (
              <Volume2 className="size-4" strokeWidth={1.7} />
            )}
          </button>
        )}
      </div>

      {(data.heading || data.body || (data.ctaHref && data.ctaLabel)) && (
        <div className="container-pk py-10 text-center md:py-14">
          {data.heading && (
            <h2 className="display text-[1.7rem] md:text-[2.2rem]">{data.heading}</h2>
          )}
          {data.body && (
            <p className="mx-auto mt-3 max-w-lg text-[0.95rem] leading-relaxed text-ink-soft">
              {data.body}
            </p>
          )}
          {data.ctaHref && data.ctaLabel && (
            <Link
              href={data.ctaHref}
              className="label-caps link-underline mt-4 inline-block text-ink"
            >
              {data.ctaLabel}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
