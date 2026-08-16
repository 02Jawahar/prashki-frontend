import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/server-auth'
import { AuthForm } from '@/components/storefront/auth-form'
import { safeRedirect } from '@/lib/safe-redirect'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({
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
        <h1 className="display text-[2.2rem] md:text-[2.6rem]">Sign in</h1>
        <div className="rule-dot mt-4" aria-hidden />
      </header>

      <div className="mx-auto mt-10 max-w-sm">
        <AuthForm mode="login" redirectTo={target} />

        <p className="mt-4 text-center text-sm text-ink-soft">
          <Link href="/forgot-password" className="link-underline text-ink">
            Forgot your password?
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-ink-soft">
          New here?{' '}
          <Link
            href={`/register${to ? `?redirect=${encodeURIComponent(target)}` : ''}`}
            className="link-underline text-ink"
          >
            Create an account
          </Link>
        </p>

        <p className="mt-8 border border-sage-200 bg-sage-50 p-4 text-xs leading-relaxed text-ink-soft">
          Demo account seeded for local development:
          <br />
          <span className="text-ink">customer@example.com</span> /{' '}
          <span className="text-ink">Customer@12345</span>
        </p>
      </div>
    </div>
  )
}
