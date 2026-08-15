'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertTriangle, IndianRupee, Package, ShoppingCart, Users, Clock } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { formatPrice, formatPriceShort } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { Alert, EmptyState, SkeletonRows, StatusBadge } from '@/components/ui'
import type { DashboardStats } from '@/types/api'

interface RecentOrder {
  id: string
  orderNumber: string
  status: string
  total: number
  itemCount: number
  customer: { name: string; email: string } | null
  createdAt: string
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [orders, setOrders] = useState<RecentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        // Every figure below is a live database query — no placeholder numbers.
        const [s, o] = await Promise.all([
          adminService.stats(),
          adminService.recentOrders().catch(() => []),
        ])
        setStats(s)
        setOrders(o as RecentOrder[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load the dashboard')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-7">
        <h1 className="display text-2xl">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-soft">Live figures from the store database.</p>
      </header>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <SkeletonRows rows={4} />
      ) : stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total products"
              value={String(stats.totalProducts)}
              sub={`${stats.activeProducts} published`}
              icon={<Package className="size-4" strokeWidth={1.5} />}
              href="/admin/products"
            />
            <StatCard
              label="Total customers"
              value={String(stats.totalCustomers)}
              icon={<Users className="size-4" strokeWidth={1.5} />}
              href="/admin/customers"
            />
            <StatCard
              label="Total orders"
              value={String(stats.totalOrders)}
              icon={<ShoppingCart className="size-4" strokeWidth={1.5} />}
              href="/admin/orders"
            />
            <StatCard
              label="Total revenue"
              value={formatPriceShort(stats.totalRevenue)}
              sub="Paid orders only"
              icon={<IndianRupee className="size-4" strokeWidth={1.5} />}
            />
            <StatCard
              label="Pending orders"
              value={String(stats.pendingOrders)}
              sub="Awaiting payment"
              icon={<Clock className="size-4" strokeWidth={1.5} />}
              href="/admin/orders?status=PENDING_PAYMENT"
            />
            <StatCard
              label="Low stock"
              value={String(stats.lowStockCount)}
              sub="At or below threshold"
              tone={stats.lowStockCount > 0 ? 'warning' : undefined}
              icon={<AlertTriangle className="size-4" strokeWidth={1.5} />}
              href="/admin/inventory?lowOnly=true"
            />
          </div>

          <div className="mt-9 grid gap-6 lg:grid-cols-2">
            <section className="border border-rule bg-white">
              <header className="flex items-center justify-between border-b border-rule px-5 py-3.5">
                <h2 className="label-caps">Recent orders</h2>
                <Link href="/admin/orders" className="label-caps link-underline text-sage-700">
                  View all
                </Link>
              </header>

              {orders.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No orders yet" body="Orders will appear here once customers check out." />
                </div>
              ) : (
                <ul className="divide-y divide-hairline">
                  {orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                      <div className="min-w-0">
                        <Link href={`/admin/orders/${o.id}`} className="text-sm hover:underline">
                          {o.orderNumber}
                        </Link>
                        <p className="truncate text-xs text-ink-soft">
                          {o.customer?.name ?? 'Guest'} · {formatDate(o.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <StatusBadge status={o.status} />
                        <span className="text-sm tabular-nums">{formatPrice(o.total)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border border-rule bg-white">
              <header className="flex items-center justify-between border-b border-rule px-5 py-3.5">
                <h2 className="label-caps">Low stock</h2>
                <Link href="/admin/inventory" className="label-caps link-underline text-sage-700">
                  Manage
                </Link>
              </header>

              {stats.lowStockItems.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="Stock levels are healthy" />
                </div>
              ) : (
                <ul className="divide-y divide-hairline">
                  {stats.lowStockItems.map((item) => (
                    <li key={item.variantId} className="flex items-center justify-between gap-4 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{item.productName}</p>
                        <p className="text-xs text-ink-soft">{item.sku}</p>
                      </div>
                      <span
                        className={
                          item.availableStock === 0
                            ? 'badge badge-danger'
                            : 'badge badge-warning'
                        }
                      >
                        {item.availableStock} left
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon,
  href,
  tone,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  href?: string
  tone?: 'warning'
}) {
  const inner = (
    <div
      className={`h-full border bg-white p-5 transition-colors ${
        tone === 'warning' ? 'border-warning/40' : 'border-rule'
      } ${href ? 'hover:border-ink' : ''}`}
    >
      <div className="flex items-center justify-between">
        <p className="label-caps text-ink-soft">{label}</p>
        <span className={tone === 'warning' ? 'text-warning' : 'text-sage-600'}>{icon}</span>
      </div>
      <p className="display mt-3 text-3xl tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}
    </div>
  )

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  )
}
