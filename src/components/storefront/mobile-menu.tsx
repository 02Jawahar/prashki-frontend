'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { NavItem } from '@/types/api'

/** Mobile navigation drawer — designed for the small screen, not a shrunk desktop. */
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
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />

      <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <span className="eyebrow text-sage-700">Menu</span>
          <button type="button" onClick={onClose} aria-label="Close menu">
            <X className="size-5" strokeWidth={1.4} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-5 py-6">
          {nav.map((item) => (
            <div key={item.label} className="border-b border-hairline py-4 last:border-0">
              <Link href={item.href} onClick={onClose} className="label-caps text-ink">
                {item.label}
              </Link>

              {item.children?.length ? (
                <ul className="mt-3 space-y-2.5 pl-1">
                  {item.children.map((child) => (
                    <li key={child.href}>
                      <Link href={child.href} onClick={onClose} className="text-[0.95rem] text-ink-soft">
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="border-t border-hairline px-5 py-4">
          <Link href={signedIn ? '/account' : '/login'} onClick={onClose} className="label-caps text-ink">
            {signedIn ? 'Your account' : 'Sign in'}
          </Link>
        </div>
      </div>
    </div>
  )
}
