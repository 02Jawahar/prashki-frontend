'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowDown, ArrowUp, Plus, Search, X } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { ApiRequestError } from '@/services/api-client'
import { formatPrice } from '@/lib/money'
import { Alert, Button, EmptyState, Field, Input } from '@/components/ui'
import type { ProductDetail } from '@/types/api'

/**
 * The pieces a set is made of (M03).
 *
 * A set is an ordinary product that happens to be assembled from others. It
 * has its own price, and that is what the customer pays — the pieces keep
 * their own prices so the page can show what the set saves, and so each can
 * still be bought on its own.
 *
 * Order matters: it is the order the customer picks sizes in, so it is worth
 * arranging top to bottom the way the look is worn.
 */
export function ProductSet({
  product,
  onChange,
}: {
  product: ProductDetail
  onChange: (product: ProductDetail) => void
}) {
  const pieces = product.set?.pieces ?? []

  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductDetail[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults(null)
      return
    }
    try {
      const found = await adminService.products({ q: term.trim(), perPage: 8 })
      setResults(found.products as unknown as ProductDetail[])
    } catch {
      setResults([])
    }
  }, [])

  useEffect(() => {
    // Typed a letter at a time, so the search waits until the typing stops.
    const timer = setTimeout(() => void search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  async function save(ids: string[]) {
    setBusy(true)
    setError(null)
    try {
      onChange(await adminService.setComponents(product.id, ids))
      setQuery('')
      setResults(null)
      setAdding(false)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save the pieces')
    } finally {
      setBusy(false)
    }
  }

  const ids = pieces.map((p) => p.productId)

  function move(index: number, by: -1 | 1) {
    const next = [...ids]
    const to = index + by
    if (to < 0 || to >= next.length) return
    ;[next[index], next[to]] = [next[to]!, next[index]!]
    void save(next)
  }

  const piecesTotal = product.set?.piecesTotal ?? 0
  const saving = piecesTotal - product.price

  return (
    <section className="border border-rule bg-white p-5">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <p className="label-caps text-ink">Pieces</p>
          <p className="mt-1 max-w-lg text-xs text-ink-soft">
            Leave this empty for a single garment. Add pieces and this becomes a set: the customer
            picks a size for each one and pays this product&rsquo;s price.
          </p>
          <p className="mt-2 max-w-lg text-xs text-ink-soft">
            Each piece must already exist as its own product, with its own price and sizes — that
            is what lets someone buy the top without the pant. Create them first under{' '}
            <a href="/admin/products/new" className="link-underline text-ink">
              New product
            </a>
            , then find them here.
          </p>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" strokeWidth={2} />
            Add a piece
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {adding && (
        <div className="mt-4 border border-rule bg-sage-50 p-4">
          <Field
            label="Find a piece"
            htmlFor="set-search"
            hint="Search by name or SKU. Only products that already exist appear here."
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
                strokeWidth={1.6}
              />
              <Input
                id="set-search"
                autoFocus
                value={query}
                placeholder="Magnolia cape"
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </Field>

          {results !== null && (
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {results.length === 0 && (
                <li className="px-1 py-2 text-xs text-ink-soft">
                  Nothing matches that. A piece has to exist as its own product before it can be
                  added to a set.
                </li>
              )}
              {results.map((candidate) => {
                const already = ids.includes(candidate.id)
                const itself = candidate.id === product.id
                return (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      disabled={already || itself || busy}
                      onClick={() => void save([...ids, candidate.id])}
                      className="flex w-full items-center gap-3 border border-transparent px-2 py-2 text-left transition-colors hover:border-rule hover:bg-white disabled:opacity-45"
                    >
                      <span className="relative size-10 shrink-0 overflow-hidden bg-sage-100">
                        {candidate.images?.[0]?.url && (
                          <Image
                            src={candidate.images[0].url}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{candidate.name}</span>
                        <span className="block text-xs text-ink-soft">
                          {candidate.sku} · {formatPrice(candidate.price)}
                        </span>
                      </span>
                      {itself ? (
                        <span className="text-xs text-ink-soft">this product</span>
                      ) : already ? (
                        <span className="text-xs text-ink-soft">already in</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => {
              setAdding(false)
              setQuery('')
              setResults(null)
            }}
          >
            Done
          </Button>
        </div>
      )}

      {pieces.length === 0 ? (
        !adding && (
          <div className="mt-4">
            <EmptyState
              title="Not a set"
              body="This is sold as one garment. To sell it as a set, create each piece as its own product first, then add two or more of them here."
            />
          </div>
        )
      ) : (
        <>
          <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
            {pieces.map((piece, index) => (
              <li key={piece.productId} className="flex items-center gap-3 py-3">
                <span className="relative size-12 shrink-0 overflow-hidden bg-sage-100">
                  {piece.image && (
                    <Image src={piece.image} alt="" fill sizes="48px" className="object-cover" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{piece.name}</span>
                  <span className="block text-xs text-ink-soft">
                    {formatPrice(piece.price)} on its own · {piece.sizes.length}{' '}
                    {piece.sizes.length === 1 ? 'size' : 'sizes'}
                    {!piece.available && ' · not on sale'}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0 || busy}
                    onClick={() => move(index, -1)}
                    aria-label={`Move ${piece.name} up`}
                    className="p-1.5 text-ink-soft transition-colors hover:text-ink disabled:opacity-30"
                  >
                    <ArrowUp className="size-4" strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    disabled={index === pieces.length - 1 || busy}
                    onClick={() => move(index, 1)}
                    aria-label={`Move ${piece.name} down`}
                    className="p-1.5 text-ink-soft transition-colors hover:text-ink disabled:opacity-30"
                  >
                    <ArrowDown className="size-4" strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save(ids.filter((id) => id !== piece.productId))}
                    aria-label={`Remove ${piece.name}`}
                    className="p-1.5 text-ink-soft transition-colors hover:text-danger disabled:opacity-30"
                  >
                    <X className="size-4" strokeWidth={1.6} />
                  </button>
                </span>
              </li>
            ))}
          </ul>

          {/*
            The arithmetic an editor actually wants to see: what the pieces cost
            separately against what the set is priced at. A set priced above its
            pieces is legal and almost always a typo.
          */}
          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Pieces bought separately</dt>
              <dd className="tabular-nums">{formatPrice(piecesTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">This set</dt>
              <dd className="tabular-nums">{formatPrice(product.price)}</dd>
            </div>
            <div className="flex justify-between border-t border-hairline pt-1.5">
              <dt className={saving > 0 ? 'text-sage-700' : 'text-danger'}>
                {saving > 0 ? 'Customer saves' : saving === 0 ? 'No saving' : 'Set costs more'}
              </dt>
              <dd
                className={`tabular-nums ${saving > 0 ? 'text-sage-700' : saving < 0 ? 'text-danger' : ''}`}
              >
                {formatPrice(Math.abs(saving))}
              </dd>
            </div>
          </dl>

          {saving < 0 && (
            <p className="mt-2 text-xs text-danger">
              This set costs more than buying the pieces one by one. Check the price above.
            </p>
          )}

          {pieces.length === 1 && (
            <p className="mt-2 text-xs text-danger">
              A set needs at least two pieces. Add another, or remove this one to sell it as a
              single garment.
            </p>
          )}
        </>
      )}
    </section>
  )
}
