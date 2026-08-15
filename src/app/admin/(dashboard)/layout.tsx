import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/server-auth'
import { AuthProvider } from '@/hooks/use-auth'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminHeader } from '@/components/admin/admin-header'

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Admin' },
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  // Redirecting here is a routing convenience, not the security boundary —
  // every admin API call is independently authenticated and authorised.
  if (!user) redirect('/admin/login?redirect=/admin')
  if (user.role !== 'ADMIN') redirect('/')

  return (
    <AuthProvider initialUser={user}>
      <div className="flex min-h-screen bg-shell">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader />
          <main className="flex-1 px-5 py-7 lg:px-8">{children}</main>
        </div>
      </div>
    </AuthProvider>
  )
}
