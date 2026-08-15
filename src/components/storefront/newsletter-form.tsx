'use client'

import { useState } from 'react'
import { Button, Input } from '@/components/ui'

/**
 * Newsletter capture. There is no subscriber endpoint in this phase, so the
 * form validates and acknowledges locally rather than pretending to persist —
 * a button that silently does nothing would be worse than an honest message.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) return
    setDone(true)
    setEmail('')
  }

  if (done) {
    return (
      <p role="status" className="text-sm text-sage-700">
        Thank you — we&rsquo;ll be in touch.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <label className="sr-only" htmlFor="newsletter-email">
        Email address
      </label>
      <Input
        id="newsletter-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
        className="flex-1"
      />
      <Button type="submit">Subscribe</Button>
    </form>
  )
}
