import { apiClient } from './api-client'
import type { Pagination } from '@/types/api'

/**
 * Admin services for the modules added after the boilerplate.
 *
 * Kept apart from `admin.service.ts` so the original file stays readable; both
 * speak to the same `/admin` subtree, and every endpoint behind them re-checks
 * the caller's permission server-side.
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

// --------------------------------------------------------------- coupons

export type DiscountType = 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING'
export type CouponStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED'

export interface Coupon {
  id: string
  code: string
  description: string | null
  type: DiscountType
  status: CouponStatus
  /** Basis points for PERCENTAGE (1000 = 10%), paise for FIXED. */
  value: number
  maxDiscount: number | null
  minSubtotal: number
  startsAt: string | null
  endsAt: string | null
  usageLimit: number | null
  usageCount: number
  perUserLimit: number | null
  firstOrderOnly: boolean
  excludeDiscounted: boolean
  isPublic: boolean
  redemptionCount: number
  percentLabel: string | null
  products: Array<{ id: string; name: string; slug: string }>
  categories: Array<{ id: string; name: string; slug: string }>
  createdAt: string
}

export interface CouponInput {
  code: string
  description?: string | null
  type: DiscountType
  status: CouponStatus
  value: number
  maxDiscount?: number | null
  minSubtotal: number
  startsAt?: string | null
  endsAt?: string | null
  usageLimit?: number | null
  perUserLimit?: number | null
  firstOrderOnly: boolean
  excludeDiscounted: boolean
  isPublic: boolean
  productIds: string[]
  categoryIds: string[]
}

export const couponService = {
  list: (query: { q?: string; status?: string; page?: number } = {}) =>
    apiClient
      .get<{ coupons: Coupon[] }>(`/admin/coupons${qs(query)}`)
      .then((r) => ({ coupons: r.data.coupons, pagination: r.pagination as Pagination })),

  byId: (id: string) =>
    apiClient.get<{ coupon: Coupon }>(`/admin/coupons/${id}`).then((r) => r.data.coupon),

  create: (input: CouponInput) =>
    apiClient.post<{ coupon: Coupon }>('/admin/coupons', input).then((r) => r.data.coupon),

  update: (id: string, input: CouponInput) =>
    apiClient.patch<{ coupon: Coupon }>(`/admin/coupons/${id}`, input).then((r) => r.data.coupon),

  /** A redeemed coupon is expired rather than deleted; the response says which. */
  remove: (id: string) =>
    apiClient
      .delete<{ deleted: boolean; expired: boolean; message?: string }>(`/admin/coupons/${id}`)
      .then((r) => r.data),
}

// -------------------------------------------------------------- shipping

/** A rate band. Bounds are inclusive-lower, exclusive-upper; null = unbounded. */
export interface ShippingRate {
  id?: string
  label: string | null
  minWeightGrams: number | null
  maxWeightGrams: number | null
  minSubtotal: number | null
  maxSubtotal: number | null
  amount: number
  position: number
}

export interface ShippingMethod {
  id: string
  zoneId: string
  name: string
  description: string | null
  rate: number
  freeAbove: number | null
  minSubtotal: number | null
  maxSubtotal: number | null
  maxWeightGrams: number | null
  minDays: number | null
  maxDays: number | null
  isCod: boolean
  codFee: number
  provider: string | null
  isActive: boolean
  position: number
  rates: ShippingRate[]
}

export interface ShippingZone {
  id: string
  name: string
  countries: string[]
  regions: string[]
  isDefault: boolean
  isActive: boolean
  /** False turns the zone into an explicit refusal. */
  isServiceable: boolean
  unserviceableMessage: string | null
  position: number
  methods: ShippingMethod[]
}

/** A carrier adapter this build can talk to. */
export interface CarrierAdapter {
  name: string
  /** False means parcels on this carrier are booked by hand. */
  canCreateShipments: boolean
  /** False means it is registered but missing its credentials. */
  configured: boolean
  isDefault: boolean
}

