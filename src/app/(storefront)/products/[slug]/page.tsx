import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { productService } from '@/services/product.service'
import { ProductGallery } from '@/components/storefront/product-gallery'
import { AddToCart } from '@/components/storefront/add-to-cart'
import { ProductGrid, SectionHeading } from '@/components/storefront/product-card'
import { formatPrice } from '@/lib/money'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const res = await productService.bySlug(slug)
  if (!res) return { title: 'Product not found' }

  const { product } = res.data
  const description = product.shortDescription ?? product.description.slice(0, 155)

  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${slug}` },
    openGraph: {
      title: product.name,
      description,
      type: 'website',
      images: product.images[0] ? [product.images[0].url] : undefined,
    },
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const res = await productService.bySlug(slug)
  if (!res) notFound()

  const { product, related } = res.data

  // Structured data so the listing is machine-readable (spec §57).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: product.images.map((i) => i.url),
    offers: {
      '@type': 'Offer',
      price: (product.price / 100).toFixed(2),
      priceCurrency: 'INR',
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container-pk py-8 md:py-12">
        <nav className="mb-7 text-xs text-ink-soft" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <span className="mx-2">/</span>
          {product.category ? (
            <>
              <Link href={`/categories/${product.category.slug}`} className="hover:text-ink">
                {product.category.name}
              </Link>
              <span className="mx-2">/</span>
            </>
          ) : null}
          <span className="text-ink">{product.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <ProductGallery images={product.images} title={product.name} />

          <div className="lg:sticky lg:top-28 lg:self-start">
            {product.featured && <p className="eyebrow mb-3 text-sage-700">Featured</p>}

            <h1 className="display text-[1.9rem] leading-tight md:text-[2.4rem]">{product.name}</h1>
            {product.shortDescription && (
              <p className="mt-2 text-[0.9rem] text-ink-soft">{product.shortDescription}</p>
            )}

            <div className="mt-6">
              <AddToCart product={product} />
            </div>

            <div className="mt-9 border-t border-hairline pt-7">
              <h2 className="label-caps mb-3">Description</h2>
              <p className="whitespace-pre-line text-[0.88rem] leading-relaxed text-ink-soft">
                {product.description}
              </p>

              <dl className="mt-6 space-y-2 text-xs text-ink-soft">
                <div className="flex gap-2">
                  <dt className="label-caps">SKU</dt>
                  <dd>{product.sku}</dd>
                </div>
                {product.category && (
                  <div className="flex gap-2">
                    <dt className="label-caps">Category</dt>
                    <dd>{product.category.name}</dd>
                  </div>
                )}
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <div className="flex gap-2">
                    <dt className="label-caps">You save</dt>
                    <dd className="text-sale">
                      {formatPrice(product.compareAtPrice - product.price)} ({product.discountPercent}%)
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="container-pk py-16 md:py-20">
          <SectionHeading title="You may also like" />
          <div className="mt-12">
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </>
  )
}
