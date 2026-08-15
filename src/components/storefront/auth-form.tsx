'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useCart } from '@/hooks/use-cart'
import { ApiRequestError } from '@/services/api-client'
import { Alert, Button, Field, Input } from '@/components/ui'

/**
 * Sign in / register.
 *
 * After success it returns the customer to wherever they were headed
 * (spec §35) rather than dumping them on the homepage, and refreshes the cart
 * because the server merges any guest bag at login.
 */
export function AuthForm({
  mode,
  redirectTo,
}: {
  mode: 'login' | 'register'
  redirectTo: string
}) {
  const router = useRouter()
  const { login, register } = useAuth()
  const { refresh: refreshCart } = useCart()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register({ name, email, password, phone: phone || undefined })
      }

      await refreshCart()
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message)
        const details = err.details as Array<{ path: string; message: string }> | undefined
        if (Array.isArray(details)) {
          setFieldErrors(
            Object.fromEntries(details.map((d) => [d.path.replace(/^body\./, ''), d.message])),
          )
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert>{error}</Alert>}

      {mode === 'register' && (
        <Field label="Name" htmlFor="name" required error={fieldErrors.name}>
          <Input
            id="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(fieldErrors.name)}
          />
        </Field>
      )}

      <Field label="Email" htmlFor="email" required error={fieldErrors.email}>
        <Input
          id="email"
          type="email"
          autoComplete={mode === 'login' ? 'username' : 'email'}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={Boolean(fieldErrors.email)}
        />
      </Field>

      {mode === 'register' && (
        <Field label="Phone" htmlFor="phone" hint="Optional — used for delivery updates." error={fieldErrors.phone}>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={Boolean(fieldErrors.phone)}
          />
        </Field>
      )}

      <Field
        label="Password"
        htmlFor="password"
        required
        hint={mode === 'register' ? 'At least 8 characters.' : undefined}
        error={fieldErrors.password}
      >
        <Input
          id="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          minLength={mode === 'register' ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={Boolean(fieldErrors.password)}
        />
      </Field>

      <Button type="submit" loading={submitting} className="w-full">
        {submitting ? 'Please wait' : mode === 'login' ? 'Sign in' : 'Create account'}
      </Button>
    </form>
  )
}
