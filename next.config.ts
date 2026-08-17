import type { NextConfig } from 'next'

type ImagePattern = {
  protocol: 'http' | 'https'
  hostname: string
  port?: string
  pathname: string
}

/**
 * Hosts `next/image` may optimise from.
 *
 * Anything not listed is refused — a deliberate guard, since the optimiser
 * would otherwise fetch arbitrary URLs and re-serve them from our domain. The
 * refusal is a 400 from `/_next/image`, which on the page looks like a broken
 * image with no visible cause, so both storage arrangements have to be
 * declared:
 *
 *   - local disk — images come from the API host, always under /uploads
 *   - S3-compatible — images come from a separate media host at any path,
 *     because the object key decides the path and there is no fixed prefix
 */
function imagePatterns(): ImagePattern[] {
  const patterns: ImagePattern[] = []

  const add = (raw: string, pathname: string) => {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return
    }

    // Server-side and browser-side requests can resolve the same service
    // differently in development, so both spellings of loopback are allowed.
    const hosts = new Set([url.hostname])
    if (url.hostname === 'localhost') hosts.add('127.0.0.1')
    if (url.hostname === '127.0.0.1') hosts.add('localhost')

    for (const hostname of hosts) {
      patterns.push({
        protocol: url.protocol.replace(':', '') as 'http' | 'https',
        hostname,
        port: url.port || undefined,
        pathname,
      })
    }
  }

  add(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1', '/uploads/**')

  /**
   * Set to the backend's STORAGE_PUBLIC_URL when using S3-compatible storage.
   * Read at server start rather than inlined into the bundle, so moving to a
   * different bucket or putting a CDN in front is an environment change and a
   * restart rather than a rebuild.
   */
  if (process.env.MEDIA_URL) add(process.env.MEDIA_URL, '/**')

  return patterns
}

/**
 * Next 16 refuses to optimize images from hosts that resolve to a private IP,
 * because in production that is an SSRF vector. In local development the API
 * *is* on localhost, so the guard has to be lifted — but only there, and only
 * when the configured API host is genuinely local.
 */
function allowLocalImageHost(): boolean {
  if (process.env.NODE_ENV === 'production') return false

  try {
    const { hostname } = new URL(process.env.NEXT_PUBLIC_API_URL ?? '')
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: imagePatterns(),
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowLocalIP: allowLocalImageHost(),
  },
}

export default nextConfig
