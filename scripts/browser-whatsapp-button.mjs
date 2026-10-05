/**
 * Whether the WhatsApp button is there, points at the right number, and is
 * reachable by a thumb.
 *
 * The link is the whole feature, so the number in the href is checked rather
 * than assumed — a button that opens a chat with the wrong person is worse
 * than no button, and nothing about the page would look wrong.
 *
 * Also checks it is not covering anything. It floats over every page, and the
 * failure mode for a fixed-position element is sitting on top of a control
 * somebody needs.
 *
 *   node scripts/browser-whatsapp-button.mjs
 *   node scripts/browser-whatsapp-button.mjs --base https://prashandki.in
 */
import { chromium } from 'playwright-core'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const BASE = flag('base', 'http://localhost:3100')
const CHROME = flag('chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe')
const EXPECT = flag('number', '919994411585')

let passed = 0
let failed = 0
const check = (label, ok, detail) => {
  if (ok) passed++
  else failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}
const section = (t) => console.log(`\n${t}`)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

// A phone, because that is where this button matters and where a fixed
// element is most likely to be in the way.
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
const page = await context.newPage()

console.log(`\n  target ${BASE}`)

section('On the homepage')
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const link = page.locator('a[aria-label="Message us on WhatsApp"]')
check('the button is on the page', (await link.count()) === 1)

const href = await link.first().getAttribute('href')
check('it opens WhatsApp', Boolean(href?.startsWith('https://wa.me/')), href?.slice(0, 48))
check(
  'at the right number, with the spaces and plus stripped',
  Boolean(href?.startsWith(`https://wa.me/${EXPECT}`)),
  `expected ${EXPECT}, setting holds "+91 99944 11585"`,
)
check('with a message already typed', href?.includes('?text=') === true)
check('and opens in its own tab, safely', (await link.first().getAttribute('rel'))?.includes('noopener') === true)

section('Where it sits')
const box = await link.first().boundingBox()
check('it is visible', Boolean(box) && box.width > 20, box ? `${Math.round(box.width)}×${Math.round(box.height)}px` : '')
check(
  'big enough to tap',
  Boolean(box) && box.width >= 44 && box.height >= 44,
  'WCAG asks for 44px; a thumb asks for more',
)
check(
  'clear of the bottom edge',
  Boolean(box) && 844 - (box.y + box.height) >= 12,
  box ? `${Math.round(844 - (box.y + box.height))}px of clearance` : '',
)

/*
 * The real risk of a fixed button: it covers something. Ask the page what is
 * actually on top at that point rather than reasoning about z-index.
 */
const onTop = await page.evaluate(() => {
  const el = document.querySelector('a[aria-label="Message us on WhatsApp"]')
  if (!el) return null
  const r = el.getBoundingClientRect()
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return el.contains(hit) ? 'itself' : (hit?.tagName ?? 'nothing')
})
check('nothing is covering it', onTop === 'itself', `topmost element is ${onTop}`)

section('On a product page')
await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
check('it follows to other pages', (await page.locator('a[aria-label="Message us on WhatsApp"]').count()) === 1)

await page.screenshot({ path: 'E:/prashki-frontend/.playwright/whatsapp-button.png' })
console.log('\n  shot  E:/prashki-frontend/.playwright/whatsapp-button.png')

await browser.close()
console.log(`\n  ${passed} passed, ${failed} failed\n`)
process.exit(failed ? 1 : 0)
