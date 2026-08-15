import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { getCurrentUser } from '@/lib/server-auth'

export const metadata: Metadata = { title: 'Order confirmed', robots: { index: false, follow: false } }

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { order } = await searchParams

  return (
    <div className="container-narrow py-20 text-center md:py-28">
      <CheckCircle2 className="mx-auto size-12 text-sage-600" strokeWidth={1.2} />

      <p className="eyebrow mt-6 text-sage-700">Order placed</p>
      <h1 className="display mt-3 text-[2.2rem] md:text-[2.8rem]">Thank you</h1>
      <div className="rule-dot mt-4" aria-hidden />

      <p className="mx-auto mt-5 max-w-md text-[0.95rem] text-ink-soft">
        {order ? (
          <>
            Your order <span className="text-ink">{order}</span> has been received. We&rsquo;ve
            reserved your pieces and will confirm as soon as payment completes.
          </>
        ) : (
          'Your order has been received.'
        )}
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link href="/account/orders" className="btn btn-primary">
          View your orders
        </Link>
        <Link href="/products" className="btn btn-outline">
          Continue shopping
        </Link>
      </div>
    </div>
  )
}
