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
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            {/* Full lockup here — there is room for the tagline to be legible. */}
            <Image
              src="/brand/logo-sage.png"
              alt={storeName}
              width={2128}
              height={1063}
              className="h-16 w-auto"
            />
            <p className="mt-5 max-w-xs text-[0.85rem] text-ink-soft">
              Hand-finished pieces, cut to order in our studio.
            </p>
          </div>

          <FooterColumn heading="Shop" links={shopLinks.map((l) => ({ href: l.href, label: l.label }))} />

          <FooterColumn
            heading="Account"
            links={[
              { href: '/account', label: 'Your account' },
              { href: '/account/orders', label: 'Orders' },
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
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-rule pt-7 text-[0.75rem] text-ink-soft md:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {storeName}. All rights reserved.
          </p>
          <p className="eyebrow text-[0.6rem] text-sage-700">Made to order</p>
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
