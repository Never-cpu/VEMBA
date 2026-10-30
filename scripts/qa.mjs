import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'
import { showcaseProducts } from '../src/data/showcaseCatalog.js'
import { journalStories } from '../src/data/catalog.js'
import { applySpotlightPricing, getSpotlightCycle, selectSpotlightProducts } from '../src/data/homeSpotlight.js'

const base = process.env.VEMBA_URL || 'https://localhost:5173'
const apiPattern = /\/data\/retail-products\.json(?:\?.*)?$/
// These records only exist inside intercepted QA responses, never the shipped catalog.
const fixtureProducts = Array.from({ length: 32 }, (_, index) => {
  const photoSource = showcaseProducts[index % showcaseProducts.length]
  const name = index === 0 ? 'QA Reference Headphones' : index === 1 ? 'QA Camera Sling' : `QA Catalog Item ${index + 1}`
  return {
    id: `retail-qa-${index + 1}`,
    slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
    source: 'retailer-api',
    sourceName: 'QA Test Retailer',
    sourceUrl: photoSource.sourceUrl,
    imageSourceUrl: photoSource.imageSourceUrl,
    priceCheckedAt: '2026-10-12',
    name,
    description: `A browser-test fixture, number ${index + 1}.`,
    category: index % 2 ? 'accessories' : 'audio',
    collection: index % 2 ? 'accessories' : 'audio',
    eyebrow: 'QA Test Retailer',
    price: index === 0 ? 19.99 : 199.49 + index,
    currency: 'USD',
    stock: index === 2 ? 0 : null,
    badge: index === 2 ? 'Out of stock' : null,
    image: photoSource.image,
    images: [photoSource.image],
    colors: [],
    sizes: [],
    materials: [],
    details: ['Browser-test fixture'],
    reviews: [],
    isNew: false,
    shippingInformation: 'Check the retailer for delivery and availability.',
    returnPolicy: 'See the original retailer listing for return terms.',
    warrantyInformation: '',
  }
})
const fixture = { version: 1, fetchedAt: '2026-10-12T00:00:00.000Z', sources: [], products: fixtureProducts }
const fixedTime = Date.parse('2026-10-15T10:30:00+01:00')
const fixedCycle = getSpotlightCycle(fixedTime)
const localProducts = applySpotlightPricing(showcaseProducts, selectSpotlightProducts(showcaseProducts, fixedCycle.cycleIndex), fixedCycle.endsAt)
const totalProducts = localProducts.length + fixtureProducts.length
const pageSize = 24
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2 }).format(value)
const remoteTitle = fixtureProducts[0].name
const remotePath = `/products/${fixtureProducts[0].slug}`
const failures = []
const assert = (condition, message) => { if (!condition) failures.push(message) }
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
})

