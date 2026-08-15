import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Pagination as PaginationType } from '@/types/api'

export function Pagination({
  pagination,
  basePath,
  searchParams,
}: {
  pagination: PaginationType
  basePath: string
  searchParams: Record<string, string | string[] | undefined>
}) {
  const { page, pageCount } = pagination
  if (pageCount <= 1) return null

  const hrefFor = (target: number) => {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page' || value === undefined) continue
      if (Array.isArray(value)) value.forEach((v) => qs.append(key, v))
      else qs.set(key, value)
    }
    if (target > 1) qs.set('page', String(target))
    const s = qs.toString()
    return s ? `${basePath}?${s}` : basePath
  }

  // Window the numbers so a long catalogue doesn't produce a wall of links.
  const pages: (number | 'gap')[] = []
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) pages.push(i)
    else if (pages[pages.length - 1] !== 'gap') pages.push('gap')
  }

  return (
    <nav className="mt-16 flex items-center justify-center gap-1.5" aria-label="Pagination">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className="p-2 text-ink-soft hover:text-ink" aria-label="Previous page">
          <ChevronLeft className="size-4" strokeWidth={1.5} />
        </Link>
      )}

      {pages.map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-2 text-ink-soft">
            &hellip;
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`flex size-9 items-center justify-center text-sm transition-colors ${
              p === page ? 'bg-sage-700 text-white' : 'text-ink hover:bg-sage-50'
            }`}
          >
            {p}
          </Link>
        ),
      )}

      {page < pageCount && (
        <Link href={hrefFor(page + 1)} className="p-2 text-ink-soft hover:text-ink" aria-label="Next page">
          <ChevronRight className="size-4" strokeWidth={1.5} />
        </Link>
      )}
    </nav>
  )
}
