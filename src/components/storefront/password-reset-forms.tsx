'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authService } from '@/services/auth.service'
import { ApiRequestError } from '@/services/api-client'
import { Alert, Button, Field, Input } from '@/components/ui'

/**
 * "Forgot password".
 *
 * The confirmation is deliberately the same whether or not the address has an
 * account — the API refuses to say, and a UI that said "no account found"
 * would hand that back to anyone who asked.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)

    try {
      await authService.forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-sm">
        <Alert tone="success">
          If <span className="text-ink">{email}</span> has an account, a reset link is on its way. It
          expires in an hour.
        </Alert>
        <p className="text-ink-soft">
          Nothing arrived? Check your spam folder, or{' '}
          <button type="button" className="link-underline text-ink" onClick={() => setSent(false)}>
            try a different address
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert>{error}</Alert>}

      <Field
        label="Email"
        htmlFor="email"
        required
        hint="We will send a link to set a new password."
      >
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <Button type="submit" loading={submitting} className="w-full">
        {submitting ? 'Sending' : 'Send reset link'}
      </Button>

      <p className="text-center text-sm text-ink-soft">
        <Link href="/login" className="link-underline text-ink">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}

/** Completes the reset. The token arrives in the URL and is never displayed. */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return

    if (password !== confirm) {
      setError('Those passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await authService.resetPassword({ token, password })
      setDone(true)
      // Every session was revoked server-side, so the only way on is a fresh
      // sign-in. Refreshing clears any stale user the layout is holding.
      router.refresh()
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Something went wrong. Please try again.',
      )
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4 text-sm">
        <Alert tone="success">Your password has been changed.</Alert>
        <p className="text-ink-soft">
          For safety we signed you out everywhere.{' '}
          <Link href="/login" className="link-underline text-ink">
            Sign in again
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert>{error}</Alert>}

      <Field label="New password" htmlFor="password" required hint="At least 8 characters.">
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      <Field label="Confirm password" htmlFor="confirm" required>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={confirm.length > 0 && confirm !== password}
        />
      </Field>

      <Button type="submit" loading={submitting} className="w-full">
        {submitting ? 'Saving' : 'Set new password'}
      </Button>
    </form>
  )
}
