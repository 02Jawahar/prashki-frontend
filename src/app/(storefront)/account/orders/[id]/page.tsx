'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { orderService, type Order } from '@/services/order.service'
import { formatPrice } from '@/lib/money'
import { formatDateTime } from '@/lib/utils'
import { Alert, SkeletonRows, StatusBadge } from '@/components/ui'
import { OrderTracking } from '@/components/storefront/order-tracking'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setOrder(await orderService.byId(id))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load that order')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) return <SkeletonRows rows={5} />
  if (error || !order) return <Alert>{error ?? 'Order not found'}</Alert>

  const address = order.shippingAddressSnapshot
  const payment = order.payments[0]

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/account/orders"
        className="label-caps mb-5 inline-flex items-center gap-1 text-ink-soft hover:text-ink"
      >
        <ChevronLeft className="size-3.5" strokeWidth={1.6} />
        Orders
      </Link>

      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="display text-2xl">{order.orderNumber}</h2>
          <p className="mt-1 text-xs text-ink-soft">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <section className="border border-rule">
        <ul className="divide-y divide-hairline">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 p-5">
              <div className="relative aspect-2/3 w-16 shrink-0 overflow-hidden bg-sage-50">
                {item.imageUrlSnapshot && (
                  <Image
                    src={item.imageUrlSnapshot}
                    alt={item.productNameSnapshot}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex flex-1 justify-between gap-3">
                <div>
                  {/* Snapshotted at purchase — independent of the live catalogue. */}
                  <p className="display leading-tight">{item.productNameSnapshot}</p>
                  <p className="text-xs text-ink-soft">
                    {item.variantNameSnapshot && item.variantNameSnapshot !== 'Default'
                      ? `${item.variantNameSnapshot} · `
                      : ''}
                    {item.sku}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {item.quantity} × {formatPrice(item.unitPrice)}
                  </p>
                </div>
                <span className="shrink-0 text-sm">{formatPrice(item.lineTotal)}</span>
              </div>
            </li>
          ))}
        </ul>

        <dl className="space-y-2.5 border-t border-hairline p-5 text-sm">
          <Row label="Subtotal" value={formatPrice(order.subtotal)} />
          {order.discount > 0 && (
            <Row
              label={order.couponCode ? `Discount (${order.couponCode})` : 'Discount'}
              value={`−${formatPrice(order.discount)}`}
            />
          )}
          <Row
            label={order.shippingMethodName ? `Shipping — ${order.shippingMethodName}` : 'Shipping'}
            value={order.shipping === 0 ? 'Complimentary' : formatPrice(order.shipping)}
          />
          {order.tax > 0 && <Row label="Tax" value={formatPrice(order.tax)} />}
          <div className="flex justify-between border-t border-hairline pt-3 text-base">
            <dt className="label-caps">Total</dt>
            <dd>{formatPrice(order.total)}</dd>
          </div>
        </dl>
      </section>

      <OrderTracking orderId={order.id} />

      {order.status === 'DELIVERED' && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-rule p-5">
          <p className="text-sm text-ink-soft">
            Something not right? Returns are open for seven days after delivery.
          </p>
          <Link href={`/account/orders/${order.id}/return`} className="btn btn-outline btn-sm">
            Start a return
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="border border-rule p-5">
          <h3 className="label-caps mb-3">Shipping to</h3>
          <address className="text-sm not-italic leading-relaxed text-ink-soft">
            {address.name}
            <br />
            {address.addressLine1}
            {address.addressLine2 && (
              <>
                <br />
                {address.addressLine2}
              </>
            )}
            <br />
            {address.city}, {address.state} {address.postalCode}
            <br />
            {address.phone}
          </address>
        </section>

        <section className="border border-rule p-5">
          <h3 className="label-caps mb-3">Payment</h3>
          {payment ? (
            <dl className="space-y-1.5 text-sm text-ink-soft">
              <div className="flex justify-between">
                <dt>Provider</dt>
                <dd className="text-ink">{payment.provider}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={payment.status} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Amount</dt>
                <dd className="text-ink">{formatPrice(payment.amount)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-ink-soft">No payment recorded.</p>
          )}
        </section>
      </div>

      <section className="mt-6 border border-rule p-5">
        <h3 className="label-caps mb-4">History</h3>
        <ol className="space-y-3">
          {order.statusHistory.map((entry) => (
            <li key={entry.id} className="flex gap-3 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sage-600" aria-hidden />
              <div>
                <p>
                  {entry.fromStatus ? `${label(entry.fromStatus)} → ` : ''}
                  {label(entry.toStatus)}
                </p>
                <p className="text-xs text-ink-soft">
                  {formatDateTime(entry.createdAt)}
                  {entry.note ? ` · ${entry.note}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function label(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase()
}
