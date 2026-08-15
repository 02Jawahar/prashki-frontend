'use client'

import { useEffect, useState } from 'react'
import { adminService } from '@/services/admin.service'
import { Alert, Button, Field, Input, SkeletonRows } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'

interface Setting {
  id: string
  key: string
  value: string
  type: string
  group: string
  label: string
}

/** Settings (spec §37) — none of these values are hard-coded in the frontend. */
export default function AdminSettingsPage() {
  const { can } = useAuth()
  const [settings, setSettings] = useState<Setting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const rows = await adminService.settings()
        setSettings(rows)
        setValues(Object.fromEntries(rows.map((s) => [s.key, s.value])))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const changed = settings
        .filter((s) => values[s.key] !== s.value)
        .map((s) => ({ key: s.key, value: values[s.key] ?? s.value }))

      if (changed.length > 0) {
        await adminService.updateSettings(changed)
        setSettings((prev) => prev.map((s) => ({ ...s, value: values[s.key] ?? s.value })))
      }
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SkeletonRows rows={6} />

  // JSON blobs (navigation, homepage layout) are edited elsewhere, not here.
  const editable = settings.filter((s) => s.type !== 'JSON')
  const groups = [...new Set(editable.map((s) => s.group))]
  const readOnly = !can('settings.update')

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="display text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Store-wide values used by the storefront and at checkout.
        </p>
      </header>

      {error && <Alert>{error}</Alert>}
      {saved && (
        <div className="mb-5">
          <Alert tone="success">Settings saved.</Alert>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {groups.map((group) => (
          <section key={group} className="border border-rule bg-white p-6">
            <h2 className="label-caps mb-5">{group}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {editable
                .filter((s) => s.group === group)
                .map((s) => (
                  <Field
                    key={s.key}
                    label={s.label}
                    htmlFor={s.key}
                    hint={s.key.includes('fee') || s.key.includes('threshold') ? 'In paise' : undefined}
                  >
                    <Input
                      id={s.key}
                      type={s.type === 'NUMBER' ? 'number' : 'text'}
                      value={values[s.key] ?? ''}
                      disabled={readOnly}
                      onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                    />
                  </Field>
                ))}
            </div>
          </section>
        ))}

        {!readOnly && (
          <Button type="submit" loading={saving}>
            Save settings
          </Button>
        )}
      </form>
    </div>
  )
}
