'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { formatPrice } from '@/lib/money'
import { Alert, Button } from '@/components/ui'
import type { ProductDetail } from '@/types/api'

/**
 * Buying a set, piece by piece.
 *
 * Every piece is taken by default, because the set is the thing on the page
 * and its price is what the customer came for. Unticking is how you take less.
 *
 * Two prices apply and the page says which is which as it goes, because the
 * rule is only obvious once you see it move: take the whole look and you pay
 * the set price, take part of it and you pay for the pieces you took. Leaving
 * that to be discovered at checkout would feel like a trick.
 *
 * Sizes are per piece — the whole point of selling a set this way. A customer
 * needing M on top and L below is the ordinary case, not the exception.
 */
export function SetBuy({ product }: { product: ProductDetail }) {
  const set = product.set!
  const router = useRouter()
  const { addSet, loading } = useCart()

  const [taken, setTaken] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(set.pieces.map((piece) => [piece.productId, piece.available])),
  )
  const [sizes, setSizes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const chosen = set.pieces.filter((piece) => taken[piece.productId] && piece.available)
  const whole = chosen.length === set.pieces.length && set.pieces.every((p) => p.available)

  /**
   * What it costs, worked out the same way the server does. Shown live, and
   * recomputed on the server before a rupee is taken — this figure is for
   * reading, never for charging.
   */
  const total = useMemo(
    () =>
      whole
        ? product.price
        : chosen.reduce((sum, piece) => sum + piece.price, 0),
    [whole, chosen, product.price],
  )

  const missingSize = chosen.filter((piece) => !sizes[piece.productId])

  async function add() {
    setTouched(true)
    setError(null)

    if (chosen.length === 0) {
      setError('Choose at least one piece.')
      return
    }
    if (missingSize.length > 0) {
      setError(`Choose a size for ${missingSize.map((p) => p.name).join(' and ')}.`)
      return
    }

    try {
      await addSet(
        product.id,
        chosen.map((piece) => ({ productId: piece.productId, variantId: sizes[piece.productId]! })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that to your bag')
    }
  }

  async function buyNow() {
    await add()
    if (chosen.length > 0 && missingSize.length === 0) router.push('/checkout')
  }

  const saving = set.piecesTotal - product.price

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-lg text-ink">{formatPrice(total)}</span>
        {whole && saving > 0 && (
          <>
            <span className="text-ink-soft line-through">{formatPrice(set.piecesTotal)}</span>
            <span className="badge badge-danger">Save {formatPrice(saving)}</span>
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        {whole
          ? 'The full set. Inclusive of all taxes.'
          : chosen.length === 0
            ? 'Choose the pieces you would like.'
            : `${chosen.length} of ${set.pieces.length} pieces, at their own prices.`}
      </p>

      <div className="mt-7 space-y-3">
        <p className="label-caps">The set</p>

        {set.pieces.map((piece) => {
          const isTaken = Boolean(taken[piece.productId]) && piece.available
          const stocked = piece.sizes.filter((size) => size.inStock)

          return (
            <div
              key={piece.productId}
              className={`border p-4 transition-colors ${
                isTaken ? 'border-sage-300 bg-sage-50' : 'border-rule'
              }`}
            >
              <div className="flex items-start gap-3">
                {/*
                  A real checkbox rather than a styled div: it is a choice that
                  changes the price, and it should be reachable by keyboard and
                  announced as what it is.
                */}
                <input
                  id={`piece-${piece.productId}`}
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-[#5b6241]"
                  checked={isTaken}
                  disabled={!piece.available}
                  onChange={(e) =>
                    setTaken((current) => ({ ...current, [piece.productId]: e.target.checked }))
                  }
                />

                {piece.image && (
                  <span className="relative size-14 shrink-0 overflow-hidden bg-sage-100">
                    <Image src={piece.image} alt="" fill sizes="56px" className="object-cover" />
                  </span>
                )}

                <label htmlFor={`piece-${piece.productId}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block text-sm">{piece.name}</span>
                  <span className="mt-0.5 block text-xs text-ink-soft">
                    {piece.available ? formatPrice(piece.price) : 'Not available'}
                    {piece.available && ' on its own'}
                  </span>
                </label>

                <Link
                  href={`/products/${piece.slug}`}
                  className="link-underline shrink-0 text-xs text-ink-soft hover:text-ink"
                >
                  View
                </Link>
              </div>

              {isTaken && (
                <div className="mt-3.5 pl-7">
                  {stocked.length === 0 ? (
                    <p className="text-xs text-danger">No sizes in stock.</p>
                  ) : (
                    <>
                      <p className="label-caps mb-2 text-[0.65rem]">Size</p>
                      <div className="flex flex-wrap gap-1.5">
                        {piece.sizes.map((size) => (
                          <button
                            key={size.id}
                            type="button"
                            disabled={!size.inStock}
                            onClick={() =>
                              setSizes((current) => ({ ...current, [piece.productId]: size.id }))
                            }
                            className={`label-caps min-w-10 border px-2.5 py-1.5 text-[0.68rem] transition-colors ${
                              sizes[piece.productId] === size.id
                                ? 'border-sage-700 bg-white text-ink'
                                : 'border-rule hover:border-ink'
                            } ${!size.inStock ? 'cursor-not-allowed text-ink-soft line-through opacity-50' : ''}`}
                          >
                            {size.name}
                          </button>
                        ))}
                      </div>
                      {touched && !sizes[piece.productId] && (
                        <p className="mt-2 text-xs text-danger">Choose a size.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

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
          onClick={() => void buyNow()}
        >
          Buy now
        </Button>

        {!whole && chosen.length > 0 && saving > 0 && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-sage-700">
            <Check className="mt-0.5 size-3 shrink-0" strokeWidth={2.5} />
            Take all {set.pieces.length} pieces for {formatPrice(product.price)} and save{' '}
            {formatPrice(saving)}.
          </p>
        )}
      </div>
    </div>
  )
}
