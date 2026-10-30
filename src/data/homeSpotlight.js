import { showcaseProducts } from './showcaseCatalog.js'

// The fixed local pool keeps offers stable while the remote catalog loads.
// Change the duration, number of products or divisor to update the promotion.
export const spotlightConfig = {
  startsAt: '2026-10-14T00:00:00+01:00',
  durationHours: 2,
  productCount: 4,
  priceDivisor: 4,
}

const spotlightProductIds = [...new Set(showcaseProducts.map((product) => product.id))].sort()

function originalPrice(product) {
  return product?.spotlightOffer?.originalPrice ?? product?.price
}

function isEligible(product) {
  const price = originalPrice(product)
  return Boolean(product && product.inStock !== false
    && !(product.stock != null && Number(product.stock) <= 0)
    && Number.isFinite(price) && price > 0)
}

function seededRandom(cycleIndex) {
  let seed = 2166136261
  for (const character of `vemba-spotlight-v1:${cycleIndex}`) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
  }

  // Mulberry32 gives every visitor the same shuffle for this two-hour window.
  return () => {
    seed = (seed + 0x6D2B79F5) >>> 0
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function getSpotlightCycle(now = Date.now()) {
  const startsAt = Date.parse(spotlightConfig.startsAt)
  const durationMs = spotlightConfig.durationHours * 60 * 60 * 1000
  const currentTime = Math.max(startsAt, Number.isFinite(now) ? now : Date.now())
  const cycleIndex = Math.floor((currentTime - startsAt) / durationMs)
  const endsAt = startsAt + (cycleIndex + 1) * durationMs

  return {
    cycleIndex,
    remainingSeconds: Math.ceil((endsAt - currentTime) / 1000),
    endsAt,
  }
}

export function selectSpotlightProducts(products, cycleIndex) {
  const productsById = new Map(products.map((product) => [product.id, product]))
  const index = Number.isFinite(cycleIndex) ? Math.max(0, Math.floor(cycleIndex)) : 0
  const available = spotlightProductIds.map((id) => productsById.get(id)).filter(isEligible)
  const random = seededRandom(index)

  for (let position = available.length - 1; position > 0; position -= 1) {
    const swapPosition = Math.floor(random() * (position + 1))
    ;[available[position], available[swapPosition]] = [available[swapPosition], available[position]]
  }

  return available.slice(0, spotlightConfig.productCount).map((product) => {
    const category = (product.category || 'Featured').replace(/-/g, ' ')
    return { id: product.id, label: category.charAt(0).toUpperCase() + category.slice(1), product }
  })
}

export function applySpotlightPricing(products, selection, endsAt) {
  const selectedIds = new Set(selection.map(({ id }) => id))
  const discountPercent = Math.round((1 - 1 / spotlightConfig.priceDivisor) * 100)

  return products.map((product) => {
    if (!selectedIds.has(product.id) || !isEligible(product)) return product

    const price = originalPrice(product)
    const priceInCents = Math.round(price * 100)
    return {
      ...product,
      price: Math.round(priceInCents / spotlightConfig.priceDivisor) / 100,
      compareAt: price,
      badge: `${discountPercent}% off`,
      spotlightOffer: { originalPrice: price, endsAt, discountPercent },
    }
  })
}
