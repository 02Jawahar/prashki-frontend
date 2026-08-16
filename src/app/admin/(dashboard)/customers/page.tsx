'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { formatDate } from '@/lib/utils'
import { Alert, Button, EmptyState, Input, SkeletonRows, StatusBadge } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import type { AdminCustomer, Pagination } from '@/types/api'

export default function AdminCustomersPage() {
  const { can } = useAuth()
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminService.customers({ q: q || undefined, page, perPage: 25 })
      setCustomers(res.customers)
      setPagination(res.pagination)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load customers')
    } finally {
      setLoading(false)
    }
  }, [q, page])

  useEffect(() => {
    const id = setTimeout(() => void load(), q ? 300 : 0)
    return () => clearTimeout(id)
  }, [load, q])

  async function toggleStatus(customer: AdminCustomer) {
    setBusy(customer.id)
    try {
      await adminService.setCustomerStatus(
        customer.id,
        customer.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the customer')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="display text-2xl">Customers</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {pagination ? `${pagination.total} registered customer${pagination.total === 1 ? '' : 's'}` : ' '}
        </p>
      </header>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.5} />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder="Search by name, email or phone"
          className="pl-9"
          aria-label="Search customers"
        />
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No customers yet" body="Customers appear here after they register." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Orders</th>
                  <th>Joined</th>
                  <th>Status</th>
                  {can('customer.update') && <th />}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/customers/${c.id}`} className="link-underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="text-xs text-ink-soft">{c.email}</td>
                    <td className="text-xs text-ink-soft">{c.phone ?? '—'}</td>
                    <td className="tabular-nums">{c.orderCount}</td>
                    <td className="whitespace-nowrap text-xs text-ink-soft">{formatDate(c.createdAt)}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    {can('customer.update') && (
                      <td className="text-right">
                        <button
                          type="button"
                          disabled={busy === c.id}
                          onClick={() => void toggleStatus(c)}
                          className="text-xs text-ink-soft hover:text-ink disabled:opacity-40"
                        >
                          {c.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                        </button>
                      </td>
                    )}
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
