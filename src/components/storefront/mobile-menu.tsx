'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import type { NavItem } from '@/types/api'

/**
 * Mobile navigation — a drill-down, not a shrunk desktop menu.
 *
 * Tapping an item that has children slides to a panel of its own, titled with
 * that item and carrying a back arrow. That is how the reference does it, and
 * it is the right shape for a deep menu on a phone: Ready to Wear holds two
 * columns and fourteen links, and indenting all of that inline makes a list
 * people scroll past rather than read.
 *
 * The trail is a stack rather than one "current" value, so back always returns
 * to where you came from however deep you went. Closing the drawer forgets the
 * journey, because reopening three levels down is disorienting.
 */
export function MobileMenu({
  nav,
  open,
  onClose,
  signedIn,
}: {
  nav: NavItem[]
  open: boolean
  onClose: () => void
  signedIn: boolean
}) {
  const [trail, setTrail] = useState<NavItem[]>([])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) setTrail([])
  }, [open])

  if (!open) return null

  const current = trail[trail.length - 1] ?? null
  const items = current ? (current.children ?? []) : nav

  function leave() {
    setTrail([])
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />

      <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white">
        <div className="px-5 py-4">
          <button type="button" onClick={onClose} aria-label="Close menu">
            <X className="size-5" strokeWidth={1.4} />
          </button>
        </div>

        {current && (
          <div className="flex items-center gap-4 px-5 pb-5">
            <button
              type="button"
              onClick={() => setTrail((t) => t.slice(0, -1))}
              aria-label={`Back to ${trail.length > 1 ? trail[trail.length - 2]!.label : 'the menu'}`}
              className="shrink-0"
            >
              <ArrowLeft className="size-5" strokeWidth={1.5} />
            </button>
            <h2 className="flex-1 text-center text-[1.05rem] tracking-[0.04em]">{current.label}</h2>
            {/* Balances the arrow so the title sits centred, as in the reference. */}
            <span className="size-5 shrink-0" aria-hidden />
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-5 pb-8">
          <ul>
            {items.map((item, index) => (
              <li key={`${item.label}-${index}`}>
                {item.children?.length ? (
                  <button
                    type="button"
                    onClick={() => setTrail((t) => [...t, item])}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left text-[1.05rem] tracking-[0.02em] text-ink"
                  >
                    {item.label}
                    <ArrowRight className="size-4 shrink-0" strokeWidth={1.5} />
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    onClick={leave}
                    className="block py-4 text-[1.05rem] tracking-[0.02em] text-ink"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {/*
            The panel's own landing page, offered after its contents. A heading
            that is also a destination becomes unreachable once tapping it
            drills in instead — this is how you still get to it.
          */}
          {current && (
            <Link
              href={current.href}
              onClick={leave}
              className="label-caps link-underline mt-2 inline-block py-2 text-xs text-sage-700"
            >
              View all {current.label.toLowerCase()}
            </Link>
          )}
        </nav>

        <div className="border-t border-hairline px-5 py-4">
          <Link href={signedIn ? '/account' : '/login'} onClick={leave} className="label-caps text-ink">
            {signedIn ? 'Your account' : 'Sign in'}
          </Link>
        </div>
      </div>
    </div>
  )
}
