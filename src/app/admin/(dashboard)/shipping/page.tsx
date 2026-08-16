'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import {
  shippingAdminService,
  type ShippingMethod,
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [editingZone, setEditingZone] = useState<ShippingZone | 'new' | null>(null)
  const [editingMethod, setEditingMethod] = useState<
    { zoneId: string; method?: ShippingMethod } | null
  >(null)
  const [confirming, setConfirming] = useState<
    { kind: 'zone' | 'method'; id: string; name: string } | null
  >(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setZones(await shippingAdminService.zones())
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
            Zones decide where you deliver; methods decide what it costs.
          </p>
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
                    {!zone.isActive && <span className="badge badge-neutral ml-2">Inactive</span>}
                  </h2>
                  <p className="mt-1 text-xs text-ink-soft">
                    {zone.countries.join(', ')}
                    {zone.regions.length > 0 ? ` — ${zone.regions.join(', ')}` : ' — everywhere in those countries'}
                  </p>
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

              {zone.methods.length === 0 ? (
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
                          {method.rate === 0 ? 'Free' : formatPrice(method.rate)}
                          {method.isCod && method.codFee > 0 && (
                            <span className="block text-xs text-ink-soft">
                              + {formatPrice(method.codFee)} handling
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
