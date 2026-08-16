import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { contentService } from '@/services/content.service'
import { PageBlocks } from '@/components/storefront/page-blocks'

/**
 * CMS pages (M25).
 *
 * A catch-all at the storefront root, so /about, /returns-policy and anything
 * else an editor creates resolve without a code change. It sits last in the
 * route hierarchy, so real routes — /products, /cart, /account — always win.
 *
 * Only published pages resolve; a draft slug 404s exactly like a slug that does
 * not exist, so unreleased content cannot be found by guessing.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const res = await contentService.bySlug(slug)
  if (!res) return { title: 'Not found' }

  const { page } = res.data

  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? undefined,
    alternates: { canonical: `/${page.slug}` },
    robots: page.seoNoindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: page.seoTitle ?? page.title,
      description: page.seoDescription ?? undefined,
      type: 'article',
      images: page.ogImage ? [page.ogImage] : undefined,
    },
  }
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const res = await contentService.bySlug(slug)
  if (!res) notFound()

  const { page } = res.data

  return (
    <article className="container-narrow py-12 md:py-16">
      <header className="mb-10 text-center">
        <h1 className="display text-[2.2rem] md:text-[2.8rem]">{page.title}</h1>
        <div className="rule-dot mt-4" aria-hidden />
      </header>

      <PageBlocks blocks={page.blocks} />
    </article>
  )
}
