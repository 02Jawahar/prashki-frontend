'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useScrollToEditor } from '@/hooks/use-scroll-to-editor'
import {
  collectionAdminService,
  type AdminCollection,
  type CollectionInput,
  type CollectionStatus,
} from '@/services/admin-modules.service'
import { adminService } from '@/services/admin.service'
import { ApiRequestError } from '@/services/api-client'
import { MediaPicker } from '@/components/admin/media-picker'
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Select,
  SkeletonRows,
  StatusBadge,
  Textarea,
} from '@/components/ui'

/**
 * Collections — the seasonal drops shown on Discover (M23).
 *
 * A collection is when a piece was made; a category is what it is. A product
 * sits in one category and in as many collections as carried it, which is why
 * membership is a checklist here rather than a field on the product.
 */
const STATUSES: CollectionStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED']

export default function AdminCollectionsPage() {
  const { can } = useAuth()
  const editable = can('content.manage')

  const [collections, setCollections] = useState<AdminCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [editing, setEditing] = useState<AdminCollection | 'new' | null>(null)
  const [removing, setRemoving] = useState<AdminCollection | null>(null)
  const [busy, setBusy] = useState(false)

  const editorRef = useScrollToEditor(Boolean(editing))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCollections(await collectionAdminService.list())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load collections')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove() {
    if (!removing) return
    setBusy(true)
    try {
      const result = await collectionAdminService.remove(removing.id)
      setNotice(result.message ?? 'Collection deleted.')
      setRemoving(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not remove that collection')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Collections</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Seasonal drops, shown on Discover newest first. A piece can be in several.
          </p>
        </div>
        {editable && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-3.5" strokeWidth={2} />
            New collection
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}

      {editing && (
        <div ref={editorRef} className="scroll-mt-6">
          <CollectionForm
            collection={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={async (message) => {
              setEditing(null)
              setNotice(message)
              setError(null)
              await load()
            }}
          />
        </div>
      )}

      <div className="mt-6 border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={3} />
          </div>
        ) : collections.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No collections yet"
              body="Create one to give Discover something to show, and to make a collection filter work on the storefront."
            />
          </div>
        ) : (
          <ul>
            {collections.map((collection) => (
              <li
                key={collection.id}
                className="flex items-center justify-between gap-4 border-b border-rule px-5 py-4 last:border-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{collection.name}</span>
                    {collection.year !== null && (
                      <span className="text-xs text-ink-soft">{collection.year}</span>
                    )}
                    <StatusBadge status={collection.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    /collections/{collection.slug} &middot; {collection.productCount ?? 0} piece
                    {collection.productCount === 1 ? '' : 's'}
                    {collection.coverImage ? '' : ' · no cover image'}
                  </p>
                </div>

                {editable && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(collection)}>
                      Edit
                    </Button>
                    <button
                      type="button"
                      onClick={() => setRemoving(collection)}
                      aria-label={`Remove ${collection.name}`}
                      className="p-1.5 text-ink-soft transition-colors hover:text-danger"
                    >
                      <Trash2 className="size-4" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {removing && (
        <ConfirmDialog
          open
          title={`Remove ${removing.name}?`}
          body={
            removing.publishedAt
              ? 'This collection has been live, so it will be archived rather than deleted — its web address may be in a bookmark or an email.'
              : 'This collection has never been published, so it will be deleted.'
          }
          confirmLabel="Remove"
          loading={busy}
          onConfirm={remove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  )
}

function CollectionForm({
  collection,
  onCancel,
  onSaved,
}: {
  collection: AdminCollection | null
  onCancel: () => void
  onSaved: (message: string) => void | Promise<void>
}) {
  const [form, setForm] = useState({
    name: collection?.name ?? '',
    slug: collection?.slug ?? '',
    year: collection?.year != null ? String(collection.year) : '',
    description: collection?.description ?? '',
    coverImage: collection?.coverImage ?? '',
    status: collection?.status ?? ('DRAFT' as CollectionStatus),
    position: String(collection?.position ?? 0),
  })
  const [productIds, setProductIds] = useState<string[]>([])
  const [products, setProducts] = useState<Array<{ id: string; name: string; sku: string }>>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      /**
       * Every product, not a page of them. The picker is a checklist, and a
       * piece that merely sits on page two looks to the person using it exactly
       * like a piece that does not exist.
       */
      const all: Array<{ id: string; name: string; sku: string }> = []
      for (let page = 1; page <= 10; page++) {
        const result = await adminService.products({ page, perPage: 100 }).catch(() => null)
        if (!result?.products?.length) break
        all.push(...result.products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })))
        if (result.products.length < 100) break
      }
      if (!cancelled) setProducts(all)
    })()

    if (collection) {
      void collectionAdminService
        .byId(collection.id)
        .then((full) => {
          if (!cancelled) setProductIds((full.products ?? []).map((p) => p.id))
        })
        .catch(() => undefined)
    }

    return () => {
      cancelled = true
    }
  }, [collection])

  function toggle(id: string) {
    setProductIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)

    const payload: CollectionInput = {
      name: form.name,
      slug: form.slug,
      year: form.year ? Number(form.year) : null,
      description: form.description || null,
      coverImage: form.coverImage || null,
      status: form.status,
      position: Number(form.position || 0),
      productIds,
    }

    try {
      if (collection) await collectionAdminService.update(collection.id, payload)
      else await collectionAdminService.create(payload)
      await onSaved(collection ? 'Collection saved.' : 'Collection created.')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save that collection')
      setSaving(false)
    }
  }

  const visible = search
    ? products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()))
    : products

  return (
    <form onSubmit={submit} className="border border-rule bg-white p-6" noValidate>
      <h2 className="display mb-5 text-lg">
        {collection ? `Edit ${collection.name}` : 'New collection'}
      </h2>
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="c-name" required>
          <Input
            id="c-name"
            required
            value={form.name}
            onChange={(e) => {
              const name = e.target.value
              setForm((f) => ({
                ...f,
                name,
                // Derived only while the address has never been set. Changing a
                // live one breaks every link that points at it.
                slug: collection
                  ? f.slug
                  : name
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, ''),
              }))
            }}
          />
        </Field>

        <Field label="Web address" htmlFor="c-slug" required hint="Lowercase and hyphens. Lives at /collections/…">
          <Input
            id="c-slug"
            required
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
        </Field>

        <Field label="Year" htmlFor="c-year" hint="Shown beside the name on Discover.">
          <Input
            id="c-year"
            type="number"
            min={1900}
            max={2200}
            value={form.year}
            onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
          />
        </Field>

        <Field label="Status" htmlFor="c-status" hint="Only Active collections appear on Discover.">
          <Select
            id="c-status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CollectionStatus }))}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Order" htmlFor="c-position" hint="Lower appears first on Discover.">
          <Input
            id="c-position"
            type="number"
            min={0}
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
          />
        </Field>
      </div>

      <div className="mt-4">
        <MediaPicker
          value={form.coverImage}
          label="Cover image"
          folder="banners"
          hint="The tile on Discover. Without one the grid shows a gap."
          onChange={(coverImage) => setForm((f) => ({ ...f, coverImage }))}
        />
      </div>

      <div className="mt-4">
        <Field label="Description" htmlFor="c-desc" hint="Shown above the pieces on the collection page.">
          <Textarea
            id="c-desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Field>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="label-caps">Pieces in this collection</span>
          <span className="text-xs text-ink-soft">{productIds.length} selected</span>
        </div>

        <Input
          placeholder="Search by name or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="mt-3 max-h-72 overflow-y-auto border border-rule">
          {visible.length === 0 ? (
            <p className="p-4 text-sm text-ink-soft">No products match that.</p>
          ) : (
            <ul>
              {visible.map((product) => (
                <li key={product.id} className="border-b border-hairline last:border-0">
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[#5b6241]"
                      checked={productIds.includes(product.id)}
                      onChange={() => toggle(product.id)}
                    />
                    <span className="flex-1">{product.name}</span>
                    <span className="text-xs text-ink-soft">{product.sku}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" size="sm" loading={saving}>
          {collection ? 'Save changes' : 'Create collection'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
