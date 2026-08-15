import { apiClient } from './api-client'

export interface CartItem {
  id: string
  variantId: string
  productId: string
  quantity: number
  unitPrice: number
  lineTotal: number
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

export interface Cart {
  id: string
  token: string
  items: CartItem[]
  itemCount: number
  subtotal: number
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
}
