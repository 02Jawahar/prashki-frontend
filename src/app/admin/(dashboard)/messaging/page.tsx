'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  messagingService,
  type MessageEvent,
  type MessageLog,
  type MessageTemplate,
} from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { Check, Plus } from 'lucide-react'
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
  const [events, setEvents] = useState<MessageEvent[]>([])
  const [orphans, setOrphans] = useState<Array<{ id: string; key: string; channel: string }>>([])
  const [toggling, setToggling] = useState<string | null>(null)
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
      // Both, because the event list drives the channel switches and the
      // templates carry the copy the editor needs.
      const [rows, catalogue] = await Promise.all([
        messagingService.templates(),
        messagingService.events(),
      ])
      setTemplates(rows)
      setEvents(catalogue.events)
      setOrphans(catalogue.orphans)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Turning a channel on creates its template if there is not one yet, seeded
   * from the email copy — a new WhatsApp message starts as the email rather
   * than as an empty box, which is a far better starting point than blank.
   */
  async function setChannel(key: string, channel: string, enabled: boolean) {
    setToggling(`${key}:${channel}`)
    setError(null)
    setNotice(null)

    try {
      const result = await messagingService.setChannel({ key, channel, enabled })
      await load()

      if (result.created) {
        setNotice(
          `${channel === 'WHATSAPP' ? 'WhatsApp' : channel.toLowerCase()} is on, with a copy of the email wording to edit.`,
        )
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not change that channel')
    } finally {
      setToggling(null)
    }
  }

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

      <ul className="space-y-3">
        {events.map((event) => (
          <li key={event.key} className="border border-rule bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{event.label}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{event.description}</p>
              </div>
              {event.transactional && (
                <span
                  className="badge badge-neutral shrink-0 text-[0.65rem]"
                  title="Sent regardless of marketing preferences — it is part of the purchase."
                >
                  Transactional
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {event.channels.map((channel) => {
                const template = templates.find((t) => t.id === channel.templateId)
                const busy = toggling === `${event.key}:${channel.channel}`

                return (
                  <span key={channel.channel} className="inline-flex items-center">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setChannel(event.key, channel.channel, !channel.enabled)}
                      aria-pressed={channel.enabled}
                      className={`border px-3 py-1.5 text-xs capitalize transition-colors disabled:opacity-50 ${
                        channel.enabled
                          ? 'border-sage-700 bg-sage-50 text-sage-700'
                          : 'border-rule text-ink-soft hover:bg-shell'
                      }`}
                    >
                      {channel.enabled ? (
                        <Check className="mr-1 inline size-3" strokeWidth={2.5} />
                      ) : (
                        <Plus className="mr-1 inline size-3" strokeWidth={2} />
                      )}
                      {channel.channel === 'WHATSAPP' ? 'WhatsApp' : channel.channel.toLowerCase()}
                    </button>

                    {template && (
                      <button
                        type="button"
                        onClick={() => startEditing(template)}
                        className="ml-1.5 mr-2 text-xs text-sage-700 underline"
                      >
                        Edit
                      </button>
                    )}
                  </span>
                )
              })}
            </div>

            {/*
              A channel that needs a phone number is only as good as the data.
              Saying so here stops "WhatsApp is on but nothing arrives" becoming
              a bug report.
            */}
            {event.channels.some((c) => c.enabled && c.channel !== 'EMAIL') && (
              <p className="mt-3 text-xs text-ink-soft">
                WhatsApp and SMS only reach customers who have saved a phone number.
              </p>
            )}
          </li>
        ))}
      </ul>

      {orphans.length > 0 && (
        <div className="mt-6 border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">Templates with no matching event</p>
          <p className="mt-1 text-xs text-amber-800">
            These will never be sent — the event they were written for is not one the store emits.
            Usually a leftover from a renamed event.
          </p>
          <ul className="mt-2 text-xs text-amber-800">
            {orphans.map((orphan) => (
              <li key={orphan.id}>
                {orphan.key} · {orphan.channel.toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
      )}
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
