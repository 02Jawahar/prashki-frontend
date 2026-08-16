'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { refundService } from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { OrderShipments } from '@/components/admin/order-shipments'
import { formatPrice } from '@/lib/money'
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
  Textarea,
} from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import type { Order, OrderStatus } from '@/services/order.service'

/**
 * Which statuses an order can move to next. Mirrors the server's transition
 * table — the server rejects anything invalid regardless of what is offered here.
 */
const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { can } = useAuth()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [next, setNext] = useState<string>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const [internalNotes, setInternalNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  const [money, setMoney] = useState<{ paid: number; refunded: number; refundable: number } | null>(null)
  const [refunds, setRefunds] = useState<
    Array<{ id: string; amount: number; status: string; reason: string | null; createdAt: string }>
  >([])
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [confirmingRefund, setConfirmingRefund] = useState(false)

  const load = useCallback(async () => {
    try {
      const result = await adminService.order(id)
      setOrder(result)
      setInternalNotes(result.internalNotes ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the order')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadMoney = useCallback(async () => {
    if (!can('order.read')) return
    try {
      const result = await refundService.forOrder(id)
      setMoney({ paid: result.paid, refunded: result.refunded, refundable: result.refundable })
      setRefunds(result.refunds)
      setRefundAmount(String(result.refundable / 100))
    } catch {
      // Refund figures are supplementary; the order still renders without them.
    }
  }, [id, can])

  useEffect(() => {
    void load()
    void loadMoney()
  }, [load, loadMoney])

  async function apply() {
    if (!next || !order) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await adminService.setOrderStatus(order.id, next, note || undefined)
      setOrder(updated)
      setNext('')
      setNote('')
      setNotice(
        next === 'CANCELLED'
          ? 'Order cancelled and stock returned to inventory.'
          : `Status updated to ${next.replace(/_/g, ' ').toLowerCase()}.`,
      )
      await loadMoney()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the status')
    } finally {
      setBusy(false)
    }
  }

  async function saveNotes() {
    if (!order) return

    setNotesSaving(true)
    setError(null)
    try {
      setOrder(await adminService.setOrderInternalNotes(order.id, internalNotes))
      setNotice('Notes saved.')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save those notes')
    } finally {
      setNotesSaving(false)
    }
  }

  async function issueRefund() {
    if (!order) return

    setBusy(true)
    setError(null)
    try {
      await refundService.create({
        orderId: order.id,
        amount: Math.round(Number(refundAmount) * 100),
        reason: refundReason || undefined,
      })
      setConfirmingRefund(false)
      setRefundReason('')
      setNotice('Refund sent to the gateway.')
      await loadMoney()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not issue that refund')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <SkeletonRows rows={6} />
  if (!order) return <Alert>{error ?? 'Order not found'}</Alert>

  const address = order.shippingAddressSnapshot
  const options = NEXT_STATUS[order.status] ?? []

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/orders" className="label-caps mb-4 inline-flex items-center gap-1 text-ink-soft hover:text-ink">
        <ChevronLeft className="size-3.5" strokeWidth={1.6} />
        Orders
      </Link>

      <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="display text-2xl">{order.orderNumber}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-ink-soft">Placed {formatDateTime(order.createdAt)}</p>
        </div>
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && (
        <div className="mb-5">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="border border-rule bg-white">
            <h2 className="label-caps border-b border-rule px-5 py-3.5">Items</h2>
            <ul className="divide-y divide-hairline">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 p-5">
                  <div className="relative aspect-2/3 w-14 shrink-0 overflow-hidden bg-sage-50">
                    {item.imageUrlSnapshot && (
                      <Image src={item.imageUrlSnapshot} alt="" fill sizes="56px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex flex-1 justify-between gap-3 text-sm">
                    <div>
                      <p>{item.productNameSnapshot}</p>
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
                    <span className="shrink-0">{formatPrice(item.lineTotal)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 border-t border-rule p-5 text-sm">
              <Row label="Subtotal" value={formatPrice(order.subtotal)} />
              {order.discount > 0 && (
                <Row
                  label={order.couponCode ? `Discount (${order.couponCode})` : 'Discount'}
                  value={`−${formatPrice(order.discount)}`}
                />
              )}
              <Row
                label={order.shippingMethodName ? `Shipping — ${order.shippingMethodName}` : 'Shipping'}
                value={order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}
              />
              {order.tax > 0 && <Row label="Tax" value={formatPrice(order.tax)} />}
              <div className="flex justify-between border-t border-hairline pt-2.5 text-base">
                <dt className="label-caps">Total</dt>
                <dd>{formatPrice(order.total)}</dd>
              </div>
            </dl>
          </section>

          <OrderShipments
            orderId={order.id}
            items={order.items}
            onChanged={async () => {
              await load()
            }}
          />

          <section className="border border-rule bg-white p-5">
            <h2 className="label-caps mb-4">Status history</h2>
            <ol className="space-y-3">
              {order.statusHistory.map((entry) => (
                <li key={entry.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sage-600" aria-hidden />
                  <div>
                    <p>
                      {entry.fromStatus ? `${entry.fromStatus.replace(/_/g, ' ').toLowerCase()} → ` : ''}
                      {entry.toStatus.replace(/_/g, ' ').toLowerCase()}
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

        <aside className="space-y-6">
          {can('order.update_status') && options.length > 0 && (
            <section className="border border-rule bg-white p-5">
              <h2 className="label-caps mb-4">Update status</h2>
              <Select value={next} onChange={(e) => setNext(e.target.value)} aria-label="New status">
                <option value="">Choose…</option>
                {options.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ').toLowerCase()}
                  </option>
                ))}
              </Select>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="mt-3"
              />
              {next === 'CANCELLED' && (
                <p className="mt-2 text-xs text-warning">
                  Cancelling returns every item to stock.
                </p>
              )}
              <Button size="sm" className="mt-3 w-full" disabled={!next} loading={busy} onClick={() => void apply()}>
                Apply
              </Button>
            </section>
          )}

          {can('order.update_status') && options.length === 0 && (
            <section className="border border-rule bg-white p-5">
              <h2 className="label-caps mb-2">Update status</h2>
              <p className="text-xs text-ink-soft">
                This order is {order.status.replace(/_/g, ' ').toLowerCase()} — no further transitions.
              </p>
            </section>
          )}

          <section className="border border-rule bg-white p-5">
            <h2 className="label-caps mb-3">Customer</h2>
            {order.user ? (
              <div className="text-sm">
                <p>{order.user.name}</p>
                <p className="text-ink-soft">{order.user.email}</p>
                {order.user.phone && <p className="text-ink-soft">{order.user.phone}</p>}
                <Link href={`/admin/customers`} className="label-caps link-underline mt-2 inline-block text-sage-700">
                  Customers
                </Link>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Not available</p>
            )}
          </section>

          <section className="border border-rule bg-white p-5">
            <h2 className="label-caps mb-3">Shipping address</h2>
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

          <section className="border border-rule bg-white p-5">
            <h2 className="label-caps mb-3">Payment</h2>
            {order.payments.length === 0 ? (
              <p className="text-sm text-ink-soft">No payment recorded.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {order.payments.map((p) => (
                  <li key={p.id}>
                    <div className="flex items-center justify-between">
                      <span>{p.provider}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-ink-soft">{formatPrice(p.amount)}</p>
                    {p.providerPaymentId && (
                      <p className="text-xs text-ink-soft">{p.providerPaymentId}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {can('refund.create') && money && money.paid > 0 && (
            <section className="border border-rule bg-white p-5">
              <h2 className="label-caps mb-3">Refunds</h2>

              <dl className="space-y-2 text-sm">
                <Row label="Captured" value={formatPrice(money.paid)} />
                <Row label="Refunded" value={formatPrice(money.refunded)} />
                <Row label="Still refundable" value={formatPrice(money.refundable)} />
              </dl>

              {money.refundable > 0 ? (
                <div className="mt-4 space-y-3">
                  <Field label="Amount (₹)" htmlFor="refund">
                    <Input
                      id="refund"
                      type="number"
                      min={1}
                      max={money.refundable / 100}
                      step="0.01"
                      value={refundAmount}
                      onChange={(event) => setRefundAmount(event.target.value)}
                    />
                  </Field>
                  <Input
                    aria-label="Refund reason"
                    placeholder="Reason (optional)"
                    value={refundReason}
                    onChange={(event) => setRefundReason(event.target.value)}
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={
                      !refundAmount ||
                      Number(refundAmount) <= 0 ||
                      Math.round(Number(refundAmount) * 100) > money.refundable
                    }
                    onClick={() => setConfirmingRefund(true)}
                  >
                    Issue refund
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-soft">Nothing left to refund.</p>
              )}

              {refunds.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-hairline pt-3 text-xs">
                  {refunds.map((refund) => (
                    <li key={refund.id} className="flex items-center justify-between gap-2">
                      <span>
                        {formatPrice(refund.amount)}
                        <span className="ml-2 text-ink-soft">{formatDateTime(refund.createdAt)}</span>
                      </span>
                      <StatusBadge status={refund.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {order.notes && (
            <section className="border border-rule bg-white p-5">
              <h2 className="label-caps mb-2">Customer note</h2>
              <p className="text-sm text-ink-soft">{order.notes}</p>
            </section>
          )}

          {can('order.update') && (
            <section className="border border-rule bg-white p-5">
              <h2 className="label-caps mb-2">Internal notes</h2>
              <p className="mb-3 text-xs text-ink-soft">Staff only — the customer never sees this.</p>
              <Textarea
                rows={4}
                maxLength={4000}
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
              />
              <Button
                size="sm"
                className="mt-3 w-full"
                loading={notesSaving}
                onClick={() => void saveNotes()}
              >
                Save notes
              </Button>
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmingRefund}
        title={`Refund ₹${refundAmount}?`}
        body="This sends money back through the payment gateway. It cannot be undone from here."
        confirmLabel="Send refund"
        loading={busy}
        onConfirm={() => void issueRefund()}
        onCancel={() => setConfirmingRefund(false)}
      />
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
