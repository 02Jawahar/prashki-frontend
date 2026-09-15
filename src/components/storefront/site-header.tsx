'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Heart, Menu, Search, ShoppingBag, User, X, ChevronDown } from 'lucide-react'
import { SearchOverlay } from './search-overlay'
import { MobileMenu } from './mobile-menu'
import { NotificationBell } from './notification-bell'
import { useAuth } from '@/hooks/use-auth'
import { useCart } from '@/hooks/use-cart'
import type { NavItem } from '@/types/api'

/**
 * Premium fashion header (spec §17): centred wordmark, horizontal navigation
 * with hover dropdowns on desktop, drawer on mobile.
 *
 * Navigation comes from the `nav.main` setting rather than being hard-coded, so
 * an admin-managed menu can replace the seed data without touching this file.
 */
/**
 * The panel that drops under a top-level item.
 *
 * Children that have children of their own become named columns — "Featured",
 * "Women's" — with the heading itself a link to that landing page. Children
 * without any become a single unheaded column, which is what a short menu
 * wants.
 *
 * A column's own children may go one level deeper again: "Women's" holds the
 * four ranges, and each range holds its garment types. That fourth level is
 * where the menu stops, for a reason that is visual rather than technical — a
 * column deep enough to need a fifth is taller than the panel it sits in.
 *
 * Columns are laid out on a fixed 4-track grid rather than `auto-fit`, so two
 * columns sit at the left edge under the navigation that opened them instead
 * of stretching across the full width away from the cursor.
 *
 * Keys are label-and-position, not href. Two columns legitimately point at the
 * same landing page — "Featured" and "Women's" both open /products — so href
 * collides, and React silently drops one of the duplicates.
 */
function MenuLink({
  node,
  onNavigate,
  className = 'link-underline text-[0.9rem] text-ink hover:text-sage-700',
}: {
  node: NavItem
  onNavigate: () => void
  className?: string
}) {
  return (
    <Link href={node.href} onClick={onNavigate} className={className}>
      {node.label}
    </Link>
  )
}

function MegaMenu({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const children = item.children ?? []
  const columns = children.filter((child) => child.children?.length)
  const loose = children.filter((child) => !child.children?.length)

  return (
    <div className="container-pk grid grid-cols-4 gap-10 py-9">
      {loose.length > 0 && (
        <div className={columns.length > 0 ? '' : 'col-span-2'}>
          <p className="eyebrow mb-4 text-ink-soft">{item.label}</p>
          <ul className={`grid gap-x-8 gap-y-2.5 ${columns.length > 0 ? '' : 'grid-cols-2'}`}>
            {loose.map((child, index) => (
              <li key={`${child.label}-${index}`}>
                <MenuLink node={child} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {columns.map((column, index) => (
        <div key={`${column.label}-${index}`}>
          <MenuLink
            node={column}
            onNavigate={onNavigate}
            className="eyebrow link-underline mb-4 block text-ink"
          />

          <ul className="space-y-2.5">
            {(column.children ?? []).map((child, childIndex) => (
              <li key={`${child.label}-${childIndex}`}>
                {child.children?.length ? (
                  /*
                   * A range inside a column — "Casual" with its garment types
                   * beneath. The range name is set in the body colour and its
                   * types in the softer one, so the eye can tell a heading from
                   * a destination without an indent doing all the work.
                   */
                  <>
                    <MenuLink
                      node={child}
                      onNavigate={onNavigate}
                      className="link-underline mb-1.5 block text-[0.9rem] font-medium text-ink"
                    />
                    <ul className="mb-3 space-y-1.5 border-l border-hairline pl-3">
                      {child.children.map((grandchild, grandchildIndex) => (
                        <li key={`${grandchild.label}-${grandchildIndex}`}>
                          <MenuLink
                            node={grandchild}
                            onNavigate={onNavigate}
                            className="link-underline text-[0.85rem] text-ink-soft hover:text-sage-700"
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <MenuLink node={child} onNavigate={onNavigate} />
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function SiteHeader({ nav, storeName }: { nav: NavItem[]; storeName: string }) {
  const { user } = useAuth()
  const { itemCount, openCart } = useCart()
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <div className="bg-sage-700 py-2 text-center text-white">
        <p className="label-caps text-[0.66rem]">
          Complimentary shipping across India &middot; Made to order in 15&ndash;20 days
        </p>
      </div>

      <header
        className={`sticky top-0 z-50 border-b bg-white transition-shadow ${
          scrolled ? 'border-hairline shadow-[0_1px_12px_rgba(33,33,33,0.05)]' : 'border-transparent'
        }`}
        onMouseLeave={() => setOpenGroup(null)}
      >
        <div className="container-pk">
          <div className="flex items-center justify-between gap-4 py-4">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" strokeWidth={1.4} />
            </button>

            <nav className="hidden lg:order-1 lg:flex lg:flex-1 lg:items-center lg:gap-6 xl:gap-8">
              {nav.map((item) => (
                <div key={item.label} onMouseEnter={() => setOpenGroup(item.label)}>
                  <Link
                    href={item.href}
                    className="label-caps flex items-center gap-1 whitespace-nowrap py-2 text-ink transition-colors hover:text-sage-700"
                  >
                    {item.label}
                    {item.children?.length ? <ChevronDown className="size-3" strokeWidth={1.6} /> : null}
                  </Link>
                </div>
              ))}
            </nav>

            {/*
              The wordmark, not the full lockup: at header height the lockup's
              tagline renders as an illegible smudge. The full lockup lives in
              the footer, where there is vertical room for it.
            */}
            <Link href="/" className="shrink-0 lg:order-2" aria-label={`${storeName} — home`}>
              <Image
                src="/brand/wordmark-sage.png"
                alt={storeName}
                width={2120}
                height={363}
                priority
                className="h-6 w-auto md:h-7"
              />
            </Link>

            <div className="flex items-center gap-4 lg:order-3 lg:flex-1 lg:justify-end lg:gap-5">
              <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search">
                <Search className="size-5" strokeWidth={1.4} />
              </button>

              <NotificationBell />

              {/*
                Saved pieces. Shown only when signed in, because the wishlist
                lives on the account — offering it to a guest leads to a login
                wall reached by pressing a heart, which reads as being refused
                rather than being asked to sign in.
              */}
              {user && (
                <Link href="/account/wishlist" aria-label="Saved pieces" className="hidden sm:block">
                  <Heart className="size-5" strokeWidth={1.4} />
                </Link>
              )}

              <Link
                href={user ? '/account' : '/login'}
                aria-label={user ? 'Your account' : 'Sign in'}
                className="hidden sm:block"
              >
                <User className="size-5" strokeWidth={1.4} />
              </Link>

              <button type="button" onClick={openCart} className="relative" aria-label={`Bag, ${itemCount} items`}>
                <ShoppingBag className="size-5" strokeWidth={1.4} />
                {itemCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-sage-700 text-[0.6rem] font-medium text-white">
                    {itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mega menu */}
        {nav.map((item) =>
          item.children?.length && openGroup === item.label ? (
            <div
              key={item.label}
              className="absolute inset-x-0 top-full hidden border-t border-hairline bg-white lg:block"
              onMouseEnter={() => setOpenGroup(item.label)}
            >
              <MegaMenu item={item} onNavigate={() => setOpenGroup(null)} />
            </div>
          ) : null,
        )}
      </header>

      <MobileMenu nav={nav} open={menuOpen} onClose={() => setMenuOpen(false)} signedIn={Boolean(user)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
