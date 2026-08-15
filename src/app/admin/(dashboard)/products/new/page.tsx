'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { ProductForm } from '@/components/admin/product-form'

export default function NewProductPage() {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/products" className="label-caps mb-4 inline-flex items-center gap-1 text-ink-soft hover:text-ink">
        <ChevronLeft className="size-3.5" strokeWidth={1.6} />
        Products
      </Link>

      <h1 className="display mb-1 text-2xl">New product</h1>
      <p className="mb-7 text-sm text-ink-soft">
        Create the product, then add images and adjust stock on the next screen.
      </p>

      <ProductForm onSaved={(product) => router.push(`/admin/products/${product.id}`)} />
    </div>
  )
}