function watchPage(page, label) {
  page.on('request', (request) => {
    assert(!/^http:\/\//.test(request.url()), `${label}: insecure HTTP request: ${request.url()}`)
    assert(!/\/images\/aurel-(?:hero|products)\.png(?:\?|$)/.test(request.url()), `${label}: requested a removed AI image: ${request.url()}`)
    assert(!/https:\/\/(?:cdn\.)?dummyjson\.com\//.test(request.url()), `${label}: requested the removed placeholder API: ${request.url()}`)
  })
  page.on('websocket', (socket) => {
    assert(!socket.url().startsWith('ws://'), `${label}: insecure WebSocket: ${socket.url()}`)
  })
  page.on('pageerror', (error) => failures.push(`${label}: page error: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    // HTTP 503 is deliberately returned by the API failure scenarios below.
    if (message.text().includes('the server responded with a status of 503')) return
    failures.push(`${label}: console error: ${message.text()}`)
  })
}

async function fixedContext({ width = 1440, height = 1000 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  // Keep rotating selections and their prices stable across page visits and reloads.
  await context.clock.setFixedTime(fixedTime)
  return context
}

async function testContext({ width = 1440, height = 1000, handler } = {}) {
  const context = await fixedContext({ width, height })
  await context.route(apiPattern, async (route) => {
    if (handler) await handler(route)
    else await route.fulfill({ json: fixture })
  })
  return context
}

async function waitForCount(page, selector, count) {
  await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count, { selector, count })
}

async function loadAllProducts(page, count) {
  let shown = await page.locator('.product-card').count()
  while (shown < count) {
    await page.getByRole('button', { name: /load more/i }).click()
    const next = Math.min(shown + pageSize, count)
    await waitForCount(page, '.product-card', next)
    shown = next
  }
  assert(shown === count, 'pagination: loaded product count is incorrect')
  assert(await page.getByRole('button', { name: /load more/i }).count() === 0, 'pagination: load more should disappear after the final page')
}

async function checkOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert(overflow <= 1, `${label}: horizontal overflow of ${overflow}px`)
}

async function capture(page, name) {
  if (process.env.VEMBA_SCREENSHOTS !== '1') return
  await mkdir('screenshots', { recursive: true })
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false })
}

try {
  const context = await testContext()
  const page = await context.newPage()
  watchPage(page, 'desktop')
  // Chrome performs normal certificate validation; never ignore HTTPS errors.
  const securitySession = await context.newCDPSession(page)
  let connectionSecurity
  securitySession.on('Security.visibleSecurityStateChanged', ({ visibleSecurityState }) => {
    connectionSecurity = visibleSecurityState
  })
  await securitySession.send('Security.enable')
  for (const route of ['/', '/shop', `/products/${showcaseProducts[0].slug}`, '/search?q=playstation', '/wishlist', '/about', '/journal', ...journalStories.map((story) => `/journal/${story.slug}`), '/help']) {
    const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
    assert(response?.ok(), `${route}: did not return a successful response`)
    assert(await page.locator('main').count() === 1, `${route}: expected one main landmark`)
    await checkOverflow(page, route)
  }
  assert(await page.evaluate(() => location.protocol === 'https:' && window.isSecureContext), 'checkout security: HTTPS is required')
  assert(connectionSecurity?.securityState === 'secure', 'checkout security: Chrome must report a trusted secure connection')
  assert(!connectionSecurity?.certificateSecurityState?.certificateNetworkError, 'checkout security: certificate validation failed')
  await securitySession.detach()

  await page.goto(base, { waitUntil: 'networkidle' })
  await capture(page, 'desktop-exact')
  await page.goto(`${base}/shop`, { waitUntil: 'networkidle' })
  await waitForCount(page, '.product-card', 24)
  assert((await page.locator('.catalog-sort > span').innerText()).includes(String(totalProducts)), 'shop: count must include the complete remote catalog')
  await loadAllProducts(page, totalProducts)

  await page.locator('.filter-chips').getByRole('button', { name: 'audio', exact: true }).click()
  await waitForCount(page, '.product-card', 16)
  assert((await page.locator('.product-card__category').allTextContents()).every((category) => category === 'audio'), 'shop: API category filter returned unrelated products')
  const apiCard = page.locator('.product-card').filter({ has: page.getByRole('heading', { name: remoteTitle, exact: true }) })
  assert((await apiCard.locator('.product-card__price').innerText()) === '$19.99', 'shop: cents must be preserved in remote product prices')
  await apiCard.scrollIntoViewIfNeeded()
  await apiCard.locator('img').evaluate((image) => image.decode())
  assert(await apiCard.locator('img').evaluate((image) => image.naturalWidth > 0), 'shop: remote product image did not render')
  const soldOutCard = page.locator('.product-card').filter({ hasText: 'QA Catalog Item 3' }).first()
  assert(await soldOutCard.locator('.product-card__quick-add').isDisabled(), 'shop: out-of-stock product can be added to the bag')

  await page.locator('.filter-chips').getByRole('button', { name: 'All', exact: true }).click()
  await page.locator('.catalog-sort select').selectOption('price-low')
  const prices = (await page.locator('.product-card__price').allTextContents()).map((value) => Number(value.replace(/[^0-9.]/g, '')))
  assert(prices.every((value, index) => index === 0 || value >= prices[index - 1]), 'shop: price sorting is incorrect')

  await page.goto(`${base}/search?q=${encodeURIComponent(remoteTitle)}`, { waitUntil: 'networkidle' })
  await waitForCount(page, '.product-card', 1)
  assert(await page.getByRole('heading', { name: remoteTitle, exact: true }).count() === 1, 'search: remote product was not found')
  await page.locator('.product-card').hover()
  await page.locator('.product-card__quick-add').click()
  await page.locator('.cart-drawer').waitFor({ state: 'visible' })
  assert((await page.locator('.cart-drawer .cart-line').innerText()).includes(remoteTitle), 'cart: remote quick add did not create a line item')
  assert((await page.locator('.cart-drawer .subtotal-row').innerText()).includes('$19.99'), 'cart: subtotal lost decimal cents')
  await page.locator('.cart-drawer').getByRole('button', { name: 'Close bag', exact: true }).click()
  await page.locator('.product-card__wishlist').click()

  // Reload with no product cache: persisted remote IDs must survive the asynchronous fetch.
  await page.evaluate(() => localStorage.removeItem('aurel-store:products:v2'))
  await page.goto(`${base}/wishlist`, { waitUntil: 'networkidle' })
  await waitForCount(page, '.product-card', 1)
  assert(await page.getByRole('heading', { name: remoteTitle, exact: true }).count() === 1, 'wishlist: remote item was lost while the catalog reloaded')
  await page.goto(`${base}/cart`, { waitUntil: 'networkidle' })
  assert((await page.locator('main .cart-line').innerText()).includes(remoteTitle), 'cart: remote item did not survive reload')
  assert((await page.locator('.summary-lines').innerText()).includes('$19.99'), 'cart: restored subtotal is incorrect')

  await page.goto(`${base}/checkout`, { waitUntil: 'networkidle' })
  for (const label of ['Card number', 'Expiry date', 'Security code']) {
    assert(await page.getByLabel(label, { exact: true }).count() === 1, `checkout: ${label} should be available for the card demo`)
  }
  assert(await page.getByRole('radio', { name: 'Debit or credit card', exact: true }).isChecked(), 'checkout: card should be selected by default')
  for (const method of ['Debit or credit card', 'Gift card']) {
    const option = page.getByRole('radio', { name: method, exact: true })
    let giftCardPage
    if (method === 'Gift card') {
      const popup = page.context().waitForEvent('page')
      await option.check()
      giftCardPage = await popup
      await giftCardPage.getByRole('heading', { name: 'Capture a gift card.' }).waitFor()
      assert(await giftCardPage.getByLabel('Gift card code').isVisible(), 'gift card: code field is missing')
      assert(await giftCardPage.getByRole('button', { name: /capture gift card details/i }).isVisible(), 'gift card: capture action is missing')
      assert(await giftCardPage.getByRole('link', { name: /purchase online/i }).count() === 0, 'gift card: purchase link should be removed')
      await giftCardPage.close()
    } else await option.check()
    assert(await option.isChecked(), `checkout: ${method} could not be selected`)
    assert(await page.locator('input[name="payment-method"]:checked').count() === 1, 'checkout: exactly one payment method should be selected')
    const paymentMethodLabel = method === 'Gift card' ? 'gift card' : 'card'
    const paymentButton = page.getByRole('button', { name: new RegExp(`continue with ${paymentMethodLabel}`, 'i') })
    assert(await paymentButton.isDisabled(), `checkout: ${method} must remain disabled until connected`)
    assert((await paymentButton.innerText()).includes('$31.99'), `checkout: ${method} total should include cents and $12 delivery`)
  }
  await page.getByRole('radio', { name: 'Debit or credit card', exact: true }).check()
  assert(await page.getByText('Secure checkout.', { exact: true }).isVisible(), 'checkout: secure checkout message is missing')
  const savedCart = await page.evaluate(() => localStorage.getItem('aurel-store:cart'))
  for (const [label, value] of [
    ['Email address', 'test@example.com'], ['First name', 'Ari'], ['Last name', 'Stone'],
    ['Address', '42 Form Street'], ['City', 'Brooklyn'], ['State / Region', 'New York'],
    ['Postal code', '11201'],
  ]) await page.getByLabel(label, { exact: true }).fill(value)
  await page.getByLabel('Postal code', { exact: true }).press('Enter')
  assert(new URL(page.url()).pathname === '/checkout', 'checkout: Enter must not complete an unconnected payment')
  assert(await page.evaluate(() => sessionStorage.getItem('aurel-last-order')) === null, 'checkout: unconnected payments must not save an order summary')
  assert(await page.evaluate(() => localStorage.getItem('aurel-store:cart')) === savedCart, 'checkout: unconnected payments must preserve the bag')
  assert((await page.locator('.summary-total').innerText()).includes('$31.99'), 'checkout: order total changed before payment')
  await context.close()

  // Real products remain local and deterministic; retailer sites are never needed to browse them.
  const realContext = await testContext()
  const realPage = await realContext.newPage()
  watchPage(realPage, 'real products')
  await realPage.goto(`${base}/collections/new`, { waitUntil: 'networkidle' })
  const photoResults = await realPage.evaluate(async (paths) => Promise.all(paths.map(async (src) => {
    const photo = new Image()
    photo.src = src
    try {
      await photo.decode()
      return { src, loaded: photo.naturalWidth > 100 && photo.naturalHeight > 100 }
    } catch {
      return { src, loaded: false }
    }
  })), [...new Set(showcaseProducts.flatMap((product) => [product.image, ...(product.images || [])]).filter(Boolean))])
  for (const photo of photoResults) assert(photo.loaded, `real catalog: product photo did not decode: ${photo.src}`)
  const realSamples = [
    showcaseProducts.find((product) => product.category === 'gaming' && /PS5|PlayStation 5/i.test(product.name)),
    showcaseProducts.find((product) => product.category === 'gaming' && /PS4|PlayStation 4/i.test(product.name)),
    showcaseProducts.find((product) => product.category === 'jewellery' && product.price >= 1000),
    showcaseProducts.find((product) => product.category === 'watches' && product.price >= 1000),
  ].map((product) => localProducts.find((candidate) => candidate.id === product?.id))
  assert(realSamples.every(Boolean), 'real catalog: expected PS5, PS4, expensive jewellery, and luxury watches')
  for (const product of realSamples.filter(Boolean)) {
    assert(product.source === 'retailer' && /^https:\/\//.test(product.sourceUrl), `${product.name}: expected an identifiable retailer source`)
    assert(product.stock === null && product.rating == null, `${product.name}: retailer data must not invent inventory or ratings`)
    assert(product.image?.startsWith('/images/'), `${product.name}: expected a locally saved product photo`)
    await realPage.goto(`${base}/products/${product.slug}`, { waitUntil: 'networkidle' })
    assert((await realPage.locator('.pdp-info h1').innerText()) === product.name, `${product.name}: detail page did not resolve`)
    assert((await realPage.locator('.pdp-price > span').first().innerText()) === money(product.price), `${product.name}: detail price does not match the current promotion`)
    assert(await realPage.locator('.pdp-price .product-rating').count() === 0, `${product.name}: detail page displays an invented rating`)
    const sourceLinks = await realPage.locator('.pdp-info a').evaluateAll((links) => links.map((link) => link.href))
    assert(sourceLinks.includes(product.sourceUrl), `${product.name}: detail page is missing its real product source`)
    const photo = realPage.locator('.pdp-gallery__main img')
    await photo.evaluate((image) => image.decode())
    assert(await photo.evaluate((image) => image.naturalWidth > 100 && image.naturalHeight > 100), `${product.name}: real product photo failed to load`)
    await realPage.locator('.pdp-actions').getByRole('button', { name: /add to bag/i }).click()
    await realPage.locator('.cart-drawer').getByRole('button', { name: 'Close bag', exact: true }).click()
    await realPage.locator('.pdp-actions').getByRole('button', { name: 'Add to wishlist', exact: true }).click()
  }
  await realPage.goto(`${base}/wishlist`, { waitUntil: 'networkidle' })
  await waitForCount(realPage, '.product-card', realSamples.filter(Boolean).length)
  for (const product of realSamples.filter(Boolean)) {
    assert(await realPage.getByRole('heading', { name: product.name, exact: true }).count() === 1, `${product.name}: wishlist did not survive reload`)
  }
  await realPage.goto(`${base}/cart`, { waitUntil: 'networkidle' })
  const realCartNames = await realPage.locator('main .cart-line').allTextContents()
  for (const product of realSamples.filter(Boolean)) {
    assert(realCartNames.some((line) => line.includes(product.name)), `${product.name}: cart did not survive reload`)
  }
  const realSubtotal = realSamples.filter(Boolean).reduce((total, product) => total + product.price, 0)
  assert((await realPage.locator('.summary-lines').innerText()).includes(money(realSubtotal)), 'real cart: restored subtotal is incorrect')
  for (const collection of ['gaming', 'luxury', 'new']) {
    const expected = localProducts.filter((product) => collection === 'new' ? product.isNew : product.category === collection || product.collection === collection)
    await realPage.goto(`${base}/collections/${collection}`, { waitUntil: 'networkidle' })
    await waitForCount(realPage, '.product-card', Math.min(pageSize, expected.length))
    assert((await realPage.locator('.catalog-sort > span').innerText()) === `${expected.length} products`, `${collection}: collection count is incorrect`)
    await loadAllProducts(realPage, expected.length)
    const names = await realPage.locator('.product-card h3').allTextContents()
    assert(expected.every((product) => names.includes(product.name)), `${collection}: collection contains incorrect products`)
    await checkOverflow(realPage, `desktop ${collection}`)
  }
  await realContext.close()

  // A fresh direct link must wait for the API instead of flashing a missing-product page.
  let releaseCatalog
  const catalogGate = new Promise((resolve) => { releaseCatalog = resolve })
  const directContext = await testContext({ handler: async (route) => { await catalogGate; await route.fulfill({ json: fixture }) } })
  const directPage = await directContext.newPage()
  watchPage(directPage, 'direct product')
  await directPage.goto(`${base}${remotePath}`, { waitUntil: 'domcontentloaded' })
  await directPage.locator('.catalog-status').filter({ hasText: /loading/i }).waitFor()
  assert(await directPage.locator('.not-found').count() === 0, 'product: showed 404 while waiting for the API')
  releaseCatalog()
  await directPage.locator('.pdp-info h1').waitFor()
  assert((await directPage.locator('.pdp-info h1').innerText()) === remoteTitle, 'product: direct API product link failed')
  assert((await directPage.locator('.pdp-price').innerText()).includes('$19.99'), 'product: detail page lost price cents')
  assert(await directPage.locator('.pdp-price .product-rating').count() === 0, 'product: API item displays an invented rating')
  assert((await directPage.locator('.pdp-info a').evaluateAll((links) => links.map((link) => link.href))).includes(fixtureProducts[0].sourceUrl), 'product: API item is missing its retailer source link')
  await directPage.locator('.pdp-gallery__main img').evaluate((image) => image.decode())
  await directPage.reload({ waitUntil: 'networkidle' })
  assert((await directPage.locator('.pdp-info h1').innerText()) === remoteTitle, 'product: API product detail did not survive refresh')
  await directContext.close()

  // Failure starts with empty storage; real local products remain browseable until retry succeeds.
  let failApi = true
  const fallbackContext = await testContext({ handler: (route) => failApi
    ? route.fulfill({ status: 503, json: { message: 'Temporary test outage' } })
    : route.fulfill({ json: fixture }) })
  const fallbackPage = await fallbackContext.newPage()
  watchPage(fallbackPage, 'API recovery')
  await fallbackPage.goto(`${base}/shop`, { waitUntil: 'networkidle' })
  await fallbackPage.getByRole('button', { name: 'Try again', exact: true }).waitFor()
  assert(await fallbackPage.locator('.product-card').count() === Math.min(pageSize, localProducts.length), 'API failure: local and real products should remain available without a cache')
  assert((await fallbackPage.locator('.catalog-sort > span').innerText()) === `${localProducts.length} products`, 'API failure: fallback count must include the real product catalog')
  failApi = false
  await fallbackPage.getByRole('button', { name: 'Try again', exact: true }).click()
  await fallbackPage.getByRole('button', { name: 'Try again', exact: true }).waitFor({ state: 'hidden' })
  await fallbackPage.waitForFunction((total) => document.querySelector('.catalog-sort > span')?.textContent === `${total} products`, totalProducts)
  await waitForCount(fallbackPage, '.product-card', 24)
  assert(await fallbackPage.getByRole('button', { name: 'Try again', exact: true }).count() === 0, 'API recovery: error did not clear after retry')
  await fallbackPage.goto(`${base}${remotePath}`, { waitUntil: 'networkidle' })
  await fallbackPage.locator('.pdp-actions').getByRole('button', { name: /add to bag/i }).click()
  await fallbackPage.locator('.cart-drawer').getByRole('button', { name: 'Close bag', exact: true }).click()
  await fallbackPage.locator('.pdp-actions').getByRole('button', { name: 'Add to wishlist', exact: true }).click()
  failApi = true
  await fallbackPage.goto(`${base}/wishlist`, { waitUntil: 'networkidle' })
  assert(await fallbackPage.getByRole('heading', { name: remoteTitle, exact: true }).count() === 1, 'API failure: cached wishlist product was lost')
  await fallbackPage.goto(`${base}/cart`, { waitUntil: 'networkidle' })
  assert((await fallbackPage.locator('main .cart-line').innerText()).includes(remoteTitle), 'API failure: cached remote cart product was lost')
  await fallbackContext.close()

  // Returning visitors must lose the old invented/test products, while real saved items survive.
  const migrationContext = await testContext({ handler: (route) => route.fulfill({ status: 503, json: { message: 'Migration test outage' } }) })
  await migrationContext.addInitScript(({ localProduct, remoteProduct }) => {
    if (localStorage.getItem('qa:migration-seeded')) return
    const legacyProduct = { ...remoteProduct, id: 'dummyjson-1', source: 'dummyjson', name: 'Old placeholder product', image: '/images/aurel-products.png', images: ['/images/aurel-products.png'] }
    const invalidProduct = { ...remoteProduct, id: 'retail-qa-99', name: 'Invalid cached product', image: '/images/aurel-products.png', images: ['/images/aurel-products.png'] }
    localStorage.setItem('aurel-store:products:v1', JSON.stringify([legacyProduct]))
    localStorage.setItem('aurel-store:products:v2', JSON.stringify([remoteProduct, legacyProduct, invalidProduct]))
    const savedIds = ['aurel-001', 'dummyjson-1', localProduct.id, remoteProduct.id]
    localStorage.setItem('aurel-store:cart', JSON.stringify(savedIds.map((productId) => ({ productId, quantity: 1, color: null, size: null }))))
    localStorage.setItem('aurel-store:wishlist', JSON.stringify(savedIds))
    localStorage.setItem('qa:migration-seeded', '1')
  }, { localProduct: showcaseProducts[0], remoteProduct: fixtureProducts[0] })
  const migrationPage = await migrationContext.newPage()
  watchPage(migrationPage, 'legacy data migration')
  await migrationPage.goto(`${base}/wishlist`, { waitUntil: 'networkidle' })
  await waitForCount(migrationPage, '.product-card', 2)
  const migratedNames = await migrationPage.locator('.product-card h3').allTextContents()
  assert(migratedNames.includes(showcaseProducts[0].name) && migratedNames.includes(remoteTitle), 'migration: real saved wishlist items were removed')
  const migratedStorage = await migrationPage.evaluate(() => ({
    oldCache: localStorage.getItem('aurel-store:products:v1'),
    cart: JSON.parse(localStorage.getItem('aurel-store:cart')),
    wishlist: JSON.parse(localStorage.getItem('aurel-store:wishlist')),
  }))
  const keptIds = [showcaseProducts[0].id, fixtureProducts[0].id]
  assert(migratedStorage.oldCache === null, 'migration: old placeholder cache was not removed')
  assert(migratedStorage.cart.length === 2 && migratedStorage.cart.every((item) => keptIds.includes(item.productId)), 'migration: cart retained a removed fictional or test product')
  assert(migratedStorage.wishlist.length === 2 && migratedStorage.wishlist.every((id) => keptIds.includes(id)), 'migration: wishlist retained a removed fictional or test product')
  await migrationPage.goto(`${base}/cart`, { waitUntil: 'networkidle' })
  assert(await migrationPage.locator('main .cart-line').count() === 2, 'migration: real saved cart items were removed')
  await migrationPage.goto(`${base}/shop`, { waitUntil: 'networkidle' })
  assert((await migrationPage.locator('.catalog-sort > span').innerText()) === `${localProducts.length + 1} products`, 'migration: obsolete or invalid cached products entered the catalog')
  await migrationContext.close()

  const soldOutContext = await testContext()
  await soldOutContext.addInitScript(() => {
    localStorage.setItem('aurel-store:cart', JSON.stringify([{ productId: 'retail-qa-3', quantity: 1, color: null, size: null }]))
  })
  const soldOutPage = await soldOutContext.newPage()
  watchPage(soldOutPage, 'saved sold-out product')
  await soldOutPage.goto(`${base}/checkout`, { waitUntil: 'networkidle' })
  const removeSoldOut = soldOutPage.getByRole('button', { name: 'Remove QA Catalog Item 3', exact: true })
  await removeSoldOut.waitFor()
  assert(await soldOutPage.getByRole('button', { name: /continue with (card|gift card)/i }).count() === 0, 'checkout: saved out-of-stock item can still be ordered')
  await removeSoldOut.click()
  assert(await soldOutPage.getByRole('heading', { name: 'Your bag is empty', exact: true }).count() === 1, 'checkout: unavailable saved item could not be removed')
  await soldOutContext.close()

  const mobileContext = await testContext({ width: 390, height: 844 })
  const mobile = await mobileContext.newPage()
  watchPage(mobile, 'mobile')
  await mobile.goto(base, { waitUntil: 'networkidle' })
  await checkOverflow(mobile, 'mobile home')
  await capture(mobile, 'mobile-exact')
  await mobile.getByRole('button', { name: 'Open menu' }).click()
  assert(await mobile.locator('.mobile-menu').isVisible(), 'mobile: menu did not open')
  await mobile.locator('.mobile-menu .icon-button').click()
  await mobile.goto(`${base}/shop`, { waitUntil: 'networkidle' })
  await waitForCount(mobile, '.product-card', 24)
  await checkOverflow(mobile, 'mobile expanded catalog')
  await mobile.getByRole('button', { name: 'Filters', exact: true }).click()
  await mobile.locator('.mobile-filters').getByRole('button', { name: 'accessories', exact: true }).click()
  await waitForCount(mobile, '.product-card', 16)
  await checkOverflow(mobile, 'mobile API category')
  await mobile.goto(`${base}/collections/gaming`, { waitUntil: 'networkidle' })
  await waitForCount(mobile, '.product-card', Math.min(pageSize, showcaseProducts.filter((product) => product.category === 'gaming').length))
  await checkOverflow(mobile, 'mobile gaming collection')
  await mobileContext.close()

  // Run separately from deterministic checks: VEMBA_LIVE=1 npm run qa.
  if (process.env.VEMBA_LIVE === '1') {
    const liveContext = await fixedContext()
    const livePage = await liveContext.newPage()
    watchPage(livePage, 'live API')
    const responsePromise = livePage.waitForResponse((response) => apiPattern.test(response.url()) && response.status() === 200, { timeout: 20000 })
    await livePage.goto(`${base}/shop`, { waitUntil: 'domcontentloaded' })
    const response = await responsePromise
    const liveData = await response.json()
    assert(liveData.version === 1 && liveData.products.length >= 80, 'live API: expected at least 80 imported retailer products')
    assert(new Set(liveData.products.map((product) => product.id)).size === liveData.products.length, 'live API: duplicate retailer product IDs')
    for (const product of liveData.products) {
      assert(product.source === 'retailer-api' && /^retail-[a-z0-9-]+-\d+$/.test(product.id), `${product.name}: expected an imported retailer product`)
      assert(product.price > 0 && product.currency === 'USD', `${product.name}: missing a valid USD reference price`)
      assert(product.rating == null && product.stock === null, `${product.name}: imported data must not invent ratings or inventory`)
      assert(/^https:\/\//.test(product.sourceUrl) && /^https:\/\//.test(product.imageSourceUrl), `${product.name}: missing original retailer or photograph provenance`)
    }
    await waitForCount(livePage, '.product-card', 24)
    const liveCount = new Set([...showcaseProducts, ...liveData.products].map((product) => product.id)).size
    await livePage.waitForFunction((total) => document.querySelector('.catalog-sort > span')?.textContent === `${total} products`, liveCount)
    const livePhotos = [...new Set(liveData.products.flatMap((product) => [product.image, ...(product.images || [])]).filter(Boolean))]
    const livePhotoResults = await livePage.evaluate(async (paths) => Promise.all(paths.map(async (src) => {
      const photo = new Image()
      photo.src = src
      try {
        await photo.decode()
        return { src, loaded: photo.naturalWidth > 100 && photo.naturalHeight > 100 }
      } catch {
        return { src, loaded: false }
      }
    })), livePhotos)
    for (const photo of livePhotoResults) assert(photo.loaded, `live API: imported product photo did not decode: ${photo.src}`)
    await livePage.goto(`${base}/search?q=${encodeURIComponent(liveData.products[0].name)}`, { waitUntil: 'networkidle' })
    const liveImage = livePage.locator('.product-card img').first()
    await liveImage.scrollIntoViewIfNeeded()
    await liveImage.evaluate((image) => image.decode())
    assert(await liveImage.evaluate((image) => image.naturalWidth > 0), 'live API: remote product photo did not load')
    console.log(`Imported API catalog verified: ${liveData.products.length} retailer products and ${livePhotos.length} decoded original product photos.`)
    await liveContext.close()
  }
} catch (error) {
  failures.push(error.stack || String(error))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`QA failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('QA passed: real products and source photos, legacy product removal, new arrivals, pagination, filters, search, decimal prices, persistent cart/wishlist, direct links, API recovery, checkout, routes, and mobile.')
