'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { returnService, type ReturnRequest } from '@/services/storefront.service'
import { ApiRequestError } from '@/services/api-client'
import { formatPrice } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { Alert, Button, ConfirmDialog, SkeletonRows, StatusBadge } from '@/components/ui'

/** Statuses a customer may still withdraw from. Mirrors the API's own rule. */
const CANCELLABLE = new Set(['REQUESTED', 'APPROVED'])

export default function ReturnDetailPage() {
  const params = useParams<{ id: string }>()

  const [request, setRequest] = useState<ReturnRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    void returnService
      .byId(params.id)
      .then(setRequest)
      .catch((err) =>
        setError(err instanceof ApiRequestError ? err.message : 'Could not load that return'),
      )
      .finally(() => setLoading(false))
  }, [params.id])

  async function cancel() {
    setCancelling(true)
    try {
      setRequest(await returnService.cancel(params.id))
      setConfirming(false)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not cancel that return')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <SkeletonRows rows={4} />
  if (!request) return <Alert>{error ?? 'That return could not be found.'}</Alert>

  const refundable = request.items.reduce((sum, item) => sum + item.refundableAmount, 0)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {error && <Alert>{error}</Alert>}

      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="display text-2xl">{request.returnNumber}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Order{' '}
            <Link href={`/account/orders/${request.order.id}`} className="link-underline text-ink">
              {request.order.orderNumber}
            </Link>{' '}
            · requested {formatDate(request.requestedAt)}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </header>

      {request.status === 'REJECTED' && request.rejectionReason && (
        <Alert>
          <p className="font-medium">This return was declined</p>
          <p className="mt-1">{request.rejectionReason}</p>
        </Alert>
      )}

      {request.status === 'APPROVED' && (
        <Alert tone="info">
          Your return has been approved. Send the items back in their original packaging and we will
          email you once they arrive.
        </Alert>
      )}

      <section>
        <h3 className="label-caps mb-4">Items</h3>
        <ul className="border-t border-hairline">
          {request.items.map((item) => (
            <li key={item.id} className="flex gap-4 border-b border-hairline py-4">
              <div className="relative aspect-2/3 w-16 shrink-0 overflow-hidden bg-sage-50">
                {item.orderItem.imageUrlSnapshot && (
                  <Image
                    src={item.orderItem.imageUrlSnapshot}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex flex-1 justify-between gap-3 text-sm">
                <div>
                  <p className="display leading-tight">{item.orderItem.productNameSnapshot}</p>
                  {item.orderItem.variantNameSnapshot &&
                    item.orderItem.variantNameSnapshot !== 'Default' && (
                      <p className="mt-0.5 text-xs text-ink-soft">
                        Size {item.orderItem.variantNameSnapshot}
                      </p>
                    )}
                  <p className="mt-0.5 text-xs text-ink-soft">Quantity {item.quantity}</p>
                </div>
                <span className="shrink-0">{formatPrice(item.refundableAmount)}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-between text-sm">
          <span className="label-caps">
            {request.resolution === 'REFUND' ? 'Refund value' : 'Value'}
          </span>
          <span>{formatPrice(refundable)}</span>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          This is what you paid for these items after any discount, so it may be less than the
          original price.
        </p>
      </section>

      <section>
        <h3 className="label-caps mb-4">Reason</h3>
        <p className="text-sm">{request.reason.replace(/_/g, ' ').toLowerCase()}</p>
        {request.comment && <p className="mt-2 text-sm text-ink-soft">{request.comment}</p>}
      </section>

      {request.refunds.length > 0 && (
        <section>
          <h3 className="label-caps mb-4">Refunds</h3>
          <ul className="space-y-2 text-sm">
            {request.refunds.map((refund) => (
              <li key={refund.id} className="flex items-center justify-between border border-rule p-3">
                <span>
                  {formatPrice(refund.amount)}
                  <span className="ml-2 text-xs text-ink-soft">{formatDate(refund.createdAt)}</span>
                </span>
                <StatusBadge status={refund.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="label-caps mb-4">Progress</h3>
        <ol className="space-y-3 text-sm">
          {request.statusHistory.map((entry) => (
            <li key={entry.id} className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sage-700" aria-hidden />
              <span>
                <span className="capitalize">{entry.status.replace(/_/g, ' ').toLowerCase()}</span>
                <span className="ml-2 text-xs text-ink-soft">{formatDate(entry.createdAt)}</span>
                {entry.note && <span className="mt-0.5 block text-xs text-ink-soft">{entry.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {CANCELLABLE.has(request.status) && (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          Cancel this return
        </Button>
      )}

      <ConfirmDialog
        open={confirming}
        title={`Cancel return ${request.returnNumber}?`}
        body="You can start another return later, as long as the seven-day window is still open."
        confirmLabel="Cancel the return"
        cancelLabel="Keep it"
        loading={cancelling}
        onConfirm={() => void cancel()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
