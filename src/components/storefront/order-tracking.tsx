'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Truck } from 'lucide-react'
import { trackingService, type Shipment } from '@/services/storefront.service'
import { formatDateTime } from '@/lib/utils'
import { SkeletonRows, StatusBadge } from '@/components/ui'

/**
 * Shipment tracking for one order.
 *
 * An order can go out in several parcels, so each shipment gets its own panel
 * with its own trail. Nothing renders until there is a shipment — before
 * despatch the order history already tells the customer where things stand.
 */
export function OrderTracking({ orderId }: { orderId: string }) {
  const [shipments, setShipments] = useState<Shipment[] | null>(null)

  useEffect(() => {
    void trackingService
      .forOrder(orderId)
      .then((result) => setShipments(result.shipments))
      // Tracking is supplementary; a failure here must not break the page.
      .catch(() => setShipments([]))
  }, [orderId])

  if (shipments === null) return <SkeletonRows rows={2} className="mt-6" />
  if (shipments.length === 0) return null

  return (
    <section className="mt-6 space-y-4">
      <h3 className="label-caps">
        {shipments.length === 1 ? 'Delivery' : `Delivery — ${shipments.length} parcels`}
      </h3>

      {shipments.map((shipment) => (
        <div key={shipment.id} className="border border-rule p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm">
                <Truck className="size-4 shrink-0 text-sage-700" strokeWidth={1.5} aria-hidden />
                <span className="display text-base">{shipment.shipmentNumber}</span>
              </p>
              {shipment.carrier && (
                <p className="mt-1 text-xs capitalize text-ink-soft">
                  {shipment.carrier}
                  {shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ''}
                </p>
              )}
              {shipment.estimatedAt && shipment.status !== 'DELIVERED' && (
                <p className="mt-1 text-xs text-ink-soft">
                  Expected {formatDateTime(shipment.estimatedAt)}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge status={shipment.status} />
              {shipment.trackingUrl && (
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="label-caps link-underline inline-flex items-center gap-1 text-sage-700"
                >
                  Track
                  <ExternalLink className="size-3" strokeWidth={1.6} aria-hidden />
                </a>
              )}
            </div>
          </div>

          {shipments.length > 1 && (
            <ul className="mt-4 space-y-1 text-xs text-ink-soft">
              {shipment.items.map((item) => (
                <li key={item.id}>
                  {item.quantity} × {item.orderItem.productNameSnapshot}
                  {item.orderItem.variantNameSnapshot &&
                  item.orderItem.variantNameSnapshot !== 'Default'
                    ? ` (${item.orderItem.variantNameSnapshot})`
                    : ''}
                </li>
              ))}
            </ul>
          )}

          {shipment.events.length > 0 && (
            <ol className="mt-4 space-y-3 border-t border-hairline pt-4">
              {shipment.events.map((event) => (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sage-600" aria-hidden />
                  <div>
                    <p className="capitalize">{event.status.replace(/_/g, ' ').toLowerCase()}</p>
                    <p className="text-xs text-ink-soft">
                      {formatDateTime(event.occurredAt)}
                      {event.location ? ` · ${event.location}` : ''}
                      {event.message ? ` · ${event.message}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </section>
  )
}
