import type { Metadata } from 'next'
import { CustomisationClient } from '@/components/storefront/customisation-client'

export const metadata: Metadata = {
  title: 'Customisation',
  description:
    'Something made for you, or one of ours altered to fit the occasion. Request a consultation with the studio.',
  alternates: { canonical: '/customisation' },
}

export default function CustomisationPage() {
  return (
    <div className="container-pk py-12 md:py-16">
      <CustomisationClient />
    </div>
  )
}
