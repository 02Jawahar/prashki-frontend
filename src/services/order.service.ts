import { apiClient } from './api-client'
import type { Pagination } from '@/types/api'

export interface Address {
  id: string
  label: string | null
  name: string
  phone: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  postalCode: string
  country: string
  isDefault: boolean
}

export type AddressInput = Omit<Address, 'id'>

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export interface OrderItem {
  id: string
  productId: string | null
  productNameSnapshot: string
  variantNameSnapshot: string | null
  sku: string
  imageUrlSnapshot: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
  /** This line's share of the order discount, in paise. */
  discountAllocated: number
}

export interface OrderSummary {
  id: string
  orderNumber: string
  status: OrderStatus
  total: number
  createdAt: string
  itemCount: number
  items: Array<{ id: string; quantity: number; imageUrlSnapshot: string | null; productNameSnapshot: string }>
}

export interface AddressSnapshot {
  name: string
  phone: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  postalCode: string
  country: string
}

export interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
  currency: string
  notes: string | null
  /**
   * Staff-only. Present on admin reads and absent on customer reads, because
   * the API strips it rather than relying on the client not to render it.
   */
  internalNotes?: string | null
  couponCode: string | null
  shippingMethodName: string | null
  shippingAddressSnapshot: AddressSnapshot
  createdAt: string
  items: OrderItem[]
  statusHistory: Array<{ id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string | null; createdAt: string }>
  payments: Array<{ id: string; provider: string; status: string; amount: number; providerPaymentId: string | null; createdAt: string }>
  user?: { id: string; name: string; email: string; phone: string | null }
}

export const addressService = {
  list: () => apiClient.get<{ addresses: Address[] }>('/addresses').then((r) => r.data.addresses),
  create: (input: Partial<AddressInput>) =>
    apiClient.post<{ address: Address }>('/addresses', input).then((r) => r.data.address),
  update: (id: string, input: Partial<AddressInput>) =>
    apiClient.patch<{ address: Address }>(`/addresses/${id}`, input).then((r) => r.data.address),
  remove: (id: string) => apiClient.delete<{ deleted: boolean }>(`/addresses/${id}`),
}

export const orderService = {
  /**
   * `idempotencyKey` is what makes a double-clicked "Place order", or a retry
   * after a dropped connection, resolve to one order instead of two. The client
   * mints it once per checkout attempt and reuses it for every retry.
   */
  create: (input: {
    addressId: string
    notes?: string
    shippingMethodId?: string
    idempotencyKey?: string
  }) => apiClient.post<{ order: Order; replayed: boolean }>('/orders', input).then((r) => r.data),

  list: (page = 1) =>
    apiClient
      .get<{ orders: OrderSummary[] }>(`/orders?page=${page}`)
      .then((r) => ({ orders: r.data.orders, pagination: r.pagination as Pagination })),

  byId: (id: string) => apiClient.get<{ order: Order }>(`/orders/${id}`).then((r) => r.data.order),
}
