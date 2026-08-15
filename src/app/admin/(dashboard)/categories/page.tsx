'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { MediaPicker } from '@/components/admin/media-picker'
import { Alert, Button, EmptyState, Field, Input, Select, SkeletonRows, StatusBadge, Textarea } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import type { AdminCategory } from '@/types/api'

export default function AdminCategoriesPage() {
  const { can } = useAuth()
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCategories(await adminService.categories())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load categories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(id: string) {
    try {
      await adminService.deleteCategory(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the category')
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Categories</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Categories can nest — the storefront currently shows one level.
          </p>
        </div>
        {can('category.manage') && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-3.5" strokeWidth={2} />
            New category
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}

      {editing && (
        <CategoryForm
          category={editing === 'new' ? undefined : editing}
          categories={categories}
          onDone={async () => {
            setEditing(null)
            await load()
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="mt-5 border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={5} />
          </div>
        ) : categories.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No categories yet" body="Create one to organise your catalogue." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Parent</th>
                  <th>Products</th>
                  <th>Order</th>
                  <th>Status</th>
                  {can('category.manage') && <th />}
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="text-xs text-ink-soft">{c.slug}</td>
                    <td className="text-xs text-ink-soft">{c.parent?.name ?? '—'}</td>
                    <td className="tabular-nums">{c.productCount}</td>
                    <td className="tabular-nums">{c.sortOrder}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    {can('category.manage') && (
                      <td className="whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => setEditing(c)}
                          className="text-xs text-ink-soft hover:text-ink"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(c.id)}
                          className="ml-3 text-xs text-ink-soft hover:text-danger"
                        >
                          Delete
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
    </div>
  )
}

function CategoryForm({
  category,
  categories,
  onDone,
  onCancel,
}: {
  category?: AdminCategory
  categories: AdminCategory[]
  onDone: () => void | Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [image, setImage] = useState(category?.image ?? '')
  const [status, setStatus] = useState(category?.status ?? 'ACTIVE')
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0))
  const [parentId, setParentId] = useState(category?.parent?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        image: image.trim(),
        status,
        sortOrder: Number(sortOrder) || 0,
        parentId: parentId || null,
      }
      if (category) await adminService.updateCategory(category.id, payload)
      else await adminService.createCategory(payload)
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the category')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="border border-rule bg-white p-6">
      <h2 className="label-caps mb-5">{category ? 'Edit category' : 'New category'}</h2>
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="c-name" required>
          <Input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Parent" htmlFor="c-parent" hint="Leave empty for a top-level category.">
          <Select id="c-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">None</option>
            {categories
              .filter((c) => c.id !== category?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="Description" htmlFor="c-desc">
            <Textarea id="c-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>

        <div className="sm:col-span-2">
          {/* Shown as the banner on this category's page and on the homepage tile. */}
          <MediaPicker
            value={image}
            onChange={setImage}
            folder="categories"
            label="Category banner"
            hint="Wide crop. Also used for this category's tile on the homepage. Image or video."
          />
        </div>

        <Field label="Status" htmlFor="c-status">
          <Select id="c-status" value={status} onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </Field>

        <Field label="Sort order" htmlFor="c-sort">
          <Input id="c-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
      </div>

      <div className="mt-5 flex gap-3">
        <Button type="submit" size="sm" loading={busy}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
