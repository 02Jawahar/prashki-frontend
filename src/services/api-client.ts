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
export async function serverApiGet<T>(
  path: string,
  opts: { cookieHeader?: string; revalidate?: number | false; tags?: string[] } = {},
): Promise<Result<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (opts.cookieHeader) headers.cookie = opts.cookieHeader

  const res = await fetch(`${SERVER_BASE}${path}`, {
    headers,
    // Catalogue edits should show up immediately (spec §39). Swap to a
    // revalidate window plus tag invalidation when caching is turned on.
    cache: opts.revalidate === undefined ? 'no-store' : undefined,
    next: opts.revalidate === undefined ? undefined : { revalidate: opts.revalidate, tags: opts.tags },
  })

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
