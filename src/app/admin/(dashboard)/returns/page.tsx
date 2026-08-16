'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import {
  returnAdminService,
  type AdminReturnSummary,
} from '@/services/admin-modules.service'
import { formatPrice } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { Alert, EmptyState, Input, Select, SkeletonRows, StatusBadge } from '@/components/ui'

const STATUSES = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'IN_TRANSIT',
  'RECEIVED',
  'INSPECTED',
  'COMPLETED',
  'CANCELLED',
]

export default function AdminReturnsPage() {
  const [requests, setRequests] = useState<AdminReturnSummary[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await returnAdminService.list({ q: q || undefined, status: status || undefined })
      setRequests(result.requests)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load returns')
    } finally {
      setLoading(false)
    }
  }, [q, status])

  useEffect(() => {
    // Debounced so typing in the search box does not fire a request per key.
    const timer = setTimeout(() => void load(), 250)
    return () => clearTimeout(timer)
  }, [load])

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="display text-2xl">Returns</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Requests move forward one step at a time; stock only goes back on the shelf once the
          goods are here and someone has marked them resaleable.
        </p>
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
            strokeWidth={1.5}
          />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Return or order number, email"
            aria-label="Search returns"
            className="pl-9"
          />
        </div>

        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="sm:w-52"
        >
          <option value="">All statuses</option>
          {STATUSES.map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </Select>
      </div>

      <div className="border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={5} />
          </div>
        ) : requests.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No returns" body="Nothing matches those filters." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-soft">
                <th className="p-3 font-normal">Return</th>
                <th className="p-3 font-normal">Order</th>
                <th className="p-3 font-normal">Customer</th>
                <th className="p-3 font-normal">Reason</th>
                <th className="p-3 font-normal">Items</th>
                <th className="p-3 font-normal">Requested</th>
                <th className="p-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-b border-hairline last:border-0">
                  <td className="p-3">
                    <Link href={`/admin/returns/${request.id}`} className="link-underline">
                      {request.returnNumber}
                    </Link>
                  </td>
                  <td className="p-3">
                    <Link href={`/admin/orders/${request.order.id}`} className="link-underline text-ink-soft">
                      {request.order.orderNumber}
                    </Link>
                    <span className="ml-2 text-xs text-ink-soft">
                      {formatPrice(request.order.total)}
                    </span>
                  </td>
                  <td className="p-3">
                    <p>{request.customer.name}</p>
                    <p className="text-xs text-ink-soft">{request.customer.email}</p>
                  </td>
                  <td className="p-3 text-ink-soft">
                    {request.reason.replace(/_/g, ' ').toLowerCase()}
                  </td>
                  <td className="p-3">{request.itemCount}</td>
                  <td className="p-3 text-ink-soft">{formatDate(request.requestedAt)}</td>
                  <td className="p-3">
                    <StatusBadge status={request.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
