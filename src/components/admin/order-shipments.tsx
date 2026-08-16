'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { shipmentService, type AdminShipment } from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { formatDateTime } from '@/lib/utils'
import {
  Alert,
  Button,
  ConfirmDialog,
  Field,
  Input,
  Select,
  SkeletonRows,
  StatusBadge,
} from '@/components/ui'
import type { OrderItem } from '@/services/order.service'

/**
 * Shipments for one order (M09).
 *
 * An order can go out in several parcels, so the form works from what is still
 * unshipped rather than from the order lines directly. The API enforces the
 * same ceiling — this just stops the screen offering an impossible quantity.
 */
const CARRIERS = ['bluedart', 'delhivery', 'dtdc', 'ekart', 'indiapost', 'xpressbees'] as const

const STATUSES = [
  'READY_TO_SHIP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED_TO_ORIGIN',
  'CANCELLED',
] as const

export function OrderShipments({
  orderId,
  items,
  onChanged,
}: {
  orderId: string
  items: OrderItem[]
  onChanged?: () => void | Promise<void>
}) {
  const { can } = useAuth()
  const editable = can('shipment.manage')

  const [shipments, setShipments] = useState<AdminShipment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')

  const [statusChange, setStatusChange] = useState<{ id: string; status: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setShipments(await shipmentService.forOrder(orderId))
    } catch {
      setShipments([])
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  /** Quantity already committed to a live parcel, per order line. */
  const shipped = new Map<string, number>()
  for (const shipment of shipments ?? []) {
    if (shipment.status === 'CANCELLED') continue
    for (const item of shipment.items) {
      shipped.set(item.orderItemId, (shipped.get(item.orderItemId) ?? 0) + item.quantity)
    }
  }

  const remaining = items.map((item) => ({
    item,
    left: item.quantity - (shipped.get(item.id) ?? 0),
  }))
  const anythingLeft = remaining.some((row) => row.left > 0)

  async function create() {
    const chosen = Object.entries(quantities).filter(([, quantity]) => quantity > 0)
    if (chosen.length === 0) return

    setBusy(true)
    setError(null)

    try {
      await shipmentService.create(orderId, {
        items: chosen.map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
        carrier: carrier || null,
        trackingNumber: trackingNumber || null,
      })
      setCreating(false)
      setQuantities({})
      setCarrier('')
      setTrackingNumber('')
      await load()
      await onChanged?.()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create that shipment')
    } finally {
      setBusy(false)
    }
  }

  async function applyStatus() {
    if (!statusChange) return

    setBusy(true)
    setError(null)

    try {
      await shipmentService.setStatus(statusChange.id, { status: statusChange.status })
      setStatusChange(null)
      await load()
      await onChanged?.()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update that shipment')
    } finally {
      setBusy(false)
    }
  }

  if (shipments === null) return <SkeletonRows rows={2} />

  return (
    <section className="border border-rule bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <h2 className="label-caps">Shipments</h2>
        {editable && anythingLeft && !creating && (
          <Button size="sm" variant="ghost" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" strokeWidth={2} />
            New shipment
          </Button>
        )}
      </header>

      {error && (
        <div className="p-5 pb-0">
          <Alert>{error}</Alert>
        </div>
      )}

      {creating && (
        <div className="border-b border-hairline p-5">
          <p className="label-caps mb-3">What is going in this parcel?</p>

          <ul className="space-y-2">
            {remaining.map(({ item, left }) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {item.productNameSnapshot}
                  {item.variantNameSnapshot && item.variantNameSnapshot !== 'Default'
                    ? ` (${item.variantNameSnapshot})`
                    : ''}
                  <span className="ml-2 text-xs text-ink-soft">
                    {left} of {item.quantity} left
                  </span>
                </span>

                <Select
                  aria-label={`Quantity of ${item.productNameSnapshot}`}
                  disabled={left === 0}
                  value={quantities[item.id] ?? 0}
                  onChange={(event) =>
                    setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))
                  }
                  className="w-20 shrink-0"
                >
                  {Array.from({ length: left + 1 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Carrier" htmlFor="carrier" hint="Adds a tracking link if we know the format.">
              <Select id="carrier" value={carrier} onChange={(event) => setCarrier(event.target.value)}>
                <option value="">Not yet decided</option>
                {CARRIERS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Tracking number" htmlFor="tracking" hint="Leave empty until the courier has it.">
              <Input
                id="tracking"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
              />
            </Field>
          </div>

          <div className="mt-4 flex gap-3">
            <Button
              size="sm"
              loading={busy}
              disabled={Object.values(quantities).every((quantity) => !quantity)}
              onClick={() => void create()}
            >
              Create shipment
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {shipments.length === 0 ? (
        <p className="p-5 text-sm text-ink-soft">Nothing has been despatched yet.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {shipments.map((shipment) => (
            <li key={shipment.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm">
                    <span className="display text-base">{shipment.shipmentNumber}</span>
                    {shipment.carrier && (
                      <span className="ml-2 text-xs capitalize text-ink-soft">
                        {shipment.carrier}
                        {shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ''}
                      </span>
                    )}
                  </p>
                  <ul className="mt-1 text-xs text-ink-soft">
                    {shipment.items.map((item) => (
                      <li key={item.id}>
                        {item.quantity} × {item.orderItem.productNameSnapshot}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center gap-3">
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
                  <StatusBadge status={shipment.status} />
                </div>
              </div>

              {shipment.events.length > 0 && (
                <ol className="mt-3 space-y-1.5 border-t border-hairline pt-3 text-xs text-ink-soft">
                  {shipment.events.slice(0, 4).map((event) => (
                    <li key={event.id}>
                      <span className="capitalize">{event.status.replace(/_/g, ' ').toLowerCase()}</span>
                      {' · '}
                      {formatDateTime(event.occurredAt)}
                      {event.message ? ` · ${event.message}` : ''}
                    </li>
                  ))}
                </ol>
              )}

              {editable && !['DELIVERED', 'CANCELLED', 'RETURNED_TO_ORIGIN'].includes(shipment.status) && (
                <div className="mt-3 flex items-center gap-2">
                  <Select
                    aria-label={`Update ${shipment.shipmentNumber}`}
                    value=""
                    onChange={(event) =>
                      event.target.value &&
                      setStatusChange({ id: shipment.id, status: event.target.value })
                    }
                    className="w-52"
                  >
                    <option value="">Update status…</option>
                    {STATUSES.filter((status) => status !== shipment.status).map((status) => (
                      <option key={status} value={status}>
                        {status.replace(/_/g, ' ').toLowerCase()}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={statusChange !== null}
        title={`Mark as ${statusChange?.status.replace(/_/g, ' ').toLowerCase()}?`}
        body={
          statusChange?.status === 'DELIVERED'
            ? 'The customer will be told their order has arrived, and the order moves to delivered once every parcel has.'
            : 'The customer sees this on their tracking page.'
        }
        confirmLabel="Update"
        tone="primary"
        loading={busy}
        onConfirm={() => void applyStatus()}
        onCancel={() => setStatusChange(null)}
      />
    </section>
  )
}
