'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { redirectService, type Redirect } from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
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
} from '@/components/ui'

/**
 * URL redirects (M23).
 *
 * Paths only — the API refuses anything that would send a visitor off-site, and
 * the form says so rather than letting someone find out by having it rejected.
 */
export default function AdminRedirectsPage() {
  const { can } = useAuth()
  const editable = can('content.manage')

  const [redirects, setRedirects] = useState<Redirect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Redirect | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Redirect | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await redirectService.list()
      setRedirects(result.redirects)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load redirects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove() {
    if (!deleting) return

    setBusy(true)
    try {
      await redirectService.remove(deleting.id)
      setDeleting(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not delete that redirect')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Redirects</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Keep old links working after a rename. Renaming a page adds one for you.
          </p>
        </div>
        {editable && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-3.5" strokeWidth={2} />
            New redirect
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}

      {editing && (
        <RedirectForm
          redirect={editing === 'new' ? undefined : editing}
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
            <SkeletonRows rows={4} />
          </div>
        ) : redirects.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No redirects" body="Nothing is being forwarded at the moment." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-soft">
                <th className="p-3 font-normal">From</th>
                <th className="p-3 font-normal">To</th>
                <th className="p-3 font-normal">Type</th>
                <th className="p-3 font-normal">Hits</th>
                <th className="p-3 font-normal">Last used</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {redirects.map((redirect) => (
                <tr key={redirect.id} className="border-b border-hairline last:border-0">
                  <td className="p-3 font-mono text-xs">{redirect.fromPath}</td>
                  <td className="p-3 font-mono text-xs">{redirect.toPath}</td>
                  <td className="p-3 text-ink-soft">
                    {redirect.statusCode === 301 ? 'Permanent' : 'Temporary'}
                    {!redirect.isActive && <span className="badge badge-neutral ml-2">Off</span>}
                  </td>
                  <td className="p-3">{redirect.hitCount}</td>
                  <td className="p-3 text-ink-soft">
                    {redirect.lastHitAt ? formatDate(redirect.lastHitAt) : '—'}
                  </td>
                  <td className="p-3 text-right">
                    {editable && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(redirect)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleting(redirect)}>
                          Delete
                        </Button>
                      </div>
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
        title="Delete this redirect?"
        body={`Anyone following a link to ${deleting?.fromPath} will get a 404 instead.`}
        confirmLabel="Delete"
        loading={busy}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function RedirectForm({
  redirect,
  onDone,
  onCancel,
}: {
  redirect?: Redirect
  onDone: () => void | Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    fromPath: redirect?.fromPath ?? '',
    toPath: redirect?.toPath ?? '',
    statusCode: String(redirect?.statusCode ?? 301),
    isActive: redirect?.isActive ?? true,
    note: redirect?.note ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setError(null)

    const payload = {
      fromPath: form.fromPath,
      toPath: form.toPath,
      statusCode: Number(form.statusCode),
      isActive: form.isActive,
      note: form.note || null,
    }

    try {
      if (redirect) await redirectService.update(redirect.id, payload)
      else await redirectService.create(payload)
      await onDone()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save that redirect')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="border border-rule bg-white p-6" noValidate>
      <h2 className="display mb-5 text-lg">{redirect ? 'Edit redirect' : 'New redirect'}</h2>
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" htmlFor="from" required hint="A path on this site, e.g. /old-dress">
          <Input
            id="from"
            required
            value={form.fromPath}
            onChange={(event) => setForm((f) => ({ ...f, fromPath: event.target.value }))}
            placeholder="/old-path"
          />
        </Field>

        <Field label="To" htmlFor="to" required hint="Also a path. Off-site addresses are refused.">
          <Input
            id="to"
            required
            value={form.toPath}
            onChange={(event) => setForm((f) => ({ ...f, toPath: event.target.value }))}
            placeholder="/new-path"
          />
        </Field>

        <Field
          label="Type"
          htmlFor="code"
          hint="Permanent tells search engines to move the ranking across."
        >
          <Select
            id="code"
            value={form.statusCode}
            onChange={(event) => setForm((f) => ({ ...f, statusCode: event.target.value }))}
          >
            <option value="301">Permanent (301)</option>
            <option value="302">Temporary (302)</option>
          </Select>
        </Field>

        <Field label="Note" htmlFor="note" hint="Why this exists.">
          <Input
            id="note"
            maxLength={300}
            value={form.note}
            onChange={(event) => setForm((f) => ({ ...f, note: event.target.value }))}
          />
        </Field>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[#5b6241]"
          checked={form.isActive}
          onChange={(event) => setForm((f) => ({ ...f, isActive: event.target.checked }))}
        />
        Active
      </label>

      <div className="mt-6 flex gap-3">
        <Button type="submit" size="sm" loading={saving}>
          {redirect ? 'Save changes' : 'Create redirect'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
