'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { formatPrice } from '@/lib/money'
import { Alert, Button, EmptyState } from '@/components/ui'

export function CartDrawer() {
  const { cart, drawerOpen, closeCart, updateItem, removeItem, loading, error } = useCart()

  if (!drawerOpen) return null
  const items = cart?.items ?? []

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-ink/30" onClick={closeCart} aria-hidden />

      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white"
        role="dialog"
        aria-label="Shopping bag"
      >
        <header className="flex items-center justify-between border-b border-hairline px-6 py-5">
          <h2 className="label-caps">Your bag ({cart?.itemCount ?? 0})</h2>
          <button type="button" onClick={closeCart} aria-label="Close bag">
            <X className="size-5" strokeWidth={1.4} />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 items-center px-6">
            <EmptyState
              icon={<ShoppingBag className="size-7" strokeWidth={1.2} />}
              title="Your bag is empty"
              action={
                <Link href="/products" onClick={closeCart} className="btn btn-outline btn-sm">
                  Start shopping
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {error && <Alert>{error}</Alert>}

              {(cart?.issues.length ?? 0) > 0 && (
                <div className="mb-4">
                  <Alert tone="danger">
                    <ul className="space-y-1">
                      {cart!.issues.map((issue) => (
                        <li key={issue.itemId + issue.code}>{issue.message}</li>
                      ))}
                    </ul>
                  </Alert>
                </div>
              )}

              <ul className="space-y-6">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-4">
                    <Link
                      href={`/products/${item.product.slug}`}
                      onClick={closeCart}
                      className="relative aspect-2/3 w-20 shrink-0 overflow-hidden bg-sage-50"
                    >
                      {item.product.image && (
                        <Image src={item.product.image} alt={item.product.name} fill sizes="80px" className="object-cover" />
                      )}
                    </Link>

                    <div className="flex flex-1 flex-col">
                      <div className="flex justify-between gap-3">
                        <div>
                          <Link
                            href={`/products/${item.product.slug}`}
                            onClick={closeCart}
                            className="display text-[0.98rem] leading-snug"
                          >
                            {item.product.name}
                          </Link>
                          <p className="mt-0.5 text-xs text-ink-soft">{item.variant.name}</p>
                          {!item.purchasable && (
                            <p className="mt-1 text-xs text-danger">Unavailable</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeItem(item.id)}
                          aria-label={`Remove ${item.product.name}`}
                          className="shrink-0 text-ink-soft hover:text-ink"
                        >
                          <X className="size-4" strokeWidth={1.4} />
                        </button>
                      </div>

                      <div className="mt-auto flex items-center justify-between pt-3">
                        <div className="flex items-center border border-rule">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => void updateItem(item.id, item.quantity - 1)}
                            className="px-2.5 py-1.5 disabled:opacity-40"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="size-3" strokeWidth={1.6} />
                          </button>
                          <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            disabled={loading || item.quantity >= item.availableStock}
                            onClick={() => void updateItem(item.id, item.quantity + 1)}
                            className="px-2.5 py-1.5 disabled:opacity-40"
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-3" strokeWidth={1.6} />
                          </button>
                        </div>
                        <span className="text-sm">{formatPrice(item.lineTotal)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <footer className="border-t border-hairline px-6 py-5">
              <div className="flex items-center justify-between">
                <span className="label-caps">Subtotal</span>
                <span className="text-base">{formatPrice(cart?.subtotal ?? 0)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">Shipping calculated at checkout.</p>

              <Link
                href="/checkout"
                onClick={closeCart}
                aria-disabled={!cart?.checkoutReady}
                className={`btn btn-primary mt-4 w-full ${!cart?.checkoutReady ? 'pointer-events-none opacity-45' : ''}`}
              >
                Checkout
              </Link>
              <Link
                href="/cart"
                onClick={closeCart}
                className="label-caps link-underline mt-4 block text-center text-ink-soft"
              >
                View bag
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