export const shippingAdminService = {
  zones: () =>
    apiClient
      .get<{
        zones: ShippingZone[]
        provider: { name: string; canCreateShipments: boolean }
        providers: CarrierAdapter[]
      }>('/admin/shipping/zones')
      .then((r) => r.data),

  /** Replaces a method's bands wholesale — the editor sends the full set. */
  saveRates: (methodId: string, rates: Array<Omit<ShippingRate, 'id'>>) =>
    apiClient
      .put<{ method: ShippingMethod }>(`/admin/shipping/methods/${methodId}/rates`, { rates })
      .then((r) => r.data.method),

  createZone: (input: Partial<ShippingZone>) =>
    apiClient.post<{ zone: ShippingZone }>('/admin/shipping/zones', input).then((r) => r.data.zone),

  updateZone: (id: string, input: Partial<ShippingZone>) =>
    apiClient
      .patch<{ zone: ShippingZone }>(`/admin/shipping/zones/${id}`, input)
      .then((r) => r.data.zone),

  deleteZone: (id: string) =>
    apiClient
      .delete<{ deleted: boolean; message?: string }>(`/admin/shipping/zones/${id}`)
      .then((r) => r.data),

  createMethod: (zoneId: string, input: Partial<ShippingMethod>) =>
    apiClient
      .post<{ method: ShippingMethod }>(`/admin/shipping/zones/${zoneId}/methods`, input)
      .then((r) => r.data.method),

  updateMethod: (id: string, input: Partial<ShippingMethod>) =>
    apiClient
      .patch<{ method: ShippingMethod }>(`/admin/shipping/methods/${id}`, input)
      .then((r) => r.data.method),

  deleteMethod: (id: string) =>
    apiClient
      .delete<{ deleted: boolean; message?: string }>(`/admin/shipping/methods/${id}`)
      .then((r) => r.data),
}

// ------------------------------------------------------------ shipments

export interface AdminShipment {
  id: string
  orderId: string
  shipmentNumber: string
  status: string
  carrier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  weightGrams: number | null
  lengthMm: number | null
  widthMm: number | null
  heightMm: number | null
  /** Paise the courier collects on delivery. Zero for a prepaid parcel. */
  codAmount: number
  /**
   * Whether a carrier could actually book this parcel. False for a method that
   * books by hand, and false once it is already booked — the server decides,
   * because which adapters exist is a property of the build.
   */
  canBook: boolean
  /** Carrier references. Null when the parcel was booked by hand. */
  provider: string | null
  providerShipmentId: string | null
  labelUrl: string | null
  dispatchedBy: string | null
  packedAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  estimatedAt: string | null
  /** Raised by a carrier exception, or by an event that arrived out of order. */
  needsReview: boolean
  reviewReason: string | null
  notes: string | null
  createdAt: string
  items: Array<{ id: string; orderItemId: string; quantity: number; orderItem: { productNameSnapshot: string; variantNameSnapshot: string | null } }>
  events: Array<{
    id: string
    status: string
    message: string | null
    location: string | null
    occurredAt: string
    source: string
    providerStatus: string | null
    ignoredForStatus: boolean
  }>
}

export const shipmentService = {
  forOrder: (orderId: string) =>
    apiClient
      .get<{ shipments: AdminShipment[] }>(`/admin/shipments${qs({ orderId })}`)
      .then((r) => r.data.shipments),

  create: (
    orderId: string,
    input: {
      items: Array<{ orderItemId: string; quantity: number }>
      carrier?: string | null
      trackingNumber?: string | null
      weightGrams?: number | null
      lengthMm?: number | null
      widthMm?: number | null
      heightMm?: number | null
      estimatedAt?: string | null
      notes?: string | null
      dispatchedBy?: string | null
      bookWithProvider?: boolean
    },
  ) =>
    apiClient
      .post<{
        shipment: AdminShipment
        fullyShipped: boolean
        booked: boolean
        bookingError?: string
      }>(`/admin/shipments/orders/${orderId}`, input)
      .then((r) => r.data),

  /** Books, or retries booking, an existing parcel with the carrier. */
  book: (id: string) =>
    apiClient
      .post<{ shipment: AdminShipment }>(`/admin/shipments/${id}/book`)
      .then((r) => r.data.shipment),

  /** Clears the review flag once an operator has looked at the parcel. */
  markReviewed: (id: string) =>
    apiClient
      .post<{ shipment: AdminShipment }>(`/admin/shipments/${id}/reviewed`)
      .then((r) => r.data.shipment),

  updateTracking: (
    id: string,
    input: {
      carrier?: string | null
      trackingNumber?: string | null
      estimatedAt?: string | null
      notes?: string | null
      weightGrams?: number | null
      lengthMm?: number | null
      widthMm?: number | null
      heightMm?: number | null
      dispatchedBy?: string | null
    },
  ) =>
    apiClient
      .patch<{ shipment: AdminShipment }>(`/admin/shipments/${id}`, input)
      .then((r) => r.data.shipment),

  /**
   * Cancelling here also calls the parcel off with the carrier. That half is
   * best-effort, so `carrierError` comes back set when the courier could not be
   * reached and the pickup may still stand.
   */
  setStatus: (id: string, input: { status: string; message?: string; location?: string }) =>
    apiClient
      .patch<{ shipment: AdminShipment; carrierError: string | null }>(
        `/admin/shipments/${id}/status`,
        input,
      )
      .then((r) => r.data),
}

