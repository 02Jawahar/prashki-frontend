'use client'

import { useCallback, useEffect, useState } from 'react'
import { shippingAdminService, type ParcelDefaults } from '@/services/admin-modules.service'
import { useAuth } from '@/hooks/use-auth'
import { Alert, Button, Field, Input, SkeletonRows } from '@/components/ui'

/**
 * What a parcel is assumed to be when nobody has said otherwise.
 *
 * These numbers were constants inside the carrier adapter, which is a poor
 * place for anything that decides what the studio is billed. Couriers charge
 * on the greater of what a parcel weighs and what it takes up, so a box
 * declared smaller than it is gets re-weighed at the courier's hub and the
 * difference comes out of the wallet days later, with nothing tying it back to
 * the order that caused it.
 *
 * The volumetric figure is shown alongside, live, because that is usually the
 * one that decides the bill for clothing — a lehenga is light and large — and
 * it is not a calculation anyone should have to do in their head while typing
 * a box size.
 */
export function ParcelDefaultsCard() {
  const { can } = useAuth()

  const [draft, setDraft] = useState<Record<keyof ParcelDefaults, string> | null>(null)
  const [saved, setSaved] = useState<ParcelDefaults | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const canEdit = can('settings.update')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await shippingAdminService.parcelDefaults()
      setSaved(data.parcelDefaults)
      setDraft({
        weightGrams: String(data.parcelDefaults.weightGrams),
        lengthMm: String(data.parcelDefaults.lengthMm),
        widthMm: String(data.parcelDefaults.widthMm),
        heightMm: String(data.parcelDefaults.heightMm),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the parcel defaults')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const set = (key: keyof ParcelDefaults, value: string) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
    setDone(false)
  }

  const numbers: ParcelDefaults | null = draft
    ? {
        weightGrams: Number(draft.weightGrams),
        lengthMm: Number(draft.lengthMm),
        widthMm: Number(draft.widthMm),
        heightMm: Number(draft.heightMm),
      }
    : null

  const valid =
    numbers !== null &&
    Object.values(numbers).every((n) => Number.isInteger(n) && n >= 10 && n <= 50_000)

  const dirty =
    numbers !== null &&
    saved !== null &&
    (Object.keys(numbers) as Array<keyof ParcelDefaults>).some((k) => numbers[k] !== saved[k])

  /** (L × W × H in cm) ÷ 5000, the courier's formula, in grams. */
  const volumetric =
    numbers && valid
      ? Math.round((((numbers.lengthMm / 10) * (numbers.widthMm / 10) * (numbers.heightMm / 10)) / 5000) * 1000)
      : null

  const chargeable = volumetric !== null && numbers ? Math.max(volumetric, numbers.weightGrams) : null

  async function save() {
    if (!numbers || !valid) return
    setBusy(true)
    setError(null)
    try {
      const result = await shippingAdminService.saveParcelDefaults(numbers)
      setSaved(result.parcelDefaults)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the parcel defaults')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="border border-rule bg-white p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="label-caps">Default parcel</h2>
        {done && !dirty && <span className="text-xs text-ink-soft">Saved</span>}
      </div>

      <p className="mb-5 max-w-2xl text-xs text-ink-soft">
        Used for a garment with no weight of its own, and for a parcel packed without
        measurements. Couriers charge on the greater of actual and volumetric weight, so these
        decide what you are billed when nobody has entered the real figures.
      </p>

      {error && <Alert>{error}</Alert>}

      {loading || !draft ? (
        <SkeletonRows rows={2} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Weight (g)" htmlFor="pd-weight" hint="Per garment.">
              <Input
                id="pd-weight"
                type="number"
                min={10}
                step={50}
                value={draft.weightGrams}
                onChange={(e) => set('weightGrams', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Length (mm)" htmlFor="pd-length">
              <Input
                id="pd-length"
                type="number"
                min={10}
                value={draft.lengthMm}
                onChange={(e) => set('lengthMm', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Width (mm)" htmlFor="pd-width">
              <Input
                id="pd-width"
                type="number"
                min={10}
                value={draft.widthMm}
                onChange={(e) => set('widthMm', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Height (mm)" htmlFor="pd-height">
              <Input
                id="pd-height"
                type="number"
                min={10}
                value={draft.heightMm}
                onChange={(e) => set('heightMm', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
          </div>

          {/*
            The consequence of the box size, while it is being typed. For
            clothing the volumetric figure usually wins, and being told so here
            is better than finding out from a wallet debit a week later.
          */}
          {volumetric !== null && chargeable !== null && numbers && (
            <p className="mt-4 text-xs text-ink-soft">
              That box is{' '}
              <span className="tabular-nums text-ink">{(volumetric / 1000).toFixed(2)} kg</span>{' '}
              volumetric. The courier would bill{' '}
              <span className="tabular-nums text-ink">{(chargeable / 1000).toFixed(2)} kg</span>
              {volumetric > numbers.weightGrams
                ? ' — the box decides, not the weight.'
                : ' — the weight decides, not the box.'}
            </p>
          )}

          {canEdit && (
            <div className="mt-5 flex items-center gap-3">
              <Button type="button" onClick={() => void save()} loading={busy} disabled={!dirty || !valid}>
                Save
              </Button>
              {!valid && <span className="text-xs text-danger">Every figure must be a whole number.</span>}
            </div>
          )}
        </>
      )}
    </section>
  )
}
