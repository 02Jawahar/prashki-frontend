import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/money'
import type { ProductListItem } from '@/types/api'

/**
 * Product card: a 2:3 portrait crop that cross-fades to a second image on
 * hover, with the name and price sitting quietly beneath. No borders, no
 * shadows — the photography carries the grid.
 */
export function ProductCard({
  product,
  priority = false,
  sizes = '(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw',
}: {
  product: ProductListItem
  priority?: boolean
  sizes?: string
}) {
  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-2/3 overflow-hidden bg-sage-50">
        {product.image && (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover transition-opacity duration-700 ease-out group-hover:opacity-0"
          />
        )}
        {product.hoverImage && (
          <Image
            src={product.hoverImage}
            alt=""
            aria-hidden
            fill
            sizes={sizes}
            className="object-cover opacity-0 transition-all duration-700 ease-out group-hover:scale-[1.03] group-hover:opacity-100"
          />
        )}

        {product.discountPercent > 0 && (
          <span className="label-caps absolute left-3 top-3 bg-white/95 px-2.5 py-1 text-sale">
            {product.discountPercent}% off
          </span>
        )}
        {product.discountPercent === 0 && product.featured && (
          <span className="label-caps absolute left-3 top-3 bg-white/95 px-2.5 py-1 text-sage-700">
            Featured
          </span>
        )}
        {!product.inStock && (
          <span className="label-caps absolute inset-x-0 bottom-0 bg-ink/70 py-2 text-center text-white">
            Sold out
          </span>
        )}
      </div>

      <div className="pt-4 text-center">
        <h3 className="display text-[1.05rem] leading-snug text-ink">{product.name}</h3>
        {product.shortDescription && (
          <p className="mt-1 text-[0.78rem] text-ink-soft">{product.shortDescription}</p>
        )}
        <p className="mt-2 flex items-center justify-center gap-2 text-[0.85rem]">
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-ink-soft line-through">{formatPrice(product.compareAtPrice)}</span>
          )}
          <span className={product.discountPercent > 0 ? 'text-sale' : 'text-ink'}>
            {formatPrice(product.price)}
          </span>
        </p>
      </div>
    </Link>
  )
}

export function ProductGrid({
  products,
  priorityCount = 0,
}: {
  products: ProductListItem[]
  priorityCount?: number
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-[22px] lg:grid-cols-4 lg:gap-x-8 lg:gap-y-14">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} priority={i < priorityCount} />
      ))}
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  href,
  hrefLabel = 'View all',
}: {
  eyebrow?: string
  title: string
  body?: string
  href?: string
  hrefLabel?: string
}) {
  return (
    <div className="text-center">
      {eyebrow && <p className="eyebrow mb-3 text-sage-700">{eyebrow}</p>}
      <h2 className="display text-[1.9rem] md:text-[2.4rem]">{title}</h2>
      <div className="rule-dot mt-4" aria-hidden />
      {body && <p className="mx-auto mt-4 max-w-xl text-[0.92rem] text-ink-soft">{body}</p>}
      {href && (
        <Link href={href} className="label-caps link-underline mt-6 inline-block text-sage-700">
          {hrefLabel}
        </Link>
      )}
    </div>
  )
}
