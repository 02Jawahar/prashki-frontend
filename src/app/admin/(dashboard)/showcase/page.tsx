'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Film, Plus, Trash2 } from 'lucide-react'
import {
  showcaseService,
  type AdminShowcaseItem,
  type ShowcaseInput,
} from '@/services/admin-modules.service'
import { adminService } from '@/services/admin.service'
import { ApiRequestError } from '@/services/api-client'
import { MediaPicker } from '@/components/admin/media-picker'
import { formatDate } from '@/lib/utils'
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
 * The customer showcase — the "as worn by you" wall on the homepage.
 *
 * The screen is built around the one thing that makes this feature risky:
 * every item is a real person's face, usually taken from their own social
 * post. The API refuses to publish without a recorded permission date, so this
 * form leads with that rather than hiding it at the bottom, and says why.
 *
 * Order is edited in place with the arrows and saved as a whole list, which
 * matches how the API takes it and avoids a drag-and-drop dependency for what
 * is at most a dozen tiles.
 */
const BLANK: ShowcaseInput = {
  mediaType: 'VIDEO',
  mediaUrl: '',
  posterUrl: '',
  altText: '',
  caption: '',
  creditName: '',
  creditHandle: '',
  sourceUrl: '',
  consentGrantedAt: null,
  consentNote: '',
  status: 'DRAFT',
  productIds: [],
}

