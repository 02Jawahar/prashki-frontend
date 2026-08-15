'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authService } from '@/services/auth.service'
import { ApiRequestError } from '@/services/api-client'
import { Alert, Button, Field, Input } from '@/components/ui'

export function AdminLoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const user = await authService.login({ email, password })

      // A valid customer login is not admin access.
      if (user.role !== 'ADMIN') {
        await authService.logout().catch(() => undefined)
        setError('That account does not have admin access.')
        return
      }

      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Could not sign in. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert>{error}</Alert>}

      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={Boolean(error)}
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={Boolean(error)}
        />
      </Field>

      <Button type="submit" loading={submitting} className="w-full">
        {submitting ? 'Signing in' : 'Sign in'}
      </Button>
    </form>
  )
}
