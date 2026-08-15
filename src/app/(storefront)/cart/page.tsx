'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { formatPrice } from '@/lib/money'
import { Alert, Button, EmptyState, SkeletonRows } from '@/components/ui'

export default function CartPage() {
  const { cart, updateItem, removeItem, loading, error } = useCart()

  if (!cart) {
    return (
      <div className="container-pk py-16">
        <SkeletonRows rows={4} />
      </div>
    )
  }

  const items = cart.items

  return (
    <div className="container-pk py-12 md:py-16">
      <header className="mb-10 text-center">
        <h1 className="display text-[2.2rem] md:text-[2.6rem]">Your bag</h1>
        <div className="rule-dot mt-4" aria-hidden />
      </header>

      {error && <Alert>{error}</Alert>}

      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="size-8" strokeWidth={1.2} />}
          title="Your bag is empty"
          body="Once you add something, it will appear here."
          action={
            <Link href="/products" className="btn btn-primary">
              Start shopping
            </Link>
          }
        />
      ) : (
        <div className="grid gap-12 lg:grid-cols-[1fr_360px] lg:gap-16">
          <div>
            {cart.issues.length > 0 && (
              <div className="mb-6">
                <Alert tone="danger">
                  <p className="mb-1 font-medium">Some items need attention before checkout:</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {cart.issues.map((issue) => (
                      <li key={issue.itemId + issue.code}>{issue.message}</li>
                    ))}
                  </ul>
                </Alert>
              </div>
            )}

            <ul className="border-t border-hairline">
              {items.map((item) => (
                <li key={item.id} className="flex gap-5 border-b border-hairline py-6">
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="relative aspect-2/3 w-24 shrink-0 overflow-hidden bg-sage-50 md:w-32"
                  >
                    {item.product.image && (
                      <Image
                        src={item.product.image}
                        alt={item.product.name}
                        fill
                        sizes="128px"
                        className="object-cover"
                      />
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-4">
                      <div>
                        <Link href={`/products/${item.product.slug}`} className="display text-lg leading-snug">
                          {item.product.name}
                        </Link>
                        <p className="mt-1 text-xs text-ink-soft">
                          {item.variant.name === 'Default' ? item.variant.sku : `Size ${item.variant.name}`}
                        </p>
                        <p className="mt-1 text-xs text-ink-soft">{formatPrice(item.unitPrice)} each</p>
                        {!item.purchasable && (
                          <p className="mt-2 text-xs text-danger">
                            {item.availableStock === 0 ? 'Out of stock' : `Only ${item.availableStock} left`}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => void removeItem(item.id)}
                        aria-label={`Remove ${item.product.name}`}
                        className="h-fit text-ink-soft hover:text-ink"
                      >
                        <X className="size-4" strokeWidth={1.4} />
                      </button>
                    </div>

                    <div className="mt-auto flex items-end justify-between pt-4">
                      <div className="flex items-center border border-rule">
                        <button
                          type="button"
                          disabled={loading || item.quantity <= 1}
                          onClick={() => void updateItem(item.id, item.quantity - 1)}
                          className="px-3 py-2 disabled:opacity-40"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-3" strokeWidth={1.6} />
                        </button>
                        <span className="min-w-9 text-center text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          disabled={loading || item.quantity >= item.availableStock}
                          onClick={() => void updateItem(item.id, item.quantity + 1)}
                          className="px-3 py-2 disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          <Plus className="size-3" strokeWidth={1.6} />
                        </button>
                      </div>
                      <span>{formatPrice(item.lineTotal)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <aside className="lg:sticky lg:top-28 lg:h-fit">
            <div className="border border-rule p-7">
              <h2 className="label-caps mb-5">Order summary</h2>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Subtotal</dt>
                  <dd>{formatPrice(cart.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Shipping</dt>
                  <dd className="text-ink-soft">Calculated at checkout</dd>
                </div>
              </dl>

              <div className="mt-5 flex justify-between border-t border-hairline pt-5">
                <span className="label-caps">Total</span>
                <span className="text-base">{formatPrice(cart.subtotal)}</span>
              </div>

              <Link
                href="/checkout"
                aria-disabled={!cart.checkoutReady}
                className={`btn btn-primary mt-6 w-full ${!cart.checkoutReady ? 'pointer-events-none opacity-45' : ''}`}
              >
                Proceed to checkout
              </Link>

              <p className="mt-4 text-xs leading-relaxed text-ink-soft">
                You&rsquo;ll be asked to sign in before completing your order.
              </p>

              <Link href="/products" className="label-caps link-underline mt-5 block text-center text-ink-soft">
                Continue shopping
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
