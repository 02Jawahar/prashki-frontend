'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ExternalLink, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export function AdminHeader() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onLogout() {
    setBusy(true)
    await logout()
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-end gap-4 border-b border-rule bg-white px-5 py-3.5 lg:px-8">
      <Link
        href="/"
        target="_blank"
        className="label-caps flex items-center gap-1.5 text-ink-soft hover:text-ink"
      >
        View store
        <ExternalLink className="size-3" strokeWidth={1.5} />
      </Link>

      <div className="hidden text-right sm:block">
        <p className="text-sm leading-tight">{user?.name}</p>
        <p className="text-xs text-ink-soft">{user?.email}</p>
      </div>

      <button
        type="button"
        onClick={() => void onLogout()}
        disabled={busy}
        className="label-caps flex items-center gap-1.5 text-ink-soft hover:text-ink disabled:opacity-50"
      >
        <LogOut className="size-3.5" strokeWidth={1.5} />
        Sign out
      </button>
    </header>
  )
}
