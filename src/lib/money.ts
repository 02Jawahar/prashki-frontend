/**
 * Money arrives from the API as integer paise. Formatting happens here, once.
 */
const inr = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const inrCompact = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function formatPrice(paise: number): string {
  return `₹${inr.format(paise / 100)}`
}

/** Compact form for tables, filters and stat tiles. */
export function formatPriceShort(paise: number): string {
  return `₹${inrCompact.format(paise / 100)}`
}

/** Editable rupee value for admin number inputs. */
export function paiseToRupeeInput(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return ''
  return String(paise / 100)
}

export function rupeeInputToPaise(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}
