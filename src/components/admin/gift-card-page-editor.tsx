'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { giftCardAdminService, type GiftCardPageConfig } from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { formatPrice } from '@/lib/money'
import { Alert, Button, Field, Input, Textarea } from '@/components/ui'

/**
 * The storefront gift card page, edited here (M13, M25).
 *
 * Amounts are entered in rupees and stored in paise, like every other price in
 * the admin. They are not merely what the page displays — the server refuses
 * any amount not on this list or inside the custom band, so removing an amount
 * here stops it being buyable rather than only hiding the button.
 */
export function GiftCardPageEditor({ canEdit }: { canEdit: boolean }) {
  const [config, setConfig] = useState<GiftCardPageConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /** Rupee strings, because a half-typed number is not a number yet. */
  const [amounts, setAmounts] = useState<string[]>([])

  useEffect(() => {
    void giftCardAdminService
      .config()
      .then((c) => {
        setConfig(c)
        setAmounts(c.denominations.map((p) => String(p / 100)))
      })
      .catch(() => setError('Could not load the page settings.'))
      .finally(() => setLoading(false))
  }, [])

  function patch(changes: Partial<GiftCardPageConfig>) {
    setConfig((c) => (c ? { ...c, ...changes } : c))
    setNotice(null)
  }

  async function save() {
    if (!config || saving) return

    const denominations = amounts
      .map((a) => Math.round(Number(a) * 100))
      .filter((p) => Number.isFinite(p) && p > 0)

    if (denominations.length === 0) {
      setError('Offer at least one amount.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const saved = await giftCardAdminService.saveConfig({
        ...config,
        denominations,
        terms: config.terms.map((t) => t.trim()).filter(Boolean),
      })
      setConfig(saved)
      setAmounts(saved.denominations.map((p) => String(p / 100)))
      setNotice('Saved. The gift card page is updated.')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save that.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-ink-soft">Loading page settings…</p>
  if (!config) return <Alert>{error ?? 'Could not load the page settings.'}</Alert>

  return (
    <div className="space-y-8">
      {error && <Alert>{error}</Alert>}
      {notice && <p className="text-sm text-sage-700">{notice}</p>}

      <section>
        <p className="label-caps mb-1">Amounts offered</p>
        <p className="mb-4 text-xs text-ink-soft">
          In rupees. These are the buttons on the page, and the only fixed amounts the server will
          accept. Removing one stops it being sold.
        </p>

        <div className="space-y-2">
          {amounts.map((value, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                step={1}
                value={value}
                disabled={!canEdit}
                onChange={(e) =>
                  setAmounts((a) => a.map((v, i) => (i === index ? e.target.value : v)))
                }
                className="max-w-40"
              />
              <span className="text-xs text-ink-soft">
                {Number(value) > 0 ? formatPrice(Math.round(Number(value) * 100)) : '—'}
              </span>
              {canEdit && amounts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setAmounts((a) => a.filter((_, i) => i !== index))}
                  aria-label="Remove this amount"
                  className="text-ink-soft hover:text-danger"
                >
                  <X className="size-4" strokeWidth={1.6} />
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && amounts.length < 8 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setAmounts((a) => [...a, ''])}
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Add an amount
          </Button>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Smallest custom amount (₹)" htmlFor="gc-min">
          <Input
            id="gc-min"
            type="number"
            min={1}
            step={1}
            disabled={!canEdit}
            value={config.custom.min / 100}
            onChange={(e) =>
              patch({ custom: { ...config.custom, min: Math.round(Number(e.target.value) * 100) } })
            }
          />
        </Field>

        <Field label="Largest custom amount (₹)" htmlFor="gc-max">
          <Input
            id="gc-max"
            type="number"
            min={1}
            step={1}
            disabled={!canEdit}
            value={config.custom.max / 100}
            onChange={(e) =>
              patch({ custom: { ...config.custom, max: Math.round(Number(e.target.value) * 100) } })
            }
          />
        </Field>
      </section>

      <section className="max-w-xs">
        <Field
          label="Valid for (years)"
          htmlFor="gc-years"
          hint="Applies to cards issued from now on. Cards already sold keep the expiry they were sold with."
        >
          <Input
            id="gc-years"
            type="number"
            min={1}
            max={10}
            step={1}
            disabled={!canEdit}
            value={config.validForYears}
            onChange={(e) => patch({ validForYears: Number(e.target.value) })}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <Field label="Page heading" htmlFor="gc-heading">
          <Input
            id="gc-heading"
            maxLength={80}
            disabled={!canEdit}
            value={config.heading}
            onChange={(e) => patch({ heading: e.target.value })}
          />
        </Field>

        <Field label="Introduction" htmlFor="gc-intro" hint="The paragraph under the heading.">
          <Textarea
            id="gc-intro"
            rows={3}
            maxLength={600}
            disabled={!canEdit}
            value={config.intro}
            onChange={(e) => patch({ intro: e.target.value })}
          />
        </Field>
      </section>

      <section>
        <p className="label-caps mb-1">Good to know</p>
        <p className="mb-4 text-xs text-ink-soft">
          Shown as a list at the bottom of the page. The validity line is added automatically from
          the number of years above, so it can never disagree with it — do not repeat it here.
        </p>

        <div className="space-y-2">
          {config.terms.map((term, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                maxLength={200}
                disabled={!canEdit}
                value={term}
                onChange={(e) =>
                  patch({ terms: config.terms.map((t, i) => (i === index ? e.target.value : t)) })
                }
              />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => patch({ terms: config.terms.filter((_, i) => i !== index) })}
                  aria-label="Remove this line"
                  className="shrink-0 text-ink-soft hover:text-danger"
                >
                  <X className="size-4" strokeWidth={1.6} />
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && config.terms.length < 8 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => patch({ terms: [...config.terms, ''] })}
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Add a line
          </Button>
        )}
      </section>

      {canEdit && (
        <div className="border-t border-rule pt-6">
          <Button loading={saving} onClick={() => void save()}>
            Save page
          </Button>
        </div>
      )}
    </div>
  )
}
