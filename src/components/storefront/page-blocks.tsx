import Link from 'next/link'
import { SectionMedia } from './section-media'
import { sanitizeHtml } from '@/lib/sanitize-html'
import type { PageBlock } from '@/services/content.service'

/**
 * Renders a CMS page's blocks (M25).
 *
 * The block array is the same shape the homepage sections use, so a block that
 * works on one works on the other. An unrecognised type renders nothing rather
 * than throwing — an editor experimenting with a new block should not be able
 * to take a published page down.
 */
export function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  return (
    <div className="space-y-12">
      {blocks.map((block, index) => (
        <Block key={`${block.type}-${index}`} block={block} />
      ))}
    </div>
  )
}

function Block({ block }: { block: PageBlock }) {
  const data = block.data ?? {}
  const str = (key: string): string | undefined => {
    const value = data[key]
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }

  switch (block.type) {
    case 'richText': {
      const html = str('html')
      if (!html) return null
      return (
        <div
          className="prose-pk"
          // Editor-authored HTML, stripped of scripts, event handlers and any
          // element that could execute — see the sanitizer.
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
        />
      )
    }

    case 'hero':
    case 'imageBanner':
    case 'videoBanner': {
      const image = str('image') ?? str('src')
      const heading = str('heading')

      return (
        <section className="relative overflow-hidden">
          {image && (
            <div className="relative aspect-16/9 w-full bg-sage-50 md:aspect-16/6">
              <SectionMedia src={image} sizes="100vw" />
            </div>
          )}
          {(heading || str('body')) && (
            <div className={image ? 'mt-6 text-center' : 'text-center'}>
              {str('eyebrow') && <p className="eyebrow mb-3 text-sage-700">{str('eyebrow')}</p>}
              {heading && <h2 className="display text-[1.8rem] md:text-[2.2rem]">{heading}</h2>}
              {str('body') && (
                <p className="mx-auto mt-3 max-w-xl text-[0.92rem] text-ink-soft">{str('body')}</p>
              )}
              {str('ctaLabel') && str('ctaHref') && (
                <Link href={str('ctaHref')!} className="btn btn-primary mt-6">
                  {str('ctaLabel')}
                </Link>
              )}
            </div>
          )}
        </section>
      )
    }

    case 'faq': {
      const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : []
      if (items.length === 0) return null

      return (
        <section>
          {str('heading') && <h2 className="display mb-6 text-2xl">{str('heading')}</h2>}
          <dl className="divide-y divide-hairline border-y border-hairline">
            {items.map((item, index) => (
              <div key={index} className="py-5">
                <dt className="display text-lg">{String(item.question ?? '')}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {String(item.answer ?? '')}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )
    }

    case 'gallery': {
      const images = Array.isArray(data.images) ? (data.images as string[]) : []
      if (images.length === 0) return null

      return (
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {images.map((src, index) => (
            <div key={index} className="relative aspect-2/3 overflow-hidden bg-sage-50">
              <SectionMedia src={src} sizes="(min-width: 768px) 33vw, 50vw" />
            </div>
          ))}
        </section>
      )
    }

    case 'spacer':
      return <div className="h-8" aria-hidden />

    default:
      // Unknown block type — the storefront has not been taught this one yet.
      return null
  }
}