// -------------------------------------------------------------- returns

export interface AdminReturnSummary {
  id: string
  returnNumber: string
  status: string
  resolution: string
  reason: string
  itemCount: number
  order: { id: string; orderNumber: string; total: number }
  customer: { id: string; name: string; email: string | null }
  requestedAt: string
}

export interface AdminReturn {
  id: string
  returnNumber: string
  status: string
  resolution: string
  reason: string
  comment: string | null
  internalNotes: string | null
  rejectionReason: string | null
  images: string[]
  requestedAt: string
  order: { id: string; orderNumber: string; status: string; total: number; currency: string }
  user: { id: string; name: string; email: string | null; phone: string | null }
  items: Array<{
    id: string
    quantity: number
    restock: boolean
    condition: string | null
    refundableAmount: number
    orderItem: {
      id: string
      productNameSnapshot: string
      variantNameSnapshot: string | null
      imageUrlSnapshot: string | null
      quantity: number
    }
  }>
  statusHistory: Array<{ id: string; status: string; note: string | null; createdAt: string }>
  refunds: Array<{ id: string; amount: number; status: string; createdAt: string }>
}

export const returnAdminService = {
  list: (query: { q?: string; status?: string; page?: number } = {}) =>
    apiClient
      .get<{ requests: AdminReturnSummary[] }>(`/admin/returns${qs(query)}`)
      .then((r) => ({ requests: r.data.requests, pagination: r.pagination as Pagination })),

  byId: (id: string) =>
    apiClient
      .get<{ request: AdminReturn; refundable: { paid: number; refunded: number; refundable: number } }>(
        `/admin/returns/${id}`,
      )
      .then((r) => r.data),

  setStatus: (
    id: string,
    input: {
      status: string
      note?: string
      rejectionReason?: string
      itemDispositions?: Array<{ returnItemId: string; restock: boolean; condition?: string }>
    },
  ) =>
    apiClient
      .patch<{ request: AdminReturn }>(`/admin/returns/${id}/status`, input)
      .then((r) => r.data.request),

  setInternalNotes: (id: string, internalNotes: string) =>
    apiClient
      .patch<{ request: AdminReturn }>(`/admin/returns/${id}/internal-notes`, { internalNotes })
      .then((r) => r.data.request),
}

export const refundService = {
  forOrder: (orderId: string) =>
    apiClient
      .get<{
        paid: number
        refunded: number
        refundable: number
        refunds: Array<{ id: string; amount: number; status: string; reason: string | null; createdAt: string }>
      }>(`/admin/refunds/orders/${orderId}`)
      .then((r) => r.data),

  create: (input: { orderId: string; amount: number; reason?: string; returnRequestId?: string }) =>
    apiClient
      .post<{ refund: { id: string; amount: number; status: string }; refundable: number }>(
        '/admin/refunds',
        input,
      )
      .then((r) => r.data),
}

// ----------------------------------------------------------------- pages

export interface AdminPageSummary {
  id: string
  slug: string
  title: string
  status: string
  isSystem: boolean
  publishedAt: string | null
  scheduledFor: string | null
  updatedAt: string
  _count: { revisions: number }
}

export interface AdminPage {
  id: string
  slug: string
  title: string
  status: string
  blocks: Array<{ type: string; data: Record<string, unknown> }>
  seoTitle: string | null
  seoDescription: string | null
  seoNoindex: boolean
  ogImage: string | null
  isSystem: boolean
  publishedAt: string | null
  scheduledFor: string | null
  revisions: Array<{ id: string; version: number; title: string; note: string | null; createdAt: string }>
}

