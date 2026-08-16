'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { erasureService, type ErasureBlocker } from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { Alert, Button, Field, Input } from '@/components/ui'

/**
 * Erasing a customer's personal data on their request (DPDP right to erasure).
 *
 * Three deliberate frictions, because this is the only action in the admin
 * with no undo:
 *
 *   - Eligibility is checked and shown before the button is offered, so an
 *     erasure is never attempted on an account with a parcel in transit.
 *   - A reason is required. Erasures get audited, and "who asked for this"
 *     is the question that gets asked six months later.
 *   - The customer's email has to be typed back. A misclick on the wrong row
 *     is the realistic way this goes wrong, and only this catches it.
 */
export function ErasurePanel({
  customerId,
  customerEmail,
  customerStatus,
  onErased,
}: {
  customerId: string
  customerEmail: string | null
  customerStatus: string
  onErased: () => void
}) {
  const [blockers, setBlockers] = useState<ErasureBlocker[]>([])
  const [canErase, setCanErase] = useState(false)
  const [checking, setChecking] = useState(true)

  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ ordersRedacted: number } | null>(null)

  const alreadyErased = customerStatus === 'ANONYMISED'

  const check = useCallback(async () => {
    if (alreadyErased) {
      setChecking(false)
      return
    }

    try {
      const result = await erasureService.check(customerId)
      setCanErase(result.canErase)
      setBlockers(result.blockers)
    } catch {
      // Eligibility is advisory — the server checks again before doing
      // anything, so a failure here should not present a broken panel.
      setCanErase(false)
    } finally {
      setChecking(false)
    }
  }, [customerId, alreadyErased])

  useEffect(() => {
    void check()
  }, [check])

  async function erase() {
    setBusy(true)
    setError(null)
    try {
      const result = await erasureService.erase(customerId, reason.trim())
      setDone({ ordersRedacted: result.ordersRedacted })
      setOpen(false)
      onErased()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'The erasure did not complete')
    } finally {
      setBusy(false)
    }
  }

  if (alreadyErased) {
    return (
      <section className="border border-rule bg-white p-5">
        <h2 className="label-caps mb-3">Personal data</h2>
        <p className="text-sm text-ink-soft">
          This account has been erased. The order history is kept without the personal details, as
          the tax rules require.
        </p>
      </section>
    )
  }

  const emailMatches = confirmEmail.trim().toLowerCase() === (customerEmail ?? '').toLowerCase()

  return (
    <section className="border border-rule bg-white p-5">
      <h2 className="label-caps mb-3">Personal data</h2>

      {done ? (
        <Alert tone="success">
          Erased. {done.ordersRedacted} order{done.ordersRedacted === 1 ? '' : 's'} kept with the
          personal details removed.
        </Alert>
      ) : checking ? (
        <p className="text-sm text-ink-soft">Checking…</p>
      ) : !canErase ? (
        <div className="text-sm">
          <p className="text-ink-soft">This account cannot be erased yet:</p>
          <ul className="mt-2 space-y-1">
            {blockers.map((blocker) => (
              <li key={blocker.reason} className="text-ink-soft">
                — {blocker.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : !open ? (
        <>
          <p className="text-sm text-ink-soft">
            Removes the name, email, phone, addresses and reviews. Orders stay, with the personal
            details stripped out. This cannot be undone.
          </p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setOpen(true)}>
            <ShieldOff className="mr-1.5 size-3.5" strokeWidth={1.5} />
            Erase personal data
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          {error && <Alert>{error}</Alert>}

          <Field label="Why is this being erased?">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Customer requested erasure by email, 16 Aug"
            />
          </Field>

          <Field label={`Type ${customerEmail ?? 'the email address'} to confirm`}>
            <Input
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              autoComplete="off"
            />
          </Field>

          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={busy || !reason.trim() || !emailMatches}
              onClick={() => void erase()}
            >
              {busy ? 'Erasing…' : 'Erase permanently'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setReason('')
                setConfirmEmail('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
