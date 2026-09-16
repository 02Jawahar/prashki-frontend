'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { apiClient } from '@/services/api-client'
import type { ProductVariant } from '@/types/api'

/**
 * Add to bag from the listing, without opening the piece.
 *
 * It asks for a size rather than choosing one. A "quick add" that silently
 * picked a size would be quick in the wrong direction: the customer discovers
 * the mistake at delivery, and a returned garment costs everyone more than the
 * click it saved.
 *
 * The sizes are fetched when the button is pressed, not with the listing. A
 * grid of twelve products would otherwise carry sixty variants nobody looks at,
 * on a page whose whole job is loading quickly.
 */
export function QuickAdd({
  productId,
  productSlug,
  productName,
  inStock,
}: {
  productId: string
  productSlug: string
  productName: string
  inStock: boolean
}) {
  const { addItem } = useCart()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [variants, setVariants] = useState<ProductVariant[] | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!inStock) return null

  async function reveal(event: React.MouseEvent) {
    // The card is a link; opening the size picker must not follow it.
    event.preventDefault()
    event.stopPropagation()

    setOpen(true)
    if (variants || loading) return

    setLoading(true)
    setError(null)
    try {
      // The client fetcher, not the server one: this runs in the browser when
      // someone presses the button.
      const { data } = await apiClient.get<{ product: { variants: ProductVariant[] } }>(
        `/products/${productSlug}`,
      )
      setVariants(data.product.variants.filter((v) => v.inStock))
    } catch {
      setError('Could not load sizes')
    } finally {
      setLoading(false)
    }
  }

  async function add(event: React.MouseEvent, variant: ProductVariant) {
    event.preventDefault()
    event.stopPropagation()

    setAdding(variant.id)
    setError(null)
    try {
      await addItem(variant.id, 1)
      setAdded(true)
      setOpen(false)
      // Long enough to register, short enough not to sit there.
      setTimeout(() => setAdded(false), 2000)
    } catch {
      setError('Could not add that')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div
      className="absolute inset-x-0 bottom-0"
      onMouseLeave={() => setOpen(false)}
    >
      {open ? (
        <div className="bg-white/95 px-3 py-3 backdrop-blur-sm">
          {loading ? (
            <p className="flex items-center justify-center gap-2 text-xs text-ink-soft">
              <Loader2 className="size-3 animate-spin" strokeWidth={2} />
              Loading sizes
            </p>
          ) : error ? (
            <p className="text-center text-xs text-danger">{error}</p>
          ) : variants && variants.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-1.5">
              {variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={(e) => void add(e, variant)}
                  disabled={adding !== null}
                  className="label-caps min-w-9 border border-rule px-2 py-1.5 text-[0.65rem] transition-colors hover:border-ink hover:bg-sage-50 disabled:opacity-50"
                >
                  {adding === variant.id ? (
                    <Loader2 className="mx-auto size-3 animate-spin" strokeWidth={2} />
                  ) : (
                    variant.name
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-ink-soft">No sizes in stock</p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => void reveal(e)}
          aria-label={`Add ${productName} to bag`}
          className="label-caps w-full bg-white/95 py-3 text-[0.68rem] opacity-0 backdrop-blur-sm transition-opacity duration-300 hover:bg-white group-hover:opacity-100 group-focus-within:opacity-100 md:opacity-0"
        >
          {added ? (
            <span className="flex items-center justify-center gap-1.5 text-sage-700">
              <Check className="size-3" strokeWidth={2.5} />
              Added
            </span>
          ) : (
            'Quick add'
          )}
        </button>
      )}
    </div>
  )
}