export const pageService = {
  list: (query: { q?: string; status?: string; page?: number } = {}) =>
    apiClient
      .get<{ pages: AdminPageSummary[] }>(`/admin/pages${qs(query)}`)
      .then((r) => ({ pages: r.data.pages, pagination: r.pagination as Pagination })),

  byId: (id: string) =>
    apiClient.get<{ page: AdminPage }>(`/admin/pages/${id}`).then((r) => r.data.page),

  create: (input: Partial<AdminPage> & { revisionNote?: string }) =>
    apiClient.post<{ page: AdminPage }>('/admin/pages', input).then((r) => r.data.page),

  update: (id: string, input: Partial<AdminPage> & { revisionNote?: string }) =>
    apiClient.patch<{ page: AdminPage }>(`/admin/pages/${id}`, input).then((r) => r.data.page),

  restore: (id: string, revisionId: string) =>
    apiClient
      .post<{ page: AdminPage }>(`/admin/pages/${id}/restore/${revisionId}`)
      .then((r) => r.data.page),

  remove: (id: string) =>
    apiClient
      .delete<{ deleted: boolean; message?: string }>(`/admin/pages/${id}`)
      .then((r) => r.data),
}

// ------------------------------------------------------------- redirects

export interface Redirect {
  id: string
  fromPath: string
  toPath: string
  statusCode: number
  isActive: boolean
  hitCount: number
  lastHitAt: string | null
  note: string | null
  createdAt: string
}

export const redirectService = {
  list: (query: { q?: string; page?: number } = {}) =>
    apiClient
      .get<{ redirects: Redirect[] }>(`/admin/redirects${qs(query)}`)
      .then((r) => ({ redirects: r.data.redirects, pagination: r.pagination as Pagination })),

  create: (input: Partial<Redirect>) =>
    apiClient.post<{ redirect: Redirect }>('/admin/redirects', input).then((r) => r.data.redirect),

  update: (id: string, input: Partial<Redirect>) =>
    apiClient
      .patch<{ redirect: Redirect }>(`/admin/redirects/${id}`, input)
      .then((r) => r.data.redirect),

  remove: (id: string) =>
    apiClient.delete<{ deleted: boolean }>(`/admin/redirects/${id}`).then((r) => r.data),
}

// --------------------------------------------------------------- reviews

export interface AdminReview {
  id: string
  rating: number
  title: string | null
  body: string | null
  images: string[]
  status: string
  isVerifiedPurchase: boolean
  adminResponse: string | null
  rejectionReason: string | null
  helpfulCount: number
  createdAt: string
  user: { id: string; name: string; email: string | null }
  product: { id: string; name: string; slug: string }
}

export const reviewAdminService = {
  list: (query: { status?: string; productId?: string; page?: number } = {}) =>
    apiClient
      .get<{ reviews: AdminReview[]; pendingCount: number }>(`/admin/reviews${qs(query)}`)
      .then((r) => ({ ...r.data, pagination: r.pagination as Pagination })),

  setStatus: (id: string, input: { status: string; rejectionReason?: string }) =>
    apiClient
      .patch<{ review: AdminReview }>(`/admin/reviews/${id}/status`, input)
      .then((r) => r.data.review),

  respond: (id: string, adminResponse: string) =>
    apiClient
      .patch<{ review: AdminReview }>(`/admin/reviews/${id}/response`, { adminResponse })
      .then((r) => r.data.review),

  remove: (id: string) =>
    apiClient.delete<{ deleted: boolean }>(`/admin/reviews/${id}`).then((r) => r.data),
}

// ------------------------------------------------------------ attributes

export interface AttributeValue {
  id: string
  value: string
  slug: string
  colorHex: string | null
  position: number
  usageCount: number
}

export interface Attribute {
  id: string
  name: string
  slug: string
  isSwatch: boolean
  isFilterable: boolean
  position: number
  values: AttributeValue[]
}

