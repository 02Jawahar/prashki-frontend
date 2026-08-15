'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Boxes,
  LayoutTemplate,
  ShoppingCart,
  Users,
  Settings,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

/**
 * Sidebar (spec §8). Deliberately five groups — the structure supports adding
 * more without restructuring, but the boilerplate does not ship thirty modules.
 *
 * `permission` only decides whether the link is rendered. The server enforces
 * the same permission on every request behind it.
 */
interface NavEntry {
  label: string
  href: string
  icon: typeof LayoutDashboard
  permission?: string
}

interface NavGroup {
  label?: string
  entries: NavEntry[]
}

const NAV: NavGroup[] = [
  { entries: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard, permission: 'dashboard.read' }] },
  {
    label: 'Catalog',
    entries: [
      { label: 'Products', href: '/admin/products', icon: Package, permission: 'product.read' },
      { label: 'Categories', href: '/admin/categories', icon: FolderTree, permission: 'product.read' },
      { label: 'Inventory', href: '/admin/inventory', icon: Boxes, permission: 'inventory.read' },
    ],
  },
  {
    label: 'Storefront',
    entries: [{ label: 'Content', href: '/admin/content', icon: LayoutTemplate, permission: 'settings.read' }],
  },
  { entries: [{ label: 'Orders', href: '/admin/orders', icon: ShoppingCart, permission: 'order.read' }] },
  { entries: [{ label: 'Customers', href: '/admin/customers', icon: Users, permission: 'customer.read' }] },
  { entries: [{ label: 'Settings', href: '/admin/settings', icon: Settings, permission: 'settings.read' }] },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { can } = useAuth()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const nav = (
    <nav className="flex flex-col gap-6 p-5">
      {NAV.map((group, i) => {
        const visible = group.entries.filter((e) => !e.permission || can(e.permission))
        if (visible.length === 0) return null

        return (
          <div key={i}>
            {group.label && <p className="eyebrow mb-3 px-3 text-ink-soft">{group.label}</p>}
            <ul className="space-y-0.5">
              {visible.map((entry) => (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(entry.href) ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-brand px-3 py-2.5 text-sm transition-colors',
                      isActive(entry.href)
                        ? 'bg-sage-700 text-white'
                        : 'text-ink hover:bg-sage-100',
                    )}
                  >
                    <entry.icon className="size-4 shrink-0" strokeWidth={1.5} />
                    {entry.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        className="fixed left-4 top-4 z-40 rounded-brand border border-rule bg-white p-2 lg:hidden"
      >
        <Menu className="size-4" strokeWidth={1.5} />
      </button>

      <aside className="hidden w-60 shrink-0 border-r border-rule bg-white lg:block">
        <div className="border-b border-rule px-5 py-5">
          <Link href="/admin" className="block">
            <Image
              src="/brand/wordmark-sage.png"
              alt="Prash & Ki"
              width={2120}
              height={363}
              className="h-5 w-auto"
            />
          </Link>
          <p className="eyebrow mt-1.5 text-sage-700">Admin</p>
        </div>
        {nav}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-white">
            <div className="flex items-center justify-between border-b border-rule px-5 py-5">
              <Image
                src="/brand/wordmark-sage.png"
                alt="Prash & Ki"
                width={2120}
                height={363}
                className="h-5 w-auto"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close admin menu">
                <X className="size-5" strokeWidth={1.5} />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  )
}
