import Link from 'next/link'
import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/storefront/password-reset-forms'
import { Alert } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <div className="container-narrow py-16 md:py-24">
      <header className="text-center">
        <h1 className="display text-[2.2rem] md:text-[2.6rem]">Set a new password</h1>
        <div className="rule-dot mt-4" aria-hidden />
      </header>

      <div className="mx-auto mt-10 max-w-sm">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4 text-sm">
            <Alert>That reset link is incomplete or has expired.</Alert>
            <p className="text-ink-soft">
              <Link href="/forgot-password" className="link-underline text-ink">
                Ask for a new one
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