export const attributeService = {
  list: () =>
    apiClient.get<{ attributes: Attribute[] }>('/admin/attributes').then((r) => r.data.attributes),

  create: (input: { name: string; isSwatch: boolean; isFilterable: boolean; position?: number }) =>
    apiClient.post<{ attribute: Attribute }>('/admin/attributes', input).then((r) => r.data.attribute),

  update: (id: string, input: Partial<{ name: string; isSwatch: boolean; isFilterable: boolean; position: number }>) =>
    apiClient
      .patch<{ attribute: Attribute }>(`/admin/attributes/${id}`, input)
      .then((r) => r.data.attribute),

  remove: (id: string) =>
    apiClient.delete<{ deleted: boolean }>(`/admin/attributes/${id}`).then((r) => r.data),

  addValue: (attributeId: string, input: { value: string; colorHex?: string | null; position?: number }) =>
    apiClient
      .post<{ value: AttributeValue }>(`/admin/attributes/${attributeId}/values`, input)
      .then((r) => r.data.value),

  updateValue: (valueId: string, input: Partial<{ value: string; colorHex: string | null; position: number }>) =>
    apiClient
      .patch<{ value: AttributeValue }>(`/admin/attributes/values/${valueId}`, input)
      .then((r) => r.data.value),

  removeValue: (valueId: string) =>
    apiClient.delete<{ deleted: boolean }>(`/admin/attributes/values/${valueId}`).then((r) => r.data),

  setVariantOptions: (variantId: string, attributeValueIds: string[]) =>
    apiClient
      .put<{ variantId: string }>(`/admin/attributes/variants/${variantId}`, { attributeValueIds })
      .then((r) => r.data),
}

// -------------------------------------------------------------- messaging

export interface MessageTemplate {
  id: string
  key: string
  channel: string
  name: string
  subject: string | null
  body: string
  providerTemplateId: string | null
  variables: string[]
  isActive: boolean
}

export interface MessageLog {
  id: string
  channel: string
  recipient: string
  subject: string | null
  status: string
  entityType: string | null
  entityId: string | null
  error: string | null
  attempts: number
  sentAt: string | null
  createdAt: string
  template: { key: string; name: string } | null
}

export interface MessageEventChannel {
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS'
  templateId: string | null
  /** A template exists, whether or not it is switched on. */
  configured: boolean
  /** The channel will actually send. */
  enabled: boolean
}

export interface MessageEvent {
  key: string
  label: string
  description: string
  channels: MessageEventChannel[]
  transactional: boolean
}

export const messagingService = {
  templates: () =>
    apiClient
      .get<{ templates: MessageTemplate[] }>('/admin/messaging/templates')
      .then((r) => r.data.templates),

  saveTemplate: (input: Omit<MessageTemplate, 'id'>) =>
    apiClient
      .put<{ template: MessageTemplate }>('/admin/messaging/templates', input)
      .then((r) => r.data.template),

  /** Events the store can message about, with the state of each channel. */
  events: () =>
    apiClient
      .get<{ events: MessageEvent[]; orphans: Array<{ id: string; key: string; channel: string }> }>(
        '/admin/messaging/events',
      )
      .then((r) => r.data),

  /** Turns a channel on or off, creating the template the first time. */
  setChannel: (input: { key: string; channel: string; enabled: boolean }) =>
    apiClient
      .put<{ template: MessageTemplate | null; created: boolean }>(
        '/admin/messaging/events/channels',
        input,
      )
      .then((r) => r.data),

  /** Renders a template with sample values, including unsaved edits. */
  preview: (input: {
    key: string
    channel: string
    subject?: string | null
    body?: string
  }) =>
    apiClient
      .post<{
        subject: string | null
        body: string
        usedVariables: Record<string, string>
        undeclared: string[]
      }>('/admin/messaging/templates/preview', input)
      .then((r) => r.data),

  /** Sends the real thing, to the signed-in admin. The API ignores any address. */
  testSend: (input: { key: string; channel: string }) =>
    apiClient
      .post<{ sent: boolean; reason: string | null; recipient: string; provider: string }>(
        '/admin/messaging/templates/test-send',
        input,
      )
      .then((r) => r.data),

  logs: (query: { channel?: string; status?: string; page?: number } = {}) =>
    apiClient
      .get<{ logs: MessageLog[] }>(`/admin/messaging/logs${qs(query)}`)
      .then((r) => ({ logs: r.data.logs, pagination: r.pagination as Pagination })),
}

// --------------------------------------------------------------- reports

export interface SalesReport {
  range: { from: string; to: string; interval: string }
  orders: number
  grossRevenue: number
  refunds: number
  netRevenue: number
  averageOrderValue: number
  breakdown: { subtotal: number; discount: number; shipping: number; tax: number }
  series: Array<{ date: string; orders: number; revenue: number }>
}

