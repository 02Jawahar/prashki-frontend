'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  messagingService,
  type MessageLog,
  type MessageTemplate,
} from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { formatDateTime } from '@/lib/utils'
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  SkeletonRows,
  StatusBadge,
  Textarea,
} from '@/components/ui'

/**
 * Message templates and the delivery log (M14, M15).
 *
 * Templates are the copy the store sends; the log answers "did they get it?".
 * Transactional messages — receipts, delivery updates — are always sent
 * regardless of preferences, which is why there is no on/off switch for them.
 */
export default function AdminMessagingPage() {
  const [tab, setTab] = useState<'templates' | 'logs'>('templates')

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="display text-2xl">Messages</h1>
        <p className="mt-1 text-sm text-ink-soft">
          What the store sends, and what actually went out.
        </p>
      </header>

      <div className="mb-5 flex gap-6 border-b border-hairline">
        {(['templates', 'logs'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value ? 'page' : undefined}
            className={`label-caps -mb-px border-b-2 pb-3 ${
              tab === value ? 'border-sage-700 text-ink' : 'border-transparent text-ink-soft'
            }`}
          >
            {value === 'templates' ? 'Templates' : 'Delivery log'}
          </button>
        ))}
      </div>

      {tab === 'templates' ? <Templates /> : <Logs />}
    </div>
  )
}

