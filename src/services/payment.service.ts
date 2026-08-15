import { apiClient } from './api-client'

export interface ProviderOrder {
  provider: string
  providerOrderId: string
  amount: number
  currency: string
  publicKey?: string
  orderNumber: string
}

export const paymentService = {
  /** Creates the gateway-side order. Amount comes from our order, not the client. */
  create: (orderId: string) =>
    apiClient.post<ProviderOrder>('/payments/create', { orderId }).then((r) => r.data),

  /** Server-side signature verification — the only thing that marks an order paid. */
  verify: (input: {
    orderId: string
    providerOrderId: string
    providerPaymentId: string
    signature: string
  }) =>
    apiClient
      .post<{ verified: boolean; orderNumber: string; status: string }>('/payments/verify', input)
      .then((r) => r.data),
}