export const reportService = {
  sales: (query: { from?: string; to?: string; interval?: string } = {}) =>
    apiClient.get<SalesReport>(`/admin/reports/sales${qs(query)}`).then((r) => r.data),

  topProducts: (query: { from?: string; to?: string; limit?: number } = {}) =>
    apiClient
      .get<{ products: Array<{ productId: string | null; name: string; unitsSold: number; revenue: number }> }>(
        `/admin/reports/top-products${qs(query)}`,
      )
      .then((r) => r.data.products),

  inventory: () =>
    apiClient
      .get<{
        variantsTracked: number
        unitsInStock: number
        lowStockCount: number
        outOfStockCount: number
        fastestMoving: Array<{ variantId: string; sku: string; productName: string; unitsSold: number; remaining: number }>
      }>('/admin/reports/inventory')
      .then((r) => r.data),

  customers: (query: { from?: string; to?: string } = {}) =>
    apiClient
      .get<{
        newCustomers: number
        totalCustomers: number
        customersWhoBought: number
        repeatCustomers: number
        repeatRate: number
      }>(`/admin/reports/customers${qs(query)}`)
      .then((r) => r.data),

  searches: (query: { from?: string; to?: string; limit?: number } = {}) =>
    apiClient
      .get<{ searches: Array<{ term: string; searches: number; zeroResults: number }> }>(
        `/admin/reports/searches${qs(query)}`,
      )
      .then((r) => r.data.searches),
}

// ------------------------------------------------------- roles and staff

export interface PermissionRow {
  id: string
  key: string
  group: string
  label: string
}

export interface Role {
  id: string
  key: string
  name: string
  description: string | null
  isSystem: boolean
  /** Super Admin — always holds everything, grants not editable. */
  isLocked: boolean
  userCount: number
  permissions: string[]
}

export interface StaffMember {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  emailVerified: boolean
  lastLoginAt: string | null
  createdAt: string
  roles: Array<{ id: string; key: string; name: string }>
  /** True until they first sign in — the invitation is outstanding. */
  pendingInvite: boolean
}

export const rbacService = {
  permissions: () =>
    apiClient
      .get<{
        permissions: PermissionRow[]
        groups: Array<{ group: string; permissions: PermissionRow[] }>
      }>('/admin/permissions')
      .then((r) => r.data),

  roles: () => apiClient.get<{ roles: Role[] }>('/admin/roles').then((r) => r.data.roles),

  createRole: (input: { name: string; description?: string | null; permissions: string[] }) =>
    apiClient.post<{ role: Role }>('/admin/roles', input).then((r) => r.data.role),

  updateRole: (
    id: string,
    input: { name: string; description?: string | null; permissions: string[] },
  ) => apiClient.patch<{ role: Role }>(`/admin/roles/${id}`, input).then((r) => r.data.role),

  deleteRole: (id: string) =>
    apiClient.delete<{ deleted: boolean }>(`/admin/roles/${id}`).then((r) => r.data),

  staff: (query: { q?: string; page?: number } = {}) =>
    apiClient
      .get<{ staff: StaffMember[] }>(`/admin/staff${qs(query)}`)
      .then((r) => ({ staff: r.data.staff, pagination: r.pagination as Pagination })),

  invite: (input: { name: string; email: string; roleIds: string[] }) =>
    apiClient
      .post<{ staff: StaffMember; message: string }>('/admin/staff', input)
      .then((r) => r.data),

  updateStaff: (id: string, input: { roleIds?: string[]; status?: 'ACTIVE' | 'SUSPENDED' }) =>
    apiClient.patch<{ staff: StaffMember }>(`/admin/staff/${id}`, input).then((r) => r.data.staff),

  resendInvite: (id: string) =>
    apiClient
      .post<{ sent: boolean; message: string }>(`/admin/staff/${id}/invite`)
      .then((r) => r.data),
}

// ------------------------------------------------------------- audit log

export interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  metadata: Record<string, unknown> | null
  ip: string | null
  userAgent: string | null
  createdAt: string
  actor: { id: string; name: string; email: string | null } | null
}

export const auditService = {
  list: (
    query: {
      action?: string
      entityType?: string
      entityId?: string
      userId?: string
      page?: number
    } = {},
  ) =>
    apiClient
      .get<{ entries: AuditEntry[]; actions: string[] }>(`/admin/audit${qs(query)}`)
      .then((r) => ({ ...r.data, pagination: r.pagination as Pagination })),
}

