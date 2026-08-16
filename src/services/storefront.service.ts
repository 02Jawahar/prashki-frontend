import { apiClient } from './api-client'
import type { Pagination } from '@/types/api'

/**
 * Customer-facing services for the modules added after the boilerplate:
 * shipping quotes, tracking, returns, wishlist, reviews and notifications.
 *
 * Grouped in one file because each is small and they are all "the storefront
 * talking about an order it already owns" — splitting them would be six files
 * of four lines each.
 */

function qs(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

// -------------------------------------------------------------- shipping

export interface ShippingQuote {
  id: string
  name: string
  description: string | null
  cost: number
  rate: number
  isFree: boolean
  isCod: boolean
  codFee: number
  minDays: number | null
  maxDays: number | null
}

export interface ServiceabilityAnswer {
  serviceable: boolean
  codAvailable: boolean
  zone: { id: string; name: string } | null
  reason: string | null
  estimate: { minDays: number; maxDays: number } | null
}

export const shippingService = {
  /**
   * The basket value and parcel weight come from the server's copy of the
   * cart, so the query only carries the destination.
   */
  quote: (destination: { country?: string; state?: string; postalCode?: string }) =>
    apiClient
      .get<{
        zone: { id: string; name: string } | null
        methods: ShippingQuote[]
        serviceable: boolean
        reason: string | null
        weightGrams: number
        deliverable: boolean
      }>(`/shipping/quote${qs({ country: 'IN', ...destination })}`)
      .then((r) => r.data),

  /** "Do you deliver to my PIN?" — cart-independent, so a product page can ask. */
  serviceability: (postalCode: string, country = 'IN') =>
    apiClient
      .get<ServiceabilityAnswer>(`/shipping/serviceability${qs({ postalCode, country })}`)
      .then((r) => r.data),
}

// -------------------------------------------------------------- tracking

export type ShipmentStatus =
  | 'PENDING'
  | 'READY_TO_SHIP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED_TO_ORIGIN'
  | 'CANCELLED'

export interface ShipmentEvent {
  id: string
  status: ShipmentStatus
  message: string | null
  location: string | null
  occurredAt: string
}

export interface Shipment {
  id: string
  shipmentNumber: string
  status: ShipmentStatus
  carrier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  shippedAt: string | null
  deliveredAt: string | null
  estimatedAt: string | null
  items: Array<{
    id: string
    quantity: number
    orderItem: {
      id: string
      productNameSnapshot: string
      variantNameSnapshot: string | null
      imageUrlSnapshot: string | null
    }
  }>
  events: ShipmentEvent[]
}

export const trackingService = {
  forOrder: (orderId: string) =>
    apiClient
      .get<{ order: { id: string; orderNumber: string; status: string }; shipments: Shipment[] }>(
        `/tracking/orders/${orderId}`,
      )
      .then((r) => r.data),
}

// --------------------------------------------------------------- returns

export const RETURN_REASONS = [
  { value: 'WRONG_SIZE', label: 'The size was wrong' },
  { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
  { value: 'DAMAGED', label: 'It arrived damaged' },
  { value: 'DEFECTIVE', label: 'There is a fault' },
  { value: 'WRONG_ITEM', label: 'The wrong item arrived' },
  { value: 'CHANGED_MIND', label: 'I changed my mind' },
  { value: 'OTHER', label: 'Something else' },
] as const

export type ReturnStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'INSPECTED'
  | 'COMPLETED'
  | 'CANCELLED'

export interface ReturnableLine {
  orderItemId: string
  productName: string
  variantName: string | null
  imageUrl: string | null
  purchased: number
  claimed: number
  returnable: number
  unitValue: number
}

export interface ReturnRequest {
  id: string
  returnNumber: string
  status: ReturnStatus
  resolution: string
  reason: string
  comment: string | null
  rejectionReason: string | null
  carrier: string | null
  trackingNumber: string | null
  requestedAt: string
  resolvedAt: string | null
  order: { id: string; orderNumber: string; status: string; total: number; currency: string }
  items: Array<{
    id: string
    quantity: number
    refundableAmount: number
    orderItem: {
      id: string
      productNameSnapshot: string
      variantNameSnapshot: string | null
      imageUrlSnapshot: string | null
    }
  }>
  statusHistory: Array<{ id: string; status: ReturnStatus; note: string | null; createdAt: string }>
  refunds: Array<{ id: string; amount: number; status: string; createdAt: string }>
}

export const returnService = {
  eligibility: (orderId: string) =>
    apiClient
      .get<{
        order: { id: string; orderNumber: string; status: string }
        eligible: boolean
        reason: string | null
        windowClosesAt: string | null
        lines: ReturnableLine[]
      }>(`/returns/eligibility/${orderId}`)
      .then((r) => r.data),

  create: (input: {
    orderId: string
    reason: string
    comment?: string
    images?: string[]
    resolution?: 'REFUND' | 'EXCHANGE' | 'STORE_CREDIT'
    items: Array<{ orderItemId: string; quantity: number }>
  }) =>
    apiClient
      .post<{ request: ReturnRequest; estimatedRefund: number }>('/returns', input)
      .then((r) => r.data),

  list: () => apiClient.get<{ requests: ReturnRequest[] }>('/returns').then((r) => r.data.requests),

  byId: (id: string) =>
    apiClient.get<{ request: ReturnRequest }>(`/returns/${id}`).then((r) => r.data.request),

  cancel: (id: string) =>
    apiClient.post<{ request: ReturnRequest }>(`/returns/${id}/cancel`).then((r) => r.data.request),
}

// -------------------------------------------------------------- wishlist

export interface WishlistItem {
  id: string
  addedAt: string
  available: boolean
  inStock: boolean
  price: number
  compareAtPrice: number | null
  discountPercent: number
  variant: { id: string; name: string; sku: string } | null
  product: { id: string; name: string; slug: string; image: string | null; status: string }
}

export const wishlistService = {
  list: () =>
    apiClient.get<{ items: WishlistItem[]; count: number }>('/wishlist').then((r) => r.data),

  add: (productId: string, variantId?: string) =>
    apiClient
      .post<{ item: WishlistItem; alreadySaved?: boolean }>('/wishlist', { productId, variantId })
      .then((r) => r.data),

  removeByProduct: (productId: string) =>
    apiClient.delete<{ removed: boolean }>(`/wishlist/product/${productId}`).then((r) => r.data),

  remove: (id: string) => apiClient.delete<{ removed: boolean }>(`/wishlist/${id}`).then((r) => r.data),
}

// --------------------------------------------------------------- reviews

export interface Review {
  id: string
  rating: number
  title: string | null
  body: string | null
  images: string[]
  isVerifiedPurchase: boolean
  helpfulCount: number
  adminResponse: string | null
  adminRespondedAt: string | null
  createdAt: string
  user: { id: string; name: string }
}

export interface ReviewSummary {
  average: number
  count: number
  breakdown: Record<string, number>
}

export const reviewService = {
  forProduct: (productId: string, query: { sort?: string; rating?: number; page?: number } = {}) =>
    apiClient
      .get<{ reviews: Review[]; summary: ReviewSummary }>(
        `/reviews/product/${productId}${qs(query)}`,
      )
      .then((r) => ({ ...r.data, pagination: r.pagination as Pagination })),

  mine: (productId: string) =>
    apiClient
      .get<{ review: (Review & { status: string; rejectionReason: string | null }) | null }>(
        `/reviews/mine/${productId}`,
      )
      .then((r) => r.data.review),

  submit: (input: {
    productId: string
    rating: number
    title?: string
    body?: string
    images?: string[]
  }) =>
    apiClient
      .post<{ review: { id: string; status: string }; message: string }>('/reviews', input)
      .then((r) => r.data),

  markHelpful: (id: string) =>
    apiClient
      .post<{ review: { id: string; helpfulCount: number } }>(`/reviews/${id}/helpful`)
      .then((r) => r.data.review),
}

// --------------------------------------------------------- notifications

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  link: string | null
  readAt: string | null
  createdAt: string
}

export const notificationService = {
  list: (query: { unreadOnly?: boolean; page?: number } = {}) =>
    apiClient
      .get<{ notifications: Notification[]; unread: number }>(`/notifications${qs(query)}`)
      .then((r) => ({ ...r.data, pagination: r.pagination as Pagination })),

  markRead: (id: string) =>
    apiClient.post<{ read: boolean; unread: number }>(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    apiClient.post<{ markedRead: number; unread: number }>('/notifications/read-all').then((r) => r.data),

  preferences: () =>
    apiClient
      .get<{ preferences: Array<{ id: string; channel: string; type: string; enabled: boolean }> }>(
        '/notification-preferences',
      )
      .then((r) => r.data.preferences),

  savePreferences: (preferences: Array<{ channel: string; type: string; enabled: boolean }>) =>
    apiClient
      .put<{ preferences: Array<{ id: string; channel: string; type: string; enabled: boolean }> }>(
        '/notification-preferences',
        { preferences },
      )
      .then((r) => r.data.preferences),
}

// -------------------------------------------------------------- analytics

/**
 * Best-effort. Analytics must never block an interaction or surface an error,
 * so failures are swallowed on purpose.
 */
export function trackEvent(
  type: string,
  payload: { entityType?: string; entityId?: string; properties?: Record<string, string | number | boolean | null> } = {},
): void {
  void apiClient.post('/analytics', { type, ...payload }).catch(() => undefined)
}
