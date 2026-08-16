'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import {
  webhookEventService,
  type RetryOutcome,
  type WebhookEventRecord,
} from '@/services/admin-modules.service'
import { formatDateTime } from '@/lib/utils'
import { Alert, Button, EmptyState, Input, Select, SkeletonRows, StatusBadge } from '@/components/ui'
import type { Pagination } from '@/types/api'

/**
 * The provider-callback failure queue (FR-04: "permanent failures enter a
 * visible operational queue").
 *
 * This page exists because of one specific failure: a payment that Razorpay
 * captured and we did not record. The customer has been charged, their order
 * says unpaid, and until someone looks at a row in a table nobody knows. The
 * queue is how "someone looks" happens without it being an accident.
 *
 * Defaults to the stuck items rather than everything — a list dominated by
 * thousands of successful callbacks is one nobody scans.
 */
const STATUSES = ['FAILED', 'RECEIVED', 'PROCESSED', 'SKIPPED'] as const

export default function AdminWebhookEventsPage() {
  const [events, setEvents] = useState<WebhookEventRecord[]>([])
  const [stuckCount, setStuckCount] = useState(0)
  const [pagination, setPagination] = useState<Pagination | null>(null)

  const [status, setStatus] = useState<string>('FAILED')
  const [provider, setProvider] = useState('')
  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<{ id: string; result: RetryOutcome } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await webhookEventService.list({
        status: status || undefined,
        provider: provider || undefined,
        page,
      })
      setEvents(result.events)
      setStuckCount(result.stuckCount)
      setPagination(result.pagination)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the callback queue')
    } finally {
      setLoading(false)
    }
  }, [status, provider, page])

  useEffect(() => {
    const timer = setTimeout(() => void load(), provider ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, provider])

  async function retry(id: string) {
    setRetrying(id)
    setOutcome(null)
    try {
      const result = await webhookEventService.retry(id)
      setOutcome({ id, result })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The retry could not be started')
    } finally {
      setRetrying(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="display text-2xl">Provider callbacks</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Payment and carrier callbacks we received. Anything that did not process is here, and can
          be run again.
        </p>
      </header>

      {error && <Alert>{error}</Alert>}

      {stuckCount > 0 && (
        <div className="mb-5 flex items-start gap-3 border border-amber-300 bg-amber-50 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" strokeWidth={1.5} />
          <div>
            <p className="font-medium text-amber-900">
              {stuckCount} callback{stuckCount === 1 ? '' : 's'} did not process
            </p>
            <p className="mt-0.5 text-amber-800">
              A payment callback that failed means an order may be paid at the gateway and unpaid
              here. Check the order before retrying.
            </p>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
          className="sm:w-56"
        >
          <option value="">All statuses</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.toLowerCase()}
            </option>
          ))}
        </Select>

        <Input
          value={provider}
          onChange={(event) => {
            setProvider(event.target.value)
            setPage(1)
          }}
          placeholder="Provider"
          aria-label="Filter by provider"
          className="sm:max-w-xs"
        />
      </div>

      <div className="border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={8} />
          </div>
        ) : events.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={status === 'FAILED' ? 'Nothing stuck' : 'Nothing recorded'}
              body={
                status === 'FAILED'
                  ? 'Every callback we have received processed successfully.'
                  : 'No callbacks match those filters.'
              }
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-soft">
                <th className="p-3 font-normal">Received</th>
                <th className="p-3 font-normal">Provider</th>
                <th className="p-3 font-normal">Event</th>
                <th className="p-3 font-normal">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-hairline align-top last:border-0">
                  <td className="whitespace-nowrap p-3 text-xs text-ink-soft">
                    {formatDateTime(event.receivedAt)}
                    {event.processedAt && (
                      <p className="mt-0.5 text-[0.65rem]">
                        tried {formatDateTime(event.processedAt)}
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-xs">{event.provider}</td>
                  <td className="p-3">
                    <p className="text-xs">{event.eventType}</p>
                    <p className="font-mono text-[0.65rem] text-ink-soft">{event.eventId}</p>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={event.status} />
                    {event.error && (
                      <p className="mt-1 max-w-xs text-[0.7rem] leading-snug text-ink-soft">
                        {event.error}
                      </p>
                    )}
                    {outcome?.id === event.id && (
                      <p
                        className={`mt-1 text-[0.7rem] ${
                          outcome.result.status === 'PROCESSED' ? 'text-sage-700' : 'text-red-700'
                        }`}
                      >
                        Retry: {outcome.result.status.toLowerCase()}
                        {outcome.result.error ? ` — ${outcome.result.error}` : ''}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {event.status !== 'PROCESSED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={retrying === event.id}
                        onClick={() => void retry(event.id)}
                      >
                        <RefreshCw
                          className={`mr-1.5 size-3.5 ${retrying === event.id ? 'animate-spin' : ''}`}
                          strokeWidth={1.5}
                        />
                        {retrying === event.id ? 'Running' : 'Retry'}
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === event.id ? null : event.id)}
                      className="ml-3 text-xs text-sage-700 underline"
                    >
                      {expanded === event.id ? 'Hide' : 'Payload'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {expanded && (
          <div className="border-t border-rule bg-shell p-4">
            <pre className="overflow-x-auto text-[0.7rem] leading-relaxed text-ink-soft">
              {JSON.stringify(events.find((e) => e.id === expanded)?.payload, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {pagination && pagination.pageCount > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-ink-soft">
            Page {pagination.page} of {pagination.pageCount} · {pagination.total} callbacks
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= pagination.pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
