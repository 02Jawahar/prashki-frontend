/**
 * Whether the feature film plays again after you scroll away and come back.
 *
 * It played the first time and never again. The observer flipped a flag on
 * arrival, and the flag was already set on the second arrival — so no state
 * changed, no effect re-ran, and the film stayed paused where scrolling past
 * had left it. The markup was identical in both cases, which is why this has
 * to be a real browser scrolling a real page.
 *
 *   node scripts/browser-film-band.mjs
 *   node scripts/browser-film-band.mjs --headed
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

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: !HEADED,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

const band = page.locator('video[poster*="film-feature-poster"], video[poster*="film-studio"]').first()

const state = () =>
  band.evaluate((v) => ({
    paused: v.paused,
    time: Number(v.currentTime.toFixed(2)),
    src: Boolean(v.currentSrc || v.getAttribute('src')),
  }))

// ══════════════════════════════════════════════════ first visit
section('Scrolling to it', 'The first time')

check('the film band is on the page', (await band.count()) > 0)

await band.scrollIntoViewIfNeeded()
await page.waitForTimeout(5000)

const first = await state()
check('the source attaches once it is reached', first.src)
check('it plays', !first.paused && first.time > 0, `currentTime ${first.time}s`)

// ══════════════════════════════════════════════════ away
section('Scrolling past it', 'It should stop decoding')

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await page.waitForTimeout(3000)

const away = await state()
check('it pauses when it is off screen', away.paused, `paused at ${away.time}s`)

// ══════════════════════════════════════════════════ back — the bug
section('Coming back to it', 'This is the one that was broken')

await band.scrollIntoViewIfNeeded()
await page.waitForTimeout(5000)

const back = await state()
check('it plays again', !back.paused, `paused=${back.paused}`)
check('and the picture is advancing', back.time > away.time, `${away.time}s -> ${back.time}s`)

// ══════════════════════════════════════════════════ and again
section('And once more', 'Not just the second time')

await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(2500)
await band.scrollIntoViewIfNeeded()
await page.waitForTimeout(4000)

const third = await state()
check('it still resumes on a third pass', !third.paused && third.time > back.time,
  `${back.time}s -> ${third.time}s`)

await browser.close()
console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
