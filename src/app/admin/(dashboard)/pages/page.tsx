'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { pageService, type AdminPageSummary } from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { formatDate } from '@/lib/utils'
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  SkeletonRows,
  StatusBadge,
} from '@/components/ui'

/**
 * Content pages (M25).
 *
 * Built-in pages — about, contact, the policies — are marked as such and
 * archive rather than delete, because the footer and checkout link to them.
 */
export default function AdminPagesPage() {
  const { can } = useAuth()
  const editable = can('content.manage')

  const [pages, setPages] = useState<AdminPageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<AdminPageSummary | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await pageService.list()
      setPages(result.pages)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function create() {
    setBusy(true)
    setError(null)
    try {
      await pageService.create({
        title,
        slug: slug || slugify(title),
        status: 'DRAFT',
        blocks: [],
      })
      setCreating(false)
      setTitle('')
      setSlug('')
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create that page')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!deleting) return

    setBusy(true)
    try {
      const result = await pageService.remove(deleting.id)
      setNotice(result.message ?? 'Page deleted.')
      setDeleting(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not delete that page')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Pages</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Standalone content — about, policies, lookbooks. Every save keeps a version you can go
            back to.
          </p>
        </div>
        {editable && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" strokeWidth={2} />
            New page
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}

      {creating && (
        <div className="mb-5 border border-rule bg-white p-5">
          <h2 className="display mb-4 text-lg">New page</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="p-title" required>
              <Input
                id="p-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  if (!slug) setSlug(slugify(event.target.value))
                }}
              />
            </Field>
            <Field label="Address" htmlFor="p-slug" required hint="Appears as /your-address">
              <Input id="p-slug" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
            </Field>
          </div>

          <div className="mt-4 flex gap-3">
            <Button size="sm" loading={busy} disabled={!title.trim()} onClick={() => void create()}>
              Create as draft
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={5} />
          </div>
        ) : pages.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No pages yet" body="Create one to add content beyond the catalogue." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-soft">
                <th className="p-3 font-normal">Title</th>
                <th className="p-3 font-normal">Address</th>
                <th className="p-3 font-normal">Status</th>
                <th className="p-3 font-normal">Versions</th>
                <th className="p-3 font-normal">Updated</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-hairline last:border-0">
                  <td className="p-3">
                    <Link href={`/admin/pages/${page.id}`} className="link-underline">
                      {page.title}
                    </Link>
                    {page.isSystem && <span className="badge badge-neutral ml-2">Built in</span>}
                  </td>
                  <td className="p-3 text-ink-soft">/{page.slug}</td>
                  <td className="p-3">
                    <StatusBadge status={page.status} />
                  </td>
                  <td className="p-3 text-ink-soft">{page._count.revisions}</td>
                  <td className="p-3 text-ink-soft">{formatDate(page.updatedAt)}</td>
                  <td className="p-3 text-right">
                    {editable && (
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(page)}>
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.title}?`}
        body={
          deleting?.isSystem
            ? 'This is a built-in page linked from the footer, so it will be archived rather than deleted.'
            : 'The page and its version history will be removed. Any links to it will start 404ing unless you add a redirect.'
        }
        confirmLabel="Delete"
        loading={busy}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140)
}
