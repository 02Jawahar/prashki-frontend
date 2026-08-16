'use client'

import { useEffect, useState } from 'react'
import { Star, ThumbsUp } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import {
  reviewService,
  type Review,
  type ReviewSummary,
} from '@/services/storefront.service'
import { ApiRequestError } from '@/services/api-client'
import { formatDate } from '@/lib/utils'
import { Alert, Button, Field, Input, Select, SkeletonRows, Textarea } from '@/components/ui'

/**
 * Reviews on a product page.
 *
 * Only approved reviews are public — the API will not return anything else —
 * so what renders here is what moderation has passed. The author sees their own
 * pending review through a separate call, which is what keeps "I submitted
 * this" from feeling like it vanished.
 */
export function ProductReviews({ productId }: { productId: string }) {
  const { user } = useAuth()

  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [mine, setMine] = useState<Awaited<ReturnType<typeof reviewService.mine>>>(null)
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)
  const [writing, setWriting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void reviewService
      .forProduct(productId, { sort })
      .then((result) => {
        if (cancelled) return
        setReviews(result.reviews)
        setSummary(result.summary)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [productId, sort])

  useEffect(() => {
    if (!user) {
      setMine(null)
      return
    }
    void reviewService.mine(productId).then(setMine).catch(() => undefined)
  }, [productId, user])

  async function markHelpful(id: string) {
    try {
      const updated = await reviewService.markHelpful(id)
      setReviews((current) =>
        current.map((review) =>
          review.id === id ? { ...review, helpfulCount: updated.helpfulCount } : review,
        ),
      )
    } catch {
      // A vote that does not land is not worth interrupting the page for.
    }
  }

  return (
    <section className="border-t border-hairline pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display text-2xl">Reviews</h2>
          {summary && summary.count > 0 && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Stars value={summary.average} />
              <span>{summary.average.toFixed(1)}</span>
              <span className="text-ink-soft">
                · {summary.count} {summary.count === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          )}
        </div>

        {reviews.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="label-caps text-ink-soft">Sort</span>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort reviews"
              className="w-auto"
            >
              <option value="newest">Most recent</option>
              <option value="helpful">Most helpful</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
            </Select>
          </label>
        )}
      </header>

      {summary && summary.count > 0 && (
        <ul className="mt-6 max-w-sm space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.breakdown[String(star)] ?? 0
            const share = summary.count > 0 ? (count / summary.count) * 100 : 0
            return (
              <li key={star} className="flex items-center gap-3 text-xs">
                <span className="w-8 text-ink-soft">{star}★</span>
                <span className="h-1.5 flex-1 bg-sage-100">
                  <span className="block h-full bg-sage-600" style={{ width: `${share}%` }} />
                </span>
                <span className="w-8 text-right text-ink-soft">{count}</span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-8">
        {!user ? (
          <p className="text-sm text-ink-soft">
            <a href="/login" className="link-underline text-ink">
              Sign in
            </a>{' '}
            to leave a review.
          </p>
        ) : mine && !writing ? (
          <div className="border border-rule p-5 text-sm">
            <p className="flex items-center gap-2">
              <Stars value={mine.rating} />
              <span className="text-ink-soft">
                {mine.status === 'APPROVED'
                  ? 'Your review is published'
                  : mine.status === 'REJECTED'
                    ? 'Your review was not published'
                    : 'Your review is waiting to be read'}
              </span>
            </p>
            {mine.status === 'REJECTED' && mine.rejectionReason && (
              <p className="mt-2 text-danger">{mine.rejectionReason}</p>
            )}
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setWriting(true)}>
              Edit your review
            </Button>
          </div>
        ) : writing ? (
          <ReviewForm
            productId={productId}
            initial={mine}
            onDone={(status) => {
              setWriting(false)
              void reviewService.mine(productId).then(setMine).catch(() => undefined)
              // An edit removes an approved review from the public list until
              // it is read again, so refresh rather than patch optimistically.
              if (status) {
                void reviewService
                  .forProduct(productId, { sort })
                  .then((result) => {
                    setReviews(result.reviews)
                    setSummary(result.summary)
                  })
                  .catch(() => undefined)
              }
            }}
            onCancel={() => setWriting(false)}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setWriting(true)}>
            Write a review
          </Button>
        )}
      </div>

      <div className="mt-10">
        {loading ? (
          <SkeletonRows rows={3} />
        ) : reviews.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No reviews yet. If you have worn this, we would love to hear about it.
          </p>
        ) : (
          <ul className="space-y-8">
            {reviews.map((review) => (
              <li key={review.id} className="border-b border-hairline pb-8 last:border-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Stars value={review.rating} />
                  <span className="text-sm">{review.user.name}</span>
                  {review.isVerifiedPurchase && (
                    <span className="badge badge-success">Verified purchase</span>
                  )}
                  <span className="text-xs text-ink-soft">{formatDate(review.createdAt)}</span>
                </div>

                {review.title && <p className="display mt-3 text-lg">{review.title}</p>}
                {review.body && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                    {review.body}
                  </p>
                )}

                {review.adminResponse && (
                  <div className="mt-4 border-l-2 border-sage-300 bg-sage-50 p-4 text-sm">
                    <p className="label-caps mb-1 text-sage-800">From the studio</p>
                    <p className="text-ink-soft">{review.adminResponse}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void markHelpful(review.id)}
                  className="mt-4 flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink"
                >
                  <ThumbsUp className="size-3.5" strokeWidth={1.5} aria-hidden />
                  Helpful{review.helpfulCount > 0 ? ` (${review.helpfulCount})` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`size-3.5 ${star <= Math.round(value) ? 'fill-sage-600 text-sage-600' : 'text-rule'}`}
          strokeWidth={1.2}
          aria-hidden
        />
      ))}
    </span>
  )
}

function ReviewForm({
  productId,
  initial,
  onDone,
  onCancel,
}: {
  productId: string
  initial: Awaited<ReturnType<typeof reviewService.mine>>
  onDone: (submitted: boolean) => void
  onCancel: () => void
}) {
  const [rating, setRating] = useState(initial?.rating ?? 5)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const result = await reviewService.submit({
        productId,
        rating,
        title: title || undefined,
        body: body || undefined,
      })
      setMessage(result.message)
      onDone(true)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save your review')
      setSubmitting(false)
    }
  }

  if (message) return <Alert tone="success">{message}</Alert>

  return (
    <form onSubmit={submit} className="space-y-4 border border-rule p-5" noValidate>
      {error && <Alert>{error}</Alert>}

      <Field label="Your rating" htmlFor="rating" required>
        <div className="flex gap-1" id="rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              aria-pressed={rating === star}
              className="p-1"
            >
              <Star
                className={`size-5 ${star <= rating ? 'fill-sage-600 text-sage-600' : 'text-rule'}`}
                strokeWidth={1.2}
              />
            </button>
          ))}
        </div>
      </Field>

      <Field label="Headline" htmlFor="title" hint="Optional.">
        <Input
          id="title"
          maxLength={140}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field label="Your review" htmlFor="body" hint="How does it fit? How does it wear?">
        <Textarea
          id="body"
          rows={4}
          maxLength={4000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </Field>

      <p className="text-xs text-ink-soft">
        Reviews are read by a person before they appear, so there may be a short wait.
      </p>

      <div className="flex gap-3">
        <Button type="submit" size="sm" loading={submitting}>
          {initial ? 'Update review' : 'Submit review'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
