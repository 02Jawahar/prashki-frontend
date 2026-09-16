import Image from 'next/image'
import Link from 'next/link'
import { NewsletterForm } from './newsletter-form'
import type { NavItem, StoreSettings } from '@/types/api'

export function SiteFooter({ nav, settings }: { nav: NavItem[]; settings: StoreSettings }) {
  const storeName = settings['store.name'] ?? 'Prash & Ki'
  const email = settings['store.email']
  const phone = settings['store.phone']

  // Flatten the seeded navigation into a shop column rather than duplicating it.
  const shopLinks = (nav.find((n) => n.children?.length)?.children ?? nav).slice(0, 6)

  return (
    <footer className="mt-24 bg-shell">
      <div className="border-b border-rule">
        <div className="container-pk py-16 text-center">
          <p className="eyebrow mb-3 text-sage-700">Stay in touch</p>
          <h2 className="display text-[1.8rem] md:text-[2.2rem]">Subscribe to our newsletter</h2>
          <div className="rule-dot mt-4" aria-hidden />
          <p className="mx-auto mt-4 max-w-md text-[0.9rem] text-ink-soft">
            Early access to new collections and studio notes.
          </p>
          <div className="mt-7">
            <NewsletterForm />
          </div>
        </div>
      </div>

      <div className="container-pk py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <FooterColumn heading="Shop" links={shopLinks.map((l) => ({ href: l.href, label: l.label }))} />

          <FooterColumn
            heading="Account"
            links={[
              { href: '/account', label: 'Your account' },
              { href: '/account/orders', label: 'Orders' },
              { href: '/account/returns', label: 'Returns' },
              { href: '/account/wishlist', label: 'Wishlist' },
              { href: '/cart', label: 'Bag' },
            ]}
          />

          <div>
            <p className="eyebrow mb-4 text-ink">Customer care</p>
            <ul className="space-y-2.5 text-[0.85rem] text-ink-soft">
              {email && (
                <li>
                  <a href={`mailto:${email}`} className="link-underline hover:text-ink">
                    {email}
                  </a>
                </li>
              )}
              {phone && <li>{phone}</li>}
              <li>Monday to Saturday, 10am – 6pm IST</li>
            </ul>

            {/* CMS pages, seeded and editable from admin. */}
            <ul className="mt-6 space-y-2.5">
              {[
                { href: '/about', label: 'About us' },
                { href: '/contact', label: 'Contact' },
                { href: '/shipping-policy', label: 'Shipping' },
                { href: '/returns-policy', label: 'Returns policy' },
                { href: '/terms', label: 'Terms & conditions' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="link-underline text-[0.85rem] text-ink-soft hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/*
          The mark, centred and large, after the links rather than beside them —
          the reference closes its footer this way and it reads as a signature on
          the page rather than as a fourth column of navigation.

          Not a link. It sits directly above the copyright line, where nobody is
          looking for a way home, and the header already carries a clickable one.
        */}
        <div className="mt-16 flex flex-col items-center text-center md:mt-20">
          <Image
            src="/brand/logo-sage.png"
            alt={storeName}
            width={2128}
            height={1063}
            className="h-24 w-auto md:h-32"
          />
          <p className="mt-5 max-w-xs text-[0.85rem] text-ink-soft">
            Hand-finished pieces, cut to order in our studio.
          </p>
        </div>

        {/*
          One centred line under the mark, the way the reference closes. The
          policy links sit beneath it rather than opposite it: a row with the
          copyright pushed to one edge and links to the other leaves a gap in
          the middle that reads as something failed to load.
        */}
        <div className="mt-10 flex flex-col items-center gap-3 border-t border-rule pt-7 text-center text-[0.75rem] text-ink-soft">
          <p>
            &copy; {new Date().getFullYear()} {storeName}. All rights reserved.
          </p>

          <ul className="flex gap-5">
            {[
              { href: '/privacy-policy', label: 'Privacy' },
              { href: '/terms', label: 'Terms' },
            ].map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="link-underline hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string
  links: { href: string; label: string }[]
}) {
  return (
    <div>
      <p className="eyebrow mb-4 text-ink">{heading}</p>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link href={link.href} className="link-underline text-[0.85rem] text-ink-soft hover:text-ink">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
