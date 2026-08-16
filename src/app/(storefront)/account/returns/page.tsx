'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PackageOpen } from 'lucide-react'
import { returnService, type ReturnRequest } from '@/services/storefront.service'
import { formatPrice } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { Alert, EmptyState, SkeletonRows, StatusBadge } from '@/components/ui'

export default function ReturnsPage() {
  const [requests, setRequests] = useState<ReturnRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void returnService
      .list()
      .then(setRequests)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your returns'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonRows rows={3} />

  return (
    <div className="mx-auto max-w-3xl">
      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}

      {requests.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="size-8" strokeWidth={1.2} />}
          title="No returns"
          body="If something is not right, you can start a return from the order itself within seven days of delivery."
          action={
            <Link href="/account/orders" className="btn btn-outline btn-sm">
              View your orders
            </Link>
          }
        />
      ) : (
        <ul className="border-t border-hairline">
          {requests.map((request) => {
            const refundable = request.items.reduce((sum, item) => sum + item.refundableAmount, 0)

            return (
              <li key={request.id} className="flex items-start justify-between gap-4 border-b border-hairline py-5">
                <div className="min-w-0">
                  <Link href={`/account/returns/${request.id}`} className="display text-lg">
                    {request.returnNumber}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Order {request.order.orderNumber} · requested {formatDate(request.requestedAt)}
                  </p>
                  <p className="mt-2 truncate text-sm text-ink-soft">
                    {request.items
                      .map((item) => `${item.quantity} × ${item.orderItem.productNameSnapshot}`)
                      .join(', ')}
                  </p>
                  {request.status === 'REJECTED' && request.rejectionReason && (
                    <p className="mt-2 text-sm text-danger">{request.rejectionReason}</p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <StatusBadge status={request.status} />
                  <p className="mt-2 text-sm">{formatPrice(refundable)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
