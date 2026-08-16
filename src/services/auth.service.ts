import { apiClient } from './api-client'
import type { AuthUser } from '@/types/api'

export const authService = {
  register: (input: {
    name: string
    email: string
    password: string
    phone?: string
    acceptedTerms: boolean
    marketingOptIn?: boolean
  }) =>
    apiClient.post<{ user: AuthUser }>('/auth/register', input).then((r) => r.data.user),

  login: (input: { email: string; password: string }) =>
    apiClient.post<{ user: AuthUser }>('/auth/login', input).then((r) => r.data.user),

  logout: () => apiClient.post<{ loggedOut: boolean }>('/auth/logout'),

  me: () => apiClient.get<{ user: AuthUser }>('/auth/me').then((r) => r.data.user),

  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    apiClient.post<{ passwordChanged: boolean }>('/auth/change-password', input),

  updateProfile: (input: { name?: string; phone?: string }) =>
    apiClient.patch<{ user: AuthUser }>('/auth/profile', input).then((r) => r.data.user),

  /**
   * Always resolves the same way whether or not the address has an account —
   * the API refuses to say, and the UI must not imply otherwise.
   */
  forgotPassword: (email: string) =>
    apiClient.post<{ requested: boolean; message: string }>('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (input: { token: string; password: string }) =>
    apiClient.post<{ passwordReset: boolean }>('/auth/reset-password', input).then((r) => r.data),
}
