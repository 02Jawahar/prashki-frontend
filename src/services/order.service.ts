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
  productNameSnapshot: string
  variantNameSnapshot: string | null
  sku: string
  imageUrlSnapshot: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
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
  create: (input: { addressId: string; notes?: string }) =>
    apiClient.post<{ order: Order }>('/orders', input).then((r) => r.data.order),

  list: (page = 1) =>
    apiClient
      .get<{ orders: OrderSummary[] }>(`/orders?page=${page}`)
      .then((r) => ({ orders: r.data.orders, pagination: r.pagination as Pagination })),

  byId: (id: string) => apiClient.get<{ order: Order }>(`/orders/${id}`).then((r) => r.data.order),
}
