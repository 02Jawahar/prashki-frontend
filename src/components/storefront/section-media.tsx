import Image from 'next/image'

/**
 * Renders hero/banner artwork, which may be an image or a video.
 *
 * Video is muted, looping and `playsInline` — autoplay is only permitted when
 * muted, and without `playsInline` iOS takes it fullscreen. It is decorative,
 * so it carries no captions and is hidden from assistive tech.
 */
export function SectionMedia({
  src,
  priority = false,
  sizes = '100vw',
  className = 'object-cover',
}: {
  src: string
  priority?: boolean
  sizes?: string
  className?: string
}) {
  if (!src) return <div className="size-full bg-sage-100" aria-hidden />

  const isVideo = /\.(mp4|webm)(\?|$)/i.test(src)

  if (isVideo) {
    return (
      <video
        src={src}
        className={`size-full ${className}`}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
      />
    )
  }

  return <Image src={src} alt="" fill priority={priority} sizes={sizes} className={className} />
}