export default function AdminShowcasePage() {
  const [items, setItems] = useState<AdminShowcaseItem[]>([])
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [editing, setEditing] = useState<AdminShowcaseItem | 'new' | null>(null)
  const [deleting, setDeleting] = useState<AdminShowcaseItem | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await showcaseService.list()
      setItems(result.items)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load the showcase')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    // The product picker only needs id and name; the list endpoint is the
    // cheapest source for that.
    void adminService
      .products({ perPage: 100 })
      .then((r) => setProducts(r.products.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => undefined)
  }, [load])

  /** Moves one item and persists the whole order. */
  async function move(index: number, delta: number) {
    const next = [...items]
    const target = index + delta
    if (target < 0 || target >= next.length) return

    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)

    try {
      await showcaseService.reorder(next.map((item) => item.id))
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save that order')
      await load()
    }
  }

  async function remove() {
    if (!deleting) return
    setBusy(true)
    try {
      await showcaseService.remove(deleting.id)
      setDeleting(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not delete that item')
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-6">
        <div>
          <h1 className="display text-2xl">Customer showcase</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Photos and clips of customers in the pieces, shown on the homepage. Nothing publishes
            without a recorded permission date.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="mr-1.5 size-4" strokeWidth={1.5} />
          Add
        </Button>
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {editing && (
        <ShowcaseForm
          item={editing === 'new' ? null : editing}
          products={products}
          onCancel={() => setEditing(null)}
          onSaved={async (message) => {
            setEditing(null)
            setNotice(message)
            setError(null)
            await load()
          }}
        />
      )}

      <div className="mt-6 border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={5} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nothing here yet"
              body="Add a customer photo or clip to build the homepage wall."
            />
          </div>
        ) : (
          <ul>
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex items-start gap-4 border-b border-hairline p-4 last:border-0"
              >
                <div className="relative aspect-9/16 w-16 shrink-0 overflow-hidden bg-sage-100">
                  {item.posterUrl || item.mediaType === 'IMAGE' ? (
                    <Image
                      src={item.posterUrl ?? item.mediaUrl}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-ink-soft">
                      <Film className="size-5" strokeWidth={1.5} />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-ink-soft">{item.mediaType.toLowerCase()}</span>
                    {!item.consentGrantedAt && (
                      <span className="badge badge-warning text-[0.65rem]">No permission on file</span>
                    )}
                  </div>

                  <p className="mt-1.5 truncate text-sm">{item.altText}</p>

                  <p className="mt-0.5 text-xs text-ink-soft">
                    {item.creditName ?? 'No credit'}
                    {item.creditHandle && ` · @${item.creditHandle}`}
                    {item.consentGrantedAt &&
                      ` · permission ${formatDate(item.consentGrantedAt)}`}
                  </p>

                  {item.products.length > 0 && (
                    <p className="mt-1 text-xs text-ink-soft">
                      Shop: {item.products.map((p) => p.product.name).join(', ')}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void move(index, -1)}
                    disabled={index === 0}
                    className="p-1.5 text-ink-soft disabled:opacity-30"
                    aria-label={`Move ${item.altText} earlier`}
                  >
                    <ArrowUp className="size-4" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void move(index, 1)}
                    disabled={index === items.length - 1}
                    className="p-1.5 text-ink-soft disabled:opacity-30"
                    aria-label={`Move ${item.altText} later`}
                  >
                    <ArrowDown className="size-4" strokeWidth={1.5} />
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(item)}>
                    Edit
                  </Button>
                  <button
                    type="button"
                    onClick={() => setDeleting(item)}
                    className="p-1.5 text-ink-soft hover:text-red-700"
                    aria-label={`Delete ${item.altText}`}
                  >
                    <Trash2 className="size-4" strokeWidth={1.5} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this item?"
        body="It will be removed from the showcase permanently."
        confirmLabel="Delete"
        loading={busy}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function ShowcaseForm({
  item,
  products,
  onCancel,
  onSaved,
}: {
  item: AdminShowcaseItem | null
  products: Array<{ id: string; name: string }>
  onCancel: () => void
  onSaved: (message: string) => void | Promise<void>
}) {
  const [form, setForm] = useState<ShowcaseInput>(() =>
    item
      ? {
          mediaType: item.mediaType,
          mediaUrl: item.mediaUrl,
          posterUrl: item.posterUrl ?? '',
          altText: item.altText,
          caption: item.caption ?? '',
          creditName: item.creditName ?? '',
          creditHandle: item.creditHandle ?? '',
          sourceUrl: item.sourceUrl ?? '',
          consentGrantedAt: item.consentGrantedAt,
          consentNote: item.consentNote ?? '',
          status: item.status,
          scheduledFor: item.scheduledFor,
          productIds: item.products.map((p) => p.product.id),
        }
      : { ...BLANK },
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof ShowcaseInput>(key: K, value: ShowcaseInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  async function save() {
    setSaving(true)
    setError(null)
    try {
      // Empty strings mean "not set" on optional fields; the API wants null,
      // and a URL validator would reject "" outright.
      const payload: ShowcaseInput = {
        ...form,
        posterUrl: form.posterUrl || null,
        caption: form.caption || null,
        creditName: form.creditName || null,
        creditHandle: form.creditHandle || null,
        sourceUrl: form.sourceUrl || null,
        consentNote: form.consentNote || null,
        scheduledFor: form.scheduledFor || null,
      }

      if (item) {
        await showcaseService.update(item.id, payload)
      } else {
        await showcaseService.create(payload)
      }

      await onSaved(item ? 'Saved.' : 'Added to the showcase.')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save that')
    } finally {
      setSaving(false)
    }
  }

  const consented = Boolean(form.consentGrantedAt)

  return (
    <div className="border border-rule bg-white p-5">
      <h2 className="label-caps mb-4">{item ? 'Edit item' : 'New item'}</h2>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Type">
            <Select
              value={form.mediaType}
              onChange={(event) => set('mediaType', event.target.value as 'VIDEO' | 'IMAGE')}
            >
              <option value="VIDEO">Video</option>
              <option value="IMAGE">Photo</option>
            </Select>
          </Field>

          <MediaPicker
            value={form.mediaUrl ?? ''}
            onChange={(url) => set('mediaUrl', url)}
            folder="home"
            label={form.mediaType === 'VIDEO' ? 'Video' : 'Photo'}
            hint="Vertical works best — the wall is 9:16."
          />

          {form.mediaType === 'VIDEO' && (
            <MediaPicker
              value={form.posterUrl ?? ''}
              onChange={(url) => set('posterUrl', url)}
              folder="home"
              label="Poster"
              hint="A still from the clip. Required to publish — it is what shows while the video loads."
            />
          )}

          <Field label="Describe the shot">
            <Input
              value={form.altText ?? ''}
              onChange={(event) => set('altText', event.target.value)}
              placeholder="A customer in the Amaira dress on a rooftop at sunset"
            />
          </Field>

          <Field label="Caption (optional)">
            <Textarea
              rows={2}
              value={form.caption ?? ''}
              onChange={(event) => set('caption', event.target.value)}
              placeholder="Something they said about it."
            />
          </Field>
        </div>

        <div className="space-y-4">
          <div className="border border-rule bg-shell p-4">
            <p className="label-caps mb-1 text-xs">Permission</p>
            <p className="mb-3 text-xs text-ink-soft">
              It is their video and their face. Record when they said yes before this goes live.
            </p>

            <Field label="Permission given on">
              <Input
                type="date"
                value={form.consentGrantedAt ? form.consentGrantedAt.slice(0, 10) : ''}
                onChange={(event) =>
                  set(
                    'consentGrantedAt',
                    // The API takes an ISO datetime; a date input gives a date.
                    event.target.value ? new Date(`${event.target.value}T00:00:00Z`).toISOString() : null,
                  )
                }
              />
            </Field>

            <Field label="How they gave it">
              <Input
                value={form.consentNote ?? ''}
                onChange={(event) => set('consentNote', event.target.value)}
                placeholder="Replied yes to our comment, 12 Aug"
              />
            </Field>
          </div>

          <Field label="Credit name">
            <Input
              value={form.creditName ?? ''}
              onChange={(event) => set('creditName', event.target.value)}
              placeholder="Ananya R."
            />
          </Field>

          <Field label="Handle">
            <Input
              value={form.creditHandle ?? ''}
              onChange={(event) => set('creditHandle', event.target.value)}
              placeholder="ananya.wears"
            />
          </Field>

          <Field label="Original post (optional)">
            <Input
              value={form.sourceUrl ?? ''}
              onChange={(event) => set('sourceUrl', event.target.value)}
              placeholder="https://…"
            />
          </Field>

          <Field label="Pieces in the shot">
            <select
              multiple
              size={6}
              className="w-full border border-rule p-2 text-sm"
              value={form.productIds ?? []}
              onChange={(event) =>
                set(
                  'productIds',
                  Array.from(event.target.selectedOptions, (option) => option.value),
                )
              }
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <Select
              value={form.status}
              onChange={(event) => set('status', event.target.value as ShowcaseInput['status'])}
            >
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="ACTIVE" disabled={!consented}>
                Live{consented ? '' : ' — needs permission first'}
              </option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </Field>

          {form.status === 'SCHEDULED' && (
            <Field label="Publish on">
              <Input
                type="datetime-local"
                value={form.scheduledFor ? form.scheduledFor.slice(0, 16) : ''}
                onChange={(event) =>
                  set(
                    'scheduledFor',
                    event.target.value ? new Date(event.target.value).toISOString() : null,
                  )
                }
              />
            </Field>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <Button onClick={() => void save()} loading={saving}>
          {item ? 'Save' : 'Add'}
        </Button>
        <Button variant="ghost" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
