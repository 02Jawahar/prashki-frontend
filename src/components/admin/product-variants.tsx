'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { formatPrice, paiseToRupeeInput, rupeeInputToPaise } from '@/lib/money'
import { Alert, Button, Field, Input, StatusBadge } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import type { ProductDetail } from '@/types/api'

/**
 * Variants and stock.
 *
 * Stock is never edited as a plain field — it goes through the inventory
 * endpoint, which writes a movement in the same transaction (spec §14).
 */
export function ProductVariants({
  product,
  onChange,
}: {
  product: ProductDetail
  onChange: (product: ProductDetail) => void
}) {
  const { can } = useAuth()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: '', sku: '', stock: '0' })
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({})

  const canEdit = can('product.update')
  const canStock = can('inventory.adjust')

  async function saveStock(variantId: string) {
    const value = Number(stockDrafts[variantId])
    if (!Number.isInteger(value) || value < 0) {
      setError('Stock must be a whole number of zero or more')
      return
    }

    setBusy(variantId)
    setError(null)
    try {
      await adminService.setStock(variantId, value, 'Set from admin')
      onChange(await adminService.product(product.id))
      setStockDrafts((d) => {
        const next = { ...d }
        delete next[variantId]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update stock')
    } finally {
      setBusy(null)
    }
  }

  async function addVariant(e: React.FormEvent) {
    e.preventDefault()
    setBusy('new')
    setError(null)
    try {
      onChange(
        await adminService.createVariant(product.id, {
          name: draft.name.trim(),
          sku: draft.sku.trim(),
          stock: Number(draft.stock) || 0,
        }),
      )
      setDraft({ name: '', sku: '', stock: '0' })
      setAdding(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the variant')
    } finally {
      setBusy(null)
    }
  }

  async function removeVariant(variantId: string) {
    setBusy(variantId)
    setError(null)
    try {
      const res = await adminService.deleteVariant(product.id, variantId)
      if (res.deactivated) setError(res.message ?? 'Variant deactivated')
      onChange(await adminService.product(product.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the variant')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="border border-rule bg-white p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="label-caps">Variants &amp; stock</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Every stock change is written to the inventory ledger.
          </p>
        </div>
        {canEdit && !adding && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" strokeWidth={2} />
            Add variant
          </Button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Variant</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {product.variants.map((v) => {
              const editing = stockDrafts[v.id] !== undefined
              return (
                <tr key={v.id}>
                  <td className="whitespace-nowrap">{v.name}</td>
                  <td className="whitespace-nowrap text-xs text-ink-soft">{v.sku}</td>
                  <td className="whitespace-nowrap tabular-nums">{formatPrice(v.price)}</td>
                  <td>
                    {canStock ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          className="w-20 px-2 py-1 text-sm"
                          value={editing ? stockDrafts[v.id] : String(v.stock)}
                          onChange={(e) =>
                            setStockDrafts((d) => ({ ...d, [v.id]: e.target.value }))
                          }
                          aria-label={`Stock for ${v.name}`}
                        />
                        {editing && (
                          <Button
                            type="button"
                            size="sm"
                            loading={busy === v.id}
                            onClick={() => void saveStock(v.id)}
                          >
                            Save
                          </Button>
                        )}
                        {v.stock <= v.lowStockThreshold && (
                          <span className={v.stock === 0 ? 'badge badge-danger' : 'badge badge-warning'}>
                            {v.stock === 0 ? 'Out' : 'Low'}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="tabular-nums">{v.stock}</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  {canEdit && (
                    <td className="text-right">
                      <button
                        type="button"
                        disabled={busy === v.id || product.variants.length <= 1}
                        onClick={() => void removeVariant(v.id)}
                        className="text-xs text-ink-soft hover:text-danger disabled:opacity-30"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {adding && (
        <form onSubmit={addVariant} className="mt-5 grid gap-3 border-t border-hairline pt-5 sm:grid-cols-[1fr_2fr_1fr_auto]">
          <Field label="Name" htmlFor="v-name" required>
            <Input
              id="v-name"
              required
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </Field>
          <Field label="SKU" htmlFor="v-sku" required>
            <Input
              id="v-sku"
              required
              value={draft.sku}
              placeholder={`${product.sku}-X`}
              onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value.toUpperCase() }))}
            />
          </Field>
          <Field label="Stock" htmlFor="v-stock">
            <Input
              id="v-stock"
              type="number"
              min={0}
              value={draft.stock}
              onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
            />
          </Field>
          <div className="flex items-end gap-2 pb-1">
            <Button type="submit" size="sm" loading={busy === 'new'}>
              Add
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
