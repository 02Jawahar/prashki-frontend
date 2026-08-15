import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/server-auth'

/** Account area — signed-in customers only. The API enforces this too. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?redirect=/account')

  return (
    <div className="container-pk py-12 md:py-16">
      <header className="mb-10 text-center">
        <p className="eyebrow mb-3 text-sage-700">Account</p>
        <h1 className="display text-[2rem] md:text-[2.4rem]">Hello, {user.name.split(' ')[0]}</h1>
        <div className="rule-dot mt-4" aria-hidden />
      </header>

      <nav className="mb-10 flex justify-center gap-6 border-b border-hairline pb-4">
        <Link href="/account" className="label-caps text-ink hover:text-sage-700">
          Overview
        </Link>
        <Link href="/account/orders" className="label-caps text-ink hover:text-sage-700">
          Orders
        </Link>
      </nav>

      {children}
    </div>
  )
}
