import { serverApiGet, serverApiGetOrNull } from './api-client'

/**
 * CMS content (M25) and redirects (M23).
 *
 * Read server-side only: pages are rendered on the server for SEO, and the
 * redirect lookup runs in the proxy before a page is ever produced.
 */

/** The block shapes the renderer understands. Unknown types are skipped. */
export interface PageBlock {
  type: string
  data: Record<string, unknown>
}

export interface CmsPage {
  slug: string
  title: string
  blocks: PageBlock[]
  seoTitle: string | null
  seoDescription: string | null
  seoNoindex: boolean
  ogImage: string | null
  publishedAt: string | null
  updatedAt: string
}

export const contentService = {
  list: () =>
    serverApiGet<{ pages: Array<{ slug: string; title: string; updatedAt: string }> }>('/pages'),

  bySlug: (slug: string) => serverApiGetOrNull<{ page: CmsPage }>(`/pages/${slug}`),

  sitemap: () =>
    serverApiGet<{
      products: Array<{ path: string; lastModified: string }>
      categories: Array<{ path: string; lastModified: string }>
      pages: Array<{ path: string; lastModified: string }>
    }>('/seo/sitemap'),
}
