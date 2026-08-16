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
export function WishlistButton({
  productId,
  productName,
  className,
}: {
  productId: string
  productName: string
  className?: string
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

  async function toggle() {
    if (!user) {
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

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={authLoading || !ready}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from your wishlist` : `Save ${productName} to your wishlist`}
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
