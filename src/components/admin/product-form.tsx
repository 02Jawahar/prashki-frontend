'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminService, type CreateProductInput } from '@/services/admin.service'
import { ApiRequestError } from '@/services/api-client'
import { paiseToRupeeInput, rupeeInputToPaise } from '@/lib/money'
import { slugify } from '@/lib/utils'
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui'
import type { AdminCategory, ProductDetail } from '@/types/api'

interface Props {
  /** Present when editing; absent when creating. */
  product?: ProductDetail
  onSaved: (product: ProductDetail) => void
}

interface VariantDraft {
  name: string
  sku: string
  stock: string
}

export function ProductForm({ product, onSaved }: Props) {
  const isEdit = Boolean(product)

  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [price, setPrice] = useState(paiseToRupeeInput(product?.price))
  const [compareAtPrice, setCompareAtPrice] = useState(paiseToRupeeInput(product?.compareAtPrice))
  const [status, setStatus] = useState(product?.status ?? 'DRAFT')
  const [featured, setFeatured] = useState(product?.featured ?? false)
  const [categoryId, setCategoryId] = useState(product?.category?.id ?? '')

  // Variants are only editable at creation here; afterwards they get their own
  // panel so stock changes go through the inventory ledger.
  const [variants, setVariants] = useState<VariantDraft[]>([
    { name: 'S', sku: '', stock: '0' },
    { name: 'M', sku: '', stock: '0' },
  ])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    void adminService.categories().then(setCategories).catch(() => setCategories([]))
  }, [])

  // Discount is shown live, computed the same way the backend computes it.
  const discount = useMemo(() => {
    const p = rupeeInputToPaise(price)
    const c = rupeeInputToPaise(compareAtPrice)
    if (!p || !c || c <= p) return 0
    return Math.round(((c - p) / c) * 100)
  }, [price, compareAtPrice])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    const priceInPaise = rupeeInputToPaise(price)
    if (priceInPaise === null) {
      setFieldErrors({ price: 'Enter a valid price' })
      setSubmitting(false)
      return
    }

    const payload: CreateProductInput = {
      name: name.trim(),
      description: description.trim(),
      shortDescription: shortDescription.trim() || undefined,
      sku: sku.trim(),
      price: priceInPaise,
      compareAtPrice: rupeeInputToPaise(compareAtPrice),
      status: status as ProductDetail['status'],
      featured,
      categoryId: categoryId || null,
    }

    try {
      if (isEdit && product) {
        onSaved(await adminService.updateProduct(product.id, payload))
      } else {
        const usable = variants
          .filter((v) => v.name.trim() && v.sku.trim())
          .map((v) => ({
            name: v.name.trim(),
            sku: v.sku.trim(),
            stock: Number(v.stock) || 0,
          }))

        onSaved(
          await adminService.createProduct({
            ...payload,
            variants: usable.length > 0 ? usable : undefined,
          }),
        )
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message)
        // Surface per-field messages from the API's validation details.
        const details = err.details as Array<{ path: string; message: string }> | undefined
        if (Array.isArray(details)) {
          setFieldErrors(
            Object.fromEntries(details.map((d) => [d.path.replace(/^body\./, ''), d.message])),
          )
        }
      } else {
        setError('Could not save the product')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-7" noValidate>
      {error && <Alert>{error}</Alert>}

      <section className="border border-rule bg-white p-6">
        <h2 className="label-caps mb-5">Details</h2>

        <div className="space-y-4">
          <Field label="Name" htmlFor="name" required error={fieldErrors.name}>
            <Input
              id="name"
              value={name}
              required
              onChange={(e) => {
                setName(e.target.value)
                // Suggest a SKU while creating, but never overwrite a typed one.
                if (!isEdit && !sku) return
              }}
              onBlur={() => {
                if (!isEdit && !sku && name.trim()) {
                  setSku(slugify(name).toUpperCase().replace(/-/g, '-').slice(0, 24))
                }
              }}
              error={Boolean(fieldErrors.name)}
            />
          </Field>

          <Field
            label="Short description"
            htmlFor="shortDescription"
            hint="One line shown under the product name in listings."
            error={fieldErrors.shortDescription}
          >
            <Input
              id="shortDescription"
              value={shortDescription}
              maxLength={300}
              onChange={(e) => setShortDescription(e.target.value)}
            />
          </Field>

          <Field label="Description" htmlFor="description" required error={fieldErrors.description}>
            <Textarea
              id="description"
              rows={6}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={Boolean(fieldErrors.description)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" htmlFor="sku" required error={fieldErrors.sku}>
              <Input
                id="sku"
                value={sku}
                required
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                error={Boolean(fieldErrors.sku)}
              />
            </Field>

            <Field label="Category" htmlFor="categoryId" error={fieldErrors.categoryId}>
              <Select id="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent ? `${c.parent.name} → ${c.name}` : c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </section>

      <section className="border border-rule bg-white p-6">
        <h2 className="label-caps mb-1">Pricing</h2>
        <p className="mb-5 text-xs text-ink-soft">
          Entered in rupees, stored as paise. The discount is calculated from these two figures — it
          is never entered by hand.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price (₹)" htmlFor="price" required error={fieldErrors.price}>
            <Input
              id="price"
              type="number"
              min={0}
              step="0.01"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              error={Boolean(fieldErrors.price)}
            />
          </Field>

          <Field
            label="Compare-at price (₹)"
            htmlFor="compareAtPrice"
            hint="Optional. Must be higher than the price."
            error={fieldErrors.compareAtPrice}
          >
            <Input
              id="compareAtPrice"
              type="number"
              min={0}
              step="0.01"
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              error={Boolean(fieldErrors.compareAtPrice)}
            />
          </Field>

          <Field label="Discount" htmlFor="discount">
            <div className="field flex items-center bg-shell text-ink-soft">
              {discount > 0 ? `${discount}% off` : 'None'}
            </div>
          </Field>
        </div>
      </section>

      {!isEdit && (
        <section className="border border-rule bg-white p-6">
          <h2 className="label-caps mb-1">Variants</h2>
          <p className="mb-5 text-xs text-ink-soft">
            Leave blank for a single-SKU product — one &ldquo;Default&rdquo; variant is created
            automatically. Stock set here is recorded as opening stock.
          </p>

          <div className="space-y-3">
            {variants.map((v, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr_auto]">
                <Input
                  aria-label={`Variant ${i + 1} name`}
                  placeholder="Size (e.g. S)"
                  value={v.name}
                  onChange={(e) =>
                    setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                />
                <Input
                  aria-label={`Variant ${i + 1} SKU`}
                  placeholder={sku ? `${sku}-${v.name || 'X'}` : 'SKU'}
                  value={v.sku}
                  onChange={(e) =>
                    setVariants((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, sku: e.target.value.toUpperCase() } : x)),
                    )
                  }
                />
                <Input
                  aria-label={`Variant ${i + 1} stock`}
                  type="number"
                  min={0}
                  value={v.stock}
                  onChange={(e) =>
                    setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, stock: e.target.value } : x)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setVariants((prev) => prev.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => setVariants((prev) => [...prev, { name: '', sku: '', stock: '0' }])}
          >
            Add variant
          </Button>
        </section>
      )}

      <section className="border border-rule bg-white p-6">
        <h2 className="label-caps mb-5">Visibility</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="status" hint="Only Active products appear on the storefront.">
            <Select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductDetail['status'])}
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </Field>

          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="size-4 accent-[#5b6241]"
              />
              Feature on the homepage
            </label>
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button type="submit" loading={submitting}>
          {submitting ? 'Saving' : isEdit ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  )
}
