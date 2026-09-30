'use client'

import { useEffect, useRef, useState } from 'react'
import { Ruler, X } from 'lucide-react'

/**
 * Size guidance (FR-03.3).
 *
 * The studio's own measurements, in inches, laid out the way the studio's own
 * chart lays them out: sizes across, measurements down. That is how a person
 * reads a size chart — they know their bust and are looking along the row for
 * where it lands — and it is the arrangement the printed chart uses, so the
 * two cannot drift into saying different things.
 *
 * These describe the *body*, not the garment. It is the question a shopper is
 * actually asking, and garment measurements vary by cut in a way one table
 * cannot hold.
 *
 * Tops and bottoms separately, because a bottom has no bust or shoulder and a
 * single table with empty cells asks the reader to work out which columns
 * apply to what they are buying.
 *
 * Static for now. When sizing differs by category this becomes a setting the
 * catalogue team edits, which is why the tables are data rather than markup.
 */

const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const

const TOPS = [
  { label: 'Bust', values: ['34', '36', '38', '40', '42'] },
  { label: 'Waist', values: ['26', '28', '30', '32', '34'] },
  { label: 'Hips', values: ['35', '37', '39', '41', '43'] },
  { label: 'Shoulder', values: ['14', '14.5', '15', '15.5', '16'] },
  { label: 'Armhole', values: ['15.5', '16', '16.5', '17', '17.5'] },
]

const BOTTOMS = [
  { label: 'Waist', values: ['26', '28', '30', '32', '34'] },
  { label: 'Hips', values: ['35', '37', '39', '41', '43'] },
]

/**
 * What our sizes are called elsewhere.
 *
 * Read down rather than across, unlike the tables above: somebody using this
 * knows they are a UK 12 and is looking for the row that says so, which is the
 * opposite of how they read the measurements.
 *
 * The conversions are the studio's, chosen deliberately. They sit a little
 * below what our own bust figures would suggest — our XS is 34 inches where
 * this table's XS converts as a 32 — so a customer who orders by conversion
 * alone gets a slightly roomier garment than one who orders by the tape. The
 * measurements come first on the screen for that reason: they are what
 * actually decides the fit.
 */
const REGIONS = ['US', 'UK', 'AUS', 'EU'] as const

const INTERNATIONAL: Record<string, string[]> = {
  // US, UK, AUS, EU
  XS: ['2', '4', '4', '32'],
  S: ['4', '6', '6', '34'],
  M: ['6', '8', '8', '36'],
  L: ['8', '10', '10', '38'],
  XL: ['10', '12', '12', '40'],
}

function MeasurementTable({
  caption,
  rows,
}: {
  caption: string
  rows: Array<{ label: string; values: string[] }>
}) {
  return (
    <div className="mt-5">
      <p className="label-caps text-ink">{caption}</p>
      {/*
        Six columns do not fit a phone, so the table scrolls inside its own
        box rather than pushing the page sideways.
      */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="label-caps py-2 text-left font-normal">Size</th>
              {SIZES.map((size) => (
                <th key={size} className="label-caps py-2 text-center font-normal">
                  {size}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-hairline last:border-0">
                <td className="py-2.5 font-medium">{row.label}</td>
                {row.values.map((value, i) => (
                  <td
                    key={SIZES[i]}
                    className="py-2.5 text-center tabular-nums text-ink-soft"
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Our size against the ones used elsewhere.
 *
 * Turned the other way round from the measurement tables above, and on
 * purpose: a customer reading this already knows they are a UK 12 and is
 * scanning the UK column for it, where in the tables above they know their
 * bust and are scanning along a row.
 */
function ComparisonTable() {
  return (
    <div className="mt-5">
      <p className="label-caps text-ink">If you shop in other sizes</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="label-caps py-2 text-left font-normal">Size</th>
              {REGIONS.map((region) => (
                <th key={region} className="label-caps py-2 text-center font-normal">
                  {region}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZES.map((size) => (
              <tr key={size} className="border-b border-hairline last:border-0">
                <td className="py-2.5 font-medium">{size}</td>
                {(INTERNATIONAL[size] ?? []).map((value, i) => (
                  <td key={REGIONS[i]} className="py-2.5 text-center tabular-nums text-ink-soft">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SizeGuide({ productName }: { productName?: string }) {
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="label-caps link-underline inline-flex items-center gap-1.5 text-ink-soft"
      >
        <Ruler className="size-3.5" strokeWidth={1.5} aria-hidden />
        Size guide
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="size-guide-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-rule bg-paper p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="size-guide-title" className="display text-xl">
                  Size guide
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {productName ? `${productName} · ` : ''}Body measurements, in inches.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close the size guide"
                className="text-ink-soft hover:text-ink"
              >
                <X className="size-5" strokeWidth={1.4} />
              </button>
            </div>

            <MeasurementTable caption="Tops & dresses" rows={TOPS} />
            <MeasurementTable caption="Bottoms" rows={BOTTOMS} />
            <ComparisonTable />

            <div className="mt-6 space-y-2 text-sm text-ink-soft">
              <p className="label-caps text-ink">How to measure</p>
              <p>
                <span className="text-ink">Bust</span> — around the fullest part, tape level and
                not pulled tight.
              </p>
              <p>
                <span className="text-ink">Waist</span> — the narrowest part, usually just above
                the navel.
              </p>
              <p>
                <span className="text-ink">Hips</span> — around the fullest part, roughly eight
                inches below the waist.
              </p>
              <p>
                <span className="text-ink">Shoulder</span> — across the back, from the edge of one
                shoulder to the other.
              </p>
              <p>
                <span className="text-ink">Armhole</span> — around the arm where it meets the
                shoulder.
              </p>
              <p className="pt-2">
                Between two sizes? Our cuts run relaxed, so most people take the smaller. Write to
                us if you would like a second opinion on a particular piece.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
