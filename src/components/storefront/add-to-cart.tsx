'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { formatPrice } from '@/lib/money'
import { Alert, Button } from '@/components/ui'
import type { ProductDetail } from '@/types/api'

/**
 * Variant selection, quantity and the two purchase paths.
 *
 * When variants exist, everything is bought against a variant — never the
 * product (spec §11). Prices shown here are display only; the server recomputes
 * every figure from the database at add-to-cart and again at order creation.
 */
export function AddToCart({ product }: { product: ProductDetail }) {
  const router = useRouter()
  const { addItem, addParts, loading } = useCart()

  /**
   * What may be bought of this product, when it is sold in parts. One size
   * governs whichever part is chosen — that is the trade for the pieces not
   * being products of their own.
   */
  const parts = product.setOptions ?? []

  /**
   * Which parts are wanted, not which one.
   *
   * A garment sold in parts is not a choice between them — somebody may want
   * the top and the cape and not the pant, and asking them to add twice and
   * hope the halves stay together is asking them to do the shop's work. So
   * the row toggles and the price follows the selection.
   */
  const [partIds, setPartIds] = useState<string[]>(
    // The whole thing to begin with: it is what the page is for, and what the
    // headline price refers to.
    () => (parts[parts.length - 1] ? [parts[parts.length - 1]!.id] : []),
  )

  const chosen = parts.filter((p) => partIds.includes(p.id))
  /** The single-part case still reads as one part everywhere below. */
  const part = chosen.length === 1 ? chosen[0]! : null
  const partsTotal = chosen.reduce((sum, p) => sum + p.price, 0)

  const togglePart = (id: string) =>
    setPartIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )

  /**
   * A single option that costs less than the parts chosen to make it up.
   *
   * Usually the "Set". Worth saying out loud rather than quietly charging the
   * higher number — the customer picked the parts because that is how they
   * think about the garment, not because they wanted to pay more for it.
   */
  const cheaperWhole =
    chosen.length > 1
      ? (parts.find((p) => !partIds.includes(p.id) && p.price < partsTotal) ?? null)
      : null

  const sellable = product.variants.filter((v) => v.status === 'ACTIVE')
  const single = sellable.length === 1 && sellable[0]!.name === 'Default'

  const [variantId, setVariantId] = useState<string | null>(single ? sellable[0]!.id : null)
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const selected = sellable.find((v) => v.id === variantId) ?? null
  // The chosen parts price the line; otherwise the size, otherwise the product.
  const price = chosen.length > 0 ? partsTotal : (selected?.price ?? product.price)
  const maxQuantity = Math.min(selected?.stock ?? 0, 20)
  const soldOut = selected ? selected.stock <= 0 : !product.inStock

  async function add(): Promise<boolean> {
    setTouched(true)
    setError(null)

    if (!variantId) {
      setError('Please choose a size first.')
      return false
    }
    if (parts.length > 0 && chosen.length === 0) {
      setError('Please choose at least one part.')
      return false
    }
    try {
      // Several parts go in as one purchase, tied together, so the bag shows
      // them as one and removing one removes all of them.
      if (chosen.length > 1) await addParts(variantId, partIds, quantity)
      else await addItem(variantId, quantity, part?.id)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to bag')
      return false
    }
  }

  async function buyNow() {
    // Straight to checkout; the checkout page handles the sign-in requirement.
    if (await add()) router.push('/checkout')
  }

  return (
    <div>
      {parts.length > 0 && (
        <p className="mb-1 text-sm text-ink-soft">
          {formatPrice(Math.min(...parts.map((p) => p.price)))} –{' '}
          {formatPrice(Math.max(...parts.map((p) => p.price)))}
        </p>
      )}

      <div className="flex items-baseline gap-3">
        {product.compareAtPrice && product.compareAtPrice > price && (
          <span className="text-ink-soft line-through">{formatPrice(product.compareAtPrice)}</span>
        )}
        <span className={`text-lg ${product.discountPercent > 0 ? 'text-sale' : 'text-ink'}`}>
          {formatPrice(price)}
        </span>
        {product.discountPercent > 0 && (
          <span className="badge badge-danger">{product.discountPercent}% off</span>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-soft">Inclusive of all taxes</p>

      {parts.length > 0 && (
        <div className="mt-7">
          <div className="mb-2.5 flex items-baseline gap-2">
            <span className="label-caps">Set</span>
            <span className="text-xs text-ink-soft">
              {chosen.length === 0
                ? 'Choose a part'
                : chosen.map((p) => p.label).join(' + ')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {parts.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={partIds.includes(option.id)}
                onClick={() => togglePart(option.id)}
                className={`border px-4 py-2.5 text-sm transition-colors ${
                  partIds.includes(option.id)
                    ? 'border-sage-700 bg-sage-700 text-white'
                    : 'border-rule text-ink hover:border-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/*
            What the selection adds up to, itemised, once there is more than
            one. A single part already has its price in the headline above.
          */}
          {chosen.length > 1 && (
            <p className="mt-3 text-xs text-ink-soft">
              {chosen.map((p) => `${p.label} ${formatPrice(p.price)}`).join('  +  ')}
              {'  =  '}
              <span className="text-ink">{formatPrice(partsTotal)}</span>
            </p>
          )}

          {/*
            Never quietly charge more than the same garments cost under one
            name. The customer chose the parts because that is how they think
            about the piece, not because they wanted to pay extra for it.
          */}
          {cheaperWhole && (
            <button
              type="button"
              onClick={() => setPartIds([cheaperWhole.id])}
              className="link-underline mt-2 block text-xs text-ink"
            >
              {cheaperWhole.label} is {formatPrice(cheaperWhole.price)} — {formatPrice(partsTotal - cheaperWhole.price)} less
            </button>
          )}
        </div>
      )}

      {!single && (
        <div className="mt-7">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="label-caps">
              Size
              {selected && <span className="ml-2 normal-case tracking-normal text-ink-soft">{selected.name}</span>}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {sellable.map((variant) => {
              const isSelected = variant.id === variantId
              const out = variant.stock <= 0
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={out}
                  onClick={() => {
                    setVariantId(variant.id)
                    setQuantity(1)
                  }}
                  className={`min-w-14 border px-3.5 py-2.5 text-xs transition-colors ${
                    isSelected
                      ? 'border-sage-700 bg-sage-700 text-white'
                      : out
                        ? 'cursor-not-allowed border-rule text-ink-soft/50 line-through'
                        : 'border-rule text-ink hover:border-ink'
                  }`}
                >
                  {variant.name}
                </button>
              )
            })}
          </div>

          {touched && !variantId && (
            <p role="alert" className="mt-3 text-xs text-sale">
              Please choose a size.
            </p>
          )}
        </div>
      )}

      {selected && !soldOut && (
        <div className="mt-6">
          <span className="label-caps mb-2.5 block">Quantity</span>
          <div className="flex w-fit items-center border border-rule">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="px-3 py-2 disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="size-3" strokeWidth={1.6} />
            </button>
            <span className="min-w-10 text-center text-sm">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
              disabled={quantity >= maxQuantity}
              className="px-3 py-2 disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="size-3" strokeWidth={1.6} />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-7 space-y-3">
        <Button
          type="button"
          onClick={() => void add()}
          disabled={soldOut}
          loading={loading}
          className="w-full"
        >
          {soldOut ? 'Sold out' : 'Add to bag'}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => void buyNow()}
          disabled={soldOut || loading}
          className="w-full"
        >
          Buy now
        </Button>
      </div>

      {selected && (
        <p className="mt-5 text-xs text-ink-soft">
          {selected.stock > 0 ? (
            selected.stock <= selected.lowStockThreshold ? (
              <span className="text-warning">Only {selected.stock} left</span>
            ) : (
              'In stock'
            )
          ) : (
            'Out of stock'
          )}
          <span className="mx-2">·</span>
          <span className="tabular-nums">{selected.sku}</span>
        </p>
      )}
    </div>
  )
}
