'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { orderService, type OrderSummary } from '@/services/order.service'
import { formatPrice } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { Alert, EmptyState, SkeletonRows, StatusBadge } from '@/components/ui'

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setOrders((await orderService.list()).orders)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your orders')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <SkeletonRows rows={4} />
  if (error) return <Alert>{error}</Alert>

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        body="When you place an order it will show up here."
        action={
          <Link href="/products" className="btn btn-primary btn-sm">
            Start shopping
          </Link>
        }
      />
    )
  }

  return (
    <ul className="mx-auto max-w-3xl space-y-4">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={`/account/orders/${order.id}`}
            className="flex items-center gap-5 border border-rule p-5 transition-colors hover:border-ink"
          >
            <div className="flex -space-x-3">
              {order.items.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-2/3 w-12 overflow-hidden border-2 border-white bg-sage-50"
                >
                  {item.imageUrlSnapshot && (
                    <Image
                      src={item.imageUrlSnapshot}
                      alt={item.productNameSnapshot}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              <p className="display text-lg">{order.orderNumber}</p>
              <p className="text-xs text-ink-soft">
                {formatDate(order.createdAt)} · {order.itemCount}{' '}
                {order.itemCount === 1 ? 'item' : 'items'}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm">{formatPrice(order.total)}</p>
              <StatusBadge status={order.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
