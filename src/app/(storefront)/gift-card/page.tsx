import type { Metadata } from 'next'
import { serverApiGetOrNull } from '@/services/api-client'
import { GiftCardClient } from '@/components/storefront/gift-card-client'
import type { GiftCardOptions } from '@/services/storefront.service'

/**
 * The title and description follow the copy set in admin rather than sitting
 * here. A store that renames its cards should not be left with the old name in
 * search results and on every link someone shares.
 */
export async function generateMetadata(): Promise<Metadata> {
  // Swallowed rather than thrown: an unreachable API should cost this page its
  // custom title, not the whole render.
  const res = await serverApiGetOrNull<GiftCardOptions>('/gift-cards/options').catch(() => null)
  const options = res?.data ?? null

  return {
    title: options?.heading ?? 'Gift card',
    description:
      options?.intro ?? 'Let them choose. Spendable across several orders until it runs out.',
    alternates: { canonical: '/gift-card' },
  }
}

export default function GiftCardPage() {
  return (
    <div className="container-pk py-12 md:py-16">
      <GiftCardClient />
    </div>
  )
}
