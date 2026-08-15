import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { productService } from '@/services/product.service'
import { ProductGrid, SectionHeading } from '@/components/storefront/product-card'
import { SectionMedia } from '@/components/storefront/section-media'
import { NewsletterForm } from '@/components/storefront/newsletter-form'
import type { Category, HomeSection, ProductListItem, StoreSettings } from '@/types/api'

export const metadata: Metadata = {
  description: 'Hand-finished pieces, cut to order. Dresses, kurta sets, co-ords, sarees and accessories.',
}

/**
 * Homepage composed from the `home.sections` setting rather than hard-coded
 * markup, so an admin-controlled section builder can replace the seed data
 * later without rewriting this page (spec §18).
 */
export default async function HomePage() {
  let settings: StoreSettings = {}
  try {
    settings = (await productService.settings()).data.settings
  } catch {
    settings = {}
  }

  const sections = settings['home.sections'] ?? []

  // Resolve every product list the page needs in one pass.
  const [featured, newest, categories] = await Promise.all([
    productService.list({ sort: 'featured', perPage: 4 }).then((r) => r.data.products).catch(() => []),
    productService.list({ sort: 'newest', perPage: 8 }).then((r) => r.data.products).catch(() => []),
    productService.categories().then((r) => r.data.categories).catch(() => []),
  ])

  return (
    <>
      {sections.map((section, i) => {
        switch (section.type) {
          case 'hero':
            return <Hero key={i} data={section} />
          case 'services':
            return <Services key={i} items={section.items} />
          case 'featured-products':
            return (
              <Grid key={i} heading={section.heading} products={featured.slice(0, section.limit)} href="/products" />
            )
          case 'new-arrivals':
            return (
              <Grid
                key={i}
                heading={section.heading}
                products={newest.slice(0, section.limit)}
                href="/products?sort=newest"
              />
            )
          case 'banner':
            return <Banner key={i} data={section} flip={i % 2 === 1} />
          case 'category-banner':
            return <CategoryStrip key={i} heading={section.heading} slugs={section.slugs} categories={categories} />
          case 'newsletter':
            return (
              <section key={i} className="bg-sage-50 py-16 md:py-20">
                <div className="container-pk text-center">
                  <SectionHeading title={section.heading} body={section.body} />
                  <div className="mt-7">
                    <NewsletterForm />
                  </div>
                </div>
              </section>
            )
          default:
            return null
        }
      })}
    </>
  )
}

type HeroData = Extract<HomeSection, { type: 'hero' }>
type BannerData = Extract<HomeSection, { type: 'banner' }>

function Hero({ data }: { data: HeroData }) {
  return (
    <section className="relative h-[78vh] min-h-[520px] w-full overflow-hidden">
      {/* Image or video, whichever was uploaded in admin. */}
      <SectionMedia src={data.image} priority sizes="100vw" />
      <div className="absolute inset-0 bg-ink/25" />

      <div className="relative flex h-full items-center justify-center px-6 text-center text-white">
        <div className="fade-up max-w-2xl">
          <p className="eyebrow mb-5 opacity-90">{data.eyebrow}</p>
          <h1 className="display text-[3rem] leading-[1.05] md:text-[4.5rem]">{data.heading}</h1>
          <p className="mx-auto mt-5 max-w-md text-[0.95rem] opacity-90">{data.body}</p>
          <Link
            href={data.ctaHref}
            className="btn mt-8 border border-white bg-white/0 text-white hover:bg-white hover:text-ink"
          >
            {data.ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  )
}

function Services({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <section className="border-b border-hairline">
      <div className="container-pk grid grid-cols-2 gap-8 py-10 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.title} className="text-center">
            <p className="label-caps text-sage-700">{item.title}</p>
            <p className="mt-1.5 text-[0.8rem] text-ink-soft">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Grid({
  heading,
  products,
  href,
}: {
  heading: string
  products: ProductListItem[]
  href: string
}) {
  if (products.length === 0) return null

  return (
    <section className="container-pk py-16 md:py-20">
      <SectionHeading title={heading} href={href} />
      <div className="mt-12">
        <ProductGrid products={products} priorityCount={4} />
      </div>
    </section>
  )
}

function Banner({ data, flip }: { data: BannerData; flip?: boolean }) {
  return (
    <section className="container-pk py-16 md:py-24">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <div className={`relative aspect-4/3 overflow-hidden bg-sage-50 ${flip ? 'md:order-2' : ''}`}>
          <SectionMedia src={data.image} sizes="(min-width: 768px) 50vw, 100vw" />
        </div>

        <div className={flip ? 'md:order-1' : ''}>
          <p className="eyebrow mb-3 text-sage-700">{data.eyebrow}</p>
          <h2 className="display text-[2.2rem] md:text-[2.9rem]">{data.heading}</h2>
          <p className="mt-5 max-w-md text-[0.95rem] text-ink-soft">{data.body}</p>
          <Link href={data.ctaHref} className="btn btn-outline mt-8">
            {data.ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  )
}

function CategoryStrip({
  heading,
  slugs,
  categories,
}: {
  heading: string
  slugs: string[]
  categories: Category[]
}) {
  const shown = slugs
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter((c): c is Category => Boolean(c))

  if (shown.length === 0) return null

  return (
    <section className="container-pk py-16 md:py-20">
      <SectionHeading title={heading} />
      <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {shown.map((category) => (
          <Link key={category.id} href={`/categories/${category.slug}`} className="group">
            <div className="relative aspect-3/4 overflow-hidden bg-sage-50">
              {category.image && (
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  sizes="(min-width: 1024px) 20vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              )}
            </div>
            <p className="display mt-3 text-center text-[1.05rem]">{category.name}</p>
            <p className="text-center text-xs text-ink-soft">{category.productCount} pieces</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
