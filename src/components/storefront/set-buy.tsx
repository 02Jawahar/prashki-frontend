'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/hooks/use-cart'
import { formatPrice } from '@/lib/money'
import { Alert, Button } from '@/components/ui'
import type { ProductDetail } from '@/types/api'

/**
 * Buying a set.
 *
 * Laid out the way the reference does it — a price range, then a row that
 * names what can be bought — because that row is the clearest statement a
 * shopper gets that the pieces are available on their own. Underneath, it is
 * ours: the chips toggle, so a top and a pant together is a selection the
 * reference cannot express, and each chosen piece takes its own size, which is
 * the whole reason for selling a set this way.
 *
 * The price moves with the selection, and the page says which price is which:
 * the whole look earns the set price, part of it costs what those pieces cost.
 * Leaving that to be discovered at checkout would feel like a trick.
 */
export function SetBuy({ product }: { product: ProductDetail }) {
  const set = product.set!
  const router = useRouter()
  const { addSet, loading } = useCart()

  const sellable = set.pieces.filter((piece) => piece.available)

  const [taken, setTaken] = useState<string[]>(() => sellable.map((p) => p.productId))
  const [sizes, setSizes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const chosen = sellable.filter((piece) => taken.includes(piece.productId))
  const whole = chosen.length === sellable.length && sellable.length === set.pieces.length

  const total = useMemo(
    () => (whole ? product.price : chosen.reduce((sum, piece) => sum + piece.price, 0)),
    [whole, chosen, product.price],
  )

  /** Cheapest single piece up to the full set — what the reference puts at the top. */
  const cheapest = sellable.length > 0 ? Math.min(...sellable.map((p) => p.price)) : product.price

  function toggle(productId: string) {
    setTaken((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    )
  }

  const missingSize = chosen.filter((piece) => !sizes[piece.productId])

  async function add(): Promise<boolean> {
    setTouched(true)
    setError(null)

    if (chosen.length === 0) {
      setError('Choose at least one piece.')
      return false
    }
    if (missingSize.length > 0) {
      setError(`Choose a size for ${missingSize.map((p) => p.name).join(' and ')}.`)
      return false
    }

    try {
      await addSet(
        product.id,
        chosen.map((piece) => ({ productId: piece.productId, variantId: sizes[piece.productId]! })),
      )
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that to your bag')
      return false
    }
  }

  const saving = set.piecesTotal - product.price

  return (
    <div>
      {/* The range first, the way the reference opens: this starts here and goes to there. */}
      <div className="flex items-baseline gap-2">
        <span className="text-lg text-ink">{formatPrice(cheapest)}</span>
        <span className="text-ink-soft">–</span>
        <span className="text-lg text-ink">{formatPrice(product.price)}</span>
      </div>
      <p className="mt-1 text-xs text-ink-soft">Inclusive of all taxes</p>

      {/* ------------------------------------------------------------ set */}

      <div className="mt-7">
        <div className="mb-2.5 flex items-baseline gap-2">
          <span className="label-caps">Set</span>
          <span className="text-xs text-ink-soft">
            {whole
              ? 'Full set'
              : chosen.length === 0
                ? 'Nothing chosen'
                : chosen.map((p) => p.name).join(' + ')}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {set.pieces.map((piece) => {
            const on = taken.includes(piece.productId)
            return (
              <button
                key={piece.productId}
                type="button"
                disabled={!piece.available}
                aria-pressed={on}
                onClick={() => toggle(piece.productId)}
                className={`border px-4 py-2.5 text-sm transition-colors ${
                  on
                    ? 'border-sage-700 bg-sage-700 text-white'
                    : 'border-rule text-ink hover:border-ink'
                } ${!piece.available ? 'cursor-not-allowed text-ink-soft line-through opacity-50' : ''}`}
              >
                {piece.name}
              </button>
            )
          })}

          <button
            type="button"
            aria-pressed={whole}
            onClick={() => setTaken(sellable.map((p) => p.productId))}
            className={`border px-4 py-2.5 text-sm transition-colors ${
              whole ? 'border-sage-700 bg-sage-700 text-white' : 'border-rule text-ink hover:border-ink'
            }`}
          >
            Full set
          </button>
        </div>

        <p className="mt-2.5 text-xs text-ink-soft">
          {whole
            ? saving > 0
              ? `The full set, ${formatPrice(saving)} less than the pieces separately.`
              : 'The full set.'
            : chosen.length === 0
              ? 'Choose a piece, or take the full set.'
              : `${chosen.length} of ${set.pieces.length} pieces, each at its own price.`}
        </p>
      </div>

      {/* ---------------------------------------------------------- sizes */}

      {chosen.length > 0 && (
        <div className="mt-7 space-y-5">
          {chosen.map((piece) => {
            const anyStock = piece.sizes.some((size) => size.inStock)
            return (
              <div key={piece.productId}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="label-caps">
                    Size
                    {/* Named only when there is more than one, so a single piece reads plainly. */}
                    {chosen.length > 1 && (
                      <span className="ml-2 font-normal normal-case tracking-normal text-ink-soft">
                        {piece.name}
                      </span>
                    )}
                  </span>
                  <Link
                    href={`/products/${piece.slug}`}
                    className="link-underline text-xs text-ink-soft hover:text-ink"
                  >
                    View piece
                  </Link>
                </div>

                {!anyStock ? (
                  <p className="text-xs text-danger">No sizes in stock.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {piece.sizes.map((size) => (
                      <button
                        key={size.id}
                        type="button"
                        disabled={!size.inStock}
                        onClick={() =>
                          setSizes((current) => ({ ...current, [piece.productId]: size.id }))
                        }
                        className={`label-caps min-w-12 border px-3 py-2 text-xs transition-colors ${
                          sizes[piece.productId] === size.id
                            ? 'border-sage-700 bg-sage-700 text-white'
                            : 'border-rule hover:border-ink'
                        } ${!size.inStock ? 'cursor-not-allowed text-ink-soft line-through opacity-50' : ''}`}
                      >
                        {size.name}
                      </button>
                    ))}
                  </div>
                )}

                {touched && !sizes[piece.productId] && anyStock && (
                  <p className="mt-2 text-xs text-danger">Choose a size.</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      {/* ---------------------------------------------------------- total */}

      <div className="mt-7 border-t border-rule pt-6">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="label-caps">Total</span>
          <span className="display text-2xl">{chosen.length > 0 ? formatPrice(total) : '—'}</span>
        </div>

        <Button
          className="w-full justify-center"
          loading={loading}
          disabled={chosen.length === 0}
          onClick={() => void add()}
        >
          Add to bag
        </Button>

        <Button
          variant="outline"
          className="mt-3 w-full justify-center"
          disabled={chosen.length === 0 || loading}
          onClick={async () => {
            if (await add()) router.push('/checkout')
          }}
        >
          Buy now
        </Button>

        {!whole && chosen.length > 0 && saving > 0 && (
          <button
            type="button"
            onClick={() => setTaken(sellable.map((p) => p.productId))}
            className="link-underline mt-3 block w-full text-center text-xs text-sage-700"
          >
            Take the full set for {formatPrice(product.price)} and save {formatPrice(saving)}
          </button>
        )}
      </div>
    </div>
  )
}
