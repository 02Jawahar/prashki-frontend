import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/server-auth'
import { CheckoutClient } from '@/components/storefront/checkout-client'

export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } }

/**
 * The purchase gate (spec §21, §35).
 *
 * Browsing and building a bag are open to everyone; completing an order is not.
 * Anonymous visitors are sent to sign in and returned here afterwards. The API
 * enforces the same rule independently — this redirect is for the human.
 */
export default async function CheckoutPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?redirect=/checkout')

  return <CheckoutClient />
}
