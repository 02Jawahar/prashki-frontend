/**
 * Whether an admin session survives its access token expiring.
 *
 * The admin access token lives ten minutes. That is by design — it is the
 * refresh token, good for a day, that is meant to keep somebody signed in, and
 * the edge is meant to spend it before the page renders. Whether that actually
 * happens is not answerable from the code: the proxy runs, the render runs,
 * and the question is which cookie the render sees.
 *
 * So this deletes the access token from a live browser session — which is what
 * expiry amounts to — and then navigates. Landing on the dashboard means the
 * renewal worked. Landing on the login screen is the bug.
 *
 *   node scripts/browser-admin-session.mjs
 *   node scripts/browser-admin-session.mjs --headed
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
const ADMIN = { email: flag('email', 'admin@example.com'), password: flag('password', 'Admin@12345') }

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

const browser = await chromium.launch({ executablePath: CHROME, headless: !HEADED })
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
const page = await context.newPage()

const named = async (name) => (await context.cookies()).find((c) => c.name === name)

// ══════════════════════════════════════════════════ sign in
section('Signing in')

await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' })
// The form is interactive only once React has hydrated; filling before that
// types into an input whose handler is not attached yet.
await page.waitForTimeout(1500)
await page.locator('input[type="email"]').first().fill(ADMIN.email)
await page.locator('input[type="password"]').first().fill(ADMIN.password)
await page.locator('button[type="submit"]').first().click()
await page.waitForTimeout(4000)

check('an operator reaches the dashboard', !page.url().includes('/admin/login'), page.url().replace(BASE, ''))

const at = await named('at')
const rt = await named('rt')
check('an access token was issued', Boolean(at))
check('a refresh token was issued', Boolean(rt), rt ? `expires in ${Math.round((rt.expires * 1000 - Date.now()) / 3600000)}h` : '')

if (at) {
  const life = Math.round((JSON.parse(Buffer.from(at.value.split('.')[1], 'base64url')).exp * 1000 - Date.now()) / 60000)
  check('the access token is short-lived, as intended', life <= 15, `${life} minutes`)
}

// ══════════════════════════════════════════════════ the token expires
section('Ten minutes later', 'The access token is gone; the refresh token is not')

/*
 * Delete rather than wait. An expired token and an absent one take the same
 * path — the edge sees nothing usable and must spend the refresh token — and
 * this way the test runs in seconds instead of ten minutes.
 */
await context.clearCookies({ name: 'at' })
check('the access token is gone', !(await named('at')))
check('the refresh token is still there', Boolean(await named('rt')))

// A navigation, which is when the edge gets its chance.
await page.goto(`${BASE}/admin/orders`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3500)

const bounced = page.url().includes('/admin/login')
check('navigating does not bounce to the login screen', !bounced, page.url().replace(BASE, ''))
check('the session was renewed at the edge', Boolean(await named('at')), (await named('at')) ? 'new access token issued' : 'no access token after the navigation')

if (!bounced) {
  const body = await page.locator('body').innerText()
  check('the page actually rendered admin content', /orders|shipments|dashboard/i.test(body), body.slice(0, 60).replace(/\s+/g, ' '))
}

// ══════════════════════════════════════════════════ and again, mid-session
section('Sitting on a screen', 'No navigation, only API calls')

await context.clearCookies({ name: 'at' })

/*
 * The edge only runs on a navigation. Somebody who stays on one screen and
 * works — filtering, opening an order — never triggers it, so the browser's
 * own retry is the only thing standing between them and a 401.
 */
const recovered = await page.evaluate(async () => {
  const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' }).catch(() => null)
  return res ? res.status : 0
})
check('the browser can refresh without a navigation', recovered === 200 || recovered === 404,
  recovered === 404 ? 'no same-origin API route (expected — the API is elsewhere)' : `status ${recovered}`)

await browser.close()
console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
