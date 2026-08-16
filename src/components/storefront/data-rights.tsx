'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { privacyService, type ErasureEligibility } from '@/services/storefront.service'
import { ApiRequestError } from '@/services/api-client'
import { Alert, Button, Field, Input } from '@/components/ui'

/**
 * A customer's own data rights: get a copy, or have it removed.
 *
 * Both are legal entitlements under the DPDP Act, not features, so they are
 * offered plainly rather than buried — a deletion control that takes six clicks
 * to find is the kind of thing that gets a store written about.
 *
 * The wording is deliberate about what deletion does not do. Order records stay,
 * without the personal details on them, because keeping sales records is a
 * separate legal obligation that this one does not override. Saying so before
 * the button is pressed avoids the complaint that follows finding out after.
 */
export function DataRights() {
  const [eligibility, setEligibility] = useState<ErasureEligibility | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [erasing, setErasing] = useState(false)
  const [eraseError, setEraseError] = useState<string | null>(null)

  const check = useCallback(async () => {
    try {
      setEligibility(await privacyService.eligibility())
    } catch {
      // Advisory only — the server checks again before erasing anything.
      setEligibility(null)
    }
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  /**
   * Downloads the export as a file.
   *
   * Built in the browser from the JSON response rather than linked directly to
   * the endpoint: a plain `<a href>` would be an unauthenticated navigation,
   * and this data is exactly what should not be fetchable without the session.
   */
  async function downloadExport() {
    setExporting(true)
    setExportError(null)
    try {
      const data = await privacyService.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = 'my-data.json'
      link.click()

      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof ApiRequestError ? err.message : 'Could not prepare your data')
    } finally {
      setExporting(false)
    }
  }

  async function erase() {
    setErasing(true)
    setEraseError(null)
    try {
      await privacyService.erase(password, reason.trim() || undefined)
      // The session is already dead server-side. A full reload clears the
      // client's cached user rather than leaving a signed-in shell behind.
      window.location.href = '/'
    } catch (err) {
      setEraseError(
        err instanceof ApiRequestError ? err.message : 'Your account could not be closed',
      )
      setErasing(false)
    }
  }

  return (
    <section className="border border-rule bg-white p-6">
      <h2 className="display mb-1 text-lg">Your data</h2>
      <p className="mb-5 text-sm text-ink-soft">
        You can take a copy of everything we hold, or ask us to remove it.
      </p>

      <div className="border-b border-hairline pb-5">
        {exportError && <Alert>{exportError}</Alert>}
        <Button variant="ghost" onClick={() => void downloadExport()} loading={exporting}>
          <Download className="mr-1.5 size-4" strokeWidth={1.5} />
          Download my data
        </Button>
        <p className="mt-2 text-xs text-ink-soft">
          A JSON file with your profile, addresses, orders, reviews and preferences.
        </p>
      </div>

      <div className="pt-5">
        <h3 className="mb-1 text-sm font-medium">Close my account</h3>
        <p className="text-sm text-ink-soft">
          Your name, email, phone, saved addresses and reviews are removed permanently. Your past
          orders are kept with those details stripped out — we are required to keep sales records.
          This cannot be undone.
        </p>

        {eligibility && !eligibility.canErase ? (
          <div className="mt-4 text-sm">
            <p className="text-ink-soft">Not just yet:</p>
            <ul className="mt-1.5 space-y-1">
              {eligibility.blockers.map((blocker) => (
                <li key={blocker.reason} className="text-ink-soft">
                  — {blocker.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : !open ? (
          <Button variant="ghost" className="mt-4" onClick={() => setOpen(true)}>
            Close my account
          </Button>
        ) : (
          <div className="mt-4 space-y-3">
            {eraseError && <Alert>{eraseError}</Alert>}

            <Field label="Confirm your password">
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </Field>

            <Field label="Anything you would like us to know? (optional)">
              <Input value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>

            <div className="flex gap-2">
              <Button
                variant="danger"
                disabled={!password || erasing}
                loading={erasing}
                onClick={() => void erase()}
              >
                Close my account permanently
              </Button>
              <Button
                variant="ghost"
                disabled={erasing}
                onClick={() => {
                  setOpen(false)
                  setPassword('')
                  setReason('')
                }}
              >
                Keep my account
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
