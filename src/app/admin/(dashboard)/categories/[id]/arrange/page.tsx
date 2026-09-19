'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import { adminService } from '@/services/admin.service'
import { formatPrice } from '@/lib/money'
import { useAuth } from '@/hooks/use-auth'
import { Alert, Button, EmptyState, SkeletonRows, StatusBadge } from '@/components/ui'

type Row = {
  id: string
  name: string
  sku: string
  status: string
  position: number
  featured: boolean
  price: number
  image: string | null
}

/**
 * The order of the pieces inside one category.
 *
 * Until now a category's own order was whatever `publishedAt` happened to say,
 * and nothing in admin could change it. Category sort order arranged the
 * ranges; within a range, newest simply won. A studio that wants its best
 * dress first had no way to say so.
 *
 * Arrows rather than drag-and-drop, deliberately. This is the same gesture the
 * navigation editor already uses, so it needs no explaining; it works on a
 * touch screen, where drag handles are fiddly; and it is reachable from a
 * keyboard, which drag is not without a great deal of work.
 *
 * Nothing is written until Save. Moving a piece up should be a thought, not a
 * commitment - and a half-applied arrangement is worse than none, so the whole
 * category goes at once or not at all.
 */
export default function ArrangeCategoryPage() {
  const { can } = useAuth()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const categoryId = params.id

  const [category, setCategory] = useState<{ name: string; slug: string } | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [original, setOriginal] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const canEdit = can('product.update')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminService.categoryProducts(categoryId)
      setCategory(data.category)
      setRows(data.products)
      setOriginal(data.products.map((p) => p.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this category')
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    void load()
  }, [load])

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= rows.length) return

    setRows((current) => {
      const next = [...current]
      const [lifted] = next.splice(index, 1)
      next.splice(target, 0, lifted!)
      return next
    })
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await adminService.reorderCategoryProducts(
        categoryId,
        rows.map((r) => r.id),
      )
      setOriginal(rows.map((r) => r.id))
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this order')
    } finally {
      setSaving(false)
    }
  }

  const dirty = rows.some((r, i) => r.id !== original[i])

  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={() => router.push('/admin/categories')}
        className="label-caps mb-5 inline-flex items-center gap-1.5 text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        Categories
      </button>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl">{category?.name ?? 'Arrange'}</h1>
          <p className="mt-1 text-xs text-ink-soft">
            The order these appear in on the storefront. Featured pieces still lead, wherever they
            sit here.
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-3">
            {saved && !dirty && <span className="text-xs text-ink-soft">Saved</span>}
            <Button type="button" onClick={() => void save()} loading={saving} disabled={!dirty}>
              Save order
            </Button>
          </div>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing in this category"
          body="Assign products to it and they will appear here to arrange."
        />
      ) : (
        <ol className="border border-rule bg-white">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="flex items-center gap-4 border-b border-hairline px-4 py-3 last:border-b-0"
            >
              <span className="w-6 shrink-0 text-xs tabular-nums text-ink-soft">{index + 1}</span>

              <div className="relative size-12 shrink-0 overflow-hidden bg-sage-100">
                {row.image && (
                  <Image src={row.image} alt="" fill sizes="48px" className="object-cover" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{row.name}</p>
                <p className="truncate text-xs text-ink-soft">
                  {row.sku} · {formatPrice(row.price)}
                  {row.featured && ' · Featured'}
                </p>
              </div>

              <StatusBadge status={row.status} />

              {canEdit && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${row.name} up`}
                    className="p-1.5 text-ink-soft transition-colors hover:text-ink disabled:opacity-25"
                  >
                    <ChevronUp className="size-4" strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                    aria-label={`Move ${row.name} down`}
                    className="p-1.5 text-ink-soft transition-colors hover:text-ink disabled:opacity-25"
                  >
                    <ChevronDown className="size-4" strokeWidth={1.8} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {rows.length > 0 && (
        <p className="mt-4 text-xs text-ink-soft">
          This order applies to the default sort. A customer who chooses Newest or Price from SORT
          BY sees those instead.
        </p>
      )}
    </div>
  )
}
