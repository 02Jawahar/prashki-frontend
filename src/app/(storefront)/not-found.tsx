import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="container-narrow flex flex-col items-center py-28 text-center">
      <p className="eyebrow text-sage-700">404</p>
      <h1 className="display mt-3 text-[2.2rem] md:text-[2.8rem]">We couldn&rsquo;t find that</h1>
      <div className="rule-dot mt-4" aria-hidden />
      <p className="mt-5 max-w-md text-[0.92rem] text-ink-soft">
        The page you were looking for has moved, or never existed. The collection is still here.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Back to home
        </Link>
        <Link href="/products" className="btn btn-outline">
          Shop all
        </Link>
      </div>
    </div>
  )
}
