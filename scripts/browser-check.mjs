/**
 * What the pages actually do in a browser.
 *
 * The server-rendered HTML has been checked plenty of times and it keeps being
 * right while the page is wrong — a video that mounts and never plays, a
 * filter that renders and never filters. Markup is not behaviour. This drives
 * the real Chrome that is already installed, so what is asserted is what a
 * customer would see.
 *
 *   node scripts/browser-check.mjs
 *   node scripts/browser-check.mjs --base https://prashandki.in
 *
 * Nothing is installed to run it: playwright-core drives the existing browser
 * rather than downloading one of its own.
 */
import { chromium } from 'playwright-core'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const BASE = flag('base', 'http://localhost:3100')
const CHROME =
  flag('chrome', null) ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const HEADED = args.includes('--headed')

let passed = 0
let failed = 0

function check(label, ok, detail) {
  if (ok) {
    passed++
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title, note) {
  console.log(`\n${title}${note ? `  ${note}` : ''}`)
}

const browser = await chromium.launch({ executablePath: CHROME, headless: !HEADED })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

/** Anything the page logs as an error is a finding in its own right. */
const consoleErrors = []

/**
 * A signed-out visitor asking who they are gets a 401, and the app refreshes
 * and carries on. That is the design, not a fault, so it is not counted —
 * otherwise every clean run reports an error and the ones that matter are
 * lost in it.
 */
const EXPECTED = /401|Unauthorized/i

page.on('console', (m) => {
  if (m.type() === 'error' && !EXPECTED.test(m.text())) consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(String(e)))

/** Which request failed, not just that one did — the console omits the URL. */
const failedRequests = []
page.on('response', (res) => {
  if (res.status() >= 400 && !EXPECTED.test(String(res.status()))) {
    failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`)
  }
})

console.log(`\n  target ${BASE}`)

// ══════════════════════════════════════════════ homepage
section('The homepage', 'What a visitor sees and what moves')

await page.goto(BASE, { waitUntil: 'domcontentloaded' })

{
  const films = page.locator('section video')
  check('the page has films on it', (await films.count()) > 0, `${await films.count()} video elements`)

  // The film band is the heaviest thing on the page and loads only on scroll.
  const band = page.locator('video[poster*="film-studio"]').first()
  check('the studio film is on the page', (await band.count()) > 0)

  if ((await band.count()) > 0) {
    const srcBefore = await band.getAttribute('src')
    check('it holds off loading until scrolled to', !srcBefore, `src=${srcBefore ?? 'none'}`)

    await band.scrollIntoViewIfNeeded()
    await page.waitForTimeout(4000)

    const state = await band.evaluate((v) => ({
      src: v.currentSrc || v.getAttribute('src') || '',
      paused: v.paused,
      time: v.currentTime,
      ready: v.readyState,
      muted: v.muted,
    }))

    check('the film loads once it is reached', Boolean(state.src), state.src.split('/').pop() ?? '')
    check('it is playing, not just mounted', !state.paused, `paused=${state.paused}`)
    check('the picture is actually advancing', state.time > 0, `currentTime=${state.time.toFixed(2)}s`)
    check('it starts muted, as autoplay requires', state.muted)
  }
}

// ══════════════════════════════════════════════ product page
section('A product page', 'Choosing and adding')

await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded' })

{
  const first = page.locator('a[href^="/products/"]').first()
  const href = await first.getAttribute('href')
  await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' })

  const sizes = page.locator('button', { hasText: /^(XS|S|M|L|XL)$/ })
  const sizeCount = await sizes.count()
  check('sizes are offered', sizeCount > 0, `${sizeCount} sizes`)

  const addToBag = page.getByRole('button', { name: /add to bag/i }).first()
  check('there is an add-to-bag button', (await addToBag.count()) > 0)

  // Adding without choosing a size must say so rather than doing nothing.
  if ((await addToBag.count()) > 0 && sizeCount > 0) {
    await addToBag.click()
    await page.waitForTimeout(1200)
    const asked = await page.getByText(/choose a size/i).count()
    check('it asks for a size before adding', asked > 0, asked ? 'told the customer' : 'silent')

    await sizes.first().click()
    await page.waitForTimeout(400)
    await addToBag.click()
    await page.waitForTimeout(2500)

    /**
     * Read the bag from the page, not from the API.
     *
     * The API is on another origin here, so a same-origin fetch would prove
     * nothing. What matters anyway is what the customer sees: the count on the
     * bag in the header.
     */
    const count = await page
      .locator('button[aria-label^="Bag,"]')
      .first()
      .getAttribute('aria-label')
    const inBag = Number(/Bag, (\d+)/.exec(count ?? '')?.[1] ?? '0')
    check('the piece reaches the bag', inBag > 0, `${inBag} item(s) on the bag icon`)
  }
}

// ══════════════════════════════════════════════ console
section('The console', 'What the page complained about')

if (failedRequests.length > 0) {
  console.log('')
  console.log('  requests that failed:')
  for (const line of [...new Set(failedRequests)].slice(0, 8)) console.log(`    ${line}`)
}

check(
  'nothing errored while doing all that',
  consoleErrors.length === 0,
  consoleErrors.length ? consoleErrors.slice(0, 2).join(' | ').slice(0, 160) : 'clean',
)

await browser.close()

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
