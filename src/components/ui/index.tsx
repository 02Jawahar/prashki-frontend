'use client'

import { cn } from '@/lib/utils'
import { Loader2, AlertCircle, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Shared primitives (spec §53–55). Styling comes from the class layer in
 * globals.css so the storefront and admin share one visual vocabulary.
 */

// ------------------------------------------------------------------ button

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  loading?: boolean
}) {
  return (
    <button
      className={cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)}
      // Disabling while loading is what actually prevents double submission.
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

// ------------------------------------------------------------------- input

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="field-message" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Input({
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input className={cn('field', error && 'field-error', className)} {...props} />
}

export function Textarea({
  error,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea className={cn('field resize-y', error && 'field-error', className)} {...props} />
}

export function Select({
  error,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select className={cn('field cursor-pointer', error && 'field-error', className)} {...props}>
      {children}
    </select>
  )
}

// ------------------------------------------------------------------ badges

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'badge-success',
  DRAFT: 'badge-warning',
  ARCHIVED: 'badge-neutral',
  INACTIVE: 'badge-neutral',
  SUSPENDED: 'badge-danger',
  PENDING_PAYMENT: 'badge-warning',
  PAID: 'badge-success',
  PROCESSING: 'badge-info',
  SHIPPED: 'badge-info',
  DELIVERED: 'badge-success',
  CANCELLED: 'badge-danger',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('badge', STATUS_TONE[status] ?? 'badge-neutral')}>
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  )
}

// --------------------------------------------------------------- feedback

export function Alert({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'success' | 'info'
  children: ReactNode
}) {
  const tones = {
    danger: 'border-danger/30 bg-[#f6e6e2] text-danger',
    success: 'border-success/30 bg-[#e8f0ea] text-success',
    info: 'border-sage-300 bg-sage-50 text-sage-800',
  }
  return (
    <div role="alert" className={cn('flex gap-2.5 border p-3.5 text-sm', tones[tone])}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.6} />
      <div>{children}</div>
    </div>
  )
}

/** Empty state (spec §55) — never show a blank page. */
export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string
  body?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-rule px-6 py-16 text-center">
      <div className="text-ink-soft/50">{icon ?? <Inbox className="size-7" strokeWidth={1.2} />}</div>
      <p className="display text-xl">{title}</p>
      {body && <p className="max-w-sm text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Loading state (spec §54). */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-soft">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}&hellip;
    </div>
  )
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-12 w-full" />
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-2/3 w-full" />
          <div className="skeleton mx-auto mt-4 h-4 w-2/3" />
          <div className="skeleton mx-auto mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}
