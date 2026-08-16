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

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

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
   */
  matcher: ['/((?!_next/|api/|admin/|favicon|.*\\.[\\w]+$).*)'],
}
