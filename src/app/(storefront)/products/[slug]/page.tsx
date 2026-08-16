import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { productService } from '@/services/product.service'
import { ProductGallery } from '@/components/storefront/product-gallery'
import { AddToCart } from '@/components/storefront/add-to-cart'
import { ProductGrid, SectionHeading } from '@/components/storefront/product-card'
import { ProductReviews } from '@/components/storefront/product-reviews'
import { WishlistButton } from '@/components/storefront/wishlist-button'
import { PinChecker } from '@/components/storefront/pin-checker'
import { SizeGuide } from '@/components/storefront/size-guide'
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

  // Per-product SEO overrides win; the API already falls back to the product's
  // own name and summary when none is set.
  const title = product.seo?.title ?? product.name
  const description =
    product.seo?.description ?? product.shortDescription ?? product.description.slice(0, 155)

  return {
    title,
    description,
    alternates: { canonical: `/products/${slug}` },
    robots: product.seo?.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
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

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100'

  /**
   * Structured data (FR-23.2): the product, the breadcrumb trail, and the
   * organisation behind it. Emitted as one @graph rather than three separate
   * blocks so the nodes can reference each other.
   *
   * Only values that are actually visible on the page are described — a rating
   * we do not show, or a review count of zero, is not asserted.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${site}/#organization`,
        name: 'Prash & Ki',
        url: site,
        logo: `${site}/brand/logo-sage.png`,
      },
      {
        '@type': 'Product',
        name: product.name,
        description: product.description,
        sku: product.sku,
        image: product.images.map((i) => i.url),
        ...(product.material ? { material: product.material } : {}),
        ...(product.category ? { category: product.category.name } : {}),
        brand: { '@id': `${site}/#organization` },
        offers: {
          '@type': 'Offer',
          url: `${site}/products/${product.slug}`,
          price: (product.price / 100).toFixed(2),
          priceCurrency: 'INR',
          availability: product.inStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        },
        // Asserted only when there are approved reviews behind it.
        ...(product.ratingCount > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: product.ratingAverage,
                reviewCount: product.ratingCount,
              },
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: site },
          ...(product.category
            ? [
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: product.category.name,
                  item: `${site}/categories/${product.category.slug}`,
                },
              ]
            : []),
          {
            '@type': 'ListItem',
            position: product.category ? 3 : 2,
            name: product.name,
            item: `${site}/products/${product.slug}`,
          },
        ],
      },
    ],
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

            <WishlistButton
              productId={product.id}
              productName={product.name}
              className="mt-3 w-full"
            />

            <div className="mt-4 flex items-center gap-5">
              <SizeGuide />
            </div>

            <PinChecker />

            <div className="mt-9 border-t border-hairline pt-7">
              <h2 className="label-caps mb-3">Description</h2>
              <p className="whitespace-pre-line text-[0.88rem] leading-relaxed text-ink-soft">
                {product.description}
              </p>

              {product.material && (
                <div className="mt-6">
                  <h3 className="label-caps mb-2">Material</h3>
                  <p className="text-[0.88rem] leading-relaxed text-ink-soft">{product.material}</p>
                </div>
              )}

              {product.careInstructions && (
                <div className="mt-6">
                  <h3 className="label-caps mb-2">Care</h3>
                  <p className="whitespace-pre-line text-[0.88rem] leading-relaxed text-ink-soft">
                    {product.careInstructions}
                  </p>
                </div>
              )}

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

      <div className="container-pk pb-4">
        <ProductReviews productId={product.id} />
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
