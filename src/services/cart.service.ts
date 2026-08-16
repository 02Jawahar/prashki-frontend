import { apiClient } from './api-client'

export interface CartItem {
  id: string
  variantId: string
  productId: string
  categoryId: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  /** This line's share of the applied coupon, in paise. */
  discountAllocated: number
  compareAtPrice: number | null
  discountPercent: number
  availableStock: number
  purchasable: boolean
  variant: { id: string; name: string; sku: string }
  product: { id: string; name: string; slug: string; image: string | null }
}

export interface CartIssue {
  itemId: string
  code: string
  message: string
}

export interface CartCoupon {
  code: string
  description: string | null
  type: string
  amount: number
  freeShipping: boolean
  /** Present when a previously applied code has stopped being valid. */
  error?: string
}

export interface Cart {
  id: string
  token: string
  items: CartItem[]
  itemCount: number
  subtotal: number
  discount: number
  /** Goods value after the coupon, before shipping and tax. */
  discountedSubtotal: number
  coupon: CartCoupon | null
  freeShipping: boolean
  issues: CartIssue[]
  checkoutReady: boolean
}

export const cartService = {
  get: () => apiClient.get<{ cart: Cart }>('/cart').then((r) => r.data.cart),

  addItem: (variantId: string, quantity = 1) =>
    apiClient.post<{ cart: Cart }>('/cart/items', { variantId, quantity }).then((r) => r.data.cart),

  updateItem: (itemId: string, quantity: number) =>
    apiClient.patch<{ cart: Cart }>(`/cart/items/${itemId}`, { quantity }).then((r) => r.data.cart),

  removeItem: (itemId: string) =>
    apiClient.delete<{ cart: Cart }>(`/cart/items/${itemId}`).then((r) => r.data.cart),

  /**
   * Sends the code, never an amount. The server decides what it is worth and
   * returns the recalculated cart.
   */
  applyCoupon: (code: string) =>
    apiClient.post<{ cart: Cart }>('/cart/coupon', { code }).then((r) => r.data.cart),

  removeCoupon: () => apiClient.delete<{ cart: Cart }>('/cart/coupon').then((r) => r.data.cart),
}
