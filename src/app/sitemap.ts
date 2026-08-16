import type { MetadataRoute } from 'next'
import { contentService } from '@/services/content.service'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/**
 * Sitemap built from the API's own list of indexable URLs (M23).
 *
 * The API decides what belongs here — it is the only side that knows which
 * products are active and which pages are marked noindex. If it is unreachable
 * at build time we still emit the static routes rather than failing the build.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/products`, changeFrequency: 'daily', priority: 0.9 },
  ]

  try {
    const { data } = await contentService.sitemap()

    const entries = (
      rows: Array<{ path: string; lastModified: string }>,
      priority: number,
      changeFrequency: 'weekly' | 'monthly',
    ): MetadataRoute.Sitemap =>
      rows.map((row) => ({
        url: `${SITE}${row.path}`,
        lastModified: new Date(row.lastModified),
        changeFrequency,
        priority,
      }))

    return [
      ...staticRoutes,
      ...entries(data.categories, 0.8, 'weekly'),
      ...entries(data.products, 0.7, 'weekly'),
      ...entries(data.pages, 0.5, 'monthly'),
    ]
  } catch {
    return staticRoutes
  }
}
