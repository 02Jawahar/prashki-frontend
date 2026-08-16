'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import {
  refundService,
  returnAdminService,
  type AdminReturn,
} from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
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

/**
 * One return request (M22).
 *
 * The status list offered is the API's own transition table — a status the
 * server would reject is not shown, so the screen cannot invite an action that
 * then fails.
 */
const NEXT_STATUSES: Record<string, string[]> = {
  REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['IN_TRANSIT', 'RECEIVED', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['INSPECTED', 'COMPLETED'],
  INSPECTED: ['COMPLETED', 'REJECTED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
}

export default function AdminReturnDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { can } = useAuth()

  const [request, setRequest] = useState<AdminReturn | null>(null)
  const [money, setMoney] = useState<{ paid: number; refunded: number; refundable: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [nextStatus, setNextStatus] = useState('')
  const [note, setNote] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [dispositions, setDispositions] = useState<Record<string, { restock: boolean; condition: string }>>({})
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const [internalNotes, setInternalNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refunding, setRefunding] = useState(false)
  const [confirmingRefund, setConfirmingRefund] = useState(false)

  const load = useCallback(async () => {
    try {
      const result = await returnAdminService.byId(id)
      setRequest(result.request)
      setMoney(result.refundable)
      setInternalNotes(result.request.internalNotes ?? '')
      setDispositions(
        Object.fromEntries(
          result.request.items.map((item) => [
            item.id,
            { restock: item.restock, condition: item.condition ?? '' },
          ]),
        ),
      )
      // Default the refund box to what this return is worth, capped by what is
      // actually left to give back.
      const worth = result.request.items.reduce((sum, item) => sum + item.refundableAmount, 0)
      setRefundAmount(String(Math.min(worth, result.refundable.refundable) / 100))
      setError(null)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load that return')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function applyStatus() {
    if (!request || !nextStatus) return

    setSaving(true)
    setError(null)

    try {
      await returnAdminService.setStatus(id, {
        status: nextStatus,
        note: note || undefined,
        rejectionReason: rejectionReason || undefined,
        // Only meaningful when goods are being inspected; harmless otherwise.
        itemDispositions: request.items.map((item) => ({
          returnItemId: item.id,
          restock: dispositions[item.id]?.restock ?? false,
          condition: dispositions[item.id]?.condition || undefined,
        })),
      })
      setNextStatus('')
      setNote('')
      setRejectionReason('')
      setConfirming(false)
      setNotice('Return updated.')
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update that return')
    } finally {
      setSaving(false)
    }
  }

  async function saveNotes() {
    setNotesSaving(true)
    try {
      await returnAdminService.setInternalNotes(id, internalNotes)
      setNotice('Notes saved.')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save those notes')
    } finally {
      setNotesSaving(false)
    }
  }

  async function issueRefund() {
    if (!request) return

    setRefunding(true)
    setError(null)

    try {
      await refundService.create({
        orderId: request.order.id,
        amount: Math.round(Number(refundAmount) * 100),
        reason: refundReason || undefined,
        returnRequestId: request.id,
      })
      setConfirmingRefund(false)
      setNotice('Refund sent to the gateway.')
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not issue that refund')
    } finally {
      setRefunding(false)
    }
  }

  if (loading) return <SkeletonRows rows={6} />
  if (!request) return <Alert>{error ?? 'That return could not be found.'}</Alert>

  const worth = request.items.reduce((sum, item) => sum + item.refundableAmount, 0)
  const options = NEXT_STATUSES[request.status] ?? []
  const inspecting = nextStatus === 'INSPECTED' || nextStatus === 'COMPLETED'

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/returns"
        className="label-caps mb-5 inline-flex items-center gap-1 text-ink-soft hover:text-ink"
      >
        <ChevronLeft className="size-3.5" strokeWidth={1.6} />
        Returns
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display text-2xl">{request.returnNumber}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Order{' '}
            <Link href={`/admin/orders/${request.order.id}`} className="link-underline text-ink">
              {request.order.orderNumber}
            </Link>{' '}
            · {request.user.name} ({request.user.email}) · requested{' '}
            {formatDateTime(request.requestedAt)}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <section className="border border-rule bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-soft">
              <th className="p-3 font-normal">Item</th>
              <th className="p-3 font-normal">Qty</th>
              <th className="p-3 font-normal">Refundable</th>
              <th className="p-3 font-normal">Back to stock?</th>
              <th className="p-3 font-normal">Condition</th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item) => (
              <tr key={item.id} className="border-b border-hairline last:border-0">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative aspect-2/3 w-10 shrink-0 overflow-hidden bg-sage-50">
                      {item.orderItem.imageUrlSnapshot && (
                        <Image
                          src={item.orderItem.imageUrlSnapshot}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div>
                      <p>{item.orderItem.productNameSnapshot}</p>
                      {item.orderItem.variantNameSnapshot &&
                        item.orderItem.variantNameSnapshot !== 'Default' && (
                          <p className="text-xs text-ink-soft">
                            {item.orderItem.variantNameSnapshot}
                          </p>
                        )}
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  {item.quantity} of {item.orderItem.quantity}
                </td>
                <td className="p-3">{formatPrice(item.refundableAmount)}</td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#5b6241]"
                    aria-label={`Restock ${item.orderItem.productNameSnapshot}`}
                    disabled={!can('return.manage')}
                    checked={dispositions[item.id]?.restock ?? false}
                    onChange={(event) =>
                      setDispositions((current) => ({
                        ...current,
                        [item.id]: {
                          restock: event.target.checked,
                          condition: current[item.id]?.condition ?? '',
                        },
                      }))
                    }
                  />
                </td>
                <td className="p-3">
                  <Input
                    aria-label={`Condition of ${item.orderItem.productNameSnapshot}`}
                    disabled={!can('return.manage')}
                    value={dispositions[item.id]?.condition ?? ''}
                    onChange={(event) =>
                      setDispositions((current) => ({
                        ...current,
                        [item.id]: {
                          restock: current[item.id]?.restock ?? false,
                          condition: event.target.value,
                        },
                      }))
                    }
                    placeholder="As new"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between border-t border-rule p-4 text-sm">
          <span className="label-caps">Return value</span>
          <span>{formatPrice(worth)}</span>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="border border-rule bg-white p-5">
          <h2 className="label-caps mb-3">Customer’s reason</h2>
          <p className="text-sm capitalize">{request.reason.replace(/_/g, ' ').toLowerCase()}</p>
          {request.comment && <p className="mt-2 text-sm text-ink-soft">{request.comment}</p>}
          {request.rejectionReason && (
            <>
              <h3 className="label-caps mb-1 mt-4">Declined because</h3>
              <p className="text-sm text-danger">{request.rejectionReason}</p>
            </>
          )}
        </div>

        <div className="border border-rule bg-white p-5">
          <h2 className="label-caps mb-3">Internal notes</h2>
          <p className="mb-3 text-xs text-ink-soft">
            Staff only. Never shown to the customer.
          </p>
          <Textarea
            rows={4}
            maxLength={4000}
            disabled={!can('return.manage')}
            value={internalNotes}
            onChange={(event) => setInternalNotes(event.target.value)}
          />
          {can('return.manage') && (
            <Button size="sm" className="mt-3" loading={notesSaving} onClick={() => void saveNotes()}>
              Save notes
            </Button>
          )}
        </div>
      </section>

      {can('return.manage') && options.length > 0 && (
        <section className="mt-5 border border-rule bg-white p-5">
          <h2 className="label-caps mb-4">Move this return on</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Next status" htmlFor="next">
              <Select id="next" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
                <option value="">Choose…</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, ' ').toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Note" htmlFor="note" hint="Recorded on the return’s history.">
              <Input
                id="note"
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>

            {nextStatus === 'REJECTED' && (
              <div className="sm:col-span-2">
                <Field
                  label="Why are you declining this?"
                  htmlFor="reject"
                  required
                  hint="The customer sees this."
                >
                  <Textarea
                    id="reject"
                    rows={2}
                    required
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>

          {inspecting && (
            <p className="mt-3 text-xs text-ink-soft">
              Items ticked above will be added back to stock when you apply this.
            </p>
          )}

          <Button
            size="sm"
            className="mt-4"
            disabled={!nextStatus}
            onClick={() => setConfirming(true)}
          >
            Apply
          </Button>
        </section>
      )}

      {can('refund.create') && money && (
        <section className="mt-5 border border-rule bg-white p-5">
          <h2 className="label-caps mb-4">Refund</h2>

          <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-soft">Captured</dt>
              <dd>{formatPrice(money.paid)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-soft">Already refunded</dt>
              <dd>{formatPrice(money.refunded)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-soft">Still refundable</dt>
              <dd>{formatPrice(money.refundable)}</dd>
            </div>
          </dl>

          {money.refundable === 0 ? (
            <p className="text-sm text-ink-soft">
              There is nothing left to refund on this order.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount (₹)" htmlFor="refund-amount" required>
                <Input
                  id="refund-amount"
                  type="number"
                  min={1}
                  max={money.refundable / 100}
                  step="0.01"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                />
              </Field>

              <Field label="Reason" htmlFor="refund-reason" hint="For your records.">
                <Input
                  id="refund-reason"
                  maxLength={300}
                  value={refundReason}
                  onChange={(event) => setRefundReason(event.target.value)}
                />
              </Field>

              <div className="sm:col-span-2">
                <Button
                  size="sm"
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
            </div>
          )}

          {request.refunds.length > 0 && (
            <ul className="mt-5 space-y-2 border-t border-hairline pt-4 text-sm">
              {request.refunds.map((refund) => (
                <li key={refund.id} className="flex items-center justify-between">
                  <span>
                    {formatPrice(refund.amount)}
                    <span className="ml-2 text-xs text-ink-soft">
                      {formatDateTime(refund.createdAt)}
                    </span>
                  </span>
                  <StatusBadge status={refund.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-5 border border-rule bg-white p-5">
        <h2 className="label-caps mb-4">History</h2>
        <ol className="space-y-3 text-sm">
          {request.statusHistory.map((entry) => (
            <li key={entry.id} className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sage-600" aria-hidden />
              <div>
                <p className="capitalize">{entry.status.replace(/_/g, ' ').toLowerCase()}</p>
                <p className="text-xs text-ink-soft">
                  {formatDateTime(entry.createdAt)}
                  {entry.note ? ` · ${entry.note}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <ConfirmDialog
        open={confirming}
        title={`Move to ${nextStatus.replace(/_/g, ' ').toLowerCase()}?`}
        body={
          inspecting
            ? 'Items marked for restock will be added back to available stock. This cannot be undone.'
            : nextStatus === 'REJECTED'
              ? 'The customer will be told this return was declined, and why.'
              : 'The customer will see this change on their return.'
        }
        confirmLabel="Apply"
        tone={nextStatus === 'REJECTED' ? 'danger' : 'primary'}
        loading={saving}
        onConfirm={() => void applyStatus()}
        onCancel={() => setConfirming(false)}
      />

      <ConfirmDialog
        open={confirmingRefund}
        title={`Refund ₹${refundAmount}?`}
        body="This sends money back through the payment gateway. It cannot be undone from here."
        confirmLabel="Send refund"
        loading={refunding}
        onConfirm={() => void issueRefund()}
        onCancel={() => setConfirmingRefund(false)}
      />
    </div>
  )
}
