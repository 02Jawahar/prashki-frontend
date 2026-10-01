'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import {
  adminService,
  type Conversation,
  type ConversationMessage,
} from '@/services/admin.service'
import { Alert, Button, Textarea } from '@/components/ui'

/**
 * The WhatsApp conversation with one customer.
 *
 * A consultation is a conversation — somebody commissioning a piece has
 * questions and the studio has questions back — but the number could only ever
 * announce things at them. Worse, anything a customer wrote back reached
 * Twilio and was discarded, so the studio never learned they had written.
 *
 * Collapsed by default. Most rows in this list have no conversation, and an
 * empty transcript under every one buries the detail somebody is actually
 * scanning for.
 */

/** The studio keeps the diary, so the studio's clock is the one that matters. */
function at(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * How long the studio has left to reply, in words rather than a timestamp.
 *
 * WhatsApp shuts the free-reply window 24 hours after the customer's last
 * message, and "4 hours left" is a thing somebody acts on where "closes at
 * 14:32" is a sum they have to do.
 */
function remaining(closesAt: string): string {
  const ms = new Date(closesAt).getTime() - Date.now()
  if (ms <= 0) return 'closed'

  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'} left`

  const minutes = Math.max(1, Math.floor(ms / 60_000))
  return `${minutes} minute${minutes === 1 ? '' : 's'} left`
}

function Bubble({ message }: { message: ConversationMessage }) {
  const ours = message.direction === 'OUTBOUND'

  return (
    <li className={`flex flex-col ${ours ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-line px-3.5 py-2.5 text-sm ${
          ours ? 'bg-sage-100 text-ink' : 'border border-rule bg-white text-ink'
        }`}
      >
        {message.body}
      </div>
      <p className="mt-1 text-[0.6875rem] text-ink-soft">
        {at(message.createdAt)}
        {ours && message.sentBy?.name ? ` · ${message.sentBy.name}` : ''}
      </p>
    </li>
  )
}

export function ConsultationThread({
  appointmentId,
  phone,
  email,
}: {
  appointmentId: string
  phone: string
  email: string
}) {
  const [open, setOpen] = useState(false)
  const [thread, setThread] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setThread(await adminService.conversation(appointmentId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the conversation')
    } finally {
      setLoading(false)
    }
  }, [appointmentId])

  useEffect(() => {
    if (open && !thread) void load()
  }, [open, thread, load])

  // Newest message in view when the thread opens, the way every chat behaves.
  useEffect(() => {
    if (thread?.messages.length) endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [thread])

  async function send() {
    const body = draft.trim()
    if (!body) return

    setSending(true)
    setError(null)
    try {
      setThread(await adminService.reply(appointmentId, body))
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not send')
    } finally {
      setSending(false)
    }
  }

  const count = thread?.messages.length ?? 0

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="label-caps inline-flex items-center gap-1.5 text-ink-soft hover:text-ink"
      >
        <MessageCircle className="size-3.5" strokeWidth={1.6} aria-hidden />
        {open ? 'Hide the conversation' : 'WhatsApp'}
        {thread && count > 0 && !open ? ` · ${count}` : ''}
      </button>

      {open && (
        <div className="mt-4">
          {error && <Alert>{error}</Alert>}

          {loading && !thread ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : count === 0 ? (
            <p className="text-sm text-ink-soft">
              Nothing from this customer yet. WhatsApp only lets us write first using a template
              Meta has approved — until they message us, call them on{' '}
              <a href={`tel:${phone}`} className="link-underline text-ink">
                {phone}
              </a>{' '}
              or email{' '}
              <a href={`mailto:${email}`} className="link-underline text-ink">
                {email}
              </a>
              .
            </p>
          ) : (
            <ol className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {thread?.messages.map((m) => <Bubble key={m.id} message={m} />)}
              <div ref={endRef} />
            </ol>
          )}

          {thread?.canReply ? (
            <div className="mt-4">
              <Textarea
                rows={2}
                placeholder="Write to the customer on WhatsApp"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                /*
                 * Enter sends, Shift+Enter makes a new line. This is a chat
                 * box and it should behave like one.
                 */
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ink-soft">
                  {thread.windowClosesAt ? (
                    <>
                      WhatsApp closes the reply window 24 hours after they last wrote —{' '}
                      <span className="text-ink">{remaining(thread.windowClosesAt)}</span>.
                    </>
                  ) : null}
                </p>
                <Button size="sm" loading={sending} onClick={() => void send()}>
                  <Send className="size-3.5" strokeWidth={1.8} aria-hidden />
                  Send
                </Button>
              </div>
            </div>
          ) : count > 0 ? (
            /*
             * Said plainly rather than by greying a box out. Sending here would
             * be accepted by Twilio and dropped by WhatsApp, so the studio
             * would believe it had answered somebody who heard nothing.
             */
            <p className="mt-4 border-l-2 border-rule pl-3 text-sm text-ink-soft">
              The 24-hour reply window has closed, so WhatsApp will not deliver a message typed
              here. Call{' '}
              <a href={`tel:${phone}`} className="link-underline text-ink">
                {phone}
              </a>{' '}
              or email{' '}
              <a href={`mailto:${email}`} className="link-underline text-ink">
                {email}
              </a>
              . If they write again, the window reopens.
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
