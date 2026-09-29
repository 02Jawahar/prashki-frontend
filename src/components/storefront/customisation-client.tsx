'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { appointmentService } from '@/services/storefront.service'
import { useAuth } from '@/hooks/use-auth'
import { Alert, Button, Field, Input, Textarea } from '@/components/ui'

/**
 * Asking to be seen about a commission.
 *
 * No account required. Somebody commissioning a wedding lehenga is usually
 * doing it before they have bought anything, and a form that demands a
 * password first is an enquiry that never arrives. A signed-in customer gets
 * their details filled in, which is the only thing the account buys here.
 *
 * Date and time are separate inputs rather than one datetime-local, because
 * the native combined control is poor on Android and unreadable on older
 * Safari — and this is the one form on the site that a customer fills in once,
 * carefully, and will not retry if it fights them.
 */

/** Studio hours, as half-hours. Offering 3am would be a form that lies. */
const TIMES = [
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30',
]

function label(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h! < 12 ? 'am' : 'pm'
  const hour = h! % 12 === 0 ? 12 : h! % 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

/** Tomorrow, as yyyy-mm-dd in the visitor's own timezone. */
function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CustomisationClient() {
  const { user } = useAuth()

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [date, setDate] = useState(tomorrow())
  const [time, setTime] = useState('11:00')
  const [notes, setNotes] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [booked, setBooked] = useState<{ reference: string; preferredAt: string } | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      /**
       * Built as a local time and sent as an instant. `new Date('2026-10-01T11:00')`
       * is read in the visitor's own timezone, so the moment they chose is the
       * moment the studio gets — not a string that means different things in
       * different places.
       */
      const preferredAt = new Date(`${date}T${time}`)
      if (Number.isNaN(preferredAt.getTime())) {
        setError('That date does not look right.')
        return
      }

      const result = await appointmentService.book({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        preferredAt: preferredAt.toISOString(),
        notes: notes.trim() || undefined,
      })
      setBooked({ reference: result.reference, preferredAt: result.preferredAt })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not go through. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (booked) {
    const when = new Date(booked.preferredAt).toLocaleString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    return (
      <div className="mx-auto max-w-lg text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-sage-100 text-sage-700">
          <Check className="size-6" strokeWidth={1.5} aria-hidden />
        </span>
        <h1 className="display mt-5 text-2xl">Thank you — we have your request</h1>
        <p className="mt-3 text-sm text-ink-soft">
          You asked to see us on <span className="text-ink">{when}</span>. Nothing is confirmed yet;
          we will write once we have checked the diary, usually within a day.
        </p>
        <p className="mt-4 text-sm text-ink-soft">
          Your reference is <span className="font-mono text-ink">{booked.reference}</span>. A copy
          is on its way to <span className="text-ink">{email}</span>.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-3xl">Customisation</h1>
      <p className="mt-3 max-w-prose text-sm text-ink-soft">
        Something made for you, or one of ours altered to fit the occasion. Tell us when suits and
        we will sit with you — in the studio or over a call — to work out the cloth, the cut and
        the timeline. There is no charge for the conversation.
      </p>

      <form onSubmit={submit} className="mt-10 grid gap-5 sm:grid-cols-2">
        {error && (
          <div className="sm:col-span-2">
            <Alert>{error}</Alert>
          </div>
        )}

        <Field label="Your name" htmlFor="c-name" required>
          <Input
            id="c-name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Phone" htmlFor="c-phone" required hint="So we can call to confirm.">
          <Input
            id="c-phone"
            required
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Email" htmlFor="c-email" required>
            <Input
              id="c-email"
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Preferred date" htmlFor="c-date" required>
          <Input
            id="c-date"
            required
            type="date"
            min={tomorrow()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <Field label="Preferred time" htmlFor="c-time" required>
          <select
            id="c-time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full border border-rule bg-white px-3 py-2.5 text-sm text-ink focus:border-ink focus:outline-none"
          >
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="What do you have in mind?"
            htmlFor="c-notes"
            hint="An occasion, a colour, a piece of ours you liked — anything helps."
          >
            <Textarea
              id="c-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" loading={busy} className="w-full sm:w-auto">
            Request a consultation
          </Button>
          <p className="mt-3 text-xs text-ink-soft">
            We will use your phone and email only to arrange this consultation.
          </p>
        </div>
      </form>
    </div>
  )
}
