'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authService } from '@/services/auth.service'
import type { AuthUser } from '@/types/api'

interface AuthContextValue {
  user: AuthUser | null
  /** true until the initial session check completes */
  loading: boolean
  isAdmin: boolean
  can: (permission: string) => boolean
  login: (email: string, password: string) => Promise<AuthUser>
  register: (input: {
    name: string
    email: string
    password: string
    phone?: string
    acceptedTerms: boolean
    marketingOptIn?: boolean
  }) => Promise<AuthUser>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode
  initialUser?: AuthUser | null
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser)
  const [loading, setLoading] = useState(initialUser === null)

  const refresh = useCallback(async () => {
    try {
      setUser(await authService.me())
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // The server may already have resolved the user; only fetch if it didn't.
    if (initialUser) {
      setLoading(false)
      return
    }
    void refresh()
  }, [initialUser, refresh])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'ADMIN',
      // Permission checks here are for hiding controls only. The server
      // re-checks every one of them (spec §5).
      can: (permission: string) => Boolean(user?.permissions?.includes(permission)),
      login: async (email, password) => {
        const next = await authService.login({ email, password })
        setUser(next)
        return next
      },
      register: async (input) => {
        const next = await authService.register(input)
        setUser(next)
        return next
      },
      logout: async () => {
        await authService.logout().catch(() => undefined)
        setUser(null)
      },
      refresh,
    }),
    [user, loading, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
