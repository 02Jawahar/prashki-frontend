'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { notificationService, type Notification } from '@/services/storefront.service'
import { formatDate } from '@/lib/utils'

/**
 * The notification bell (M16).
 *
 * Rendered only for signed-in customers — there is nothing to show a guest, and
 * an always-present bell that is always empty is worse than no bell.
 *
 * The list is fetched when the panel opens rather than polled: order updates
 * are not a live feed, and a background poll on every page would cost more than
 * the freshness is worth.
 */
export function NotificationBell() {
  const { user } = useAuth()

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // The badge is cheap, so it loads with the header.
  useEffect(() => {
    if (!user) {
      setUnread(0)
      return
    }
    void notificationService
      .list({ unreadOnly: true, page: 1 })
      .then((result) => setUnread(result.unread))
      .catch(() => undefined)
  }, [user])

  useEffect(() => {
    if (!open) return

    setLoading(true)
    void notificationService
      .list()
      .then((result) => {
        setItems(result.notifications)
        setUnread(result.unread)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))

    const onClickAway = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onClickAway)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickAway)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })))
    setUnread(0)
    await notificationService.markAllRead().catch(() => undefined)
  }

  if (!user) return null

  return (
    <div className="relative hidden sm:block" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative block"
      >
        <Bell className="size-5" strokeWidth={1.4} />
        {unread > 0 && (
          <span className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-sage-700 text-[0.6rem] font-medium text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 border border-rule bg-paper shadow-lg">
          <header className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <p className="label-caps">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-sage-700 underline"
              >
                Mark all read
              </button>
            )}
          </header>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-ink-soft">Loading&hellip;</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-soft">Nothing yet.</p>
            ) : (
              <ul>
                {items.map((item) => {
                  const body = (
                    <>
                      <p className="text-sm leading-snug">{item.title}</p>
                      {item.body && <p className="mt-0.5 text-xs text-ink-soft">{item.body}</p>}
                      <p className="mt-1 text-[0.68rem] text-ink-soft">{formatDate(item.createdAt)}</p>
                    </>
                  )

                  return (
                    <li
                      key={item.id}
                      className={`border-b border-hairline last:border-0 ${item.readAt ? '' : 'bg-sage-50'}`}
                    >
                      {item.link ? (
                        <Link
                          href={item.link}
                          onClick={() => {
                            setOpen(false)
                            if (!item.readAt) void notificationService.markRead(item.id).catch(() => undefined)
                          }}
                          className="block px-4 py-3 hover:bg-sage-50"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="px-4 py-3">{body}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
