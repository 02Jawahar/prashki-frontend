/**
 * Whether the WhatsApp conversation actually renders on a consultation.
 *
 * Reading the markup is not the same as looking at it — a colour token that
 * was never defined rendered six components transparent earlier in this build
 * and the source looked perfect throughout. So this opens the thread the way
 * somebody in the studio would, sends a reply, and photographs the result.
 *
 *   node scripts/browser-consultation-thread.mjs
 *   node scripts/browser-consultation-thread.mjs --headed
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
const SHOT = flag('shot', 'E:/prashki-frontend/.playwright/consultation-thread.png')
const ADMIN = { email: flag('email', 'admin@example.com'), password: flag('password', 'Admin@12345') }

let passed = 0
let failed = 0
const check = (label, ok, detail) => {
  if (ok) passed++
  else failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}
const section = (t) => console.log(`\n${t}`)

const browser = await chromium.launch({ executablePath: CHROME, headless: !HEADED })
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
const page = await context.newPage()

section('Signing in')
await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.locator('input[type="email"]').first().fill(ADMIN.email)
await page.locator('input[type="password"]').first().fill(ADMIN.password)
await page.locator('button[type="submit"]').first().click()
await page.waitForTimeout(4000)
check('reached the dashboard', !page.url().includes('/admin/login'), page.url().replace(BASE, ''))

section('The consultation')
// The seeded booking is CONFIRMED, so the default REQUESTED filter hides it.
await page.goto(`${BASE}/admin/appointments`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await page.locator('select').first().selectOption('CONFIRMED')
await page.waitForTimeout(2500)

const row = page.locator('li', { hasText: 'PK-C-PREVW' }).first()
check('the seeded consultation is listed', (await row.count()) > 0)

section('The conversation')
const toggle = row.getByRole('button', { name: /WhatsApp/i }).first()
check('a WhatsApp control is on the row', (await toggle.count()) > 0)
await toggle.click()
await page.waitForTimeout(2500)

const bubbles = row.locator('ol li')
const count = await bubbles.count()
check('the thread opens with the seeded messages', count === 3, `${count} messages`)

const text = await row.innerText()
check('what the customer wrote is visible', text.includes('bring a photo of the colour'))
check('what the studio replied is visible', text.includes('Thursday at 11 works'))
check('the window is counted down in words', /hours? left|minutes? left/.test(text),
  (text.match(/\d+ (?:hours?|minutes?) left/) ?? ['not shown'])[0])

/*
 * A bubble that renders the same colour as the surface behind it is invisible
 * while the markup looks correct. Measured rather than trusted.
 */
const painted = await bubbles.first().evaluate((li) => {
  const bubble = li.firstElementChild
  const style = getComputedStyle(bubble)
  const bg = style.backgroundColor
  const transparent = bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)'
  return {
    bg,
    colour: style.color,
    transparent,
    hasBorder: style.borderTopWidth !== '0px',
    width: bubble.getBoundingClientRect().width,
  }
})
check(
  'a message bubble is actually painted',
  (!painted.transparent || painted.hasBorder) && painted.width > 40,
  `background ${painted.bg}, ${Math.round(painted.width)}px wide`,
)

section('Replying')
/*
 * By placeholder, not position. The row carries two textareas — this one and
 * the staff note — and an earlier version of this test picked the wrong one
 * by index, typed a message to the customer into a private note, and reported
 * the send as broken.
 */
const box = row.getByPlaceholder('Write to the customer on WhatsApp')
check('a reply box is offered while the window is open', (await box.count()) === 1)
await box.fill('Of course — bring the photo, it helps enormously.')
await page.waitForTimeout(300)
await row.getByRole('button', { name: /^Send$/i }).first().click()
await page.waitForTimeout(4000)

const after = await row.locator('ol li').count()
check('the reply joins the thread', after === 4, `${after} messages`)
check('the box is cleared after sending', (await box.inputValue()) === '')

await page.locator('body').evaluate((b) => b.scrollIntoView())
await row.screenshot({ path: SHOT })
console.log(`\n  shot  ${SHOT}`)

await browser.close()
console.log(`\n  ${passed} passed, ${failed} failed\n`)
process.exit(failed ? 1 : 0)
