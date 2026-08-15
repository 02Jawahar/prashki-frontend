import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/server-auth'
import { AdminLoginForm } from '@/components/admin/admin-login-form'

export const metadata = { title: 'Sign in', robots: { index: false, follow: false } }

/**
 * Sits outside the admin layout on purpose — that layout redirects anonymous
 * visitors here, so rendering the login page inside it would loop.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect: redirectTo } = await searchParams
  const user = await getCurrentUser()

  if (user?.role === 'ADMIN') redirect(safeRedirect(redirectTo))

  return (
    <div className="flex min-h-screen items-center justify-center bg-shell px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/brand/logo-sage.png"
            alt="Prash & Ki"
            width={2128}
            height={1063}
            priority
            className="h-20 w-auto"
          />
          <p className="eyebrow mt-2 text-sage-700">Admin</p>
        </div>

        <div className="border border-rule bg-white p-7">
          <h1 className="display mb-1 text-xl">Sign in</h1>
          <p className="mb-6 text-sm text-ink-soft">Staff access only.</p>
          <AdminLoginForm redirectTo={safeRedirect(redirectTo)} />
        </div>
      </div>
    </div>
  )
}

/** Only ever redirect to a path on this site — never to an attacker's URL. */
function safeRedirect(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/admin'
  return value
}
