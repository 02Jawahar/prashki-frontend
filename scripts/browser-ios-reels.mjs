/**
 * What WebKit sees of the reel strip.
 *
 * Chrome on iOS is not Chrome — Apple requires every browser on the platform
 * to render with WebKit — so this is the nearest engine available off-device.
 *
 * Read what this is honestly: a markup and state inspector, NOT proof that a
 * film autoplays on an iPhone. Headless WebKit on a desktop has no Low Power
 * Mode, no Low Data Mode and none of iOS's power-management autoplay rules,
 * and it reported the strip playing happily against a build that was dead on
 * a real handset. Use it to check that the source attached, that `playsinline`
 * and `muted` survived the render, and what `preload` ended up as. Believe a
 * phone, not this.
 *
 *   node scripts/browser-ios-reels.mjs --base http://localhost:3100
 */
import { webkit, devices } from 'playwright-core'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const BASE = flag('base', 'http://localhost:3100')

const browser = await webkit.launch({ headless: !args.includes('--headed') })
const page = await (await browser.newContext(devices['iPhone 13'])).newPage()

console.log(`\n  engine  WebKit (what every iPhone browser runs)`)
console.log(`  target  ${BASE}\n`)

await page.goto(BASE, { waitUntil: 'domcontentloaded' })

/*
 * The strip is at the very top, so the tile is already centred. The observer
 * wants 60% of it in view; a nudge and a settle is all it needs.
 */
await page.waitForTimeout(2500)
await page.evaluate(() => window.scrollBy(0, 40))
await page.waitForTimeout(6000)

const state = await page.evaluate(() => {
  const v = document.querySelector('section video')
  if (!v) return { none: true }
  return {
    src: (v.currentSrc || '(no source selected)').split('/').pop(),
    paused: v.paused,
    readyState: v.readyState,
    currentTime: Number(v.currentTime.toFixed(2)),
    muted: v.muted,
    playsinline: v.hasAttribute('playsinline'),
    preload: v.getAttribute('preload') ?? '(not set)',
    error: v.error ? `code ${v.error.code}` : null,
  }
})

if (state.none) {
  console.log('  no film element in the first section — the strip did not mount\n')
  await browser.close()
  process.exit(1)
}

console.log(`  source      ${state.src}`)
console.log(`  preload     ${state.preload}`)
console.log(`  playsinline ${state.playsinline}   muted ${state.muted}`)
console.log(`  readyState  ${state.readyState}`)
console.log(`  paused      ${state.paused}`)
console.log(`  currentTime ${state.currentTime}`)
if (state.error) console.log(`  ERROR       ${state.error}`)

/*
 * Reported, not asserted. This engine cleared a build that a real iPhone
 * could not play, so a pass here would be a lie told confidently.
 */
const moving = !state.paused && state.currentTime > 0
console.log(`
  moving here: ${moving ? 'yes' : 'no'} — which settles nothing about a handset
`)

await browser.close()
