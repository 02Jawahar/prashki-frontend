import type { MetadataRoute } from 'next'
import { productService } from '@/services/product.service'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/**
 * Sitemap built from the live catalogue. If the API is unreachable at build
 * time we still emit the static routes rather than failing the build.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/products`, changeFrequency: 'daily', priority: 0.9 },
  ]

  try {
    const [products, categories] = await Promise.all([
      productService.list({ perPage: 48 }).then((r) => r.data.products),
      productService.categories().then((r) => r.data.categories),
    ])

    return [
      ...staticRoutes,
      ...categories.map((c) => ({
        url: `${SITE}/categories/${c.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...products.map((p) => ({
        url: `${SITE}/products/${p.slug}`,
        lastModified: p.publishedAt ? new Date(p.publishedAt) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ]
  } catch {
    return staticRoutes
  }
}
