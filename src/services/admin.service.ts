import { apiClient } from './api-client'
import type { Order as AdminOrder } from './order.service'
import type {
  AdminCategory,
  AdminCustomer,
  DashboardStats,
  InventoryItem,
  InventoryMovement,
  Pagination,
  ProductDetail,
  ProductImage,
  ProductListItem,
  ProductStatus,
} from '@/types/api'

export interface AdminProductQuery {
  q?: string
  category?: string
  status?: ProductStatus
  sort?: string
  page?: number
  perPage?: number
}

function qs(query: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '' || value === null) continue
    params.set(key, String(value))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

export interface CreateProductInput {
  name: string
  description: string
  shortDescription?: string
  sku: string
  price: number
  compareAtPrice?: number | null
  status?: ProductStatus
  featured?: boolean
  categoryId?: string | null
  variants?: Array<{ name: string; sku: string; price?: number | null; stock: number }>
}

export const adminService = {
  // ------------------------------------------------------------ dashboard
  stats: () => apiClient.get<DashboardStats>('/admin/stats').then((r) => r.data),

  recentOrders: () =>
    apiClient
      .get<{ orders: Array<{ id: string; orderNumber: string; status: string; total: number; itemCount: number; customer: { name: string; email: string } | null; createdAt: string }> }>(
        '/admin/recent-orders',
      )
      .then((r) => r.data.orders),

  // ------------------------------------------------------------- products
  products: (query: AdminProductQuery = {}) =>
    apiClient
      .get<{ products: ProductListItem[] }>(`/admin/products${qs(query)}`)
      .then((r) => ({ products: r.data.products, pagination: r.pagination as Pagination })),

  product: (id: string) =>
    apiClient.get<{ product: ProductDetail }>(`/admin/products/${id}`).then((r) => r.data.product),

  createProduct: (input: CreateProductInput) =>
    apiClient.post<{ product: ProductDetail }>('/admin/products', input).then((r) => r.data.product),

  updateProduct: (id: string, input: Partial<CreateProductInput>) =>
    apiClient.patch<{ product: ProductDetail }>(`/admin/products/${id}`, input).then((r) => r.data.product),

  setProductStatus: (id: string, status: ProductStatus) =>
    apiClient
      .patch<{ product: ProductDetail }>(`/admin/products/${id}/status`, { status })
      .then((r) => r.data.product),

  deleteProduct: (id: string) =>
    apiClient.delete<{ deleted?: boolean; archived?: boolean; message?: string }>(`/admin/products/${id}`).then((r) => r.data),

  // ------------------------------------------------------------- variants
  createVariant: (productId: string, input: { name: string; sku: string; price?: number | null; stock: number }) =>
    apiClient
      .post<{ product: ProductDetail }>(`/admin/products/${productId}/variants`, input)
      .then((r) => r.data.product),

  updateVariant: (
    productId: string,
    variantId: string,
    input: { name?: string; sku?: string; price?: number | null; status?: 'ACTIVE' | 'INACTIVE' },
  ) =>
    apiClient
      .patch<{ product: ProductDetail }>(`/admin/products/${productId}/variants/${variantId}`, input)
      .then((r) => r.data.product),

  deleteVariant: (productId: string, variantId: string) =>
    apiClient.delete<{ product?: ProductDetail; deactivated?: boolean; message?: string }>(
      `/admin/products/${productId}/variants/${variantId}`,
    ).then((r) => r.data),

  // --------------------------------------------------------------- images
  uploadImages: (productId: string, files: File[]) => {
    const form = new FormData()
    for (const file of files) form.append('images', file)
    return apiClient.upload<{ images: ProductImage[] }>(`/admin/products/${productId}/images`, form).then((r) => r.data.images)
  },

  deleteImage: (productId: string, imageId: string) =>
    apiClient.delete<null>(`/admin/products/${productId}/images/${imageId}`),

  reorderImages: (productId: string, imageIds: string[]) =>
    apiClient
      .patch<{ product: ProductDetail }>(`/admin/products/${productId}/images/order`, { imageIds })
      .then((r) => r.data.product),

  // ------------------------------------------------------------ inventory
  inventory: (query: { q?: string; lowOnly?: boolean; page?: number; perPage?: number } = {}) =>
    apiClient
      .get<{ items: InventoryItem[] }>(`/admin/inventory${qs(query)}`)
      .then((r) => ({ items: r.data.items, pagination: r.pagination as Pagination })),

  movements: (variantId: string) =>
    apiClient
      .get<{ variantId: string; availableStock: number; movements: InventoryMovement[] }>(
        `/admin/inventory/${variantId}/movements`,
      )
      .then((r) => r.data),

  setStock: (variantId: string, stock: number, reason?: string) =>
    apiClient
      .post<{ variantId: string; availableStock: number }>(`/admin/products/variants/${variantId}/stock`, {
        mode: 'set',
        stock,
        reason,
      })
      .then((r) => r.data),

  adjustStock: (
    variantId: string,
    quantity: number,
    type: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'DAMAGE',
    reason?: string,
  ) =>
    apiClient
      .post<{ variantId: string; availableStock: number }>(`/admin/products/variants/${variantId}/stock`, {
        mode: 'delta',
        quantity,
        type,
        reason,
      })
      .then((r) => r.data),

  // ----------------------------------------------------------- categories
  categories: () =>
    apiClient.get<{ categories: AdminCategory[] }>('/admin/categories').then((r) => r.data.categories),

  createCategory: (input: { name: string; description?: string; status?: 'ACTIVE' | 'INACTIVE'; sortOrder?: number; parentId?: string | null }) =>
    apiClient.post<{ category: AdminCategory }>('/admin/categories', input).then((r) => r.data.category),

  updateCategory: (id: string, input: Record<string, unknown>) =>
    apiClient.patch<{ category: AdminCategory }>(`/admin/categories/${id}`, input).then((r) => r.data.category),

  deleteCategory: (id: string) =>
    apiClient.delete<{ deleted: boolean }>(`/admin/categories/${id}`).then((r) => r.data),

  // --------------------------------------------------------------- orders
  orders: (query: { q?: string; status?: string; page?: number; perPage?: number } = {}) =>
    apiClient
      .get<{
        orders: Array<{
          id: string
          orderNumber: string
          status: string
          total: number
          itemCount: number
          customer: { id: string; name: string; email: string } | null
          createdAt: string
        }>
      }>(`/admin/orders${qs(query)}`)
      .then((r) => ({ orders: r.data.orders, pagination: r.pagination as Pagination })),

  order: (id: string) =>
    apiClient.get<{ order: AdminOrder }>(`/admin/orders/${id}`).then((r) => r.data.order),

  setOrderStatus: (id: string, status: string, note?: string) =>
    apiClient
      .patch<{ order: AdminOrder }>(`/admin/orders/${id}/status`, { status, note })
      .then((r) => r.data.order),

  /** Staff-only. Never returned on a customer-facing endpoint. */
  setOrderInternalNotes: (id: string, internalNotes: string) =>
    apiClient
      .patch<{ order: AdminOrder }>(`/admin/orders/${id}/internal-notes`, { internalNotes })
      .then((r) => r.data.order),

  // ------------------------------------------------------------ customers
  customers: (query: { q?: string; page?: number; perPage?: number } = {}) =>
    apiClient
      .get<{ customers: AdminCustomer[] }>(`/admin/customers${qs(query)}`)
      .then((r) => ({ customers: r.data.customers, pagination: r.pagination as Pagination })),

  customer: (id: string) => apiClient.get<{ customer: unknown }>(`/admin/customers/${id}`).then((r) => r.data.customer),

  setCustomerStatus: (id: string, status: 'ACTIVE' | 'SUSPENDED') =>
    apiClient.patch<{ customer: AdminCustomer }>(`/admin/customers/${id}/status`, { status }).then((r) => r.data.customer),

  // ----------------------------------------------------------------- media
  /** Uploads hero/banner artwork. Accepts images and video. */
  uploadMedia: (file: File, folder: 'home' | 'banners' | 'categories' | 'misc' = 'home') => {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', folder)
    return apiClient
      .upload<{ url: string; key: string; size: number; contentType: string; kind: 'image' | 'video' }>(
        '/admin/media',
        form,
      )
      .then((r) => r.data)
  },

  deleteMedia: (key: string) =>
    apiClient.delete<null>(`/admin/media?key=${encodeURIComponent(key)}`),

  mediaLimits: () =>
    apiClient
      .get<{ maxFileBytes: number; allowed: string[]; folders: string[] }>('/admin/media/limits')
      .then((r) => r.data),

  // ------------------------------------------------------------- settings
  settings: () =>
    apiClient
      .get<{ settings: Array<{ id: string; key: string; value: string; type: string; group: string; label: string }> }>(
        '/admin/settings',
      )
      .then((r) => r.data.settings),

  updateSettings: (settings: Array<{ key: string; value: string }>) =>
    apiClient.patch<{ settings: unknown[] }>('/admin/settings', { settings }).then((r) => r.data),
}
