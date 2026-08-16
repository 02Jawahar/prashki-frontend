'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Heart, X } from 'lucide-react'
import { trackEvent, wishlistService, type WishlistItem } from '@/services/storefront.service'
import { useCart } from '@/hooks/use-cart'
import { formatPrice } from '@/lib/money'
import { Alert, Button, EmptyState, SkeletonCards } from '@/components/ui'

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const { addItem } = useCart()

  async function moveToCart(item: WishlistItem) {
    if (!item.addableVariantId) return

    setAdding(item.id)
    setError(null)
    try {
      await addItem(item.addableVariantId, 1)
      trackEvent('cart.add', { entityType: 'Product', entityId: item.product.id })
      // Saved and bought are different lists; moving means leaving this one.
      await wishlistService.remove(item.id)
      setItems((current) => current.filter((row) => row.id !== item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that to your bag')
    } finally {
      setAdding(null)
    }
  }

  useEffect(() => {
    void wishlistService
      .list()
      .then((result) => setItems(result.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your wishlist'))
      .finally(() => setLoading(false))
  }, [])

  async function remove(id: string) {
    setRemoving(id)
    try {
      await wishlistService.remove(id)
      setItems((current) => current.filter((item) => item.id !== id))
    } catch {
      setError('Could not remove that item.')
    } finally {
      setRemoving(null)
    }
  }

  if (loading) return <SkeletonCards count={4} />

  return (
    <div>
      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-8" strokeWidth={1.2} />}
          title="Nothing saved yet"
          body="Tap the heart on anything you want to come back to."
          action={
            <Link href="/products" className="btn btn-primary btn-sm">
              Browse the collection
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-8">
          {items.map((item) => (
            <li key={item.id} className="group relative">
              <button
                type="button"
                onClick={() => void remove(item.id)}
                disabled={removing === item.id}
                aria-label={`Remove ${item.product.name} from your wishlist`}
                className="absolute right-2 top-2 z-10 bg-paper/90 p-1.5 text-ink-soft opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
              >
                <X className="size-4" strokeWidth={1.4} />
              </button>

              <Link href={`/products/${item.product.slug}`} className="block">
                <div className="relative aspect-2/3 overflow-hidden bg-sage-50">
                  {item.product.image && (
                    <Image
                      src={item.product.image}
                      alt={item.product.name}
                      fill
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-cover"
                    />
                  )}
                  {(!item.available || !item.inStock) && (
                    <span className="absolute inset-x-0 bottom-0 bg-ink/75 py-1.5 text-center text-xs text-white">
                      {!item.available ? 'No longer available' : 'Out of stock'}
                    </span>
                  )}
                </div>

                <p className="display mt-4 text-center text-lg leading-snug">{item.product.name}</p>
                {item.variant && item.variant.name !== 'Default' && (
                  <p className="mt-1 text-center text-xs text-ink-soft">Size {item.variant.name}</p>
                )}
                <p className="mt-1 text-center text-sm">
                  {formatPrice(item.price)}
                  {item.compareAtPrice && item.compareAtPrice > item.price && (
                    <span className="ml-2 text-xs text-ink-soft line-through">
                      {formatPrice(item.compareAtPrice)}
                    </span>
                  )}
                </p>
              </Link>

              {/*
                Move to cart (FR-18.5). Only offered when the server has said
                there is a single purchasable variant — otherwise the customer
                goes and picks a size, because guessing one for them is how
                the wrong thing gets bought.
              */}
              {item.available && item.inStock ? (
                item.addableVariantId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    loading={adding === item.id}
                    onClick={() => void moveToCart(item)}
                  >
                    Add to bag
                  </Button>
                ) : (
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="btn btn-outline btn-sm mt-3 w-full"
                  >
                    Choose a size
                  </Link>
                )
              ) : (
                <p className="mt-3 text-center text-xs text-ink-soft">
                  {item.available ? 'Out of stock' : 'No longer available'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
