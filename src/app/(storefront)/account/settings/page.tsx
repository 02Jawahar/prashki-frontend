'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { authService } from '@/services/auth.service'
import { notificationService } from '@/services/storefront.service'
import { ApiRequestError } from '@/services/api-client'
import { DataRights } from '@/components/storefront/data-rights'
import { Alert, Button, Field, Input, SkeletonRows } from '@/components/ui'

/**
 * Account settings: profile, password and what we are allowed to send.
 *
 * Email is shown but not editable — changing the address that identifies an
 * account needs a verification round-trip, which the API deliberately does not
 * accept through a profile PATCH.
 */

/** Only opt-out-able messages appear here; receipts are not negotiable. */
const OPTIONAL_MESSAGES = [
  { type: 'marketing.newsletter', label: 'New collections and studio news' },
  { type: 'marketing.offers', label: 'Offers and discount codes' },
  { type: 'product.back_in_stock', label: 'When something on my wishlist is back' },
] as const

const CHANNELS = [
  { channel: 'EMAIL', label: 'Email' },
  { channel: 'WHATSAPP', label: 'WhatsApp' },
] as const

export default function AccountSettingsPage() {
  const { user, refresh } = useAuth()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null)

  useEffect(() => {
    setName(user?.name ?? '')
    setPhone(user?.phone ?? '')
  }, [user?.name, user?.phone])

  useEffect(() => {
    void notificationService
      .preferences()
      .then((rows) => {
        // A missing row means "never said" — and the default is yes.
        setPrefs(Object.fromEntries(rows.map((r) => [`${r.channel}:${r.type}`, r.enabled])))
      })
      .catch(() => undefined)
      .finally(() => setPrefsLoading(false))
  }, [])

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    if (profileSaving) return

    setProfileSaving(true)
    setProfileError(null)
    setProfileMessage(null)

    try {
      await authService.updateProfile({ name, phone })
      await refresh()
      setProfileMessage('Saved.')
    } catch (err) {
      setProfileError(err instanceof ApiRequestError ? err.message : 'Could not save your details')
    } finally {
      setProfileSaving(false)
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault()
    if (passwordSaving) return

    setPasswordSaving(true)
    setPasswordError(null)
    setPasswordMessage(null)

    try {
      await authService.changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      // The API revokes every session on a password change, including this one.
      setPasswordMessage('Password changed. You will need to sign in again.')
    } catch (err) {
      setPasswordError(err instanceof ApiRequestError ? err.message : 'Could not change your password')
    } finally {
      setPasswordSaving(false)
    }
  }

  async function savePrefs() {
    if (prefsSaving) return

    setPrefsSaving(true)
    setPrefsMessage(null)

    const payload = CHANNELS.flatMap(({ channel }) =>
      OPTIONAL_MESSAGES.map(({ type }) => ({
        channel,
        type,
        enabled: prefs[`${channel}:${type}`] ?? true,
      })),
    )

    try {
      await notificationService.savePreferences(payload)
      setPrefsMessage('Saved.')
    } catch {
      setPrefsMessage('Could not save your preferences.')
    } finally {
      setPrefsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-12">
      <section>
        <h2 className="label-caps mb-4">Your details</h2>

        <form onSubmit={saveProfile} className="space-y-4 border border-rule p-6" noValidate>
          {profileError && <Alert>{profileError}</Alert>}
          {profileMessage && <Alert tone="success">{profileMessage}</Alert>}

          <Field label="Name" htmlFor="name" required>
            <Input
              id="name"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field
            label="Phone"
            htmlFor="phone"
            hint="Used for delivery updates. Leave empty to remove it."
          >
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>

          <Field label="Email" htmlFor="email" hint="Write to us if you need this changed.">
            <Input id="email" type="email" value={user?.email ?? ''} disabled readOnly />
          </Field>

          <Button type="submit" loading={profileSaving}>
            Save details
          </Button>
        </form>
      </section>

      <section>
        <h2 className="label-caps mb-4">Password</h2>

        <form onSubmit={savePassword} className="space-y-4 border border-rule p-6" noValidate>
          {passwordError && <Alert>{passwordError}</Alert>}
          {passwordMessage && <Alert tone="success">{passwordMessage}</Alert>}

          <Field label="Current password" htmlFor="current" required>
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>

          <Field label="New password" htmlFor="new" required hint="At least 8 characters.">
            <Input
              id="new"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>

          <Button type="submit" loading={passwordSaving}>
            Change password
          </Button>
        </form>
      </section>

      <section>
        <h2 className="label-caps mb-4">What we send you</h2>

        {prefsLoading ? (
          <SkeletonRows rows={3} />
        ) : (
          <div className="border border-rule p-6">
            <p className="mb-5 text-sm text-ink-soft">
              Order confirmations, delivery updates and anything else about a purchase are always
              sent — they are part of the order, not marketing.
            </p>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left">
                  <th className="pb-2 font-normal text-ink-soft">Message</th>
                  {CHANNELS.map(({ channel, label }) => (
                    <th key={channel} className="pb-2 text-center font-normal text-ink-soft">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {OPTIONAL_MESSAGES.map(({ type, label }) => (
                  <tr key={type} className="border-b border-hairline last:border-0">
                    <td className="py-3">{label}</td>
                    {CHANNELS.map(({ channel }) => {
                      const key = `${channel}:${type}`
                      return (
                        <td key={channel} className="py-3 text-center">
                          <input
                            type="checkbox"
                            className="size-4 accent-sage-700"
                            aria-label={`${label} by ${channel.toLowerCase()}`}
                            checked={prefs[key] ?? true}
                            onChange={(event) =>
                              setPrefs((current) => ({ ...current, [key]: event.target.checked }))
                            }
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5 flex items-center gap-3">
              <Button type="button" onClick={() => void savePrefs()} loading={prefsSaving}>
                Save preferences
              </Button>
              {prefsMessage && <span className="text-sm text-ink-soft">{prefsMessage}</span>}
            </div>
          </div>
        )}
      </section>

      <DataRights />
    </div>
  )
}
