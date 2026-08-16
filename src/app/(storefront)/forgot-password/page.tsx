import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/storefront/password-reset-forms'

export const metadata: Metadata = {
  title: 'Forgot your password',
  // Nothing here should be indexed — it is a utility page, not content.
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <div className="container-narrow py-16 md:py-24">
      <header className="text-center">
        <h1 className="display text-[2.2rem] md:text-[2.6rem]">Forgot your password</h1>
        <div className="rule-dot mt-4" aria-hidden />
        <p className="mx-auto mt-4 max-w-sm text-sm text-ink-soft">
          Tell us the address on your account and we will send you a link to set a new password.
        </p>
      </header>

      <div className="mx-auto mt-10 max-w-sm">
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
