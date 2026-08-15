import 'server-only'
import { cookies } from 'next/headers'
import { serverApiGet } from '@/services/api-client'
import type { AuthUser } from '@/types/api'

/**
 * Resolves the signed-in user on the server by forwarding the request cookies
 * to the API.
 *
 * This is for rendering — deciding what to show and where to redirect. It is
 * NOT the security boundary: the API re-authenticates and re-authorises every
 * request, so a forged client cannot gain anything by fooling this (spec §5).
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieHeader = (await cookies()).toString()
  if (!cookieHeader) return null

  try {
    const res = await serverApiGet<{ user: AuthUser }>('/auth/me', { cookieHeader })
    return res.data.user
  } catch {
    return null
  }
}

export async function getCookieHeader(): Promise<string> {
  return (await cookies()).toString()
}
