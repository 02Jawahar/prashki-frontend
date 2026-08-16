'use client'

import { useEffect, useRef, useState } from 'react'
import { Ruler, X } from 'lucide-react'

/**
 * Size guidance (FR-03.3).
 *
 * Measurements are in centimetres and describe the *body*, not the garment —
 * that is the question a shopper is actually asking, and garment measurements
 * vary by cut in a way a single table cannot capture.
 *
 * Static for now. When sizing differs by category this becomes a setting the
 * catalogue team edits, which is why the table is data rather than markup.
 */
const SIZES = [
  { size: 'XS', bust: '78–82', waist: '60–64', hip: '86–90' },
  { size: 'S', bust: '83–87', waist: '65–69', hip: '91–95' },
  { size: 'M', bust: '88–92', waist: '70–74', hip: '96–100' },
  { size: 'L', bust: '93–98', waist: '75–80', hip: '101–106' },
  { size: 'XL', bust: '99–104', waist: '81–86', hip: '107–112' },
]

export function SizeGuide() {
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
                  Body measurements in centimetres.
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

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left">
                    <th className="label-caps py-2 font-normal">Size</th>
                    <th className="label-caps py-2 font-normal">Bust</th>
                    <th className="label-caps py-2 font-normal">Waist</th>
                    <th className="label-caps py-2 font-normal">Hip</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZES.map((row) => (
                    <tr key={row.size} className="border-b border-hairline last:border-0">
                      <td className="py-2.5 font-medium">{row.size}</td>
                      <td className="py-2.5 text-ink-soft">{row.bust}</td>
                      <td className="py-2.5 text-ink-soft">{row.waist}</td>
                      <td className="py-2.5 text-ink-soft">{row.hip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
                <span className="text-ink">Hip</span> — around the fullest part, roughly 20 cm
                below the waist.
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
