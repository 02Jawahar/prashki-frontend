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
import { cartService, type Cart } from '@/services/cart.service'
import { useAuth } from './use-auth'

interface CartContextValue {
  cart: Cart | null
  itemCount: number
  loading: boolean
  error: string | null
  drawerOpen: boolean
  openCart: () => void
  closeCart: () => void
  addItem: (variantId: string, quantity?: number) => Promise<void>
  updateItem: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  refresh: () => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setCart(await cartService.get())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your bag')
    }
  }, [])

  useEffect(() => {
    void refresh()
    // Signing in merges the guest cart server-side, so re-read afterwards.
  }, [refresh, user?.id])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const run = useCallback(async (fn: () => Promise<Cart>, opts: { openDrawer?: boolean } = {}) => {
    setLoading(true)
    setError(null)
    try {
      setCart(await fn())
      if (opts.openDrawer) setDrawerOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount: cart?.itemCount ?? 0,
      loading,
      error,
      drawerOpen,
      openCart: () => setDrawerOpen(true),
      closeCart: () => setDrawerOpen(false),
      refresh,
      addItem: (variantId, quantity = 1) =>
        run(() => cartService.addItem(variantId, quantity), { openDrawer: true }),
      updateItem: (itemId, quantity) => run(() => cartService.updateItem(itemId, quantity)),
      removeItem: (itemId) => run(() => cartService.removeItem(itemId)),
    }),
    [cart, loading, error, drawerOpen, refresh, run],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
