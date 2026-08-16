'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'
import type { Category } from '@/types/api'
import type { Facets } from '@/services/product.service'

const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price-asc', label: 'Price, low to high' },
  { value: 'price-desc', label: 'Price, high to low' },
  { value: 'rating', label: 'Best rated' },
  { value: 'name-asc', label: 'Alphabetically, A–Z' },
  { value: 'name-desc', label: 'Alphabetically, Z–A' },
]

/** Filter and sort bar. State lives in the URL so results are shareable. */
export function ProductFilters({
  categories,
  facets,
  total,
  showCategory = true,
}: {
  categories: Category[]
  facets?: Facets
  total: number
  showCategory?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)

  const category = params.get('category') ?? ''
  const inStock = params.get('inStock') === 'true'
  const minPrice = params.get('minPrice')
  const maxPrice = params.get('maxPrice')

  /**
   * The single `attributes` param holds every facet selection. Parsing it into
   * a set keeps the checkbox state and the URL as one source of truth — there
   * is no local copy to fall out of sync.
   */
  const selected = new Set(
    (params.get('attributes') ?? '')
      .split(',')
      .map((pair) => pair.trim())
      .filter(Boolean),
  )

  const activeCount =
    (category ? 1 : 0) + (inStock ? 1 : 0) + (minPrice || maxPrice ? 1 : 0) + selected.size

  const push = useCallback(
    (next: URLSearchParams) => {
      next.delete('page') // any filter change returns to page 1
      const qs = next.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (!value) next.delete(key)
    else next.set(key, value)
    push(next)
  }

  const toggleFacet = (attribute: string, value: string) => {
    const key = `${attribute}:${value}`
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)

    const query = new URLSearchParams(params.toString())
    if (next.size === 0) query.delete('attributes')
    else query.set('attributes', [...next].join(','))
    push(query)
  }

  const clearAll = () => {
    const next = new URLSearchParams()
    const sort = params.get('sort')
    if (sort) next.set('sort', sort)
    push(next)
  }

  const leaves = categories.filter((c) => c.parentId !== null)

  return (
    <>
      <div className="flex items-center justify-between gap-4 border-y border-hairline py-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="label-caps flex items-center gap-2 text-ink hover:text-sage-700"
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.4} />
          Filter
          {activeCount > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-sage-700 text-[0.6rem] text-white">
              {activeCount}
            </span>
          )}
        </button>

        <p className="hidden text-xs text-ink-soft sm:block">
          {total} {total === 1 ? 'piece' : 'pieces'}
        </p>

        <label className="flex items-center gap-2">
          <span className="label-caps hidden text-ink-soft sm:inline">Sort by</span>
          <select
            value={params.get('sort') ?? 'featured'}
            onChange={(e) => setParam('sort', e.target.value)}
            className="label-caps cursor-pointer border-0 bg-transparent pr-1 text-ink outline-none"
            aria-label="Sort products"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 py-4">
          {category && (
            <Chip
              label={leaves.find((c) => c.slug === category)?.name ?? category}
              onRemove={() => setParam('category', null)}
            />
          )}
          {inStock && <Chip label="In stock" onRemove={() => setParam('inStock', null)} />}
          {[...selected].map((key) => {
            const [attribute, value] = key.split(':')
            const group = facets?.attributes.find((a) => a.slug === attribute)
            const option = group?.values.find((v) => v.slug === value)
            return (
              <Chip
                key={key}
                label={option ? `${group!.name}: ${option.value}` : key}
                onRemove={() => toggleFacet(attribute, value)}
              />
            )
          })}
          {(minPrice || maxPrice) && (
            <Chip
              label="Price"
              onRemove={() => {
                const next = new URLSearchParams(params.toString())
                next.delete('minPrice')
                next.delete('maxPrice')
                push(next)
              }}
            />
          )}
          <button type="button" onClick={clearAll} className="label-caps ml-2 text-sage-700 underline">
            Clear all
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[75]">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-full max-w-sm flex-col bg-white">
            <header className="flex items-center justify-between border-b border-hairline px-6 py-5">
              <h2 className="label-caps">Filter</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close filters">
                <X className="size-5" strokeWidth={1.4} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {showCategory && leaves.length > 0 && (
                <Block heading="Category">
                  <Select value={category} onChange={(e) => setParam('category', e.target.value || null)}>
                    <option value="">All categories</option>
                    {leaves.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name} ({c.productCount})
                      </option>
                    ))}
                  </Select>
                </Block>
              )}

              {facets?.attributes.map((attribute) => (
                <Block key={attribute.slug} heading={attribute.name}>
                  <ul className={attribute.isSwatch ? 'flex flex-wrap gap-2' : 'space-y-2.5'}>
                    {attribute.values.map((value) => {
                      const checked = selected.has(`${attribute.slug}:${value.slug}`)

                      // Swatches read as colour, so they are rendered as
                      // pressable chips rather than a list of checkboxes.
                      if (attribute.isSwatch) {
                        return (
                          <li key={value.slug}>
                            <button
                              type="button"
                              aria-pressed={checked}
                              onClick={() => toggleFacet(attribute.slug, value.slug)}
                              title={`${value.value} (${value.count})`}
                              className={`flex items-center gap-2 border px-2.5 py-1.5 text-xs transition-colors ${
                                checked ? 'border-ink' : 'border-rule hover:border-ink'
                              }`}
                            >
                              {value.colorHex && (
                                <span
                                  className="size-3.5 rounded-full border border-rule"
                                  style={{ backgroundColor: value.colorHex }}
                                  aria-hidden
                                />
                              )}
                              {value.value}
                            </button>
                          </li>
                        )
                      }

                      return (
                        <li key={value.slug}>
                          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFacet(attribute.slug, value.slug)}
                              className="size-4 accent-[#5b6241]"
                            />
                            {value.value}
                            <span className="text-xs text-ink-soft">({value.count})</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </Block>
              ))}

              <Block heading="Availability">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={inStock}
                    onChange={(e) => setParam('inStock', e.target.checked ? 'true' : null)}
                    className="size-4 accent-[#5b6241]"
                  />
                  In stock only
                </label>
              </Block>

              <Block heading="Price (₹)">
                <PriceRange
                  min={minPrice}
                  max={maxPrice}
                  onApply={(lo, hi) => {
                    const next = new URLSearchParams(params.toString())
                    if (lo) next.set('minPrice', lo)
                    else next.delete('minPrice')
                    if (hi) next.set('maxPrice', hi)
                    else next.delete('maxPrice')
                    push(next)
                  }}
                />
              </Block>
            </div>

            <footer className="border-t border-hairline px-6 py-5">
              <Button type="button" onClick={() => setOpen(false)} className="w-full">
                Show {total} {total === 1 ? 'piece' : 'pieces'}
              </Button>
            </footer>
          </aside>
        </div>
      )}
    </>
  )
}

function Block({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-hairline py-5 first:pt-0 last:border-0">
      <p className="eyebrow mb-4 text-ink">{heading}</p>
      {children}
    </div>
  )
}

function PriceRange({
  min,
  max,
  onApply,
}: {
  min: string | null
  max: string | null
  onApply: (lo: string, hi: string) => void
}) {
  // Inputs are in rupees; the API speaks paise.
  const [lo, setLo] = useState(min ? String(Number(min) / 100) : '')
  const [hi, setHi] = useState(max ? String(Number(max) / 100) : '')

  return (
    <div className="flex items-center gap-2">
      <Input type="number" min={0} value={lo} onChange={(e) => setLo(e.target.value)} placeholder="From" />
      <span className="text-ink-soft">&ndash;</span>
      <Input type="number" min={0} value={hi} onChange={(e) => setHi(e.target.value)} placeholder="To" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onApply(lo ? String(Number(lo) * 100) : '', hi ? String(Number(hi) * 100) : '')}
      >
        Go
      </Button>
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex items-center gap-1.5 border border-rule px-3 py-1.5 text-xs text-ink hover:border-ink"
    >
      {label}
      <X className="size-3" strokeWidth={1.6} />
    </button>
  )
}
