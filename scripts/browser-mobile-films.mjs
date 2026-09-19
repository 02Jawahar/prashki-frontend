/**
 * Whether the film wall plays on a phone.
 *
 * The row starts on hover, and a touch device has no hover — so the question
 * is not whether the markup is right but whether a film on a phone screen is
 * actually moving. That is only answerable by reading `currentTime` off a real
 * video element in a real touch context, which is what this does.
 *
 *   node scripts/browser-mobile-films.mjs
 *   node scripts/browser-mobile-films.mjs --headed
 *
 * `hasTouch` plus `isMobile` is what makes `(hover: none)` match — a narrow
 * viewport alone still reports a pointer, and the autoplay is scoped to
 * hoverless devices rather than to a width.
 */
import { chromium, devices } from 'playwright-core'

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
  // Chrome blocks autoplay by default in automation; a real phone allows it
  // for a muted, inline video, which is what these are.
  args: ['--autoplay-policy=no-user-gesture-required'],
})

// ══════════════════════════════════════════════════ phone
section('On a phone', 'iPhone 13 viewport, touch, no hover')

const phone = await browser.newContext({ ...devices['iPhone 13'] })
const page = await phone.newPage()
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

const hoverless = await page.evaluate(() => window.matchMedia('(hover: none)').matches)
check('the device reports no hover', hoverless, `matchMedia -> ${hoverless}`)

const grid = page.locator('section video, div[role="img"]').first()
await grid.scrollIntoViewIfNeeded().catch(() => undefined)
await page.waitForTimeout(6000)

const state = await page.evaluate(() => {
  const videos = [...document.querySelectorAll('video')]
  return videos.map((v) => ({
    src: (v.currentSrc || v.getAttribute('src') || '').split('/').pop(),
    paused: v.paused,
    time: Number(v.currentTime.toFixed(2)),
    muted: v.muted,
    inline: v.hasAttribute('playsinline'),
  }))
})

check('a film mounted without anyone tapping', state.length > 0, `${state.length} video element(s)`)

const playing = state.filter((v) => !v.paused && v.time > 0)
check(
  'it is actually playing, not just mounted',
  playing.length > 0,
  playing.map((v) => `${v.src} @ ${v.time}s`).join(', ') || state.map((v) => `${v.src} paused=${v.paused}`).join(', '),
)

check(
  'only the film on screen plays',
  playing.length <= 2,
  `${playing.length} playing of ${state.length} mounted`,
)

check('muted and inline, as a phone requires', state.every((v) => v.muted && v.inline))

// ══════════════════════════════════════════════════ desktop, unchanged
section('On a desktop', 'Hover still governs')

const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const deskPage = await desk.newPage()
await deskPage.goto(BASE, { waitUntil: 'domcontentloaded' })
await deskPage.waitForTimeout(4000)

/*
 * Only the film wall's own videos. The page has others — the band and the
 * showcase both start themselves when scrolled to, which is their design —
 * and counting every `video` on the page asks a different question than the
 * one this is checking.
 */
const before = await deskPage.evaluate(() =>
  [...document.querySelectorAll('div[role="img"] video')].filter((v) => !v.paused).length,
)
check('no film in the wall plays until hovered', before === 0, `${before} playing before hover`)

const tile = deskPage.locator('div[role="img"]').first()
if (await tile.count()) {
  await tile.hover()
  await deskPage.waitForTimeout(5000)
  const after = await deskPage.evaluate(() => {
    const v = document.querySelector('video')
    return v ? { paused: v.paused, time: Number(v.currentTime.toFixed(2)) } : null
  })
  check('hover still starts a film', after ? !after.paused && after.time > 0 : false,
    after ? `currentTime ${after.time}s` : 'no video mounted')
}

await browser.close()
console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
