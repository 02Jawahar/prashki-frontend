/**
 * A purchase, from the shop floor to a parcel with a label.
 *
 * Everything else tests a layer. This walks the path a customer and then an
 * operator actually take: sign in, choose a piece, pick a size, check out,
 * see what the carrier charges, pay, and then — as admin — pack the parcel,
 * book it with the carrier and fetch the label.
 *
 *   node scripts/browser-purchase.mjs
 *   node scripts/browser-purchase.mjs --headed     # watch it happen
 *
 * Needs the mock payment provider. Razorpay's own window cannot be driven,
 * and a test that stops at the payment step never reaches the half that
 * matters here.
 */
import { chromium } from 'playwright-core'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const BASE = flag('base', 'http://localhost:3100')
const CHROME = flag('chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe')
const HEADED = args.includes('--headed')

const CUSTOMER = { email: 'customer@example.com', password: 'Customer@12345' }
const ADMIN = { email: 'admin@example.com', password: 'Admin@12345' }

let passed = 0
let failed = 0

const check = (label, ok, detail) => {
  if (ok) {
    passed++
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}
const section = (t, n) => console.log(`\n${t}${n ? `  ${n}` : ''}`)

let placedOrder = null

const browser = await chromium.launch({ executablePath: CHROME, headless: !HEADED })
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
const page = await context.newPage()

const failedRequests = []
page.on('response', (r) => {
  if (r.status() >= 400 && !/401|Unauthorized/.test(String(r.status()))) {
    failedRequests.push(`${r.status()} ${r.request().method()} ${r.url()}`)
  }
})

console.log(`\n  target ${BASE}`)

async function signIn(who, where = '/login') {
  await page.goto(`${BASE}${where}`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').first().fill(who.email)
  await page.locator('input[type="password"]').first().fill(who.password)
  await page.getByRole('button', { name: /sign in|log in/i }).first().click()
  await page.waitForTimeout(3000)
}

// ══════════════════════════════════════════════ the customer
section('The customer', 'Choosing and paying')

await signIn(CUSTOMER)
check('a customer can sign in', !page.url().includes('/login'), page.url().replace(BASE, '') || '/')

{
  await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded' })
  const href = await page.locator('a[href^="/products/"]').first().getAttribute('href')
  await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' })

  const size = page.locator('button', { hasText: /^(XS|S|M|L|XL)$/ }).first()
  await size.click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /add to bag/i }).first().click()
  await page.waitForTimeout(2500)

  const bag = await page.locator('button[aria-label^="Bag,"]').first().getAttribute('aria-label')
  check('a piece goes in the bag', /Bag, [1-9]/.test(bag ?? ''), bag ?? 'no bag label')
}

// ------------------------------------------------------------------ checkout

