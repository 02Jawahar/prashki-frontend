'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Trash2, Upload } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { Alert, Button, EmptyState } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import type { ProductDetail } from '@/types/api'

/**
 * Image management (spec §12): upload, delete, reorder. Order is what the
 * storefront gallery uses, so the first image is the one shown in listings.
 */
export function ProductImages({
  product,
  onChange,
}: {
  product: ProductDetail
  onChange: (product: ProductDetail) => void
}) {
  const { can } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editable = can('media.upload')

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await adminService.uploadImages(product.id, Array.from(files))
      onChange(await adminService.product(product.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove(imageId: string) {
    setBusy(true)
    setError(null)
    try {
      await adminService.deleteImage(product.id, imageId)
      onChange(await adminService.product(product.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the image')
    } finally {
      setBusy(false)
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...product.images]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]

    setBusy(true)
    try {
      onChange(await adminService.reorderImages(product.id, next.map((i) => i.id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reorder')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="border border-rule bg-white p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="label-caps">Images</h2>
          <p className="mt-1 text-xs text-ink-soft">
            The first image is used in listings. JPEG, PNG, WebP or AVIF, up to 5 MB each.
          </p>
        </div>

        {editable && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              hidden
              onChange={(e) => void upload(e.target.files)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5" strokeWidth={1.6} />
              Upload
            </Button>
          </>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {product.images.length === 0 ? (
        <EmptyState
          title="No images yet"
          body={editable ? 'Upload at least one image before publishing.' : undefined}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {product.images.map((image, index) => (
            <li key={image.id} className="group relative">
              <div className="relative aspect-2/3 overflow-hidden bg-sage-50">
                <Image
                  src={image.url}
                  alt={image.altText ?? product.name}
                  fill
                  sizes="(min-width: 640px) 25vw, 50vw"
                  className="object-cover"
                />
                {index === 0 && (
                  <span className="badge badge-info absolute left-2 top-2">Primary</span>
                )}
              </div>

              {editable && (
                <div className="mt-2 flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy || index === 0}
                      onClick={() => void move(index, -1)}
                      aria-label="Move earlier"
                      className="p-1 text-ink-soft hover:text-ink disabled:opacity-30"
                    >
                      <ArrowLeft className="size-3.5" strokeWidth={1.6} />
                    </button>
                    <button
                      type="button"
                      disabled={busy || index === product.images.length - 1}
                      onClick={() => void move(index, 1)}
                      aria-label="Move later"
                      className="p-1 text-ink-soft hover:text-ink disabled:opacity-30"
                    >
                      <ArrowRight className="size-3.5" strokeWidth={1.6} />
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(image.id)}
                    aria-label="Delete image"
                    className="p-1 text-ink-soft hover:text-danger disabled:opacity-30"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.6} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
