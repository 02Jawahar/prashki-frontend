'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { formatPrice } from '@/lib/money'
import { Alert, Button, EmptyState, Input, Select, SkeletonRows, StatusBadge } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import type { Pagination, ProductListItem, ProductStatus } from '@/types/api'

export default function AdminProductsPage() {
  const { can } = useAuth()
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ProductStatus | ''>('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminService.products({
        q: q || undefined,
        status: status || undefined,
        sort,
        page,
        perPage: 20,
      })
      setProducts(res.products)
      setPagination(res.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load products')
    } finally {
      setLoading(false)
    }
  }, [q, status, sort, page])

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => void load(), q ? 300 : 0)
    return () => clearTimeout(id)
  }, [load, q])

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Products</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {pagination ? `${pagination.total} product${pagination.total === 1 ? '' : 's'}` : ' '}
          </p>
        </div>

        {can('product.create') && (
          <Link href="/admin/products/new" className="btn btn-primary btn-sm">
            <Plus className="size-3.5" strokeWidth={2} />
            New product
          </Link>
        )}
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
            placeholder="Search by name or SKU"
            className="pl-9"
            aria-label="Search products"
          />
        </div>

        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ProductStatus | '')
            setPage(1)
          }}
          className="w-40"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </Select>

        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-44" aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="price-asc">Price low to high</option>
          <option value="price-desc">Price high to low</option>
        </Select>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : products.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No products found"
              body={q || status ? 'Try clearing the filters.' : 'Create your first product to get started.'}
              action={
                can('product.create') && !q && !status ? (
                  <Link href="/admin/products/new" className="btn btn-primary btn-sm">
                    New product
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 group">
                        <span className="relative block size-11 shrink-0 overflow-hidden bg-sage-50">
                          {p.image && (
                            <Image src={p.image} alt="" fill sizes="44px" className="object-cover" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm group-hover:underline">{p.name}</span>
                          {p.featured && <span className="badge badge-info mt-0.5">Featured</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-xs text-ink-soft">{p.sku}</td>
                    <td className="whitespace-nowrap text-xs text-ink-soft">{p.category?.name ?? '—'}</td>
                    <td className="whitespace-nowrap tabular-nums">
                      {formatPrice(p.price)}
                      {p.discountPercent > 0 && (
                        <span className="ml-1.5 text-xs text-sale">−{p.discountPercent}%</span>
                      )}
                    </td>
                    <td className="tabular-nums">
                      <span className={p.totalStock === 0 ? 'text-danger' : ''}>{p.totalStock}</span>
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
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
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= pagination.pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
