'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HomeSection } from '@/types/api'

type FilmBandData = Extract<HomeSection, { type: 'film-band' }>

/**
 * One film across the full width of the page, in whatever shape it was shot.
 *
 * Unlike the film wall at the top, this is not cropped to 9:16 — a landscape
 * film with people and captions in it loses most of itself in a vertical
 * frame. The element sizes itself from the poster, so the page does not jump
 * when the video arrives.
 *
 * Nothing is fetched until the band is nearly on screen. It is the heaviest
 * thing on the homepage, and most visitors never scroll this far; loading it
 * on arrival would cost them megabytes for something they never see.
 */
export function FilmBand({ data }: { data: FilmBandData }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [near, setNear] = useState(false)
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
          setNear(true)
          play()
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
  }, [play, reducedMotion])

  return (
    <section className="mt-16 md:mt-20">
      <video
        ref={videoRef}
        // Attached only once the band is nearly in view.
        src={near && !reducedMotion ? data.video : undefined}
        poster={data.poster}
        muted
        loop
        playsInline
        preload="none"
        aria-label={data.heading || 'Studio film'}
        className="block h-auto w-full"
      />

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
