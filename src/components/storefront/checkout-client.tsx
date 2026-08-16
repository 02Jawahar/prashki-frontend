'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { useAuth } from '@/hooks/use-auth'
import { addressService, orderService, type Address } from '@/services/order.service'
import { paymentService } from '@/services/payment.service'
import { shippingService, type ShippingQuote } from '@/services/storefront.service'
import { loadRazorpay } from '@/lib/razorpay'
import { ApiRequestError } from '@/services/api-client'
import { formatPrice } from '@/lib/money'
import { Alert, Button, EmptyState, Field, Input, SkeletonRows, Textarea } from '@/components/ui'

export function CheckoutClient() {
  const router = useRouter()
  const { cart, refresh } = useCart()
  const { user } = useAuth()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [notes, setNotes] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [methods, setMethods] = useState<ShippingQuote[]>([])
  const [methodId, setMethodId] = useState<string | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [deliverable, setDeliverable] = useState(true)
  /** The server's own explanation — "too heavy", "we don't reach that PIN". */
  const [deliveryReason, setDeliveryReason] = useState<string | null>(null)

  /**
   * One key per checkout attempt, minted when the page mounts and reused for
   * every retry. It is what makes a double-click, or a retry after a dropped
   * connection, resolve to a single order rather than two.
   */
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  useEffect(() => {
    void (async () => {
      try {
        const list = await addressService.list()
        setAddresses(list)
        setSelectedId(list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null)
        setShowForm(list.length === 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your addresses')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const selected = addresses.find((a) => a.id === selectedId) ?? null

  /**
   * Delivery options depend on where the parcel is going and what is in the
   * bag, so the quote is refetched whenever either changes. The prices shown
   * are re-derived server-side at checkout regardless — this is display only.
   */
  useEffect(() => {
    if (!selected) {
      setMethods([])
      setMethodId(null)
      return
    }

    let cancelled = false
    setQuoting(true)

    void shippingService
      .quote({
        country: selected.country,
        state: selected.state,
        postalCode: selected.postalCode,
      })
      .then((result) => {
        if (cancelled) return
        setMethods(result.methods)
        setDeliverable(result.serviceable)
        setDeliveryReason(result.reason)
        // Keep the current choice if it survived; otherwise take the cheapest.
        setMethodId((current) =>
          current && result.methods.some((m) => m.id === current)
            ? current
            : (result.methods[0]?.id ?? null),
        )
      })
      .catch(() => {
        if (!cancelled) setMethods([])
      })
      .finally(() => {
        if (!cancelled) setQuoting(false)
      })

    return () => {
      cancelled = true
    }
  }, [selected, cart?.discountedSubtotal, cart?.freeShipping])

  const chosenMethod = methods.find((m) => m.id === methodId) ?? null
  const shippingCost = chosenMethod ? chosenMethod.cost + (chosenMethod.isCod ? chosenMethod.codFee : 0) : 0
  const orderTotal = (cart?.discountedSubtotal ?? 0) + shippingCost

  /**
   * Order first, then payment (spec §31).
   *
   * The order exists as PENDING_PAYMENT before the gateway opens, so a payment
   * can always be matched back to something. Nothing here decides that the
   * order is paid — only the server's signature check and the webhook do.
   */
  async function placeOrder() {
    if (!selectedId || placing) return

    setPlacing(true)
    setError(null)

    let order
    try {
      // The server recomputes every figure; nothing sent from here is trusted.
      // The key travels with it, so a retry lands on the same order.
      const result = await orderService.create({
        addressId: selectedId,
        notes: notes || undefined,
        shippingMethodId: methodId ?? undefined,
        idempotencyKey,
      })
      order = result.order
      await refresh()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not place your order')
      setPlacing(false)

      /**
       * A rejected order means nothing was created under this key, but the
       * request body is about to change (different stock, different address).
       * A fresh key keeps the retry honest rather than replaying the old one.
       */
      setIdempotencyKey(crypto.randomUUID())

      // Stock or availability may have changed — resync so the user sees why.
      await refresh()
      return
    }

    try {
      const intent = await paymentService.create(order.id)

      if (intent.provider === 'razorpay') {
        await payWithRazorpay(order.id, order.orderNumber, intent)
        return
      }

      // Development provider: no gateway UI. The order stays PENDING_PAYMENT
      // and is confirmed by the webhook, exactly as it would be in production.
      router.push(`/checkout/success?order=${order.orderNumber}`)
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? `Order ${order.orderNumber} was created, but payment could not start: ${err.message}`
          : 'Payment could not be started',
      )
      setPlacing(false)
    }
  }

  async function payWithRazorpay(
    orderId: string,
    orderNumber: string,
    intent: Awaited<ReturnType<typeof paymentService.create>>,
  ) {
    const ready = await loadRazorpay()
    if (!ready || !window.Razorpay) {
      setError('Could not load the payment gateway. Please try again.')
      setPlacing(false)
      return
    }

    const checkout = new window.Razorpay({
      key: intent.publicKey ?? '',
      amount: intent.amount,
      currency: intent.currency,
      name: 'Prash & Ki',
      description: `Order ${orderNumber}`,
      order_id: intent.providerOrderId,
      prefill: { name: user?.name, email: user?.email, contact: user?.phone ?? undefined },
      theme: { color: '#5b6241' },
      handler: async (response) => {
        try {
          // A success callback proves nothing until the server verifies it.
          await paymentService.verify({
            orderId,
            providerOrderId: response.razorpay_order_id,
            providerPaymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })
          router.push(`/checkout/success?order=${orderNumber}`)
        } catch (err) {
          const reason = err instanceof ApiRequestError ? err.message : 'Verification failed'
          router.push(`/checkout/failed?order=${orderNumber}&reason=${encodeURIComponent(reason)}`)
        }
      },
      modal: {
        ondismiss: () => {
          setPlacing(false)
          setError(`Payment was cancelled. Order ${orderNumber} is waiting in your account.`)
        },
      },
    })

    checkout.open()
  }

  if (loading || !cart) {
    return (
      <div className="container-pk py-16">
        <SkeletonRows rows={5} />
      </div>
    )
  }

  if (cart.items.length === 0) {
    return (
      <div className="container-pk py-20">
        <EmptyState
          title="Your bag is empty"
          body="Add something before checking out."
          action={
            <Link href="/products" className="btn btn-primary">
              Start shopping
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="container-pk py-12 md:py-16">
      <header className="mb-10 text-center">
        <h1 className="display text-[2.2rem] md:text-[2.6rem]">Checkout</h1>
        <div className="rule-dot mt-4" aria-hidden />
      </header>

      <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
        <div className="space-y-8">
          {error && <Alert>{error}</Alert>}

          {cart.issues.length > 0 && (
            <Alert tone="danger">
              <p className="mb-1 font-medium">These need fixing before you can order:</p>
              <ul className="list-inside list-disc space-y-0.5">
                {cart.issues.map((i) => (
                  <li key={i.itemId + i.code}>{i.message}</li>
                ))}
              </ul>
              <Link href="/cart" className="link-underline mt-2 inline-block">
                Review your bag
              </Link>
            </Alert>
          )}

          <section>
            <h2 className="label-caps mb-4">Delivery address</h2>

            {addresses.length > 0 && (
              <ul className="space-y-3">
                {addresses.map((address) => (
                  <li key={address.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(address.id)}
                      className={`flex w-full gap-3 border p-4 text-left transition-colors ${
                        selectedId === address.id ? 'border-sage-700 bg-sage-50' : 'border-rule hover:border-ink'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                          selectedId === address.id ? 'border-sage-700 bg-sage-700' : 'border-rule'
                        }`}
                      >
                        {selectedId === address.id && <Check className="size-2.5 text-white" strokeWidth={3} />}
                      </span>
                      <span className="text-sm">
                        <span className="block font-medium">
                          {address.name}
                          {address.label && <span className="ml-2 text-xs text-ink-soft">{address.label}</span>}
                        </span>
                        <span className="mt-1 block text-ink-soft">
                          {address.addressLine1}
                          {address.addressLine2 ? `, ${address.addressLine2}` : ''}, {address.city},{' '}
                          {address.state} {address.postalCode}
                        </span>
                        <span className="mt-0.5 block text-ink-soft">{address.phone}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showForm ? (
              <div className="mt-4">
                <AddressForm
                  onCancel={addresses.length > 0 ? () => setShowForm(false) : undefined}
                  onCreated={(address) => {
                    setAddresses((prev) => [address, ...prev])
                    setSelectedId(address.id)
                    setShowForm(false)
                  }}
                />
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                Add a new address
              </Button>
            )}
          </section>

          <section>
            <h2 className="label-caps mb-4">Delivery</h2>

            {!selected ? (
              <p className="text-sm text-ink-soft">Choose an address to see delivery options.</p>
            ) : quoting ? (
              <SkeletonRows rows={2} />
            ) : !deliverable || methods.length === 0 ? (
              <Alert tone="danger">
                {deliveryReason ??
                  `We cannot deliver to ${selected.city} ${selected.postalCode} at the moment.`}{' '}
                Try another address, or write to us and we will see what we can do.
              </Alert>
            ) : (
              <ul className="space-y-3">
                {methods.map((method) => (
                  <li key={method.id}>
                    <button
                      type="button"
                      onClick={() => setMethodId(method.id)}
                      className={`flex w-full items-start gap-3 border p-4 text-left transition-colors ${
                        methodId === method.id ? 'border-sage-700 bg-sage-50' : 'border-rule hover:border-ink'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                          methodId === method.id ? 'border-sage-700 bg-sage-700' : 'border-rule'
                        }`}
                      >
                        {methodId === method.id && <Check className="size-2.5 text-white" strokeWidth={3} />}
                      </span>

                      <span className="flex flex-1 justify-between gap-4 text-sm">
                        <span>
                          <span className="block font-medium">{method.name}</span>
                          {method.description && (
                            <span className="mt-0.5 block text-xs text-ink-soft">{method.description}</span>
                          )}
                          {method.minDays !== null && (
                            <span className="mt-0.5 block text-xs text-ink-soft">
                              {method.minDays === method.maxDays
                                ? `${method.minDays} business day${method.minDays === 1 ? '' : 's'}`
                                : `${method.minDays}–${method.maxDays} business days`}
                            </span>
                          )}
                          {method.isCod && method.codFee > 0 && (
                            <span className="mt-0.5 block text-xs text-ink-soft">
                              Includes a {formatPrice(method.codFee)} handling fee
                            </span>
                          )}
                        </span>

                        <span className="shrink-0 text-right">
                          {method.isFree ? (
                            <>
                              <span className="text-sage-700">Free</span>
                              {method.rate > 0 && (
                                <span className="ml-2 text-xs text-ink-soft line-through">
                                  {formatPrice(method.rate)}
                                </span>
                              )}
                            </>
                          ) : (
                            formatPrice(method.cost + (method.isCod ? method.codFee : 0))
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="label-caps mb-4">Order note</h2>
            <Textarea
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery instructions, an occasion date, anything else."
            />
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="border border-rule p-7">
            <h2 className="label-caps mb-5">Your order</h2>

            <ul className="space-y-4 border-b border-hairline pb-5">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="relative aspect-2/3 w-14 shrink-0 overflow-hidden bg-sage-50">
                    {item.product.image && (
                      <Image src={item.product.image} alt="" fill sizes="56px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex flex-1 justify-between gap-2 text-sm">
                    <div>
                      <p className="display leading-tight">{item.product.name}</p>
                      <p className="text-xs text-ink-soft">
                        {item.variant.name === 'Default' ? '' : `${item.variant.name} · `}
                        {item.quantity} × {formatPrice(item.unitPrice)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs">{formatPrice(item.lineTotal)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="space-y-3 py-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd>{formatPrice(cart.subtotal)}</dd>
              </div>
              {cart.discount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Discount{cart.coupon ? ` (${cart.coupon.code})` : ''}</dt>
                  <dd>&minus;{formatPrice(cart.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-soft">
                  Shipping{chosenMethod ? ` — ${chosenMethod.name}` : ''}
                </dt>
                <dd className={shippingCost === 0 && chosenMethod ? 'text-sage-700' : undefined}>
                  {!chosenMethod ? '—' : shippingCost === 0 ? 'Free' : formatPrice(shippingCost)}
                </dd>
              </div>
            </dl>

            <div className="flex justify-between border-t border-hairline pt-5">
              <span className="label-caps">Total</span>
              <span className="text-base">{formatPrice(orderTotal)}</span>
            </div>

            <Button
              type="button"
              onClick={() => void placeOrder()}
              loading={placing}
              disabled={!selectedId || !cart.checkoutReady || (methods.length > 0 && !methodId)}
              className="mt-6 w-full"
            >
              {placing ? 'Placing order' : 'Place order'}
            </Button>

            {!selectedId && (
              <p className="mt-3 text-center text-xs text-ink-soft">Choose a delivery address first.</p>
            )}
            {selectedId && methods.length > 0 && !methodId && (
              <p className="mt-3 text-center text-xs text-ink-soft">Choose a delivery option.</p>
            )}

            <p className="mt-4 text-xs leading-relaxed text-ink-soft">
              Totals are confirmed by our server when the order is placed.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function AddressForm({
  onCreated,
  onCancel,
}: {
  onCreated: (address: Address) => void
  onCancel?: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return

    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      onCreated(await addressService.create({ ...form, country: 'IN', isDefault: true }))
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message)
        const details = err.details as Array<{ path: string; message: string }> | undefined
        if (Array.isArray(details)) {
          setFieldErrors(Object.fromEntries(details.map((d) => [d.path.replace(/^body\./, ''), d.message])))
        }
      } else {
        setError('Could not save the address')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="border border-rule p-5" noValidate>
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="a-name" required error={fieldErrors.name}>
          <Input id="a-name" required value={form.name} onChange={set('name')} error={Boolean(fieldErrors.name)} />
        </Field>
        <Field label="Phone" htmlFor="a-phone" required error={fieldErrors.phone}>
          <Input id="a-phone" type="tel" required value={form.phone} onChange={set('phone')} error={Boolean(fieldErrors.phone)} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Address line 1" htmlFor="a-l1" required error={fieldErrors.addressLine1}>
            <Input id="a-l1" required value={form.addressLine1} onChange={set('addressLine1')} error={Boolean(fieldErrors.addressLine1)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Address line 2" htmlFor="a-l2" error={fieldErrors.addressLine2}>
            <Input id="a-l2" value={form.addressLine2} onChange={set('addressLine2')} />
          </Field>
        </div>

        <Field label="City" htmlFor="a-city" required error={fieldErrors.city}>
          <Input id="a-city" required value={form.city} onChange={set('city')} error={Boolean(fieldErrors.city)} />
        </Field>
        <Field label="State" htmlFor="a-state" required error={fieldErrors.state}>
          <Input id="a-state" required value={form.state} onChange={set('state')} error={Boolean(fieldErrors.state)} />
        </Field>
        <Field label="PIN code" htmlFor="a-pin" required error={fieldErrors.postalCode}>
          <Input id="a-pin" required inputMode="numeric" value={form.postalCode} onChange={set('postalCode')} error={Boolean(fieldErrors.postalCode)} />
        </Field>
      </div>

      <div className="mt-5 flex gap-3">
        <Button type="submit" size="sm" loading={busy}>
          Save address
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
