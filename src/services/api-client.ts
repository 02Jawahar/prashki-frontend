import type { ApiError, ApiSuccess, Pagination } from '@/types/api'

/**
 * The single place the frontend talks to the API (spec §51).
 *
 * Two entry points because the two runtimes have different needs:
 *   apiClient       — browser. Sends cookies, transparently refreshes an
 *                     expired access token once, then retries.
 *   serverApiClient — React Server Components. Talks to the API host directly
 *                     and forwards the incoming request's cookies.
 */
const BROWSER_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'
const SERVER_BASE = process.env.API_URL ?? BROWSER_BASE

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

export interface Result<T> {
  data: T
  pagination?: Pagination
}

type Body = unknown

async function parse<T>(res: Response): Promise<Result<T>> {
  const payload = (await res.json().catch(() => null)) as ApiSuccess<T> | ApiError | null

  if (!res.ok || !payload || payload.success === false) {
    const err = (payload as ApiError | null)?.error
    throw new ApiRequestError(
      res.status,
      err?.code ?? 'REQUEST_FAILED',
      err?.message ?? `Request failed with ${res.status}`,
      err?.details,
    )
  }

  return { data: payload.data, pagination: payload.meta?.pagination }
}

// --------------------------------------------------------------- browser

let refreshInFlight: Promise<boolean> | null = null

/** Single-flight refresh so a burst of 401s triggers exactly one refresh. */
async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${BROWSER_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      // Let the next 401 start a fresh attempt.
      setTimeout(() => {
        refreshInFlight = null
      }, 0)
    })

  return refreshInFlight
}

/**
 * The CSRF token the API issued, copied from the cookie into a header.
 *
 * The cookie is deliberately readable by JavaScript — that is the point of a
 * double-submit token. An attacker's page can make the browser *send* our
 * cookie but cannot read it to build this header, which is what the check on
 * the server relies on.
 */
function csrfToken(): string | null {
  if (typeof document === 'undefined') return null

  const match = document.cookie.match(/(?:^|;\s*)csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

let primingInFlight: Promise<string | null> | null = null

/** Single-flight, so a burst of writes on a cold tab triggers one round trip. */
async function primeCsrfToken(): Promise<string | null> {
  primingInFlight ??= fetch(`${BROWSER_BASE}/`, { credentials: 'include' })
    .then(() => csrfToken())
    .catch(() => null)
    .finally(() => {
      setTimeout(() => {
        primingInFlight = null
      }, 0)
    })

  return primingInFlight
}

async function browserRequest<T>(
  path: string,
  { method = 'GET', body, isFormData = false, retry = true }: {
    method?: string
    body?: Body
    isFormData?: boolean
    retry?: boolean
  } = {},
): Promise<Result<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (body !== undefined && !isFormData) headers['content-type'] = 'application/json'

  if (method !== 'GET' && method !== 'HEAD') {
    // The token arrives on the first response from the API. If the very first
    // thing this tab does is a write, prime it rather than failing the write.
    const token = csrfToken() ?? (await primeCsrfToken())
    if (token) headers['x-csrf-token'] = token
  }

  const res = await fetch(`${BROWSER_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  })

  // An expired access token is recoverable; anything else is not.
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) {
      return browserRequest<T>(path, { method, body, isFormData, retry: false })
    }
  }

  return parse<T>(res)
}

export const apiClient = {
  get: <T,>(path: string) => browserRequest<T>(path),
  post: <T,>(path: string, body?: Body) => browserRequest<T>(path, { method: 'POST', body }),
  patch: <T,>(path: string, body?: Body) => browserRequest<T>(path, { method: 'PATCH', body }),
  put: <T,>(path: string, body?: Body) => browserRequest<T>(path, { method: 'PUT', body }),
  delete: <T,>(path: string) => browserRequest<T>(path, { method: 'DELETE' }),
  upload: <T,>(path: string, form: FormData) =>
    browserRequest<T>(path, { method: 'POST', body: form, isFormData: true }),
}

// ---------------------------------------------------------------- server

/**
 * Server-side fetch. `cookieHeader` must be passed explicitly by the caller
 * (from next/headers) so this module stays importable from anywhere.
 */
/**
 * Whether the misconfiguration warning has already been printed.
 *
 * Once per process, not once per request: a homepage render makes several
 * calls, and a wall of identical lines buries the one fact that matters.
 */
let warnedAboutServerBase = false

/**
 * Says, once, which API the server is calling and why that failed.
 *
 * Every server-side caller catches its own errors so a customer never sees a
 * stack trace — which also means a wrong `API_URL` produces a site that is
 * silently empty and gives the operator nothing to go on. This is the one
 * place that knows both the URL and the failure, so it is the only place that
 * can say so.
 *
 * The path is included but never the cookie header.
 */
function warnServerBase(path: string, reason: string): void {
  if (warnedAboutServerBase) return
  warnedAboutServerBase = true

  console.error(
    [
      '',
      '  The frontend cannot reach the API.',
      '',
      `    tried:  ${SERVER_BASE}${path}`,
      `    reason: ${reason}`,
      `    API_URL is ${process.env.API_URL ? `set to "${process.env.API_URL}"` : 'NOT SET (falling back to NEXT_PUBLIC_API_URL)'}`,
      '',
      '  Server-side rendering uses API_URL, not NEXT_PUBLIC_API_URL. It should',
      '  point at the backend, e.g. http://<backend-service>:4000/api/v1 on the',
      '  internal network. Until this resolves, pages render empty and admin',
      '  sign-in bounces back to the login form.',
      '',
    ].join('\n'),
  )
}

export async function serverApiGet<T>(
  path: string,
  opts: { cookieHeader?: string; revalidate?: number | false; tags?: string[] } = {},
): Promise<Result<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (opts.cookieHeader) headers.cookie = opts.cookieHeader

  let res: Response
  try {
    res = await fetch(`${SERVER_BASE}${path}`, {
      headers,
      // Catalogue edits should show up immediately (spec §39). Swap to a
      // revalidate window plus tag invalidation when caching is turned on.
      cache: opts.revalidate === undefined ? 'no-store' : undefined,
      next: opts.revalidate === undefined ? undefined : { revalidate: opts.revalidate, tags: opts.tags },
    })
  } catch (err) {
    // Unreachable host: DNS failure, connection refused, TLS rejection.
    warnServerBase(path, err instanceof Error ? err.message : String(err))
    throw err
  }

  // Reachable but answering wrongly — the usual sign of API_URL pointing at
  // the storefront, which serves HTML 404s where JSON was expected.
  if (res.status === 404 || res.status >= 500) {
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      warnServerBase(path, `HTTP ${res.status} with content-type "${contentType || 'none'}"`)
    }
  }

  return parse<T>(res)
}

/** Server-side variant that returns null on 404 instead of throwing. */
export async function serverApiGetOrNull<T>(
  path: string,
  opts?: Parameters<typeof serverApiGet>[1],
): Promise<Result<T> | null> {
  try {
    return await serverApiGet<T>(path, opts)
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null
    throw err
  }
}
