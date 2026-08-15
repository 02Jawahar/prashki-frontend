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
  const { addItem, loading } = useCart()

  const sellable = product.variants.filter((v) => v.status === 'ACTIVE')
  const single = sellable.length === 1 && sellable[0]!.name === 'Default'

  const [variantId, setVariantId] = useState<string | null>(single ? sellable[0]!.id : null)
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const selected = sellable.find((v) => v.id === variantId) ?? null
  const price = selected?.price ?? product.price
  const maxQuantity = Math.min(selected?.stock ?? 0, 20)
  const soldOut = selected ? selected.stock <= 0 : !product.inStock

  async function add(): Promise<boolean> {
    setTouched(true)
    setError(null)

    if (!variantId) {
      setError('Please choose a size first.')
      return false
    }
    try {
      await addItem(variantId, quantity)
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
