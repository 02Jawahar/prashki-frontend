'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { formatDateTime } from '@/lib/utils'
import { Alert, Button, EmptyState, Input, SkeletonRows } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import type { InventoryItem, InventoryMovement, Pagination } from '@/types/api'

export default function AdminInventoryPage() {
  const { can } = useAuth()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [history, setHistory] = useState<{ variantId: string; movements: InventoryMovement[] } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminService.inventory({ q: q || undefined, lowOnly: lowOnly || undefined, page, perPage: 25 })
      setItems(res.items)
      setPagination(res.pagination)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load inventory')
    } finally {
      setLoading(false)
    }
  }, [q, lowOnly, page])

  useEffect(() => {
    const id = setTimeout(() => void load(), q ? 300 : 0)
    return () => clearTimeout(id)
  }, [load, q])

  async function save(variantId: string) {
    const value = Number(drafts[variantId])
    if (!Number.isInteger(value) || value < 0) {
      setError('Stock must be a whole number of zero or more')
      return
    }
    setBusy(variantId)
    try {
      await adminService.setStock(variantId, value, 'Set from inventory screen')
      setDrafts((d) => {
        const next = { ...d }
        delete next[variantId]
        return next
      })
      await load()
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update stock')
    } finally {
      setBusy(null)
    }
  }

  async function showHistory(variantId: string) {
    setBusy(variantId)
    try {
      const res = await adminService.movements(variantId)
      setHistory({ variantId, movements: res.movements })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load history')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="display text-2xl">Inventory</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Stock is held per variant. Every change writes a movement to the ledger.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.5} />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder="Search by product or SKU"
            className="pl-9"
            aria-label="Search inventory"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => {
              setLowOnly(e.target.checked)
              setPage(1)
            }}
            className="size-4 accent-[#5b6241]"
          />
          Low stock only
        </label>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No inventory records" body="Create a product to start tracking stock." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th>Available</th>
                  <th>Threshold</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const editing = drafts[item.variantId] !== undefined
                  return (
                    <tr key={item.variantId}>
                      <td>
                        <Link href={`/admin/products/${item.productId}`} className="text-sm hover:underline">
                          {item.productName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-xs text-ink-soft">{item.variantName}</td>
                      <td className="whitespace-nowrap text-xs text-ink-soft">{item.sku}</td>
                      <td>
                        {can('inventory.adjust') ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              className="w-20 px-2 py-1 text-sm"
                              value={editing ? drafts[item.variantId] : String(item.availableStock)}
                              onChange={(e) => setDrafts((d) => ({ ...d, [item.variantId]: e.target.value }))}
                              aria-label={`Stock for ${item.sku}`}
                            />
                            {editing && (
                              <Button size="sm" loading={busy === item.variantId} onClick={() => void save(item.variantId)}>
                                Save
                              </Button>
                            )}
                            {item.isLow && (
                              <span className={item.availableStock === 0 ? 'badge badge-danger' : 'badge badge-warning'}>
                                {item.availableStock === 0 ? 'Out' : 'Low'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="tabular-nums">{item.availableStock}</span>
                        )}
                      </td>
                      <td className="tabular-nums text-xs text-ink-soft">{item.lowStockThreshold}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => void showHistory(item.variantId)}
                          className="text-xs text-ink-soft hover:text-ink"
                        >
                          History
                        </button>
                      </td>
                    </tr>
                  )
                })}
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

      {history && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setHistory(null)} aria-hidden />
          <div className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="label-caps">Movement history</h2>
              <button type="button" onClick={() => setHistory(null)} className="text-sm text-ink-soft">
                Close
              </button>
            </div>
            {history.movements.length === 0 ? (
              <EmptyState title="No movements recorded" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Change</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {history.movements.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap text-xs">{formatDateTime(m.createdAt)}</td>
                      <td className="text-xs">{m.type.replace(/_/g, ' ').toLowerCase()}</td>
                      <td className={`tabular-nums ${m.quantity < 0 ? 'text-danger' : 'text-success'}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="tabular-nums">{m.balanceAfter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
