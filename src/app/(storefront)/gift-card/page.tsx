import type { Metadata } from 'next'
import { GiftCardClient } from '@/components/storefront/gift-card-client'

export const metadata: Metadata = {
  title: 'Gift card',
  description: 'Let them choose. Valid for three years, spendable across several orders.',
}

export default function GiftCardPage() {
  return (
    <div className="container-pk py-12 md:py-16">
      <GiftCardClient />
    </div>
  )
}
