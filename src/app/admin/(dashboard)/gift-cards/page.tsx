'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useScrollToEditor } from '@/hooks/use-scroll-to-editor'
import {
  giftCardAdminService,
  type AdminGiftCard,
  type GiftCardStatus,
} from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { formatPrice } from '@/lib/money'
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
 * Gift cards (M13).
 *
 * Read-mostly on purpose. Almost every card here was created by a customer
 * paying for it, and the two things staff can do — issue one by hand, cancel
 * one — both create or destroy money, so both are audited and sit behind the
 * refund permission rather than general order access.
 */
const STATUSES: GiftCardStatus[] = ['PENDING', 'ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED']

export default function AdminGiftCardsPage() {
  const { can } = useAuth()
  const canIssue = can('refund.create')

  const [cards, setCards] = useState<AdminGiftCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')

  const [issuing, setIssuing] = useState(false)
  const [detail, setDetail] = useState<AdminGiftCard | null>(null)
  const [cancelling, setCancelling] = useState<AdminGiftCard | null>(null)
  const [busy, setBusy] = useState(false)

  const editorRef = useScrollToEditor(issuing)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await giftCardAdminService.list({ q: q || undefined, status: status || undefined })
      setCards(result.giftCards)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load gift cards')
    } finally {
      setLoading(false)
    }
  }, [q, status])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250)
    return () => clearTimeout(timer)
  }, [load])

  async function cancel() {
    if (!cancelling) return
    setBusy(true)
    try {
      await giftCardAdminService.cancel(cancelling.id, 'Cancelled from admin')
      setNotice(`${cancelling.code} cancelled.`)
      setCancelling(null)
      setDetail(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not cancel that card')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Gift cards</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Stored value. Every movement is on the card&rsquo;s statement.
          </p>
        </div>
        {canIssue && (
          <Button size="sm" onClick={() => setIssuing(true)}>
            <Plus className="size-3.5" strokeWidth={2} />
            Issue a card
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}

      {issuing && (
        <div ref={editorRef} className="scroll-mt-6">
          <IssueForm
            onCancel={() => setIssuing(false)}
            onIssued={async (card) => {
              setIssuing(false)
              setNotice(`Issued ${card.code} for ${formatPrice(card.initialValue)}.`)
              await load()
            }}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Code, recipient name or email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[12rem]">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4 border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={4} />
          </div>
        ) : cards.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No gift cards"
              body="Cards appear here when a customer buys one, or when you issue one by hand."
            />
          </div>
        ) : (
          <ul>
            {cards.map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between gap-4 border-b border-rule px-5 py-4 last:border-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">{card.code}</span>
                    <StatusBadge status={card.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {formatPrice(card.balance)} of {formatPrice(card.initialValue)} left
                    {card.recipientEmail ? ` · for ${card.recipientEmail}` : ''}
                    {card.expiresAt ? ` · expires ${formatDate(card.expiresAt)}` : ''}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => setDetail(await giftCardAdminService.byId(card.id))}
                  >
                    Statement
                  </Button>
                  {canIssue && card.status !== 'CANCELLED' && (
                    <Button size="sm" variant="ghost" onClick={() => setCancelling(card)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detail && <Statement card={detail} onClose={() => setDetail(null)} />}

      {cancelling && (
        <ConfirmDialog
          open
          title={`Cancel ${cancelling.code}?`}
          body={
            cancelling.balance > 0
              ? `${formatPrice(cancelling.balance)} is still on this card. Cancelling writes that off, and whoever holds the code will not be able to spend it.`
              : 'This card is already empty. Cancelling stops it being used if a balance is ever put back.'
          }
          confirmLabel="Cancel the card"
          loading={busy}
          onConfirm={cancel}
          onCancel={() => setCancelling(null)}
        />
      )}
    </div>
  )
}

/** The ledger, which is the honest answer to "where did the money go". */
function Statement({ card, onClose }: { card: AdminGiftCard; onClose: () => void }) {
  return (
    <div className="mt-6 border border-rule bg-white p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="display text-lg">{card.code}</h2>
          <p className="mt-1 text-xs text-ink-soft">
            {formatPrice(card.balance)} of {formatPrice(card.initialValue)}
            {card.purchaser ? ` · bought by ${card.purchaser.email}` : ' · issued by hand'}
            {card.recipientEmail ? ` · sent to ${card.recipientEmail}` : ''}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {card.message && (
        <p className="mb-4 border-l-2 border-rule pl-3 text-sm italic text-ink-soft">
          &ldquo;{card.message}&rdquo;
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-rule text-left">
              <th className="py-2 font-normal text-ink-soft">When</th>
              <th className="py-2 font-normal text-ink-soft">What</th>
              <th className="py-2 text-right font-normal text-ink-soft">Amount</th>
              <th className="py-2 text-right font-normal text-ink-soft">Balance</th>
            </tr>
          </thead>
          <tbody>
            {(card.transactions ?? []).map((t) => (
              <tr key={t.id} className="border-b border-hairline last:border-0">
                <td className="py-2.5 text-xs text-ink-soft">{formatDate(t.createdAt)}</td>
                <td className="py-2.5">
                  {t.type.charAt(0) + t.type.slice(1).toLowerCase()}
                  {t.note ? <span className="ml-2 text-xs text-ink-soft">{t.note}</span> : null}
                </td>
                <td className={`py-2.5 text-right ${t.amount < 0 ? '' : 'text-success'}`}>
                  {t.amount < 0 ? '−' : '+'}
                  {formatPrice(Math.abs(t.amount))}
                </td>
                <td className="py-2.5 text-right text-ink-soft">{formatPrice(t.balanceAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function IssueForm({
  onCancel,
  onIssued,
}: {
  onCancel: () => void
  onIssued: (card: AdminGiftCard) => void | Promise<void>
}) {
  const [form, setForm] = useState({ amount: '', name: '', email: '', message: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)

    try {
      const card = await giftCardAdminService.issue({
        amount: Math.round(Number(form.amount || 0) * 100),
        recipientName: form.name || null,
        recipientEmail: form.email || null,
        message: form.message || null,
        note: form.note || null,
      })
      await onIssued(card)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not issue that card')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="border border-rule bg-white p-6" noValidate>
      <h2 className="display mb-1 text-lg">Issue a gift card</h2>
      <p className="mb-5 text-xs text-ink-soft">
        This creates spendable value without anyone paying for it, so it is recorded against your
        name. Use the note to say why.
      </p>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₹)" htmlFor="gc-amount" required>
          <Input
            id="gc-amount"
            type="number"
            min={500}
            step={1}
            required
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
        </Field>

        <Field label="Reason" htmlFor="gc-note" required hint="Shown on the statement.">
          <Input
            id="gc-note"
            required
            placeholder="Goodwill after a late delivery"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </Field>

        <Field label="Recipient name" htmlFor="gc-rname">
          <Input
            id="gc-rname"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>

        <Field label="Recipient email" htmlFor="gc-remail">
          <Input
            id="gc-remail"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Message" htmlFor="gc-msg">
          <Textarea
            id="gc-msg"
            rows={2}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          />
        </Field>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" size="sm" loading={saving}>
          Issue
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
