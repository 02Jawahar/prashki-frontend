'use client'

import { useCallback, useEffect, useState } from 'react'
import { reportService, type SalesReport } from '@/services/admin-modules.service'
import { formatPrice } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { Alert, EmptyState, Select, SkeletonRows } from '@/components/ui'

/**
 * Reports (M19, M24).
 *
 * Revenue counts only orders that were actually paid for, and nets off refunds,
 * so the headline figure is money kept rather than money quoted.
 */
const RANGES = [
  { value: '7', label: 'Last 7 days', interval: 'day' },
  { value: '30', label: 'Last 30 days', interval: 'day' },
  { value: '90', label: 'Last 90 days', interval: 'week' },
  { value: '365', label: 'Last 12 months', interval: 'month' },
] as const

export default function AdminReportsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]['value']>('30')

  const [sales, setSales] = useState<SalesReport | null>(null)
  const [top, setTop] = useState<Awaited<ReturnType<typeof reportService.topProducts>>>([])
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof reportService.inventory>> | null>(null)
  const [customers, setCustomers] = useState<Awaited<ReturnType<typeof reportService.customers>> | null>(null)
  const [searches, setSearches] = useState<Awaited<ReturnType<typeof reportService.searches>>>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    const days = Number(range)
    const to = new Date()
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
    const interval = RANGES.find((r) => r.value === range)!.interval
    const window = { from: from.toISOString(), to: to.toISOString() }

    try {
      const [salesResult, topResult, inventoryResult, customerResult, searchResult] =
        await Promise.all([
          reportService.sales({ ...window, interval }),
          reportService.topProducts({ ...window, limit: 10 }),
          reportService.inventory(),
          reportService.customers(window),
          reportService.searches({ ...window, limit: 15 }),
        ])

      setSales(salesResult)
      setTop(topResult)
      setInventory(inventoryResult)
      setCustomers(customerResult)
      setSearches(searchResult)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the reports')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  const peak = Math.max(1, ...(sales?.series.map((point) => point.revenue) ?? [1]))

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Reports</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Every figure is a live query. Nothing here is estimated.
          </p>
        </div>

        <Select
          value={range}
          onChange={(event) => setRange(event.target.value as typeof range)}
          aria-label="Date range"
          className="w-44"
        >
          {RANGES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </header>

      {error && <Alert>{error}</Alert>}

      {loading || !sales ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Net revenue" value={formatPrice(sales.netRevenue)} />
            <Stat label="Orders" value={String(sales.orders)} />
            <Stat label="Average order" value={formatPrice(sales.averageOrderValue)} />
            <Stat label="Refunded" value={formatPrice(sales.refunds)} />
          </section>

          <section className="border border-rule bg-white p-5">
            <h2 className="label-caps mb-5">Revenue over time</h2>

            {sales.series.length === 0 ? (
              <EmptyState title="No orders in this period" />
            ) : (
              <>
                <div className="flex h-40 items-end gap-1">
                  {sales.series.map((point) => (
                    <div
                      key={point.date}
                      className="group relative flex-1"
                      title={`${formatDate(point.date)} — ${formatPrice(point.revenue)} from ${point.orders} order${point.orders === 1 ? '' : 's'}`}
                    >
                      <div
                        className="w-full bg-sage-600 transition-colors group-hover:bg-sage-700"
                        style={{ height: `${Math.max(2, (point.revenue / peak) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex justify-between text-xs text-ink-soft">
                  <span>{formatDate(sales.series[0]!.date)}</span>
                  <span>{formatDate(sales.series.at(-1)!.date)}</span>
                </div>
              </>
            )}

            <dl className="mt-6 grid gap-3 border-t border-hairline pt-5 text-sm sm:grid-cols-4">
              <Row label="Goods" value={formatPrice(sales.breakdown.subtotal)} />
              <Row label="Discounts" value={`−${formatPrice(sales.breakdown.discount)}`} />
              <Row label="Delivery" value={formatPrice(sales.breakdown.shipping)} />
              <Row label="Tax" value={formatPrice(sales.breakdown.tax)} />
            </dl>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="border border-rule bg-white p-5">
              <h2 className="label-caps mb-4">Best sellers</h2>
              {top.length === 0 ? (
                <p className="text-sm text-ink-soft">Nothing sold in this period.</p>
              ) : (
                <ul className="divide-y divide-hairline text-sm">
                  {top.map((product) => (
                    <li key={product.productId ?? product.name} className="flex justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate">{product.name}</span>
                      <span className="shrink-0 text-ink-soft">
                        {product.unitsSold} · {formatPrice(product.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border border-rule bg-white p-5">
              <h2 className="label-caps mb-4">Customers</h2>
              {customers && (
                <dl className="space-y-3 text-sm">
                  <Row label="New in this period" value={String(customers.newCustomers)} />
                  <Row label="Total customers" value={String(customers.totalCustomers)} />
                  <Row label="Have ever bought" value={String(customers.customersWhoBought)} />
                  <Row label="Bought more than once" value={String(customers.repeatCustomers)} />
                  <Row label="Repeat rate" value={`${customers.repeatRate}%`} />
                </dl>
              )}
            </section>

            <section className="border border-rule bg-white p-5">
              <h2 className="label-caps mb-4">Stock</h2>
              {inventory && (
                <>
                  <dl className="space-y-3 text-sm">
                    <Row label="Variants tracked" value={String(inventory.variantsTracked)} />
                    <Row label="Units in stock" value={String(inventory.unitsInStock)} />
                    <Row label="Running low" value={String(inventory.lowStockCount)} />
                    <Row label="Out of stock" value={String(inventory.outOfStockCount)} />
                  </dl>

                  {inventory.fastestMoving.length > 0 && (
                    <>
                      <h3 className="label-caps mb-2 mt-5">Moving fastest</h3>
                      <ul className="divide-y divide-hairline text-sm">
                        {inventory.fastestMoving.map((row) => (
                          <li key={row.variantId} className="flex justify-between gap-3 py-2">
                            <span className="min-w-0 truncate">
                              {row.productName}
                              <span className="ml-2 text-xs text-ink-soft">{row.sku}</span>
                            </span>
                            <span className="shrink-0 text-ink-soft">
                              {row.unitsSold} sold · {row.remaining} left
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </section>

            <section className="border border-rule bg-white p-5">
              <h2 className="label-caps mb-1">What people searched for</h2>
              <p className="mb-4 text-xs text-ink-soft">
                Terms that found nothing are the ones worth acting on.
              </p>

              {searches.length === 0 ? (
                <p className="text-sm text-ink-soft">No searches recorded in this period.</p>
              ) : (
                <ul className="divide-y divide-hairline text-sm">
                  {searches.map((search) => (
                    <li key={search.term} className="flex justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate">{search.term}</span>
                      <span className="shrink-0 text-ink-soft">
                        {search.searches}
                        {search.zeroResults > 0 && (
                          <span className="ml-2 text-danger">{search.zeroResults} empty</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-rule bg-white p-5">
      <p className="label-caps text-ink-soft">{label}</p>
      <p className="display mt-2 text-2xl">{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
