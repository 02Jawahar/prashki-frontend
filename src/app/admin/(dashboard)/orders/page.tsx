'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { formatPrice } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { Alert, Button, EmptyState, Input, Select, SkeletonRows, StatusBadge } from '@/components/ui'
import type { Pagination } from '@/types/api'

interface Row {
  id: string
  orderNumber: string
  status: string
  total: number
  itemCount: number
  customer: { id: string; name: string; email: string } | null
  createdAt: string
}

const STATUSES = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Row[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminService.orders({
        q: q || undefined,
        status: status || undefined,
        page,
        perPage: 25,
      })
      setOrders(res.orders)
      setPagination(res.pagination)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders')
    } finally {
      setLoading(false)
    }
  }, [q, status, page])

  useEffect(() => {
    const id = setTimeout(() => void load(), q ? 300 : 0)
    return () => clearTimeout(id)
  }, [load, q])

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="display text-2xl">Orders</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {pagination ? `${pagination.total} order${pagination.total === 1 ? '' : 's'}` : ' '}
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.5} />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder="Search by order number, customer or email"
            className="pl-9"
            aria-label="Search orders"
          />
        </div>

        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="w-48"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </Select>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No orders found"
              body={q || status ? 'Try clearing the filters.' : 'Orders appear here once customers check out.'}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/orders/${o.id}`} className="text-sm hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td>
                      <span className="block text-sm">{o.customer?.name ?? '—'}</span>
                      <span className="text-xs text-ink-soft">{o.customer?.email}</span>
                    </td>
                    <td className="whitespace-nowrap text-xs text-ink-soft">{formatDate(o.createdAt)}</td>
                    <td className="tabular-nums">{o.itemCount}</td>
                    <td className="whitespace-nowrap tabular-nums">{formatPrice(o.total)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination && pagination.pageCount > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-ink-soft">
            Page {pagination.page} of {pagination.pageCount}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="ghost" size="sm" disabled={page >= pagination.pageCount} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
