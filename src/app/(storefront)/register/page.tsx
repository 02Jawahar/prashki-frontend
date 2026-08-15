import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/server-auth'
import { AuthForm } from '@/components/storefront/auth-form'
import { safeRedirect } from '@/lib/safe-redirect'

export const metadata: Metadata = { title: 'Create an account' }

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect: to } = await searchParams
  const target = safeRedirect(to)

  const user = await getCurrentUser()
  if (user) redirect(target)

  return (
    <div className="container-narrow py-16 md:py-24">
      <header className="text-center">
        <h1 className="display text-[2.2rem] md:text-[2.6rem]">Create an account</h1>
        <div className="rule-dot mt-4" aria-hidden />
        <p className="mt-4 text-sm text-ink-soft">
          To track your orders and check out faster next time.
        </p>
      </header>

      <div className="mx-auto mt-10 max-w-sm">
        <AuthForm mode="register" redirectTo={target} />

        <p className="mt-6 text-center text-sm text-ink-soft">
          Already have an account?{' '}
          <Link
            href={`/login${to ? `?redirect=${encodeURIComponent(target)}` : ''}`}
            className="link-underline text-ink"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