// ----------------------------------------------------- customer showcase

export interface AdminShowcaseItem {
  id: string
  mediaType: 'VIDEO' | 'IMAGE'
  mediaUrl: string
  posterUrl: string | null
  altText: string
  caption: string | null
  creditName: string | null
  creditHandle: string | null
  sourceUrl: string | null
  consentGrantedAt: string | null
  consentNote: string | null
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ARCHIVED'
  scheduledFor: string | null
  publishedAt: string | null
  position: number
  products: Array<{
    position: number
    product: { id: string; name: string; slug: string; status: string }
  }>
}

export interface ShowcaseInput {
  mediaType?: 'VIDEO' | 'IMAGE'
  mediaUrl?: string
  posterUrl?: string | null
  altText?: string
  caption?: string | null
  creditName?: string | null
  creditHandle?: string | null
  sourceUrl?: string | null
  consentGrantedAt?: string | null
  consentNote?: string | null
  status?: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ARCHIVED'
  scheduledFor?: string | null
  productIds?: string[]
}

export const showcaseService = {
  list: (query: { status?: string; page?: number } = {}) =>
    apiClient
      .get<{ items: AdminShowcaseItem[] }>(`/admin/showcase${qs(query)}`)
      .then((r) => ({ ...r.data, pagination: r.pagination as Pagination })),

  create: (input: ShowcaseInput) =>
    apiClient.post<{ item: AdminShowcaseItem }>('/admin/showcase', input).then((r) => r.data.item),

  update: (id: string, input: ShowcaseInput) =>
    apiClient
      .patch<{ item: AdminShowcaseItem }>(`/admin/showcase/${id}`, input)
      .then((r) => r.data.item),

  remove: (id: string) => apiClient.delete(`/admin/showcase/${id}`),

  reorder: (ids: string[]) =>
    apiClient.patch<{ reordered: number }>('/admin/showcase/reorder', { ids }).then((r) => r.data),
}

// ------------------------------------------------- webhook failure queue

export interface WebhookEventRecord {
  id: string
  provider: string
  eventId: string
  eventType: string
  status: 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'SKIPPED'
  error: string | null
  payload: unknown
  receivedAt: string
  processedAt: string | null
}

export interface RetryOutcome {
  status: 'PROCESSED' | 'FAILED' | 'SKIPPED'
  error?: string
}

export const webhookEventService = {
  list: (query: { status?: string; provider?: string; page?: number } = {}) =>
    apiClient
      .get<{ events: WebhookEventRecord[]; stuckCount: number }>(`/admin/webhook-events${qs(query)}`)
      .then((r) => ({ ...r.data, pagination: r.pagination as Pagination })),

  retry: (id: string) =>
    apiClient.post<RetryOutcome>(`/admin/webhook-events/${id}/retry`, {}).then((r) => r.data),
}

// ------------------------------------------------------- account erasure

export interface ErasureBlocker {
  reason: string
  count: number
}

export const erasureService = {
  check: (customerId: string) =>
    apiClient
      .get<{ canErase: boolean; blockers: ErasureBlocker[] }>(
        `/admin/customers/${customerId}/erasure`,
      )
      .then((r) => r.data),

  erase: (customerId: string, reason: string) =>
    apiClient
      .post<{ anonymisedAt: string; ordersRedacted: number }>(
        `/admin/customers/${customerId}/erasure`,
        { reason },
      )
      .then((r) => r.data),
}

// --------------------------------------------------------- customer notes

export interface CustomerNote {
  id: string
  body: string
  isPinned: boolean
  createdAt: string
  author: { id: string; name: string } | null
}

export const customerNoteService = {
  create: (customerId: string, input: { body: string; isPinned?: boolean }) =>
    apiClient
      .post<{ note: CustomerNote }>(`/admin/customers/${customerId}/notes`, input)
      .then((r) => r.data.note),

  update: (customerId: string, noteId: string, input: { body?: string; isPinned?: boolean }) =>
    apiClient
      .patch<{ note: CustomerNote }>(`/admin/customers/${customerId}/notes/${noteId}`, input)
      .then((r) => r.data.note),

  remove: (customerId: string, noteId: string) =>
    apiClient
      .delete<{ deleted: boolean }>(`/admin/customers/${customerId}/notes/${noteId}`)
      .then((r) => r.data),
}
