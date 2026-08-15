import type { NextConfig } from 'next'

/**
 * Product images are served by the backend's storage provider (local disk in
 * development, S3/R2 later), so next/image needs that host allow-listed.
 *
 * The pattern is derived from the configured API URL rather than hard-coded, and
 * both localhost and 127.0.0.1 are permitted because server-side and
 * browser-side requests can resolve the API differently.
 */
function imagePatterns() {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    url = new URL('http://localhost:4000/api/v1')
  }

  const hosts = new Set([url.hostname])
  if (url.hostname === 'localhost') hosts.add('127.0.0.1')
  if (url.hostname === '127.0.0.1') hosts.add('localhost')

  return [...hosts].map((hostname) => ({
    protocol: url.protocol.replace(':', '') as 'http' | 'https',
    hostname,
    port: url.port || undefined,
    pathname: '/uploads/**',
  }))
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
