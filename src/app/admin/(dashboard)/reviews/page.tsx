'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import {
  reviewAdminService,
  type AdminReview,
} from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { formatDate } from '@/lib/utils'
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Select,
  SkeletonRows,
  StatusBadge,
  Textarea,
} from '@/components/ui'

/**
 * Review moderation (M17).
 *
 * The queue defaults to what is waiting, because that is the only view that
 * needs acting on. Approving or rejecting recomputes the product's rating
 * server-side, so nothing here has to keep an average in step.
 */
export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [status, setStatus] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [rejecting, setRejecting] = useState<AdminReview | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [responding, setResponding] = useState<AdminReview | null>(null)
  const [response, setResponse] = useState('')
  const [deleting, setDeleting] = useState<AdminReview | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await reviewAdminService.list({ status: status || undefined })
      setReviews(result.reviews)
      setPendingCount(result.pendingCount)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reviews')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
      setRejecting(null)
      setResponding(null)
      setDeleting(null)
      setRejectionReason('')
      setResponse('')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That did not work')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Reviews</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {pendingCount > 0
              ? `${pendingCount} waiting to be read.`
              : 'Nothing is waiting to be read.'}
          </p>
        </div>

        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="w-48"
        >
          <option value="PENDING">Waiting</option>
          <option value="APPROVED">Published</option>
          <option value="REJECTED">Declined</option>
          <option value="FLAGGED">Flagged</option>
          <option value="">All</option>
        </Select>
      </header>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <SkeletonRows rows={4} />
      ) : reviews.length === 0 ? (
        <div className="border border-rule bg-white p-5">
          <EmptyState title="Nothing here" body="No reviews match that filter." />
        </div>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="border border-rule bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex" aria-label={`${review.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`size-3.5 ${star <= review.rating ? 'fill-sage-600 text-sage-600' : 'text-rule'}`}
                          strokeWidth={1.2}
                          aria-hidden
                        />
                      ))}
                    </span>
                    <StatusBadge status={review.status} />
                    {review.isVerifiedPurchase && (
                      <span className="badge badge-success">Verified purchase</span>
                    )}
                  </div>

                  <p className="mt-2 text-sm">
                    <Link href={`/admin/products/${review.product.id}`} className="link-underline">
                      {review.product.name}
                    </Link>
                    <span className="ml-2 text-xs text-ink-soft">
                      {review.user.name} · {formatDate(review.createdAt)}
                    </span>
                  </p>
                </div>
              </div>

              {review.title && <p className="display mt-3 text-lg">{review.title}</p>}
              {review.body && (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                  {review.body}
                </p>
              )}

              {review.rejectionReason && (
                <p className="mt-3 text-sm text-danger">Declined: {review.rejectionReason}</p>
              )}

              {review.adminResponse && (
                <div className="mt-3 border-l-2 border-sage-300 bg-sage-50 p-3 text-sm">
                  <p className="label-caps mb-1 text-sage-800">Your reply</p>
                  <p className="text-ink-soft">{review.adminResponse}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {review.status !== 'APPROVED' && (
                  <Button
                    size="sm"
                    loading={busy}
                    onClick={() =>
                      void run(() => reviewAdminService.setStatus(review.id, { status: 'APPROVED' }))
                    }
                  >
                    Publish
                  </Button>
                )}
                {review.status !== 'REJECTED' && (
                  <Button size="sm" variant="outline" onClick={() => setRejecting(review)}>
                    Decline
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setResponding(review)
                    setResponse(review.adminResponse ?? '')
                  }}
                >
                  {review.adminResponse ? 'Edit reply' : 'Reply'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(review)}>
                  Delete
                </Button>
              </div>

              {responding?.id === review.id && (
                <div className="mt-4 border-t border-hairline pt-4">
                  <Field label="Public reply" htmlFor={`reply-${review.id}`}>
                    <Textarea
                      id={`reply-${review.id}`}
                      rows={3}
                      maxLength={2000}
                      value={response}
                      onChange={(event) => setResponse(event.target.value)}
                    />
                  </Field>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      loading={busy}
                      disabled={!response.trim()}
                      onClick={() => void run(() => reviewAdminService.respond(review.id, response))}
                    >
                      Save reply
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setResponding(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={rejecting !== null}
        title="Decline this review?"
        body={
          <div className="mt-3">
            <Field label="Reason" htmlFor="reject-reason" required hint="Recorded, and shown to the reviewer.">
              <Textarea
                id="reject-reason"
                rows={3}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
              />
            </Field>
          </div>
        }
        confirmLabel="Decline"
        loading={busy}
        onConfirm={() => {
          if (!rejecting || !rejectionReason.trim()) return
          void run(() =>
            reviewAdminService.setStatus(rejecting.id, {
              status: 'REJECTED',
              rejectionReason,
            }),
          )
        }}
        onCancel={() => {
          setRejecting(null)
          setRejectionReason('')
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this review?"
        body="It will be removed permanently and the product's rating recalculated."
        confirmLabel="Delete"
        loading={busy}
        onConfirm={() => {
          if (!deleting) return
          void run(() => reviewAdminService.remove(deleting.id))
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
