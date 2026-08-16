'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { trackEvent, wishlistService } from '@/services/storefront.service'
import { cn } from '@/lib/utils'

/**
 * The heart on a product page.
 *
 * The wishlist is signed-in only, so a guest is sent to sign in with a redirect
 * back to the product rather than being shown a control that cannot work.
 *
 * The saved state is optimistic: the icon fills immediately and reverts if the
 * request fails, because a heart that lags by a round-trip feels broken.
 */
/** Survives the round trip through sign-in; cleared as soon as it is used. */
const PENDING_KEY = 'pk:pending-wishlist'

export function WishlistButton({
  productId,
  productName,
  className,
  variant = 'button',
}: {
  productId: string
  productName: string
  className?: string
  /** `icon` is the bare heart used on a listing card (FR-18.1). */
  variant?: 'button' | 'icon'
}) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [saved, setSaved] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) {
      setSaved(false)
      setReady(true)
      return
    }

    void wishlistService
      .list()
      .then((result) => setSaved(result.items.some((item) => item.product.id === productId)))
      .catch(() => undefined)
      .finally(() => setReady(true))
  }, [user, productId])

  /**
   * A guest who taps the heart meant to save the thing (FR-18.3). Remember
   * which product, send them to sign in, and finish the job on the way back —
   * rather than losing the intent and making them find the item again.
   */
  useEffect(() => {
    if (!user || typeof window === 'undefined') return

    const pending = window.sessionStorage.getItem(PENDING_KEY)
    if (pending !== productId) return

    window.sessionStorage.removeItem(PENDING_KEY)
    void wishlistService
      .add(productId)
      .then(() => setSaved(true))
      .catch(() => undefined)
  }, [user, productId])

  async function toggle() {
    if (!user) {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(PENDING_KEY, productId)
      }
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    if (busy) return

    const next = !saved
    setSaved(next)
    setBusy(true)

    try {
      if (next) {
        await wishlistService.add(productId)
        trackEvent('wishlist.add', { entityType: 'Product', entityId: productId })
      } else {
        await wishlistService.removeByProduct(productId)
      }
    } catch {
      setSaved(!next)
    } finally {
      setBusy(false)
    }
  }

  const label = saved
    ? `Remove ${productName} from your wishlist`
    : `Save ${productName} to your wishlist`

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={(event) => {
          // The card is wrapped in a link; saving must not navigate.
          event.preventDefault()
          event.stopPropagation()
          void toggle()
        }}
        disabled={authLoading || !ready}
        aria-pressed={saved}
        aria-label={label}
        className={cn(
          'flex size-8 items-center justify-center bg-paper/85 backdrop-blur-sm transition-opacity disabled:opacity-40',
          className,
        )}
      >
        <Heart
          className={cn('size-4', saved ? 'fill-sage-700 text-sage-700' : 'text-ink-soft')}
          strokeWidth={1.4}
          aria-hidden
        />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={authLoading || !ready}
      aria-pressed={saved}
      aria-label={label}
      className={cn(
        'flex items-center justify-center gap-2 border border-rule px-4 py-3 text-sm transition-colors hover:border-ink disabled:opacity-50',
        saved && 'border-ink',
        className,
      )}
    >
      <Heart
        className={cn('size-4', saved && 'fill-sage-700 text-sage-700')}
        strokeWidth={1.4}
        aria-hidden
      />
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}
