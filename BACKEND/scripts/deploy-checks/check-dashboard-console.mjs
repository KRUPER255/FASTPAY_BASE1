#!/usr/bin/env node
/**
 * Headless browser console check for dashboard URLs.
 * Loads each URL in Chromium, captures console errors and uncaught exceptions,
 * detects navigation throttling/redirect loops, exits 1 if any occur.
 *
 * Usage:
 *   node check-dashboard-console.mjs [url1] [url2] ...
 *   (if no URLs given, uses staging defaults)
 *
 * Exit codes: 0 = OK, 1 = console errors/navigation issues found, 2 = Playwright not installed
 *
 * Requires: npm install && npx playwright install chromium (one-time)
 */

let chromium
try {
  const pw = await import('playwright')
  chromium = pw.chromium
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND' || (e.message && e.message.includes('Cannot find module'))) {
    console.error('Playwright not installed. Run: cd BACKEND/scripts/deploy-checks && npm install && npx playwright install chromium')
    process.exit(2)
  }
  throw e
}

const DEFAULT_URLS = [
  'https://staging.fastpaygaming.com/login',
  'https://sredpay.fastpaygaming.com/login'
]

const urls = process.argv.slice(2).filter(Boolean).length
  ? process.argv.slice(2).filter(Boolean)
  : DEFAULT_URLS

let failed = false
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()

for (const url of urls) {
  const page = await context.newPage()
  const errors = []
  let navigationCount = 0
  const maxNavigations = 10

  // Monitor console messages (errors and warnings with throttling)
  page.on('console', (msg) => {
    const text = msg.text()
    const type = msg.type()
    if (type === 'error') {
      errors.push(`ERROR: ${text}`)
    } else if (type === 'warning' && text.includes('Throttling navigation')) {
      errors.push(`WARNING: ${text}`)
    }
  })

  page.on('pageerror', (err) => {
    errors.push(`PAGE_ERROR: ${err.message}`)
  })

  // Monitor navigation events to detect redirect loops
  page.on('framenavigated', () => {
    navigationCount++
    if (navigationCount > maxNavigations) {
      errors.push(`Excessive navigation detected: ${navigationCount} navigations (possible redirect loop)`)
    }
  })

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
    // Allow React to hydrate and api-client validation to run
    // Also wait longer to catch navigation loops
    await new Promise((r) => setTimeout(r, 3000))
    
    // Check final navigation count after wait period
    if (navigationCount > maxNavigations) {
      errors.push(`Redirect loop detected: ${navigationCount} navigations exceeded threshold of ${maxNavigations}`)
    }
  } catch (e) {
    errors.push(`Navigation failed: ${e.message}`)
  }

  if (errors.length > 0) {
    console.error(`FAIL ${url}:`)
    errors.forEach((e) => console.error(`  - ${e}`))
    if (navigationCount > 0) {
      console.error(`  - Navigation count: ${navigationCount}`)
    }
    failed = true
  } else {
    console.log(`OK ${url}${navigationCount > 1 ? ` (${navigationCount} navigations)` : ''}`)
  }

  await page.close()
}

await browser.close()
process.exit(failed ? 1 : 0)
