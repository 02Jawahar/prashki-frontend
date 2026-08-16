'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import {
  shippingAdminService,
  type ShippingMethod,
  type ShippingRate,
  type ShippingZone,
} from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { formatPrice } from '@/lib/money'
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  SkeletonRows,
} from '@/components/ui'

/**
 * Shipping zones and rates (M21).
 *
 * A destination resolves to exactly one zone. The most specific zone whose
 * regions match wins; the zone marked default catches everything else, which is
 * what stops an unusual address becoming an undeliverable one.
 */
export default function AdminShippingPage() {
  const { can } = useAuth()
  const editable = can('shipping.manage')

  const [zones, setZones] = useState<ShippingZone[]>([])
  const [provider, setProvider] = useState<{ name: string; canCreateShipments: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [editingZone, setEditingZone] = useState<ShippingZone | 'new' | null>(null)
  const [editingMethod, setEditingMethod] = useState<
    { zoneId: string; method?: ShippingMethod } | null
  >(null)
  const [editingRates, setEditingRates] = useState<ShippingMethod | null>(null)
  const [confirming, setConfirming] = useState<
    { kind: 'zone' | 'method'; id: string; name: string } | null
  >(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await shippingAdminService.zones()
      setZones(result.zones)
      setProvider(result.provider)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load shipping zones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove() {
    if (!confirming) return

    setRemoving(true)
    try {
      const result =
        confirming.kind === 'zone'
          ? await shippingAdminService.deleteZone(confirming.id)
          : await shippingAdminService.deleteMethod(confirming.id)
      setNotice(result.message ?? 'Deleted.')
      setConfirming(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not delete that')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Shipping</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Zones decide where you deliver, methods decide what it costs, and rate bands price a
            parcel by its weight.
          </p>
          {provider && (
            <p className="mt-1 text-xs text-ink-soft">
              Carrier: <span className="text-ink">{provider.name}</span> —{' '}
              {provider.canCreateShipments
                ? 'parcels are booked automatically'
                : 'parcels are booked by hand and the tracking number entered here'}
            </p>
          )}
        </div>
        {editable && (
          <Button size="sm" onClick={() => setEditingZone('new')}>
            <Plus className="size-3.5" strokeWidth={2} />
            New zone
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}

      {editingZone && (
        <ZoneForm
          zone={editingZone === 'new' ? undefined : editingZone}
          onDone={async () => {
            setEditingZone(null)
            await load()
          }}
          onCancel={() => setEditingZone(null)}
        />
      )}

      {editingMethod && (
        <MethodForm
          zoneId={editingMethod.zoneId}
          method={editingMethod.method}
          onDone={async () => {
            setEditingMethod(null)
            await load()
          }}
          onCancel={() => setEditingMethod(null)}
        />
      )}

      {editingRates && (
        <RateBandsForm
          method={editingRates}
          onDone={async () => {
            setEditingRates(null)
            setNotice('Rate bands saved.')
            await load()
          }}
          onCancel={() => setEditingRates(null)}
        />
      )}

      {loading ? (
        <SkeletonRows rows={4} className="mt-5" />
      ) : zones.length === 0 ? (
        <div className="mt-5 border border-rule bg-white p-5">
          <EmptyState
            title="No zones yet"
            body="Create a zone covering the countries you deliver to, then add delivery methods to it."
          />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {zones.map((zone) => (
            <section key={zone.id} className="border border-rule bg-white">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule p-5">
                <div>
                  <h2 className="display text-lg">
                    {zone.name}
                    {zone.isDefault && <span className="badge badge-info ml-2">Fallback</span>}
                    {!zone.isServiceable && (
                      <span className="badge badge-danger ml-2">Not serviced</span>
                    )}
                    {!zone.isActive && <span className="badge badge-neutral ml-2">Inactive</span>}
                  </h2>
                  <p className="mt-1 text-xs text-ink-soft">
                    {zone.countries.join(', ')}
                    {zone.regions.length > 0 ? ` — ${zone.regions.join(', ')}` : ' — everywhere in those countries'}
                  </p>
                  {!zone.isServiceable && (
                    <p className="mt-1 text-xs text-danger">
                      Addresses matching this zone are refused at checkout.
                      {zone.unserviceableMessage ? ` “${zone.unserviceableMessage}”` : ''}
                    </p>
                  )}
                </div>

                {editable && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingZone(zone)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirming({ kind: 'zone', id: zone.id, name: zone.name })}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </header>

              {!zone.isServiceable ? (
                <p className="p-5 text-sm text-ink-soft">
                  This zone exists to refuse delivery, so it carries no methods. Because zones are
                  matched in order, keep its position above the zones it should override.
                </p>
              ) : zone.methods.length === 0 ? (
                <p className="p-5 text-sm text-ink-soft">
                  No delivery methods — nothing can be shipped to this zone yet.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-left text-xs text-ink-soft">
                      <th className="p-3 font-normal">Method</th>
                      <th className="p-3 font-normal">Rate</th>
                      <th className="p-3 font-normal">Free above</th>
                      <th className="p-3 font-normal">Estimate</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {zone.methods.map((method) => (
                      <tr key={method.id} className="border-b border-hairline last:border-0">
                        <td className="p-3">
                          <p>
                            {method.name}
                            {method.isCod && <span className="badge badge-neutral ml-2">COD</span>}
                            {!method.isActive && (
                              <span className="badge badge-neutral ml-2">Inactive</span>
                            )}
                          </p>
                          {method.description && (
                            <p className="mt-0.5 text-xs text-ink-soft">{method.description}</p>
                          )}
                        </td>
                        <td className="p-3">
                          {method.rates.length > 0 ? (
                            <>
                              <span>
                                {formatPrice(Math.min(...method.rates.map((r) => r.amount)))} –{' '}
                                {formatPrice(Math.max(...method.rates.map((r) => r.amount)))}
                              </span>
                              <span className="block text-xs text-ink-soft">
                                {method.rates.length} weight bands
                              </span>
                            </>
                          ) : method.rate === 0 ? (
                            'Free'
                          ) : (
                            formatPrice(method.rate)
                          )}
                          {method.isCod && method.codFee > 0 && (
                            <span className="block text-xs text-ink-soft">
                              + {formatPrice(method.codFee)} handling
                            </span>
                          )}
                          {method.maxWeightGrams && (
                            <span className="block text-xs text-ink-soft">
                              up to {(method.maxWeightGrams / 1000).toFixed(1)} kg
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-ink-soft">
                          {method.freeAbove ? formatPrice(method.freeAbove) : '—'}
                        </td>
                        <td className="p-3 text-ink-soft">
                          {method.minDays === null
                            ? '—'
                            : method.minDays === method.maxDays
                              ? `${method.minDays} day${method.minDays === 1 ? '' : 's'}`
                              : `${method.minDays}–${method.maxDays} days`}
                        </td>
                        <td className="p-3 text-right">
                          {editable && (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditingRates(method)}>
                                Bands
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingMethod({ zoneId: zone.id, method })}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setConfirming({ kind: 'method', id: method.id, name: method.name })
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {editable && (
                <div className="border-t border-hairline p-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingMethod({ zoneId: zone.id })}
                  >
                    <Plus className="size-3.5" strokeWidth={2} />
                    Add a delivery method
                  </Button>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={`Delete ${confirming?.name}?`}
        body="If any order has used it, it will be deactivated instead so that order keeps its history."
        confirmLabel="Delete"
        loading={removing}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(null)}
      />
    </div>
  )
}

function ZoneForm({
  zone,
  onDone,
  onCancel,
}: {
  zone?: ShippingZone
  onDone: () => void | Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: zone?.name ?? '',
    countries: (zone?.countries ?? ['IN']).join(', '),
    regions: (zone?.regions ?? []).join(', '),
    isDefault: zone?.isDefault ?? false,
    isActive: zone?.isActive ?? true,
    isServiceable: zone?.isServiceable ?? true,
    unserviceableMessage: zone?.unserviceableMessage ?? '',
    position: String(zone?.position ?? 0),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const list = (value: string) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setError(null)

    const payload = {
      name: form.name,
      countries: list(form.countries).map((c) => c.toUpperCase()),
      regions: list(form.regions),
      isDefault: form.isDefault,
      isActive: form.isActive,
      isServiceable: form.isServiceable,
      unserviceableMessage: form.unserviceableMessage || null,
      position: Number(form.position || 0),
    }

    try {
      if (zone) await shippingAdminService.updateZone(zone.id, payload)
      else await shippingAdminService.createZone(payload)
      await onDone()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save that zone')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="border border-rule bg-white p-6" noValidate>
      <h2 className="display mb-5 text-lg">{zone ? `Edit ${zone.name}` : 'New zone'}</h2>
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="zone-name" required>
          <Input
            id="zone-name"
            required
            value={form.name}
            onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
          />
        </Field>

        <Field label="Order" htmlFor="zone-position" hint="Lower numbers are checked first.">
          <Input
            id="zone-position"
            type="number"
            min={0}
            value={form.position}
            onChange={(event) => setForm((f) => ({ ...f, position: event.target.value }))}
          />
        </Field>

        <Field
          label="Countries"
          htmlFor="zone-countries"
          required
          hint="Two-letter codes, comma separated. e.g. IN"
        >
          <Input
            id="zone-countries"
            required
            value={form.countries}
            onChange={(event) => setForm((f) => ({ ...f, countries: event.target.value }))}
          />
        </Field>

        <Field
          label="States or PIN prefixes"
          htmlFor="zone-regions"
          hint="Leave empty to cover the whole country. e.g. Delhi, Maharashtra, 56"
        >
          <Input
            id="zone-regions"
            value={form.regions}
            onChange={(event) => setForm((f) => ({ ...f, regions: event.target.value }))}
          />
        </Field>
      </div>

      <div className="mt-4 space-y-2.5">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[#5b6241]"
            checked={form.isDefault}
            onChange={(event) => setForm((f) => ({ ...f, isDefault: event.target.checked }))}
          />
          Use as the fallback for addresses no other zone matches
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[#5b6241]"
            checked={!form.isServiceable}
            onChange={(event) => setForm((f) => ({ ...f, isServiceable: !event.target.checked }))}
          />
          <span>
            We do <strong>not</strong> deliver here
            <span className="mt-0.5 block text-xs text-ink-soft">
              Turns this zone into a refusal. Keep its position above the zones it overrides —
              matching stops at the first zone that fits.
            </span>
          </span>
        </label>

        {!form.isServiceable && (
          <div className="pl-7">
            <Field
              label="What the customer is told"
              htmlFor="zone-msg"
              hint="Shown at checkout and on the PIN checker."
            >
              <Input
                id="zone-msg"
                maxLength={300}
                value={form.unserviceableMessage}
                onChange={(event) =>
                  setForm((f) => ({ ...f, unserviceableMessage: event.target.value }))
                }
                placeholder="We are not able to deliver to that PIN code yet."
              />
            </Field>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[#5b6241]"
            checked={form.isActive}
            onChange={(event) => setForm((f) => ({ ...f, isActive: event.target.checked }))}
          />
          Active
        </label>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" size="sm" loading={saving}>
          {zone ? 'Save changes' : 'Create zone'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function MethodForm({
  zoneId,
  method,
  onDone,
  onCancel,
}: {
  zoneId: string
  method?: ShippingMethod
  onDone: () => void | Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: method?.name ?? '',
    description: method?.description ?? '',
    rate: String((method?.rate ?? 0) / 100),
    freeAbove: method?.freeAbove ? String(method.freeAbove / 100) : '',
    maxWeightGrams: method?.maxWeightGrams != null ? String(method.maxWeightGrams / 1000) : '',
    minDays: method?.minDays != null ? String(method.minDays) : '',
    maxDays: method?.maxDays != null ? String(method.maxDays) : '',
    isCod: method?.isCod ?? false,
    codFee: String((method?.codFee ?? 0) / 100),
    isActive: method?.isActive ?? true,
    position: String(method?.position ?? 0),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paise = (value: string) => Math.round(Number(value || 0) * 100)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setError(null)

    const payload = {
      name: form.name,
      description: form.description || null,
      rate: paise(form.rate),
      freeAbove: form.freeAbove ? paise(form.freeAbove) : null,
      // Entered in kilograms, stored in grams.
      maxWeightGrams: form.maxWeightGrams ? Math.round(Number(form.maxWeightGrams) * 1000) : null,
      minDays: form.minDays ? Number(form.minDays) : null,
      maxDays: form.maxDays ? Number(form.maxDays) : null,
      isCod: form.isCod,
      codFee: form.isCod ? paise(form.codFee) : 0,
      isActive: form.isActive,
      position: Number(form.position || 0),
    }

    try {
      if (method) await shippingAdminService.updateMethod(method.id, payload)
      else await shippingAdminService.createMethod(zoneId, payload)
      await onDone()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save that method')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="border border-rule bg-white p-6" noValidate>
      <h2 className="display mb-5 text-lg">
        {method ? `Edit ${method.name}` : 'New delivery method'}
      </h2>
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="m-name" required>
          <Input
            id="m-name"
            required
            value={form.name}
            onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
          />
        </Field>

        <Field label="Rate (₹)" htmlFor="m-rate" required hint="Enter 0 for free delivery.">
          <Input
            id="m-rate"
            type="number"
            min={0}
            required
            value={form.rate}
            onChange={(event) => setForm((f) => ({ ...f, rate: event.target.value }))}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Description" htmlFor="m-desc" hint="Shown to the customer at checkout.">
            <Input
              id="m-desc"
              value={form.description}
              onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
            />
          </Field>
        </div>

        <Field label="Free above (₹)" htmlFor="m-free" hint="Order value at which this becomes free.">
          <Input
            id="m-free"
            type="number"
            min={0}
            value={form.freeAbove}
            onChange={(event) => setForm((f) => ({ ...f, freeAbove: event.target.value }))}
          />
        </Field>

        <Field
          label="Carrier weight limit (kg)"
          htmlFor="m-maxw"
          hint="Heavier parcels are not offered this method. Leave empty for no limit."
        >
          <Input
            id="m-maxw"
            type="number"
            min={0}
            step="0.1"
            value={form.maxWeightGrams}
            onChange={(event) => setForm((f) => ({ ...f, maxWeightGrams: event.target.value }))}
          />
        </Field>

        <Field label="Display order" htmlFor="m-position">
          <Input
            id="m-position"
            type="number"
            min={0}
            value={form.position}
            onChange={(event) => setForm((f) => ({ ...f, position: event.target.value }))}
          />
        </Field>

        <Field label="Fastest (days)" htmlFor="m-min">
          <Input
            id="m-min"
            type="number"
            min={0}
            value={form.minDays}
            onChange={(event) => setForm((f) => ({ ...f, minDays: event.target.value }))}
          />
        </Field>

        <Field label="Slowest (days)" htmlFor="m-max">
          <Input
            id="m-max"
            type="number"
            min={0}
            value={form.maxDays}
            onChange={(event) => setForm((f) => ({ ...f, maxDays: event.target.value }))}
          />
        </Field>
      </div>

      <div className="mt-4 space-y-2.5">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[#5b6241]"
            checked={form.isCod}
            onChange={(event) => setForm((f) => ({ ...f, isCod: event.target.checked }))}
          />
          Cash on delivery
        </label>

        {form.isCod && (
          <div className="max-w-xs pl-7">
            <Field label="Handling fee (₹)" htmlFor="m-codfee">
              <Input
                id="m-codfee"
                type="number"
                min={0}
                value={form.codFee}
                onChange={(event) => setForm((f) => ({ ...f, codFee: event.target.value }))}
              />
            </Field>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[#5b6241]"
            checked={form.isActive}
            onChange={(event) => setForm((f) => ({ ...f, isActive: event.target.checked }))}
          />
          Offer this method at checkout
        </label>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" size="sm" loading={saving}>
          {method ? 'Save changes' : 'Add method'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/**
 * Weight-band editor (FR-21.2).
 *
 * Bands are entered in kilograms and rupees and stored in grams and paise.
 * Bounds are inclusive-lower and exclusive-upper, so "up to 0.5" and
 * "0.5 to 2" meet without overlapping and 500 g falls in the second band —
 * the hint says so, because getting that backwards is the easy mistake.
 *
 * Leaving the table empty falls back to the method's flat rate.
 */
function RateBandsForm({
  method,
  onDone,
  onCancel,
}: {
  method: ShippingMethod
  onDone: () => void | Promise<void>
  onCancel: () => void
}) {
  const toRow = (rate: ShippingRate) => ({
    label: rate.label ?? '',
    minWeight: rate.minWeightGrams != null ? String(rate.minWeightGrams / 1000) : '',
    maxWeight: rate.maxWeightGrams != null ? String(rate.maxWeightGrams / 1000) : '',
    minSubtotal: rate.minSubtotal != null ? String(rate.minSubtotal / 100) : '',
    maxSubtotal: rate.maxSubtotal != null ? String(rate.maxSubtotal / 100) : '',
    amount: String(rate.amount / 100),
  })

  const [rows, setRows] = useState(method.rates.map(toRow))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (index: number, key: keyof (typeof rows)[number], value: string) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    )

  const grams = (value: string) => (value ? Math.round(Number(value) * 1000) : null)
  const paise = (value: string) => (value ? Math.round(Number(value) * 100) : null)

  async function save() {
    if (saving) return

    setSaving(true)
    setError(null)

    try {
      await shippingAdminService.saveRates(
        method.id,
        rows.map((row, index) => ({
          label: row.label || null,
          minWeightGrams: grams(row.minWeight),
          maxWeightGrams: grams(row.maxWeight),
          minSubtotal: paise(row.minSubtotal),
          maxSubtotal: paise(row.maxSubtotal),
          amount: Math.round(Number(row.amount || 0) * 100),
          position: index,
        })),
      )
      await onDone()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save those bands')
      setSaving(false)
    }
  }

  return (
    <div className="border border-rule bg-white p-6">
      <h2 className="display mb-1 text-lg">Rate bands — {method.name}</h2>
      <p className="mb-5 text-sm text-ink-soft">
        The first band that fits the parcel wins. Weights are inclusive at the lower end and
        exclusive at the upper, so a 0.5 kg parcel falls into a band starting at 0.5. With no bands,
        the flat rate of {formatPrice(method.rate)} applies.
      </p>

      {error && <Alert>{error}</Alert>}

      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">No bands — the flat rate applies to every parcel.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-soft">
                <th className="p-2 font-normal">Label</th>
                <th className="p-2 font-normal">From (kg)</th>
                <th className="p-2 font-normal">To (kg)</th>
                <th className="p-2 font-normal">Order from (₹)</th>
                <th className="p-2 font-normal">Order to (₹)</th>
                <th className="p-2 font-normal">Charge (₹)</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-hairline last:border-0">
                  <td className="p-2">
                    <Input
                      aria-label={`Label for band ${index + 1}`}
                      value={row.label}
                      onChange={(event) => set(index, 'label', event.target.value)}
                      placeholder="Up to 500 g"
                    />
                  </td>
                  {(['minWeight', 'maxWeight', 'minSubtotal', 'maxSubtotal', 'amount'] as const).map(
                    (key) => (
                      <td key={key} className="p-2">
                        <Input
                          aria-label={`${key} for band ${index + 1}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={row[key]}
                          onChange={(event) => set(index, key, event.target.value)}
                          className="w-24"
                        />
                      </td>
                    ),
                  )}
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      aria-label={`Remove band ${index + 1}`}
                      onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                      className="text-ink-soft hover:text-danger"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setRows((current) => [
              ...current,
              { label: '', minWeight: '', maxWeight: '', minSubtotal: '', maxSubtotal: '', amount: '' },
            ])
          }
        >
          <Plus className="size-3.5" strokeWidth={2} />
          Add a band
        </Button>
        <Button size="sm" loading={saving} onClick={() => void save()}>
          Save bands
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
