'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { auditService, type AuditEntry } from '@/services/admin-modules.service'
import { formatDateTime } from '@/lib/utils'
import { Alert, Button, EmptyState, Input, Select, SkeletonRows } from '@/components/ui'
import type { Pagination } from '@/types/api'

/**
 * The audit trail (FR-10.6, FR-24.6).
 *
 * Read-only by design — there is no endpoint that edits or deletes an entry,
 * which is what "immutable" has to mean in practice. The PRD's acceptance
 * criterion is that a critical change can be traced to actor, time and
 * affected record, so those three are what the table leads with.
 */
export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)

  const [action, setAction] = useState('')
  const [entityId, setEntityId] = useState('')
  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await auditService.list({
        action: action || undefined,
        entityId: entityId || undefined,
        page,
      })
      setEntries(result.entries)
      // The action list comes from the unfiltered set, so choosing one does
      // not empty the dropdown that chose it.
      if (result.actions.length > 0) setActions(result.actions)
      setPagination(result.pagination)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the audit log')
    } finally {
      setLoading(false)
    }
  }, [action, entityId, page])

  useEffect(() => {
    const timer = setTimeout(() => void load(), entityId ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, entityId])

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="display text-2xl">Audit log</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every material change, with who made it and when. Entries cannot be edited or removed.
        </p>
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="mb-5 flex flex-wrap gap-3">
        <Select
          value={action}
          onChange={(event) => {
            setAction(event.target.value)
            setPage(1)
          }}
          aria-label="Filter by action"
          className="sm:w-64"
        >
          <option value="">All actions</option>
          {actions.map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </Select>

        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
            strokeWidth={1.5}
          />
          <Input
            value={entityId}
            onChange={(event) => {
              setEntityId(event.target.value)
              setPage(1)
            }}
            placeholder="Record id"
            aria-label="Filter by record id"
            className="pl-9"
          />
        </div>
      </div>

      <div className="border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={8} />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Nothing recorded" body="No entries match those filters." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-soft">
                <th className="p-3 font-normal">When</th>
                <th className="p-3 font-normal">Who</th>
                <th className="p-3 font-normal">Action</th>
                <th className="p-3 font-normal">Record</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-hairline align-top last:border-0">
                  <td className="whitespace-nowrap p-3 text-xs text-ink-soft">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="p-3">
                    {entry.actor ? (
                      <>
                        <p>{entry.actor.name}</p>
                        <p className="text-xs text-ink-soft">{entry.actor.email}</p>
                      </>
                    ) : (
                      <span className="text-xs text-ink-soft">System</span>
                    )}
                    {entry.ip && <p className="mt-0.5 text-[0.65rem] text-ink-soft">{entry.ip}</p>}
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-[0.7rem]">{entry.action}</span>
                  </td>
                  <td className="p-3">
                    <p className="text-xs">{entry.entityType}</p>
                    <p className="font-mono text-[0.65rem] text-ink-soft">{entry.entityId}</p>
                  </td>
                  <td className="p-3 text-right">
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                        className="text-xs text-sage-700 underline"
                      >
                        {expanded === entry.id ? 'Hide' : 'Details'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {expanded && (
          <div className="border-t border-rule bg-shell p-4">
            <pre className="overflow-x-auto text-[0.7rem] leading-relaxed text-ink-soft">
              {JSON.stringify(entries.find((e) => e.id === expanded)?.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {pagination && pagination.pageCount > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-ink-soft">
            Page {pagination.page} of {pagination.pageCount} · {pagination.total} entries
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
