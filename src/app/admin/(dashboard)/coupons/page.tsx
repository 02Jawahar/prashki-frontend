'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { couponService, type Coupon, type CouponInput } from '@/services/admin-modules.service'
import { adminService } from '@/services/admin.service'
import { ApiRequestError } from '@/services/api-client'
import { formatPrice } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Select,
  SkeletonRows,
  StatusBadge,
  Textarea,
} from '@/components/ui'
import type { AdminCategory } from '@/types/api'

/**
 * Coupon administration (M13).
 *
 * The form works in the units a merchant thinks in — percent and rupees — and
 * converts to the integer basis points and paise the API stores. Nothing here
 * calculates a discount; the server does that on every cart read.
 */
export default function AdminCouponsPage() {
  const { can } = useAuth()

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null)
  const [confirming, setConfirming] = useState<Coupon | null>(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [result, cats] = await Promise.all([
        couponService.list(),
        adminService.categories().catch(() => []),
      ])
      setCoupons(result.coupons)
      setCategories(cats)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load coupons')
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
      const result = await couponService.remove(confirming.id)
      setNotice(result.message ?? 'Coupon deleted.')
      setConfirming(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not delete that coupon')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Coupons</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Discount codes customers can enter in their bag.
          </p>
        </div>
        {can('coupon.manage') && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-3.5" strokeWidth={2} />
            New coupon
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}

      {editing && (
        <CouponForm
          coupon={editing === 'new' ? undefined : editing}
          categories={categories}
          onDone={async () => {
            setEditing(null)
            await load()
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="mt-5 border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={5} />
          </div>
        ) : coupons.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No coupons yet"
              body="Create one to offer a discount at checkout."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-soft">
                <th className="p-3 font-normal">Code</th>
                <th className="p-3 font-normal">Discount</th>
                <th className="p-3 font-normal">Conditions</th>
                <th className="p-3 font-normal">Used</th>
                <th className="p-3 font-normal">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-hairline last:border-0">
                  <td className="p-3">
                    <p className="font-medium">{coupon.code}</p>
                    {coupon.description && (
                      <p className="mt-0.5 text-xs text-ink-soft">{coupon.description}</p>
                    )}
                  </td>
                  <td className="p-3">
                    {coupon.type === 'FREE_SHIPPING'
                      ? 'Free delivery'
                      : coupon.type === 'PERCENTAGE'
                        ? `${coupon.value / 100}%${coupon.maxDiscount ? ` up to ${formatPrice(coupon.maxDiscount)}` : ''}`
                        : formatPrice(coupon.value)}
                  </td>
                  <td className="p-3 text-xs text-ink-soft">
                    <ul className="space-y-0.5">
                      {coupon.minSubtotal > 0 && <li>Min {formatPrice(coupon.minSubtotal)}</li>}
                      {coupon.firstOrderOnly && <li>First order only</li>}
                      {coupon.perUserLimit && <li>{coupon.perUserLimit} per customer</li>}
                      {coupon.excludeDiscounted && <li>Not on sale items</li>}
                      {coupon.endsAt && <li>Ends {formatDate(coupon.endsAt)}</li>}
                      {coupon.products.length > 0 && <li>{coupon.products.length} products</li>}
                      {coupon.categories.length > 0 && <li>{coupon.categories.length} categories</li>}
                    </ul>
                  </td>
                  <td className="p-3">
                    {coupon.usageCount}
                    {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={coupon.status} />
                  </td>
                  <td className="p-3 text-right">
                    {can('coupon.manage') && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(coupon)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(coupon)}>
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
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={`Delete ${confirming?.code}?`}
        body={
          confirming && confirming.redemptionCount > 0
            ? `This code has been used ${confirming.redemptionCount} time${confirming.redemptionCount === 1 ? '' : 's'}. It will be expired rather than deleted, so those orders keep their history.`
            : 'This cannot be undone.'
        }
        confirmLabel="Delete"
        loading={removing}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(null)}
      />
    </div>
  )
}

function CouponForm({
  coupon,
  categories,
  onDone,
  onCancel,
}: {
  coupon?: Coupon
  categories: AdminCategory[]
  onDone: () => void | Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    code: coupon?.code ?? '',
    description: coupon?.description ?? '',
    type: coupon?.type ?? 'PERCENTAGE',
    status: coupon?.status ?? 'DRAFT',
    // Percent and rupees in the form; basis points and paise on the wire.
    percent: coupon?.type === 'PERCENTAGE' ? String(coupon.value / 100) : '10',
    amount: coupon?.type === 'FIXED' ? String(coupon.value / 100) : '',
    maxDiscount: coupon?.maxDiscount ? String(coupon.maxDiscount / 100) : '',
    minSubtotal: coupon?.minSubtotal ? String(coupon.minSubtotal / 100) : '',
    startsAt: coupon?.startsAt ? coupon.startsAt.slice(0, 10) : '',
    endsAt: coupon?.endsAt ? coupon.endsAt.slice(0, 10) : '',
    usageLimit: coupon?.usageLimit ? String(coupon.usageLimit) : '',
    perUserLimit: coupon?.perUserLimit ? String(coupon.perUserLimit) : '',
    firstOrderOnly: coupon?.firstOrderOnly ?? false,
    excludeDiscounted: coupon?.excludeDiscounted ?? false,
    isPublic: coupon?.isPublic ?? true,
    categoryIds: coupon?.categories.map((c) => c.id) ?? ([] as string[]),
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const rupeesToPaise = (value: string) => Math.round(Number(value || 0) * 100)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setError(null)
    setFieldErrors({})

    const payload: CouponInput = {
      code: form.code,
      description: form.description || null,
      type: form.type as CouponInput['type'],
      status: form.status as CouponInput['status'],
      value:
        form.type === 'PERCENTAGE'
          ? // 1000 basis points = 10%
            Math.round(Number(form.percent || 0) * 100)
          : form.type === 'FIXED'
            ? rupeesToPaise(form.amount)
            : 0,
      maxDiscount: form.maxDiscount ? rupeesToPaise(form.maxDiscount) : null,
      minSubtotal: form.minSubtotal ? rupeesToPaise(form.minSubtotal) : 0,
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
      firstOrderOnly: form.firstOrderOnly,
      excludeDiscounted: form.excludeDiscounted,
      isPublic: form.isPublic,
      productIds: coupon?.products.map((p) => p.id) ?? [],
      categoryIds: form.categoryIds,
    }

    try {
      if (coupon) await couponService.update(coupon.id, payload)
      else await couponService.create(payload)
      await onDone()
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message)
        const details = err.details as Array<{ path: string; message: string }> | undefined
        if (Array.isArray(details)) {
          setFieldErrors(
            Object.fromEntries(details.map((d) => [d.path.replace(/^body\./, ''), d.message])),
          )
        }
      } else {
        setError('Could not save that coupon')
      }
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="border border-rule bg-white p-6" noValidate>
      <h2 className="display mb-5 text-lg">{coupon ? `Edit ${coupon.code}` : 'New coupon'}</h2>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" htmlFor="code" required error={fieldErrors.code}>
          <Input
            id="code"
            required
            value={form.code}
            onChange={(event) => set('code', event.target.value.toUpperCase())}
            placeholder="WELCOME10"
            error={Boolean(fieldErrors.code)}
          />
        </Field>

        <Field label="Status" htmlFor="status">
          <Select id="status" value={form.status} onChange={(event) => set('status', event.target.value as Coupon['status'])}>
            <option value="DRAFT">Draft — not usable yet</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="EXPIRED">Expired</option>
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="Description" htmlFor="description" hint="Shown to the customer when the code is applied.">
            <Textarea
              id="description"
              rows={2}
              maxLength={300}
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
            />
          </Field>
        </div>

        <Field label="Type" htmlFor="type">
          <Select id="type" value={form.type} onChange={(event) => set('type', event.target.value as Coupon['type'])}>
            <option value="PERCENTAGE">Percentage off</option>
            <option value="FIXED">Fixed amount off</option>
            <option value="FREE_SHIPPING">Free delivery</option>
          </Select>
        </Field>

        {form.type === 'PERCENTAGE' && (
          <Field label="Percentage" htmlFor="percent" required error={fieldErrors.value}>
            <Input
              id="percent"
              type="number"
              min={0.01}
              max={100}
              step={0.01}
              required
              value={form.percent}
              onChange={(event) => set('percent', event.target.value)}
              error={Boolean(fieldErrors.value)}
            />
          </Field>
        )}

        {form.type === 'FIXED' && (
          <Field label="Amount (₹)" htmlFor="amount" required error={fieldErrors.value}>
            <Input
              id="amount"
              type="number"
              min={1}
              required
              value={form.amount}
              onChange={(event) => set('amount', event.target.value)}
              error={Boolean(fieldErrors.value)}
            />
          </Field>
        )}

        {form.type === 'PERCENTAGE' && (
          <Field label="Maximum discount (₹)" htmlFor="maxDiscount" hint="Leave empty for no cap.">
            <Input
              id="maxDiscount"
              type="number"
              min={0}
              value={form.maxDiscount}
              onChange={(event) => set('maxDiscount', event.target.value)}
            />
          </Field>
        )}

        <Field label="Minimum spend (₹)" htmlFor="minSubtotal" hint="Before delivery. Leave empty for none.">
          <Input
            id="minSubtotal"
            type="number"
            min={0}
            value={form.minSubtotal}
            onChange={(event) => set('minSubtotal', event.target.value)}
          />
        </Field>

        <Field label="Starts" htmlFor="startsAt" hint="Optional.">
          <Input
            id="startsAt"
            type="date"
            value={form.startsAt}
            onChange={(event) => set('startsAt', event.target.value)}
          />
        </Field>

        <Field label="Ends" htmlFor="endsAt" hint="Optional." error={fieldErrors.endsAt}>
          <Input
            id="endsAt"
            type="date"
            value={form.endsAt}
            onChange={(event) => set('endsAt', event.target.value)}
            error={Boolean(fieldErrors.endsAt)}
          />
        </Field>

        <Field label="Total uses" htmlFor="usageLimit" hint="Leave empty for unlimited.">
          <Input
            id="usageLimit"
            type="number"
            min={1}
            value={form.usageLimit}
            onChange={(event) => set('usageLimit', event.target.value)}
          />
        </Field>

        <Field label="Uses per customer" htmlFor="perUserLimit" hint="Requires the customer to be signed in.">
          <Input
            id="perUserLimit"
            type="number"
            min={1}
            value={form.perUserLimit}
            onChange={(event) => set('perUserLimit', event.target.value)}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Limit to categories" htmlFor="categories" hint="Leave none selected to apply to everything.">
            <select
              id="categories"
              multiple
              size={Math.min(6, Math.max(3, categories.length))}
              value={form.categoryIds}
              onChange={(event) =>
                set(
                  'categoryIds',
                  [...event.target.selectedOptions].map((option) => option.value),
                )
              }
              className="field h-auto"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <fieldset className="mt-5 space-y-2.5">
        <legend className="field-label">Rules</legend>
        {[
          ['firstOrderOnly', 'Only for a customer’s first order'],
          ['excludeDiscounted', 'Does not apply to items already reduced'],
          ['isPublic', 'May be listed publicly'],
        ].map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[#5b6241]"
              checked={form[key as 'firstOrderOnly'] as boolean}
              onChange={(event) => set(key as 'firstOrderOnly', event.target.checked)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="mt-6 flex gap-3">
        <Button type="submit" size="sm" loading={saving}>
          {coupon ? 'Save changes' : 'Create coupon'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