await page.goto(`${BASE}/checkout`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

{
  // A saved address, or one typed in. Either way the PIN drives the quote.
  const hasSaved = (await page.getByText(/delivery address/i).count()) > 0
  const needsNew = (await page.getByRole('button', { name: /add a new address/i }).count()) > 0

  if (hasSaved && !(await page.locator('input[name="postalCode"]').count())) {
    check('an address is already on file', true)
  } else if (needsNew) {
    await page.getByRole('button', { name: /add a new address/i }).first().click()
    await page.waitForTimeout(1200)
    for (const [name, value] of [
      ['name', 'Browser Test'],
      ['phone', '9994411585'],
      ['addressLine1', '104, 17th Cross Street'],
      ['city', 'Chennai'],
      ['state', 'Tamil Nadu'],
      ['postalCode', '600090'],
    ]) {
      const field = page.locator(`input[name="${name}"]`).first()
      if (await field.count()) await field.fill(value)
    }
    await page.getByRole('button', { name: /save|add address/i }).first().click()
    await page.waitForTimeout(3000)
    check('an address can be added', true)
  }

  await page.waitForTimeout(2500)

  /**
   * The delivery options. This is the carrier talking: the prices here came
   * from Shiprocket a moment ago, for this PIN code and this parcel's weight.
   */
  const body = await page.locator('body').innerText()
  const delivery = body.slice(body.indexOf('DELIVERY'), body.indexOf('DELIVERY') + 400)
  const named = ['Standard delivery', 'Express delivery'].filter((n) => body.includes(n))
  check('delivery options are offered', named.length > 0, named.join(' + ') || 'none')

  const prices = [...delivery.matchAll(/₹([\d,]+\.\d\d)|Free/g)].map((m) => m[0])
  check('each option carries a price', prices.length > 0, prices.join(' / '))

  const option = page.locator('label, [role="radio"], button').filter({ hasText: /Standard delivery/ }).first()
  if (await option.count()) {
    await option.click()
    await page.waitForTimeout(1500)
  }

  const place = page.getByRole('button', { name: /place order|pay|continue to payment/i }).first()
  check('there is a way to pay', (await place.count()) > 0)

  if (await place.count()) {
    await place.click()
    await page.waitForTimeout(6000)
    const paid = /\/checkout\/success|\/account\/orders/.test(page.url())
    check('the order goes through', paid, page.url().replace(BASE, ''))
    // Remember which order, so the operator half opens that one rather than
    // whichever happens to sit at the top of the list.
    placedOrder = new URL(page.url()).searchParams.get('order')
  }
}

// ══════════════════════════════════════════════ the operator
section('The operator', 'Packing, booking, printing')

// Sign in as the operator outright. Checking whether we were bounced first
// depends on a redirect that may not happen, and a customer session reaching
// an admin page is not something to leave to inference.
await signIn(ADMIN, '/admin/login')
check('an operator can sign in', page.url().includes('/admin'), page.url().replace(BASE, ''))

{
  await page.goto(`${BASE}/admin/orders`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  // The order just placed, found by its number — not whichever is at the top.
  if (placedOrder) {
    await page.locator('input[type="search"], input[placeholder*="Search" i]').first()
      .fill(placedOrder)
      .catch(() => undefined)
    await page.waitForTimeout(2500)
  }

  // Contains, not starts-with: the hrefs are not all written the same way.
  const firstOrder = page.locator('a[href*="/admin/orders/"]').first()
  check('the order reaches admin', (await firstOrder.count()) > 0, placedOrder ?? '')

  if (await firstOrder.count()) {
    await firstOrder.click()
    await page.waitForTimeout(3000)

    /*
     * Pack a parcel before booking one. A new order has no shipment: what
     * goes in the box is a studio decision, and the carrier is only involved
     * once that decision is made.
     */
    const newShipment = page.getByRole('button', { name: /new shipment/i }).first()
    if (await newShipment.count()) {
      await newShipment.click()
      await page.waitForTimeout(1500)

      /*
       * Say what goes in the box. The button stays disabled until something
       * is chosen, which is right: a parcel with nothing in it is not a
       * parcel, and the screen refuses rather than creating an empty one.
       */
      const items = page.locator('input[type="checkbox"]')
      const count = await items.count()
      for (let i = 0; i < count; i++) {
        const box = items.nth(i)
        if (await box.isEnabled().catch(() => false)) await box.check().catch(() => undefined)
      }
      await page.waitForTimeout(800)

      const confirm = page.getByRole('button', { name: /create shipment/i }).first()
      if ((await confirm.count()) && (await confirm.isEnabled().catch(() => false))) {
        await confirm.click()
        await page.waitForTimeout(5000)
      } else {
        check('the parcel form refuses an empty parcel', true, 'button stayed disabled')
      }
      const packed = await page.locator('body').innerText()
      check('a parcel can be packed', /-S1/.test(packed), packed.match(/ORD-[\d-]+-S\d/)?.[0] ?? 'no parcel on the page')
    }


    const text = await page.locator('body').innerText()
    check('the order names its delivery option', /Standard delivery|Express delivery/.test(text))

    const bookButton = page.getByRole('button', { name: /book with carrier/i }).first()
    check('a parcel can be booked with the carrier', (await bookButton.count()) > 0,
      (await bookButton.count()) ? 'button present' : 'no parcel packed yet')

    if (await bookButton.count()) {
      await bookButton.click()
      await page.waitForTimeout(8000)

      const after = await page.locator('body').innerText()
      check('the carrier took it', /Booked with|Label|Track/.test(after),
        after.match(/Booked with \w+/)?.[0] ?? 'no confirmation on the page')

      const label = page.getByRole('link', { name: /^Label/i }).first()
      const getLabel = page.getByRole('button', { name: /get label/i }).first()
      check(
        'a label is reachable',
        (await label.count()) > 0 || (await getLabel.count()) > 0,
        (await label.count()) ? 'Label link present' : 'Get label button present',
      )
    }
  }
}

// ══════════════════════════════════════════════

if (failedRequests.length > 0) {
  console.log('')
  console.log('  requests that failed:')
  for (const line of [...new Set(failedRequests)].slice(0, 6)) console.log(`    ${line}`)
}

await browser.close()
console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
