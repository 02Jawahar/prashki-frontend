'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { ProductForm } from '@/components/admin/product-form'
import { ProductImages } from '@/components/admin/product-images'
import { ProductVariants } from '@/components/admin/product-variants'
import { Alert, Button, Spinner, StatusBadge } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import type { ProductDetail } from '@/types/api'

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { can } = useAuth()

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setProduct(await adminService.product(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the product')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleStatus() {
    if (!product) return
    setBusy(true)
    try {
      const next = product.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE'
      setProduct(await adminService.setProductStatus(product.id, next))
      setNotice(next === 'ACTIVE' ? 'Published — now live on the storefront.' : 'Unpublished.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the status')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!product) return
    setBusy(true)
    try {
      const res = await adminService.deleteProduct(product.id)
      if (res.archived) {
        setNotice(res.message ?? 'Archived instead of deleted.')
        await load()
      } else {
        router.push('/admin/products')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the product')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner label="Loading product" />
  if (!product) return <Alert>{error ?? 'Product not found'}</Alert>

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/products" className="label-caps mb-4 inline-flex items-center gap-1 text-ink-soft hover:text-ink">
        <ChevronLeft className="size-3.5" strokeWidth={1.6} />
        Products
      </Link>

      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="display truncate text-2xl">{product.name}</h1>
            <StatusBadge status={product.status} />
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {product.sku}
            {product.status === 'ACTIVE' && (
              <>
                {' · '}
                <Link
                  href={`/products/${product.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 hover:text-ink"
                >
                  View on store
                  <ExternalLink className="size-3" strokeWidth={1.5} />
                </Link>
              </>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          {can('product.publish') && (
            <Button variant="ghost" size="sm" loading={busy} onClick={() => void toggleStatus()}>
              {product.status === 'ACTIVE' ? 'Unpublish' : 'Publish'}
            </Button>
          )}
          {can('product.delete') && (
            <Button variant="danger" size="sm" loading={busy} onClick={() => void onDelete()}>
              Delete
            </Button>
          )}
        </div>
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && (
        <div className="mb-5">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      <div className="space-y-7">
        <ProductImages product={product} onChange={setProduct} />
        <ProductForm
          product={product}
          onSaved={(next) => {
            setProduct(next)
            setNotice('Changes saved. The storefront uses the new values immediately.')
          }}
        />
        <ProductVariants product={product} onChange={setProduct} />
      </div>
    </div>
  )
}
