'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { pageService, type AdminPage } from '@/services/admin-modules.service'
import { MediaPicker } from '@/components/admin/media-picker'
import { ApiRequestError } from '@/services/api-client'
import { formatDateTime } from '@/lib/utils'
import {
  Alert,
  Button,
  ConfirmDialog,
  Field,
  Input,
  Select,
  SkeletonRows,
  Textarea,
} from '@/components/ui'

/** The block types the storefront renderer knows about. */
const BLOCK_TYPES = [
  { value: 'richText', label: 'Text' },
  { value: 'hero', label: 'Hero' },
  { value: 'imageBanner', label: 'Image banner' },
  { value: 'videoBanner', label: 'Video banner' },
  { value: 'faq', label: 'Questions and answers' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'spacer', label: 'Spacer' },
] as const

type Block = { type: string; data: Record<string, unknown> }

/**
 * Page editor (M25).
 *
 * Saving snapshots the previous version first, so "restore" always returns the
 * content that was live at that version rather than a reconstruction.
 */
export default function AdminPageEditor() {
  const { id } = useParams<{ id: string }>()
  const { can } = useAuth()
  const editable = can('content.manage')

  const [page, setPage] = useState<AdminPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    title: '',
    slug: '',
    status: 'DRAFT',
    seoTitle: '',
    seoDescription: '',
    seoNoindex: false,
    ogImage: '',
    revisionNote: '',
  })
  const [blocks, setBlocks] = useState<Block[]>([])
  const [restoring, setRestoring] = useState<{ id: string; version: number } | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await pageService.byId(id)
      setPage(result)
      setForm({
        title: result.title,
        slug: result.slug,
        status: result.status,
        seoTitle: result.seoTitle ?? '',
        seoDescription: result.seoDescription ?? '',
        seoNoindex: result.seoNoindex,
        ogImage: result.ogImage ?? '',
        revisionNote: '',
      })
      setBlocks(result.blocks ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load that page')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setSaving(true)
    setError(null)

    try {
      await pageService.update(id, {
        title: form.title,
        slug: form.slug,
        status: form.status,
        blocks,
        seoTitle: form.seoTitle || null,
        seoDescription: form.seoDescription || null,
        seoNoindex: form.seoNoindex,
        ogImage: form.ogImage || null,
        revisionNote: form.revisionNote || undefined,
      })
      setNotice('Saved.')
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save that page')
    } finally {
      setSaving(false)
    }
  }

  async function restore() {
    if (!restoring) return

    setSaving(true)
    try {
      await pageService.restore(id, restoring.id)
      setNotice(`Restored version ${restoring.version}.`)
      setRestoring(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not restore that version')
    } finally {
      setSaving(false)
    }
  }

  const setBlockData = (index: number, key: string, value: unknown) =>
    setBlocks((current) =>
      current.map((block, i) =>
        i === index ? { ...block, data: { ...block.data, [key]: value } } : block,
      ),
    )

  const move = (index: number, delta: number) =>
    setBlocks((current) => {
      const next = [...current]
      const target = index + delta
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target]!, next[index]!]
      return next
    })

  if (loading) return <SkeletonRows rows={6} />
  if (!page) return <Alert>{error ?? 'That page could not be found.'}</Alert>

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/pages"
        className="label-caps mb-5 inline-flex items-center gap-1 text-ink-soft hover:text-ink"
      >
        <ChevronLeft className="size-3.5" strokeWidth={1.6} />
        Pages
      </Link>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-2xl">{page.title}</h1>
        {page.status === 'PUBLISHED' && (
          <a
            href={`/${page.slug}`}
            target="_blank"
            rel="noreferrer noopener"
            className="label-caps link-underline text-sage-700"
          >
            View on the site
          </a>
        )}
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <section className="border border-rule bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="title" required>
            <Input
              id="title"
              disabled={!editable}
              value={form.title}
              onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
            />
          </Field>

          <Field
            label="Address"
            htmlFor="slug"
            required
            hint={
              page.isSystem
                ? 'Built-in pages keep their address.'
                : 'Changing this creates a redirect from the old one.'
            }
          >
            <Input
              id="slug"
              disabled={!editable || page.isSystem}
              value={form.slug}
              onChange={(event) => setForm((f) => ({ ...f, slug: event.target.value }))}
            />
          </Field>

          <Field label="Status" htmlFor="status">
            <Select
              id="status"
              disabled={!editable}
              value={form.status}
              onChange={(event) => setForm((f) => ({ ...f, status: event.target.value }))}
            >
              <option value="DRAFT">Draft — not visible</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </Field>

          <Field label="Version note" htmlFor="note" hint="Optional. Helps when looking back.">
            <Input
              id="note"
              disabled={!editable}
              value={form.revisionNote}
              onChange={(event) => setForm((f) => ({ ...f, revisionNote: event.target.value }))}
            />
          </Field>
        </div>
      </section>

      <section className="mt-5 border border-rule bg-white p-5">
        <h2 className="label-caps mb-4">Content</h2>

        {blocks.length === 0 && (
          <p className="mb-4 text-sm text-ink-soft">Nothing on this page yet.</p>
        )}

        <div className="space-y-4">
          {blocks.map((block, index) => (
            <div key={index} className="border border-rule p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="label-caps">
                  {BLOCK_TYPES.find((t) => t.value === block.type)?.label ?? block.type}
                </p>
                {editable && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      aria-label="Move up"
                      disabled={index === 0}
                      className="p-1 text-ink-soft hover:text-ink disabled:opacity-30"
                    >
                      <ChevronUp className="size-4" strokeWidth={1.6} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      aria-label="Move down"
                      disabled={index === blocks.length - 1}
                      className="p-1 text-ink-soft hover:text-ink disabled:opacity-30"
                    >
                      <ChevronDown className="size-4" strokeWidth={1.6} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlocks((current) => current.filter((_, i) => i !== index))}
                      aria-label="Remove block"
                      className="p-1 text-ink-soft hover:text-danger"
                    >
                      <X className="size-4" strokeWidth={1.6} />
                    </button>
                  </div>
                )}
              </div>

              <BlockFields
                block={block}
                disabled={!editable}
                onChange={(key, value) => setBlockData(index, key, value)}
              />
            </div>
          ))}
        </div>

        {editable && (
          <div className="mt-4 flex flex-wrap gap-2">
            {BLOCK_TYPES.map((type) => (
              <Button
                key={type.value}
                size="sm"
                variant="ghost"
                onClick={() => setBlocks((current) => [...current, { type: type.value, data: {} }])}
              >
                <Plus className="size-3" strokeWidth={2} />
                {type.label}
              </Button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-5 border border-rule bg-white p-5">
        <h2 className="label-caps mb-4">Search engines</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title override" htmlFor="seo-title" hint="Falls back to the page title.">
            <Input
              id="seo-title"
              disabled={!editable}
              maxLength={200}
              value={form.seoTitle}
              onChange={(event) => setForm((f) => ({ ...f, seoTitle: event.target.value }))}
            />
          </Field>

          <Field label="Social image" htmlFor="og">
            <MediaPicker
              value={form.ogImage}
              folder="misc"
              onChange={(url) => setForm((f) => ({ ...f, ogImage: url }))}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="seo-desc" hint="Shown in search results.">
              <Textarea
                id="seo-desc"
                rows={2}
                maxLength={400}
                disabled={!editable}
                value={form.seoDescription}
                onChange={(event) => setForm((f) => ({ ...f, seoDescription: event.target.value }))}
              />
            </Field>
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[#5b6241]"
            disabled={!editable}
            checked={form.seoNoindex}
            onChange={(event) => setForm((f) => ({ ...f, seoNoindex: event.target.checked }))}
          />
          Keep this page out of search results
        </label>
      </section>

      {editable && (
        <div className="mt-5 flex gap-3">
          <Button loading={saving} onClick={() => void save()}>
            Save page
          </Button>
        </div>
      )}

      {page.revisions.length > 0 && (
        <section className="mt-8 border border-rule bg-white p-5">
          <h2 className="label-caps mb-4">Version history</h2>
          <ul className="divide-y divide-hairline text-sm">
            {page.revisions.map((revision) => (
              <li key={revision.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p>
                    Version {revision.version}
                    <span className="ml-2 text-xs text-ink-soft">{revision.title}</span>
                  </p>
                  <p className="text-xs text-ink-soft">
                    {formatDateTime(revision.createdAt)}
                    {revision.note ? ` · ${revision.note}` : ''}
                  </p>
                </div>
                {editable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRestoring({ id: revision.id, version: revision.version })}
                  >
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={restoring !== null}
        title={`Restore version ${restoring?.version}?`}
        body="The current content is saved as a new version first, so this can be undone."
        confirmLabel="Restore"
        tone="primary"
        loading={saving}
        onConfirm={() => void restore()}
        onCancel={() => setRestoring(null)}
      />
    </div>
  )
}

function BlockFields({
  block,
  disabled,
  onChange,
}: {
  block: Block
  disabled: boolean
  onChange: (key: string, value: unknown) => void
}) {
  const str = (key: string) => (typeof block.data[key] === 'string' ? (block.data[key] as string) : '')

  switch (block.type) {
    case 'richText':
      return (
        <Field
          label="Text"
          htmlFor="rt"
          hint="Basic HTML is allowed: headings, paragraphs, lists, links and emphasis."
        >
          <Textarea
            id="rt"
            rows={8}
            disabled={disabled}
            value={str('html')}
            onChange={(event) => onChange('html', event.target.value)}
            placeholder="<p>Your copy here.</p>"
          />
        </Field>
      )

    case 'hero':
    case 'imageBanner':
    case 'videoBanner':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Media" htmlFor="media">
              <MediaPicker
                value={str('image')}
                folder="banners"
                onChange={(url) => onChange('image', url)}
              />
            </Field>
          </div>
          <Field label="Eyebrow" htmlFor="eyebrow">
            <Input
              id="eyebrow"
              disabled={disabled}
              value={str('eyebrow')}
              onChange={(event) => onChange('eyebrow', event.target.value)}
            />
          </Field>
          <Field label="Heading" htmlFor="heading">
            <Input
              id="heading"
              disabled={disabled}
              value={str('heading')}
              onChange={(event) => onChange('heading', event.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Body" htmlFor="body">
              <Textarea
                id="body"
                rows={2}
                disabled={disabled}
                value={str('body')}
                onChange={(event) => onChange('body', event.target.value)}
              />
            </Field>
          </div>
          <Field label="Button label" htmlFor="cta">
            <Input
              id="cta"
              disabled={disabled}
              value={str('ctaLabel')}
              onChange={(event) => onChange('ctaLabel', event.target.value)}
            />
          </Field>
          <Field label="Button link" htmlFor="ctaHref" hint="A path, e.g. /products">
            <Input
              id="ctaHref"
              disabled={disabled}
              value={str('ctaHref')}
              onChange={(event) => onChange('ctaHref', event.target.value)}
            />
          </Field>
        </div>
      )

    case 'faq': {
      const items = Array.isArray(block.data.items)
        ? (block.data.items as Array<Record<string, string>>)
        : []

      return (
        <div className="space-y-3">
          <Field label="Heading" htmlFor="faq-heading">
            <Input
              id="faq-heading"
              disabled={disabled}
              value={str('heading')}
              onChange={(event) => onChange('heading', event.target.value)}
            />
          </Field>

          {items.map((item, index) => (
            <div key={index} className="grid gap-2 border border-hairline p-3 sm:grid-cols-2">
              <Input
                aria-label={`Question ${index + 1}`}
                placeholder="Question"
                disabled={disabled}
                value={item.question ?? ''}
                onChange={(event) =>
                  onChange(
                    'items',
                    items.map((entry, i) =>
                      i === index ? { ...entry, question: event.target.value } : entry,
                    ),
                  )
                }
              />
              <Input
                aria-label={`Answer ${index + 1}`}
                placeholder="Answer"
                disabled={disabled}
                value={item.answer ?? ''}
                onChange={(event) =>
                  onChange(
                    'items',
                    items.map((entry, i) =>
                      i === index ? { ...entry, answer: event.target.value } : entry,
                    ),
                  )
                }
              />
            </div>
          ))}

          {!disabled && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange('items', [...items, { question: '', answer: '' }])}
            >
              <Plus className="size-3" strokeWidth={2} />
              Add a question
            </Button>
          )}
        </div>
      )
    }

    case 'gallery': {
      const images = Array.isArray(block.data.images) ? (block.data.images as string[]) : []

      return (
        <div className="space-y-3">
          {images.map((src, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <MediaPicker
                  value={src}
                  folder="misc"
                  onChange={(url) =>
                    onChange('images', images.map((entry, i) => (i === index ? url : entry)))
                  }
                />
              </div>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove image ${index + 1}`}
                  onClick={() => onChange('images', images.filter((_, i) => i !== index))}
                  className="text-ink-soft hover:text-danger"
                >
                  <X className="size-4" strokeWidth={1.6} />
                </button>
              )}
            </div>
          ))}

          {!disabled && (
            <Button size="sm" variant="ghost" onClick={() => onChange('images', [...images, ''])}>
              <Plus className="size-3" strokeWidth={2} />
              Add an image
            </Button>
          )}
        </div>
      )
    }

    default:
      return <p className="text-sm text-ink-soft">Nothing to configure.</p>
  }
}
