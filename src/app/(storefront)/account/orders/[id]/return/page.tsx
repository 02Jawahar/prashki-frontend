'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import {
  RETURN_REASONS,
  returnService,
  type ReturnableLine,
} from '@/services/storefront.service'
import { ApiRequestError } from '@/services/api-client'
import { formatPrice } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { Alert, Button, Field, Select, SkeletonRows, Textarea } from '@/components/ui'

/**
 * Start a return.
 *
 * Quantities are capped by what the API says is still returnable, so a second
 * request cannot claim items already covered by a first. The refund figure
 * shown is the server's own calculation — price minus the share of any discount
 * that line absorbed — rather than a guess made here.
 */
export default function StartReturnPage() {
  const router = useRouter()
  const { id: orderId } = useParams<{ id: string }>()

  const [lines, setLines] = useState<ReturnableLine[]>([])
  const [orderNumber, setOrderNumber] = useState('')
  const [eligible, setEligible] = useState(false)
  const [ineligibleReason, setIneligibleReason] = useState<string | null>(null)
  const [windowClosesAt, setWindowClosesAt] = useState<string | null>(null)

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<string>(RETURN_REASONS[0].value)
  const [comment, setComment] = useState('')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void returnService
      .eligibility(orderId)
      .then((result) => {
        setLines(result.lines)
        setOrderNumber(result.order.orderNumber)
        setEligible(result.eligible)
        setIneligibleReason(result.reason)
        setWindowClosesAt(result.windowClosesAt)
      })
      .catch((err) =>
        setError(err instanceof ApiRequestError ? err.message : 'Could not load that order'),
      )
      .finally(() => setLoading(false))
  }, [orderId])

  const chosen = Object.entries(quantities).filter(([, quantity]) => quantity > 0)

  const estimate = chosen.reduce((sum, [orderItemId, quantity]) => {
    const line = lines.find((l) => l.orderItemId === orderItemId)
    return sum + (line ? line.unitValue * quantity : 0)
  }, 0)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting || chosen.length === 0) return

    setSubmitting(true)
    setError(null)

    try {
      const { request } = await returnService.create({
        orderId,
        reason,
        comment: comment || undefined,
        items: chosen.map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
      })
      router.push(`/account/returns/${request.id}`)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not start that return')
      setSubmitting(false)
    }
  }

  if (loading) return <SkeletonRows rows={4} />

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/account/orders/${orderId}`}
        className="label-caps mb-5 inline-flex items-center gap-1 text-ink-soft hover:text-ink"
      >
        <ChevronLeft className="size-3.5" strokeWidth={1.6} />
        Order {orderNumber}
      </Link>

      <h2 className="display text-2xl">Start a return</h2>

      {windowClosesAt && eligible && (
        <p className="mt-2 text-sm text-ink-soft">
          Returns for this order are open until {formatDate(windowClosesAt)}.
        </p>
      )}

      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}

      {!eligible ? (
        <div className="mt-6">
          <Alert tone="info">{ineligibleReason ?? 'This order cannot be returned.'}</Alert>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-8" noValidate>
          <section>
            <h3 className="label-caps mb-4">What are you sending back?</h3>

            <ul className="border-t border-hairline">
              {lines.map((line) => {
                const disabled = line.returnable === 0
                return (
                  <li key={line.orderItemId} className="flex gap-4 border-b border-hairline py-4">
                    <div className="relative aspect-2/3 w-16 shrink-0 overflow-hidden bg-sage-50">
                      {line.imageUrl && (
                        <Image src={line.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                      )}
                    </div>

                    <div className="flex flex-1 flex-wrap items-start justify-between gap-3">
                      <div className="text-sm">
                        <p className="display leading-tight">{line.productName}</p>
                        {line.variantName && line.variantName !== 'Default' && (
                          <p className="mt-0.5 text-xs text-ink-soft">Size {line.variantName}</p>
                        )}
                        <p className="mt-1 text-xs text-ink-soft">
                          {formatPrice(line.unitValue)} each
                          {line.claimed > 0 && ` · ${line.claimed} already in a return`}
                        </p>
                        {disabled && (
                          <p className="mt-1 text-xs text-ink-soft">
                            Nothing left to return on this line.
                          </p>
                        )}
                      </div>

                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-ink-soft">Qty</span>
                        <Select
                          aria-label={`Quantity of ${line.productName} to return`}
                          disabled={disabled}
                          value={quantities[line.orderItemId] ?? 0}
                          onChange={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [line.orderItemId]: Number(event.target.value),
                            }))
                          }
                          className="w-20"
                        >
                          {Array.from({ length: line.returnable + 1 }, (_, n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </Select>
                      </label>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="space-y-4">
            <Field label="Why are you returning it?" htmlFor="reason" required>
              <Select id="reason" value={reason} onChange={(event) => setReason(event.target.value)}>
                {RETURN_REASONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Anything else we should know?"
              htmlFor="comment"
              hint="Optional, but it helps us put it right."
            >
              <Textarea
                id="comment"
                rows={3}
                maxLength={1000}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </Field>
          </section>

          <div className="border border-rule p-5">
            <div className="flex justify-between text-sm">
              <span className="label-caps">Estimated refund</span>
              <span>{formatPrice(estimate)}</span>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              This is what you paid for the selected items after any discount. Delivery charges are
              not included. We confirm the final amount once the items reach us.
            </p>
          </div>

          <Button type="submit" loading={submitting} disabled={chosen.length === 0}>
            {submitting ? 'Sending' : 'Request return'}
          </Button>
        </form>
      )}
    </div>
  )
}
