'use client'

import { useState } from 'react'
import { MapPin, Check, X } from 'lucide-react'
import { shippingService, type ServiceabilityAnswer } from '@/services/storefront.service'
import { ApiRequestError } from '@/services/api-client'
import { Button, Input } from '@/components/ui'

/**
 * "Do you deliver to my PIN?" (FR-21.1).
 *
 * Standard on Indian storefronts, and worth answering before the bag rather
 * than at checkout — a customer who finds out at the last step that we cannot
 * reach them has wasted the whole journey.
 *
 * The answer comes entirely from the server: zone rules first, then the
 * carrier's own serviceability when the adapter has an opinion.
 */
export function PinChecker() {
  const [pin, setPin] = useState('')
  const [answer, setAnswer] = useState<ServiceabilityAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function check(event: React.FormEvent) {
    event.preventDefault()
    if (checking || pin.trim().length < 3) return

    setChecking(true)
    setError(null)
    setAnswer(null)

    try {
      setAnswer(await shippingService.serviceability(pin.trim()))
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Could not check that PIN code just now.',
      )
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="mt-6 border-t border-hairline pt-6">
      <form onSubmit={check} className="space-y-2" noValidate>
        <label htmlFor="pin" className="label-caps flex items-center gap-1.5 text-ink-soft">
          <MapPin className="size-3.5" strokeWidth={1.5} aria-hidden />
          Check delivery
        </label>

        <div className="flex gap-2">
          <Input
            id="pin"
            inputMode="numeric"
            maxLength={10}
            placeholder="PIN code"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value)
              setAnswer(null)
              setError(null)
            }}
          />
          <Button
            type="submit"
            variant="outline"
            loading={checking}
            disabled={pin.trim().length < 3}
          >
            Check
          </Button>
        </div>
      </form>

      {error && (
        <p className="mt-2 text-xs text-ink-soft" role="status">
          {error}
        </p>
      )}

      {answer && (
        <div className="mt-3 flex items-start gap-2 text-sm" role="status">
          {answer.serviceable ? (
            <>
              <Check className="mt-0.5 size-4 shrink-0 text-sage-700" strokeWidth={2} aria-hidden />
              <span>
                We deliver to {pin}
                {answer.estimate && (
                  <span className="mt-0.5 block text-xs text-ink-soft">
                    {answer.estimate.minDays === answer.estimate.maxDays
                      ? `About ${answer.estimate.minDays} business day${answer.estimate.minDays === 1 ? '' : 's'}`
                      : `${answer.estimate.minDays}–${answer.estimate.maxDays} business days`}
                    {answer.codAvailable ? ' · cash on delivery available' : ' · prepaid only'}
                  </span>
                )}
              </span>
            </>
          ) : (
            <>
              <X className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={2} aria-hidden />
              <span className="text-ink-soft">
                {answer.reason ?? 'We are not able to deliver to that PIN code yet.'}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
