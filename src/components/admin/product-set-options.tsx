'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { ApiRequestError } from '@/services/api-client'
import { formatPrice } from '@/lib/money'
import { Alert, Button, Field, Input } from '@/components/ui'
import type { ProductDetail } from '@/types/api'

/**
 * What may be bought of this product (M03).
 *
 * The light way to sell a set: the parts are choices on this one product, not
 * products of their own. One size governs whichever part is chosen, and no
 * part has a page of its own — the trade for not maintaining four products to
 * sell one look.
 *
 * Leave it empty to sell the garment whole. Two or more parts, or none: one
 * part is a product with an extra click in front of it.
 */
export function ProductSetOptions({
  product,
  onChange,
}: {
  product: ProductDetail
  onChange: (product: ProductDetail) => void
}) {
  const saved = product.setOptions ?? []

  /** Rupee strings, because a half-typed number is not a number yet. */
  const [rows, setRows] = useState<Array<{ label: string; price: string; weight: string }>>(() =>
    saved.map((o) => ({
      label: o.label,
      price: String(o.price / 100),
      weight: o.weightGrams === null ? '' : String(o.weightGrams),
    })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function patch(index: number, change: Partial<{ label: string; price: string; weight: string }>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)))
    setNotice(null)
  }

  async function save() {
    setBusy(true)
    setError(null)
    setNotice(null)

    const options = rows
      .map((row) => ({
        label: row.label.trim(),
        price: Math.round(Number(row.price) * 100),
        /**
         * Blank means unweighed, which is a different thing from weightless -
         * it falls back to the variant and then to the store default, rather
         * than telling the carrier the parcel is empty.
         */
        weightGrams: row.weight.trim() === '' ? null : Math.round(Number(row.weight)),
      }))
      .filter((row) => row.label && Number.isFinite(row.price) && row.price > 0)

    if (rows.length > 0 && options.length !== rows.length) {
      setError('Every part needs a name and a price.')
      setBusy(false)
      return
    }

    try {
      onChange(await adminService.setOptions(product.id, options))
      setNotice(
        options.length === 0
          ? 'Sold as one garment again.'
          : `Saved. The page now offers ${options.length} parts.`,
      )
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save the parts')
    } finally {
      setBusy(false)
    }
  }

  const total = rows.reduce((sum, row) => sum + (Number(row.price) || 0), 0)
  const dirty =
    rows.length !== saved.length ||
    rows.some((row, i) => {
      const was = saved[i]
      const weight = row.weight.trim() === '' ? null : Math.round(Number(row.weight))
      return (
        row.label !== was?.label ||
        Math.round(Number(row.price) * 100) !== was?.price ||
        weight !== (was?.weightGrams ?? null)
      )
    })

  return (
    <section className="border border-rule bg-white p-5">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <p className="label-caps text-ink">Sold in parts</p>
          <p className="mt-1 max-w-lg text-xs text-ink-soft">
            Leave this empty to sell the garment whole. Add parts — Top, Pant, Cape, Full set —
            and the page offers them as a row, each at its own price.
          </p>
          <p className="mt-2 max-w-lg text-xs text-ink-soft">
            The sizes below apply to whichever part is chosen, and the parts have no page of their
            own — they cannot be found in a category or in search. Somebody who should be able to
            browse straight to the top wants it as a product of its own instead.
          </p>
        </div>
        {rows.length < 8 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRows((current) => [...current, { label: '', price: '', weight: '' }])}
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Add a part
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {notice && <p className="mt-4 text-sm text-sage-700">{notice}</p>}

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">Sold whole, at the product&rsquo;s own price.</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {rows.map((row, index) => (
              <li key={index} className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label={index === 0 ? 'Part' : ''} htmlFor={`part-${index}`}>
                    <Input
                      id={`part-${index}`}
                      value={row.label}
                      placeholder="Top"
                      maxLength={40}
                      onChange={(e) => patch(index, { label: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="w-36">
                  <Field label={index === 0 ? 'Price (₹)' : ''} htmlFor={`part-price-${index}`}>
                    <Input
                      id={`part-price-${index}`}
                      type="number"
                      min={1}
                      step={1}
                      value={row.price}
                      placeholder="5000"
                      onChange={(e) => patch(index, { price: e.target.value })}
                    />
                  </Field>
                </div>
                {/*
                  What this part weighs on its own, so the courier is quoted
                  for the box that actually ships. A top and the full set are
                  the same size but very different parcels.
                */}
                <div className="w-32">
                  <Field label={index === 0 ? 'Weight (g)' : ''} htmlFor={`part-weight-${index}`}>
                    <Input
                      id={`part-weight-${index}`}
                      type="number"
                      min={0}
                      step={50}
                      value={row.weight}
                      placeholder="600"
                      onChange={(e) => patch(index, { weight: e.target.value })}
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  aria-label={`Remove ${row.label || 'this part'}`}
                  className="mb-2 p-1.5 text-ink-soft transition-colors hover:text-danger"
                >
                  <X className="size-4" strokeWidth={1.6} />
                </button>
              </li>
            ))}
          </ul>

          {rows.length === 1 && (
            <p className="mt-2 text-xs text-danger">
              Add another part, or remove this one — a single part is the whole garment with an
              extra click in front of it.
            </p>
          )}

          {/*
            The arithmetic worth seeing: what the parts come to against what a
            full set is priced at. It only means something once a part is
            actually called "full set", so it is not asserted, only shown.
          */}
          {rows.length > 1 && total > 0 && (
            <p className="mt-3 text-xs text-ink-soft">
              The parts listed come to {formatPrice(Math.round(total * 100))} altogether.
            </p>
          )}
        </>
      )}

      <div className="mt-5 border-t border-hairline pt-4">
        <Button size="sm" loading={busy} disabled={!dirty} onClick={() => void save()}>
          Save parts
        </Button>
      </div>
    </section>
  )
}
