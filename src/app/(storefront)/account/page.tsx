'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { addressService, orderService, type Address, type OrderSummary } from '@/services/order.service'
import { formatPrice } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { Button, EmptyState, SkeletonRows, StatusBadge } from '@/components/ui'

export default function AccountPage() {
  const { user, logout } = useAuth()
  const router = useRouter()

  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const [o, a] = await Promise.all([
        orderService.list().then((r) => r.orders).catch(() => []),
        addressService.list().catch(() => []),
      ])
      setOrders(o)
      setAddresses(a)
      setLoading(false)
    })()
  }, [])

  async function signOut() {
    await logout()
    router.push('/')
    router.refresh()
  }

  if (loading) return <SkeletonRows rows={4} />

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section className="border border-rule p-6">
        <h2 className="label-caps mb-4">Details</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-soft">Name</dt>
            <dd>{user?.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Email</dt>
            <dd>{user?.email}</dd>
          </div>
          {user?.phone && (
            <div>
              <dt className="text-xs text-ink-soft">Phone</dt>
              <dd>{user.phone}</dd>
            </div>
          )}
        </dl>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="label-caps">Recent orders</h2>
          <Link href="/account/orders" className="label-caps link-underline text-sage-700">
            View all
          </Link>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            body="Your orders will appear here once you've placed one."
            action={
              <Link href="/products" className="btn btn-primary btn-sm">
                Start shopping
              </Link>
            }
          />
        ) : (
          <ul className="border-t border-hairline">
            {orders.slice(0, 3).map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-4 border-b border-hairline py-4">
                <div>
                  <Link href={`/account/orders/${order.id}`} className="display text-lg">
                    {order.orderNumber}
                  </Link>
                  <p className="text-xs text-ink-soft">
                    {formatDate(order.createdAt)} · {order.itemCount}{' '}
                    {order.itemCount === 1 ? 'item' : 'items'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">{formatPrice(order.total)}</p>
                  <StatusBadge status={order.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="label-caps mb-4">Addresses</h2>
        {addresses.length === 0 ? (
          <EmptyState title="No saved addresses" body="You can add one at checkout." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="border border-rule p-4 text-sm">
                <p className="font-medium">
                  {a.name}
                  {a.isDefault && <span className="badge badge-info ml-2">Default</span>}
                </p>
                <p className="mt-1 text-ink-soft">
                  {a.addressLine1}
                  {a.addressLine2 ? `, ${a.addressLine2}` : ''}, {a.city}, {a.state} {a.postalCode}
                </p>
                <p className="mt-0.5 text-ink-soft">{a.phone}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button variant="ghost" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  )
}
