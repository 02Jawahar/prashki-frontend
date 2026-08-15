import Link from 'next/link'
import type { Metadata } from 'next'
import { XCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Payment failed', robots: { index: false, follow: false } }

export default async function CheckoutFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; reason?: string }>
}) {
  const { order, reason } = await searchParams

  return (
    <div className="container-narrow py-20 text-center md:py-28">
      <XCircle className="mx-auto size-12 text-danger" strokeWidth={1.2} />

      <p className="eyebrow mt-6 text-danger">Payment not completed</p>
      <h1 className="display mt-3 text-[2.2rem] md:text-[2.8rem]">Something went wrong</h1>
      <div className="rule-dot mt-4" aria-hidden />

      <p className="mx-auto mt-5 max-w-md text-[0.95rem] text-ink-soft">
        {reason ?? 'Your payment did not go through. Nothing has been charged.'}
        {order && (
          <>
            {' '}
            Order <span className="text-ink">{order}</span> is still awaiting payment — you can
            retry from your orders.
          </>
        )}
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link href="/account/orders" className="btn btn-primary">
          View your orders
        </Link>
        <Link href="/cart" className="btn btn-outline">
          Back to bag
        </Link>
      </div>
    </div>
  )
}
