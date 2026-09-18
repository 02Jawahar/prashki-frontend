'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  const [hovered, setHovered] = useState(false)

  /**
   * The homepage opens on full-bleed film, so the bar sits over it rather than
   * pushing it down — the reference does the same, and a white strip above the
   * films cuts the one image the page is built around.
   *
   * Only the homepage: every other page starts with a heading on white, where a
   * transparent bar would be invisible text on white.
   */
  const pathname = usePathname()
  /** Whether the bar floats over the page at all. A property of the page. */
  const homeOverlay = pathname === '/'
  /** Whether it is currently see-through. A property of the moment. */
  const overHero = homeOverlay && !scrolled && !hovered && !openGroup

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/*
        On the homepage the whole top block floats over the films; everywhere
        else it sits above the page as usual.
        
        It is fixed on the homepage whether or not it is currently transparent —
        if it moved between fixed and flowed as the colour changed, hovering the
        bar would shove the page down by its own height. Hover changes paint
        only.
      */}
      <div className={homeOverlay ? 'fixed inset-x-0 top-0 z-50' : ''}>
        <div
          className={`py-2 text-center transition-colors duration-300 ${
            overHero ? 'bg-transparent text-white' : 'bg-sage-700 text-white'
          }`}
        >
          <p className="label-caps text-[0.66rem]">
            Complimentary shipping across India &middot; Made to order in 15&ndash;20 days
          </p>
        </div>

      <header
        className={`${homeOverlay ? '' : 'sticky top-0'} z-50 border-b transition-[background-color,color,box-shadow] duration-300 ${
          overHero ? 'border-transparent bg-transparent text-white' : 'bg-white text-ink'
        } ${
          scrolled && !overHero
            ? 'border-hairline shadow-[0_1px_12px_rgba(33,33,33,0.05)]'
            : 'border-transparent'
        }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false)
          setOpenGroup(null)
        }}
      >
        {/*
          A soft wash behind the bar while it is over the film.
          
          Without it the nav is white text on whatever frame happens to be
          there, and two of these reels open on near-white studio walls — the
          links simply vanish. Dark enough to carry the text, shallow enough
          that it reads as shading on the image rather than a band across it.
        */}
        {overHero && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink/45 via-ink/20 to-transparent" />
        )}

        <div className="container-pk relative">
          <div className="flex items-center justify-between gap-4 py-4">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={`lg:hidden transition-colors ${overHero ? 'text-white' : 'text-ink'}`}
              aria-label="Open menu"
            >
              <Menu className="size-5" strokeWidth={1.4} />
            </button>

            {/*
              Search sits beside the hamburger on a phone, the way the
              reference arranges it — the left of the bar is where a thumb
              reaches, and it keeps the right side to the bag.
            */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className={`-ml-1 transition-colors lg:hidden ${overHero ? 'text-white' : 'text-ink'}`}
            >
              <Search className="size-5" strokeWidth={1.4} />
            </button>

            <nav className="hidden lg:order-1 lg:flex lg:flex-1 lg:items-center lg:gap-6 xl:gap-8">
              {nav.map((item) => (
                <div key={item.label} onMouseEnter={() => setOpenGroup(item.label)}>
                  <Link
                    href={item.href}
                    className={`label-caps flex items-center gap-1 whitespace-nowrap py-2 transition-colors ${
                      overHero ? 'text-white hover:text-white/75' : 'text-ink hover:text-sage-700'
                    }`}
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
                className={`h-6 w-auto transition-[filter] duration-300 md:h-7 ${
                  // The wordmark is dark ink on transparent, which vanishes
                  // against a photograph. Inverting is cheaper than shipping a
                  // second file and cannot drift out of sync with the first.
                  overHero ? 'brightness-0 invert' : ''
                }`}
              />
            </Link>

            {/*
              Search keeps its word on wide screens; the rest are icons at
              every width, sitting together as one set. The bag is the one
              people look for by shape rather than by name, and a lone word
              among three glyphs read as a stray link.

              Every one of them carries an aria-label, so "bag" is still what a
              screen reader announces.
            */}
            <div className="flex items-center gap-4 lg:order-3 lg:flex-1 lg:justify-end lg:gap-6">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className={`label-caps hidden items-center gap-1.5 transition-colors lg:flex ${
                  overHero ? 'text-white hover:text-white/75' : 'text-ink hover:text-sage-700'
                }`}
              >
                <Search className="size-4" strokeWidth={1.5} />
                <span>Search</span>
              </button>

              <div className="hidden lg:block">
                <NotificationBell />
              </div>

              {/*
                Saved pieces, shown to everyone. A guest who presses it lands on
                sign-in, which is the ordinary way into an account — hiding it
                until they are signed in means the one feature that gives them a
                reason to make an account is invisible until they have one.
              */}
              <Link
                href={user ? '/account/wishlist' : '/login?next=/account/wishlist'}
                aria-label="Saved pieces"
                className={`hidden transition-colors sm:block ${
                  overHero ? 'text-white hover:text-white/75' : 'text-ink hover:text-sage-700'
                }`}
              >
                <Heart className="size-5" strokeWidth={1.4} />
              </Link>

              <Link
                href={user ? '/account' : '/login'}
                aria-label={user ? 'Your account' : 'Sign in'}
                className={`transition-colors ${
                  overHero ? 'text-white hover:text-white/75' : 'text-ink hover:text-sage-700'
                }`}
              >
                <User className="size-5" strokeWidth={1.4} />
              </Link>

              <button
                type="button"
                onClick={openCart}
                className={`relative transition-colors ${
                  overHero ? 'text-white hover:text-white/75' : 'text-ink hover:text-sage-700'
                }`}
                aria-label={`Bag, ${itemCount} items`}
              >
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
      </div>

      <MobileMenu nav={nav} open={menuOpen} onClose={() => setMenuOpen(false)} signedIn={Boolean(user)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