function Templates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<MessageTemplate | null>(null)
  const [draft, setDraft] = useState({ subject: '', body: '', isActive: true })
  const [saving, setSaving] = useState(false)

  const [preview, setPreview] = useState<{ subject: string | null; body: string; undeclared: string[] } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [testing, setTesting] = useState(false)

  /**
   * The editor opens above the table, and the table is long enough that a row
   * near the bottom puts the form well off the top of the screen — pressing
   * Edit there looked like it did nothing at all. Scrolling to the panel and
   * moving focus into it is what makes the button appear to work.
   */
  const editorRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  function startEditing(template: MessageTemplate) {
    setEditing(template)
    setDraft({
      subject: template.subject ?? '',
      body: template.body,
      isActive: template.isActive,
    })
    setPreview(null)
    setNotice(null)
    setError(null)
  }

  useEffect(() => {
    if (!editing) return
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // After the scroll starts, so the browser does not fight it.
    const timer = setTimeout(() => firstFieldRef.current?.focus(), 250)
    return () => clearTimeout(timer)
  }, [editing])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setTemplates(await messagingService.templates())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!editing) return

    setSaving(true)
    setError(null)

    try {
      await messagingService.saveTemplate({
        key: editing.key,
        channel: editing.channel,
        name: editing.name,
        subject: draft.subject || null,
        body: draft.body,
        providerTemplateId: editing.providerTemplateId,
        variables: editing.variables,
        isActive: draft.isActive,
      })
      setNotice('Template saved.')
      setEditing(null)
      setPreview(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save that template')
    } finally {
      setSaving(false)
    }
  }

  /** Renders what is on screen, not what is stored — the point is to check an edit. */
  async function showPreview() {
    if (!editing) return

    setPreviewing(true)
    setError(null)
    try {
      setPreview(
        await messagingService.preview({
          key: editing.key,
          channel: editing.channel,
          subject: draft.subject || null,
          body: draft.body,
        }),
      )
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not render that template')
    } finally {
      setPreviewing(false)
    }
  }

  async function testSend() {
    if (!editing) return

    setTesting(true)
    setError(null)
    try {
      const result = await messagingService.testSend({ key: editing.key, channel: editing.channel })

      if (!result.sent) {
        setError(`Not sent — ${result.reason ?? 'the provider refused it'}.`)
      } else if (result.provider === 'console' || result.provider === 'noop') {
        // "Sent" against a stub means the pipeline worked and nothing left the
        // building. Saying so here saves an hour of checking an empty inbox.
        setNotice(
          `Sent to ${result.recipient} through the "${result.provider}" provider — it was written to the server log and the message log, not delivered. Configure a real provider to send for real.`,
        )
      } else {
        setNotice(`Sent to ${result.recipient} via ${result.provider}.`)
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send the test')
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <SkeletonRows rows={5} />

  return (
    <div>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {editing && (
        <div ref={editorRef} className="mb-5 scroll-mt-6 border border-rule bg-white p-5">
          <h2 className="display mb-1 text-lg">{editing.name}</h2>
          <p className="mb-4 text-xs text-ink-soft">
            {editing.key} · {editing.channel.toLowerCase()}
          </p>

          {editing.variables.length > 0 && (
            <p className="mb-4 text-xs text-ink-soft">
              Available placeholders:{' '}
              {editing.variables.map((variable) => (
                <code key={variable} className="mr-1.5 bg-sage-50 px-1">
                  {`{{${variable}}}`}
                </code>
              ))}
            </p>
          )}

          {editing.channel === 'EMAIL' && (
            <Field label="Subject" htmlFor="subject" required>
              <Input
                id="subject"
                ref={firstFieldRef as React.RefObject<HTMLInputElement>}
                value={draft.subject}
                onChange={(event) => setDraft((d) => ({ ...d, subject: event.target.value }))}
              />
            </Field>
          )}

          <div className="mt-4">
            <Field label="Message" htmlFor="body" required>
              <Textarea
                id="body"
                // On a channel with no subject line, this is the first field.
                ref={
                  editing.channel === 'EMAIL'
                    ? undefined
                    : (firstFieldRef as React.RefObject<HTMLTextAreaElement>)
                }
                rows={10}
                value={draft.body}
                onChange={(event) => {
                  setDraft((d) => ({ ...d, body: event.target.value }))
                  // The preview is of the previous text the moment you type.
                  setPreview(null)
                }}
              />
            </Field>
          </div>

          {preview && (
            <div className="mt-4 border border-rule bg-shell p-4">
              <p className="label-caps mb-2 text-xs">Preview — with sample values</p>

              {preview.undeclared.length > 0 && (
                <p className="mb-3 text-xs text-amber-800">
                  {preview.undeclared.map((v) => `{{${v}}}`).join(', ')}{' '}
                  {preview.undeclared.length === 1 ? 'is' : 'are'} not in this template&rsquo;s
                  placeholder list, so {preview.undeclared.length === 1 ? 'it' : 'they'} will render
                  blank in a real message.
                </p>
              )}

              {preview.subject && (
                <p className="mb-2 text-sm">
                  <span className="text-ink-soft">Subject: </span>
                  {preview.subject}
                </p>
              )}

              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {preview.body}
              </pre>
            </div>
          )}

          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[#5b6241]"
              checked={draft.isActive}
              onChange={(event) => setDraft((d) => ({ ...d, isActive: event.target.checked }))}
            />
            Active — turning this off stops the message being sent at all
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Save template
            </Button>
            <Button size="sm" variant="ghost" loading={previewing} onClick={() => void showPreview()}>
              Preview
            </Button>
            <Button size="sm" variant="ghost" loading={testing} onClick={() => void testSend()}>
              Send me a test
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>

          <p className="mt-3 text-xs text-ink-soft">
            A test sends the <em>saved</em> template to your own address — save first if you want to
            test an edit.
          </p>
        </div>
      )}

      <div className="border border-rule bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-soft">
              <th className="p-3 font-normal">Template</th>
              <th className="p-3 font-normal">Channel</th>
              <th className="p-3 font-normal">Subject</th>
              <th className="p-3 font-normal">Active</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id} className="border-b border-hairline last:border-0">
                <td className="p-3">
                  <p>{template.name}</p>
                  <p className="text-xs text-ink-soft">{template.key}</p>
                </td>
                <td className="p-3 capitalize text-ink-soft">{template.channel.toLowerCase()}</td>
                <td className="p-3 text-ink-soft">{template.subject ?? '—'}</td>
                <td className="p-3">
                  {template.isActive ? (
                    <span className="badge badge-success">On</span>
                  ) : (
                    <span className="badge badge-neutral">Off</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEditing(template)}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Logs() {
  const [logs, setLogs] = useState<MessageLog[]>([])
  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await messagingService.logs({
        status: status || undefined,
        channel: channel || undefined,
      })
      setLogs(result.logs)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the log')
    } finally {
      setLoading(false)
    }
  }, [status, channel])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      {error && <Alert>{error}</Alert>}

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
          aria-label="Filter by channel"
          className="w-40"
        >
          <option value="">All channels</option>
          <option value="EMAIL">Email</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="SMS">SMS</option>
        </Select>

        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="w-40"
        >
          <option value="">All statuses</option>
          <option value="SENT">Sent</option>
          <option value="QUEUED">Queued</option>
          <option value="FAILED">Failed</option>
          <option value="BOUNCED">Bounced</option>
        </Select>
      </div>

      <div className="border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={5} />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Nothing sent yet" body="Messages appear here as they go out." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-soft">
                <th className="p-3 font-normal">Message</th>
                <th className="p-3 font-normal">To</th>
                <th className="p-3 font-normal">Channel</th>
                <th className="p-3 font-normal">When</th>
                <th className="p-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-hairline last:border-0">
                  <td className="p-3">
                    <p>{log.template?.name ?? log.subject ?? '—'}</p>
                    {log.error && <p className="mt-0.5 text-xs text-danger">{log.error}</p>}
                  </td>
                  <td className="p-3 text-ink-soft">{log.recipient}</td>
                  <td className="p-3 capitalize text-ink-soft">{log.channel.toLowerCase()}</td>
                  <td className="p-3 text-ink-soft">
                    {formatDateTime(log.sentAt ?? log.createdAt)}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={log.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
