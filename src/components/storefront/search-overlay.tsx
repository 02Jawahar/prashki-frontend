'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { productBrowserService } from '@/services/product.service'
import { formatPrice } from '@/lib/money'
import type { ProductListItem } from '@/types/api'

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<ProductListItem[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setTerm('')
      setResults([])
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Debounced type-ahead — one request per pause, not per keystroke.
  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([])
      return
    }
    const id = setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await productBrowserService.search(term, 6))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(id)
  }, [term])

  if (!open) return null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!term.trim()) return
    onClose()
    router.push(`/search?q=${encodeURIComponent(term.trim())}`)
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />

      <div className="relative bg-white">
        <div className="container-pk py-8">
          <form onSubmit={submit} className="flex items-center gap-4 border-b border-rule pb-4">
            <Search className="size-5 shrink-0 text-ink-soft" strokeWidth={1.4} />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search for a piece, a fabric, a category"
              className="display flex-1 bg-transparent text-xl outline-none placeholder:text-ink-soft/60 md:text-2xl"
              aria-label="Search"
            />
            <button type="button" onClick={onClose} aria-label="Close search">
              <X className="size-5" strokeWidth={1.4} />
            </button>
          </form>

          <div className="min-h-16 pt-6">
            {searching && <p className="text-sm text-ink-soft">Searching&hellip;</p>}

            {!searching && term.trim().length >= 2 && results.length === 0 && (
              <p className="text-sm text-ink-soft">
                Nothing matches &ldquo;{term}&rdquo;. Try a category or a fabric.
              </p>
            )}

            {results.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-6">
                  {results.map((p) => (
                    <Link key={p.id} href={`/products/${p.slug}`} onClick={onClose} className="group">
                      <div className="relative aspect-2/3 overflow-hidden bg-sage-50">
                        {p.image && (
                          <Image
                            src={p.image}
                            alt={p.name}
                            fill
                            sizes="16vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        )}
                      </div>
                      <p className="display mt-2 text-sm leading-tight">{p.name}</p>
                      <p className="text-xs text-ink-soft">{formatPrice(p.price)}</p>
                    </Link>
                  ))}
                </div>

                <Link
                  href={`/search?q=${encodeURIComponent(term)}`}
                  onClick={onClose}
                  className="label-caps link-underline mt-8 inline-block text-sage-700"
                >
                  See all results
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
