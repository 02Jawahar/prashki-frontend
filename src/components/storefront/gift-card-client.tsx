'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { giftCardService, type GiftCardOptions } from '@/services/storefront.service'
import { ApiRequestError } from '@/services/api-client'
import { useAuth } from '@/hooks/use-auth'
import { formatPrice } from '@/lib/money'
import { Alert, Button, Field, Input, Textarea } from '@/components/ui'

/**
 * Buying a gift card, and checking what one is worth.
 *
 * The amounts come from the server rather than this file. A price the browser
 * chooses is a price the customer can choose, and a gift card is the one thing
 * on the site where that would hand out money.
 */
export function GiftCardClient() {
  const { user } = useAuth()
  const router = useRouter()

  const [options, setOptions] = useState<GiftCardOptions | null>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [form, setForm] = useState({ name: '', email: '', message: '', sendToMe: false })
  const [error, setError] = useState<string | null>(null)
  const [buying, setBuying] = useState(false)

  const [lookup, setLookup] = useState('')
  const [looking, setLooking] = useState(false)
  const [balance, setBalance] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  useEffect(() => {
    void giftCardService
      .options()
      .then((o) => {
        setOptions(o)
        setAmount(o.denominations[1] ?? o.denominations[0] ?? null)
      })
      .catch(() => setError('Could not load the gift card options.'))
  }, [])

  const customPaise = custom ? Math.round(Number(custom) * 100) : 0
  const chosen = amount ?? (customPaise > 0 ? customPaise : null)

  async function buy() {
    if (!chosen || buying) return

    if (!user) {
      // A gift card is bought against an account — that is where the order and
      // the receipt live. Send them to sign in and back here.
      router.push('/login?next=/gift-card')
      return
    }

    setBuying(true)
    setError(null)

    try {
      const order = await giftCardService.purchase({
        amount: chosen,
        sendToMe: form.sendToMe,
        recipientName: form.sendToMe ? undefined : form.name || undefined,
        recipientEmail: form.sendToMe ? undefined : form.email || undefined,
        message: form.message || undefined,
      })

      /**
       * Straight to the order, which is where payment happens. The card stays
       * dormant until that order is paid, so leaving now costs nothing but an
       * unpaid order.
       */
      router.push(`/account/orders/${order.id}`)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not start that purchase.')
      setBuying(false)
    }
  }

  async function check(event: React.FormEvent) {
    event.preventDefault()
    if (looking || !lookup.trim()) return

    setLooking(true)
    setBalance(null)
    setLookupError(null)

    try {
      const result = await giftCardService.balance(lookup.trim())
      setBalance(formatPrice(result.balance))
    } catch (err) {
      setLookupError(
        err instanceof ApiRequestError ? err.message : 'We could not check that code.',
      )
    } finally {
      setLooking(false)
    }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <section>
        <h1 className="display text-3xl">Gift card</h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">
          Let them choose. Pick a value, write a note, and we will send the card by email once your
          order is paid for. It can be spent on anything in the shop, and is valid for three years.
        </p>

        {error && (
          <div className="mt-5">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-8">
          <p className="label-caps mb-3">Value</p>

          <div className="flex flex-wrap gap-2">
            {(options?.denominations ?? []).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setAmount(value)
                  setCustom('')
                }}
                className={`border px-5 py-3 text-sm transition-colors ${
                  amount === value ? 'border-sage-700 bg-sage-50 text-ink' : 'border-rule hover:border-ink'
                }`}
              >
                {formatPrice(value)}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setAmount(null)}
              className={`border px-5 py-3 text-sm transition-colors ${
                amount === null ? 'border-sage-700 bg-sage-50 text-ink' : 'border-rule hover:border-ink'
              }`}
            >
              Custom
            </button>
          </div>

          {amount === null && options && (
            <div className="mt-4 max-w-xs">
              <Field
                label="Amount (₹)"
                htmlFor="gc-custom"
                hint={`Between ${formatPrice(options.custom.min)} and ${formatPrice(options.custom.max)}.`}
              >
                <Input
                  id="gc-custom"
                  type="number"
                  min={options.custom.min / 100}
                  max={options.custom.max / 100}
                  step={1}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-4">
          <p className="label-caps">Who is it for</p>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[#5b6241]"
              checked={form.sendToMe}
              onChange={(e) => setForm((f) => ({ ...f, sendToMe: e.target.checked }))}
            />
            Send it to me
          </label>

          {!form.sendToMe && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Their name" htmlFor="gc-name">
                <Input
                  id="gc-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
              <Field label="Their email" htmlFor="gc-email">
                <Input
                  id="gc-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Field>
            </div>
          )}

          <Field label="Message" htmlFor="gc-message" hint="Optional. Included in the email.">
            <Textarea
              id="gc-message"
              rows={3}
              maxLength={500}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
          </Field>
        </div>

        <div className="mt-8 border-t border-rule pt-6">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="label-caps">Total</span>
            <span className="display text-2xl">{chosen ? formatPrice(chosen) : '—'}</span>
          </div>

          <Button
            className="w-full justify-center"
            loading={buying}
            disabled={!chosen}
            onClick={() => void buy()}
          >
            {user ? 'Continue to payment' : 'Sign in to continue'}
          </Button>
          <p className="mt-3 text-xs text-ink-soft">
            The card is sent by email once your order is paid for, and is valid for three years.
          </p>
        </div>
      </section>

      <section className="lg:border-l lg:border-rule lg:pl-12">
        <h2 className="display text-xl">Check a balance</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {user
            ? 'Enter a code to see what is left on it.'
            : 'Sign in to check what is left on a card.'}
        </p>

        <form onSubmit={check} className="mt-5 max-w-sm" noValidate>
          <Field label="Gift card code" htmlFor="gc-code">
            <Input
              id="gc-code"
              placeholder="PK-XXXX-XXXX"
              value={lookup}
              disabled={!user}
              onChange={(e) => setLookup(e.target.value)}
            />
          </Field>

          <Button type="submit" size="sm" className="mt-3" loading={looking} disabled={!user}>
            Check
          </Button>
        </form>

        {balance && (
          <div className="mt-5 flex items-center gap-2 text-sm">
            <Check className="size-4 text-sage-700" strokeWidth={2} />
            <span>
              <span className="font-medium">{balance}</span> remaining
            </span>
          </div>
        )}

        {lookupError && (
          <div className="mt-5 max-w-sm">
            <Alert>{lookupError}</Alert>
          </div>
        )}

        <div className="mt-10 border-t border-rule pt-6 text-xs leading-relaxed text-ink-soft">
          <p className="label-caps mb-2 text-ink">Good to know</p>
          <ul className="space-y-1.5">
            <li>Valid for three years from the day it is issued.</li>
            <li>Can be spent across several orders until the balance runs out.</li>
            <li>If an order paid with a card is cancelled, the balance goes back on the card.</li>
            <li>Not exchangeable for cash.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
