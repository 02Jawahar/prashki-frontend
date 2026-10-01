'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mail, Phone } from 'lucide-react'
import { adminService, type Appointment } from '@/services/admin.service'
import { useAuth } from '@/hooks/use-auth'
import {
  Alert,
  Button,
  EmptyState,
  Select,
  SkeletonRows,
  StatusBadge,
  Textarea,
} from '@/components/ui'

/**
 * Consultations somebody asked for.
 *
 * The most valuable list in the shop: every row is a person who wants a piece
 * made and is waiting to hear back. So it opens on the ones nobody has
 * answered yet, and it puts the phone number and what they want in the row
 * rather than behind a click — somebody working through these is reaching for
 * the phone, not browsing.
 */

const FILTERS = [
  { value: 'REQUESTED', label: 'Waiting for an answer' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'COMPLETED', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: '', label: 'Everything' },
]

/** The studio keeps the diary, so the studio's clock is the one that matters. */
function when(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function AppointmentsPage() {
  const { can } = useAuth()
  const canEdit = can('order.update')

  const [status, setStatus] = useState('REQUESTED')
  const [rows, setRows] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await adminService.appointments(status || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the consultations')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  async function move(id: string, next: string) {
    setBusy(id)
    setError(null)
    try {
      await adminService.updateAppointment(id, { status: next, staffNote: notes[id] })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Consultations</h1>
          <p className="mt-1 text-sm text-ink-soft">
            People asking to be seen about a commission. Confirming one writes to them with the
            time and the address.
          </p>
        </div>
        <div className="w-56">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter">
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
      </header>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing here"
          body={
            status === 'REQUESTED'
              ? 'Every consultation has been answered.'
              : 'No consultations with that status.'
          }
        />
      ) : (
        <ol className="space-y-4">
          {rows.map((a) => (
            <li key={a.id} className="border border-rule bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="display text-lg">{a.name}</p>
                  <p className="mt-0.5 text-sm text-ink">{when(a.preferredAt)}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-soft">
                    {/*
                      Linked rather than printed. Somebody working through this
                      list is about to ring them, and on a phone that is one tap
                      instead of copying digits across.
                    */}
                    <a
                      href={`tel:${a.phone}`}
                      className="inline-flex items-center gap-1.5 hover:text-ink"
                    >
                      <Phone className="size-3.5" strokeWidth={1.6} aria-hidden />
                      {a.phone}
                    </a>
                    <a
                      href={`mailto:${a.email}`}
                      className="inline-flex items-center gap-1.5 hover:text-ink"
                    >
                      <Mail className="size-3.5" strokeWidth={1.6} aria-hidden />
                      {a.email}
                    </a>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-ink-soft">{a.reference}</span>
                  <StatusBadge status={a.status} />
                </div>
              </div>

              {a.notes && (
                <p className="mt-4 whitespace-pre-line border-l-2 border-sage-200 pl-4 text-sm text-ink-soft">
                  {a.notes}
                </p>
              )}

              {a.staffNote && (
                <p className="mt-3 text-xs text-ink-soft">
                  <span className="label-caps text-ink">Note</span> · {a.staffNote}
                </p>
              )}

              {canEdit && a.status !== 'CANCELLED' && a.status !== 'COMPLETED' && (
                <div className="mt-4 border-t border-hairline pt-4">
                  <Textarea
                    rows={2}
                    placeholder="A note for the studio — never shown to the customer"
                    value={notes[a.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.status === 'REQUESTED' && (
                      <Button
                        size="sm"
                        loading={busy === a.id}
                        onClick={() => void move(a.id, 'CONFIRMED')}
                      >
                        Confirm — writes to them
                      </Button>
                    )}
                    {a.status === 'CONFIRMED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busy === a.id}
                        onClick={() => void move(a.id, 'COMPLETED')}
                      >
                        Mark done
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === a.id}
                      onClick={() => void move(a.id, 'CANCELLED')}
                    >
                      Cancel
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">
                    Only confirming writes to the customer. Marking done or cancelling is between
                    us.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
