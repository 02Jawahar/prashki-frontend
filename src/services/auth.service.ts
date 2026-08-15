import { apiClient } from './api-client'
import type { AuthUser } from '@/types/api'

export const authService = {
  register: (input: { name: string; email: string; password: string; phone?: string }) =>
    apiClient.post<{ user: AuthUser }>('/auth/register', input).then((r) => r.data.user),

  login: (input: { email: string; password: string }) =>
    apiClient.post<{ user: AuthUser }>('/auth/login', input).then((r) => r.data.user),

  logout: () => apiClient.post<{ loggedOut: boolean }>('/auth/logout'),

  me: () => apiClient.get<{ user: AuthUser }>('/auth/me').then((r) => r.data.user),

  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    apiClient.post<{ passwordChanged: boolean }>('/auth/change-password', input),
}
