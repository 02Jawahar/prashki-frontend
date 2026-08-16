'use client'

import { useState } from 'react'
import { Tag, X } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { ApiRequestError } from '@/services/api-client'
import { formatPrice } from '@/lib/money'
import { Button, Input } from '@/components/ui'

/**
 * Discount code entry.
 *
 * The field sends a code and nothing else — the discount shown alongside it
 * comes back from the server, recalculated against the current bag. Editing
 * the bag re-runs that calculation, which is why the applied panel reads its
 * amount from the cart rather than remembering what it was told.
 */
export function CouponField() {
  const { cart, applyCoupon, removeCoupon, loading } = useCart()

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const applied = cart?.coupon && !cart.coupon.error ? cart.coupon : null
  const dropped = cart?.coupon?.error ? cart.coupon : null

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (loading || !code.trim()) return

    setError(null)
    try {
      await applyCoupon(code.trim())
      setCode('')
      setOpen(false)
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'That code could not be applied.',
      )
    }
  }

  if (applied) {
    return (
      <div className="mt-5 flex items-start justify-between gap-3 border border-sage-300 bg-sage-50 p-3.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm">
            <Tag className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
            <span className="font-medium">{applied.code}</span>
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {applied.freeShipping
              ? 'Free delivery applied'
              : `${formatPrice(applied.amount)} off`}
            {applied.description ? ` — ${applied.description}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void removeCoupon()}
          disabled={loading}
          aria-label={`Remove discount code ${applied.code}`}
          className="shrink-0 text-ink-soft hover:text-ink disabled:opacity-40"
        >
          <X className="size-4" strokeWidth={1.4} />
        </button>
      </div>
    )
  }

  return (
    <div className="mt-5">
      {dropped && (
        <p className="mb-3 text-xs text-danger" role="status">
          {dropped.code} no longer applies — {dropped.error}
        </p>
      )}

      {open ? (
        <form onSubmit={onSubmit} className="space-y-2">
          <label htmlFor="coupon" className="field-label">
            Discount code
          </label>
          <div className="flex gap-2">
            <Input
              id="coupon"
              value={code}
              autoFocus
              autoCapitalize="characters"
              placeholder="WELCOME10"
              onChange={(event) => {
                setCode(event.target.value)
                setError(null)
              }}
              error={Boolean(error)}
            />
            <Button type="submit" variant="outline" loading={loading} disabled={!code.trim()}>
              Apply
            </Button>
          </div>
          {error && (
            <p className="field-message" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="label-caps link-underline text-ink-soft"
        >
          Have a discount code?
        </button>
      )}
    </div>
  )
}
