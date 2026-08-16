'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, Pin } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { adminService } from '@/services/admin.service'
import { customerNoteService, type CustomerNote } from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { formatPrice } from '@/lib/money'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  Alert,
  Button,
  ConfirmDialog,
  Field,
  SkeletonRows,
  StatusBadge,
  Textarea,
} from '@/components/ui'

interface CustomerDetail {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  emailVerified: boolean
  createdAt: string
  lastLoginAt: string | null
  totalSpend: number
  addresses: Array<{
    id: string
    label: string | null
    name: string
    phone: string
    addressLine1: string
    addressLine2: string | null
    city: string
    state: string
    postalCode: string
    isDefault: boolean
  }>
  orders: Array<{ id: string; orderNumber: string; status: string; total: number; createdAt: string }>
  internalNotes: CustomerNote[]
}

/**
 * One customer (M10).
 *
 * Contact details arrive masked unless the signed-in admin holds
 * customer.read_pii — that decision is made server-side, so this page simply
 * renders whatever it was given.
 */
export default function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { can } = useAuth()

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [noteBody, setNoteBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<CustomerNote | null>(null)

  const load = useCallback(async () => {
    try {
      setCustomer((await adminService.customer(id)) as CustomerDetail)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load that customer')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function addNote() {
    if (!noteBody.trim()) return

    setBusy(true)
    try {
      await customerNoteService.create(id, { body: noteBody.trim() })
      setNoteBody('')
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save that note')
    } finally {
      setBusy(false)
    }
  }

  async function togglePin(note: CustomerNote) {
    setBusy(true)
    try {
      await customerNoteService.update(id, note.id, { isPinned: !note.isPinned })
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update that note')
    } finally {
      setBusy(false)
    }
  }

  async function removeNote() {
    if (!deleting) return

    setBusy(true)
    try {
      await customerNoteService.remove(id, deleting.id)
      setDeleting(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not delete that note')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <SkeletonRows rows={6} />
  if (!customer) return <Alert>{error ?? 'That customer could not be found.'}</Alert>

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/customers"
        className="label-caps mb-4 inline-flex items-center gap-1 text-ink-soft hover:text-ink"
      >
        <ChevronLeft className="size-3.5" strokeWidth={1.6} />
        Customers
      </Link>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display text-2xl">{customer.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {customer.email}
            {customer.phone ? ` · ${customer.phone}` : ''} · joined {formatDate(customer.createdAt)}
          </p>
        </div>
        <StatusBadge status={customer.status} />
      </header>

      {error && <Alert>{error}</Alert>}

      {!can('customer.read_pii') && (
        <Alert tone="info">
          Contact details are masked. Ask for the “see unmasked contact details” permission if you
          need the full address or phone number.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="border border-rule bg-white">
            <h2 className="label-caps border-b border-rule px-5 py-3.5">Orders</h2>
            {customer.orders.length === 0 ? (
              <p className="p-5 text-sm text-ink-soft">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {customer.orders.map((order) => (
                  <li key={order.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                    <div>
                      <Link href={`/admin/orders/${order.id}`} className="link-underline">
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-ink-soft">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{formatPrice(order.total)}</span>
                      <StatusBadge status={order.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-rule bg-white p-5">
            <h2 className="label-caps mb-1">Internal notes</h2>
            <p className="mb-4 text-xs text-ink-soft">
              Staff only. Never shown to the customer, and never returned by any customer-facing
              endpoint.
            </p>

            {can('customer.update') && (
              <div className="mb-5">
                <Field label="Add a note" htmlFor="note">
                  <Textarea
                    id="note"
                    rows={3}
                    maxLength={4000}
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    placeholder="Called about a sizing question — sending the M instead."
                  />
                </Field>
                <Button
                  size="sm"
                  className="mt-3"
                  loading={busy}
                  disabled={!noteBody.trim()}
                  onClick={() => void addNote()}
                >
                  Save note
                </Button>
              </div>
            )}

            {customer.internalNotes.length === 0 ? (
              <p className="text-sm text-ink-soft">No notes yet.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {customer.internalNotes.map((note) => (
                  <li key={note.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="whitespace-pre-line text-sm">{note.body}</p>
                      {can('customer.update') && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => void togglePin(note)}
                            aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
                            aria-pressed={note.isPinned}
                            className={`p-1 ${note.isPinned ? 'text-sage-700' : 'text-ink-soft hover:text-ink'}`}
                          >
                            <Pin className="size-3.5" strokeWidth={1.6} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(note)}
                            aria-label="Delete note"
                            className="p-1 text-xs text-ink-soft hover:text-danger"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      {note.author?.name ?? 'System'} · {formatDateTime(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="border border-rule bg-white p-5">
            <h2 className="label-caps mb-3">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Orders</dt>
                <dd>{customer.orders.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Total spend</dt>
                <dd>{formatPrice(customer.totalSpend)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Email verified</dt>
                <dd>{customer.emailVerified ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Last signed in</dt>
                <dd>{customer.lastLoginAt ? formatDate(customer.lastLoginAt) : 'Never'}</dd>
              </div>
            </dl>
          </section>

          <section className="border border-rule bg-white p-5">
            <h2 className="label-caps mb-3">Addresses</h2>
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-ink-soft">None saved.</p>
            ) : (
              <ul className="space-y-4 text-sm">
                {customer.addresses.map((address) => (
                  <li key={address.id}>
                    <p>
                      {address.name}
                      {address.isDefault && <span className="badge badge-info ml-2">Default</span>}
                    </p>
                    <p className="mt-1 text-ink-soft">
                      {address.addressLine1}
                      {address.addressLine2 ? `, ${address.addressLine2}` : ''}, {address.city},{' '}
                      {address.state} {address.postalCode}
                    </p>
                    <p className="text-ink-soft">{address.phone}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this note?"
        body="It will be removed permanently."
        confirmLabel="Delete"
        loading={busy}
        onConfirm={() => void removeNote()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
