/**
 * Only ever redirect to a path on this site.
 *
 * A `?redirect=` parameter is attacker-controllable, so anything that isn't a
 * plain same-site path (including protocol-relative `//evil.com`) is discarded.
 */
export function safeRedirect(value: string | undefined, fallback = '/account'): string {
  if (!value) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//')) return fallback
  if (value.includes('\\')) return fallback
  return value
}
