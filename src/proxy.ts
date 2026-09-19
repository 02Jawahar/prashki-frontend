import { NextResponse, type NextRequest } from 'next/server'

/**
 * Redirect handling (M23).
 *
 * Renaming a product or page strands every link that pointed at the old
 * address. Rather than checking the database on every request, the proxy
 * only asks about paths that look like content — and only ever redirects to a
 * path the API returned, never to a host taken from the request.
 *
 * The API validates that `toPath` is a local path, so an open redirect cannot
 * be created even by an admin with a slip of the keyboard. This checks again
 * anyway: a redirect is the one place where trusting a stored value would send
 * a customer somewhere we do not control.
 */
const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

/**
 * Seconds left on a JWT, read without verifying it.
 *
 * Only ever used to decide whether to *try* refreshing — the API verifies the
 * token properly on every request, so a forged expiry buys nothing here beyond
 * an unnecessary refresh attempt.
 */
function secondsLeft(token: string | undefined): number {
  if (!token) return 0
  try {
    const [, payload] = token.split('.')
    if (!payload) return 0
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: number }
    if (!json.exp) return 0
    return json.exp - Math.floor(Date.now() / 1000)
  } catch {
    return 0
  }
}

/**
 * Renews an admin session before the page is rendered.
 *
 * The admin access token lasts ten minutes; the refresh token lasts a day. In
 * the browser an expired access token is refreshed and the request retried,
 * but a full page load is checked on the server, which cannot refresh during
 * render — so every visit after the tenth minute looked like a signed-out
 * session and bounced to the sign-in page, with a perfectly good refresh
 * token sitting in the jar.
 *
 * Here, at the edge, cookies can still be set — and, more importantly, the
 * cookie the render is about to read can be swapped for the fresh one.
 */
async function renewAdminSession(request: NextRequest): Promise<NextResponse> {
  const refreshToken = request.cookies.get('rt')?.value
  if (!refreshToken) return NextResponse.next()

  // A little early, so a request that takes a moment does not arrive expired.
  if (secondsLeft(request.cookies.get('at')?.value) > 60) return NextResponse.next()

  const cookieHeader = request.headers.get('cookie') ?? ''

  try {
    /**
     * The CSRF token goes in the header as well as the cookie.
     *
     * `/auth/refresh` is a POST and the API guards it with a signed
     * double-submit: the `csrf` cookie has to be echoed back in
     * `x-csrf-token`, and a request carrying only the cookie is rejected
     * exactly like a forged one. Forwarding the cookie header alone got a 401
     * on every renewal — so the refresh never happened, and the ten-minute
     * bounce this function exists to prevent went on happening.
     */
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': request.cookies.get('csrf')?.value ?? '',
      },
    })
    if (!res.ok) return NextResponse.next()

    const issued = res.headers.getSetCookie?.() ?? []
    if (issued.length === 0) return NextResponse.next()

    /**
     * Hand the render the new cookies, not just the browser.
     *
     * `NextResponse.next()` passes the original request through untouched, so
     * setting `set-cookie` on the response updates the jar for *next* time
     * while this page still renders against the expired token — asks the API
     * who the user is, gets a 401, and redirects to the sign-in screen it was
     * just saved from. The request headers have to be rewritten too.
     */
    const merged = mergeCookies(cookieHeader, issued)
    const headers = new Headers(request.headers)
    headers.set('cookie', merged)

    const response = NextResponse.next({ request: { headers } })
    for (const cookie of issued) response.headers.append('set-cookie', cookie)
    return response
  } catch {
    // A refresh that cannot be reached must not take the admin down with it.
    // The page renders, the API answers 401, and the browser retries there.
    return NextResponse.next()
  }
}

/**
 * Folds freshly issued Set-Cookie values into an existing cookie header,
 * replacing any same-named pair rather than appending a second one — two `at`
 * cookies in a header is a coin toss over which the API reads.
 */
function mergeCookies(cookieHeader: string, setCookies: string[]): string {
  const jar = new Map<string, string>()

  for (const pair of cookieHeader.split(';')) {
    const [name, ...rest] = pair.trim().split('=')
    if (name) jar.set(name, rest.join('='))
  }

  for (const raw of setCookies) {
    const [pair] = raw.split(';')
    const [name, ...rest] = pair.trim().split('=')
    if (name) jar.set(name, rest.join('='))
  }

  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Admin pages need a live session, not a redirect lookup.
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return NextResponse.next()
    return renewAdminSession(request)
  }

  try {
    const response = await fetch(
      `${API_BASE}/redirects?path=${encodeURIComponent(pathname)}`,
      { headers: { accept: 'application/json' }, cache: 'no-store' },
    )
    if (!response.ok) return NextResponse.next()

    const payload = (await response.json()) as {
      success?: boolean
      data?: { redirect: { toPath: string; statusCode: number } | null }
    }

    const redirect = payload?.data?.redirect
    if (!redirect) return NextResponse.next()

    // Local paths only. Anything else is ignored rather than followed.
    if (!redirect.toPath.startsWith('/') || redirect.toPath.startsWith('//')) {
      return NextResponse.next()
    }

    const target = new URL(redirect.toPath, request.url)
    // Carry the query string across so campaign tags survive the hop.
    if (search && !redirect.toPath.includes('?')) target.search = search

    return NextResponse.redirect(target, redirect.statusCode === 302 ? 302 : 301)
  } catch {
    // A redirect lookup that fails must never take the site down with it.
    return NextResponse.next()
  }
}

export const config = {
  /**
   * Everything except Next's own assets, the API proxy and files with an
   * extension. Without this the lookup would run for every image request.
   *
   * Admin pages are included now — not for redirects, which they skip, but so
   * an expiring session can be renewed before the page is rendered.
   */
  matcher: ['/((?!_next/|api/|favicon|.*\\.[\\w]+$).*)'],
}
