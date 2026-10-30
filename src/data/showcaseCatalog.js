import { gamingProducts } from './gamingCatalog.js'
import { luxuryProducts } from './luxuryCatalog.js'

// Keep each new collection visible at the beginning of the shop.
const featured = [
  luxuryProducts.find((product) => product.category === 'jewellery'),
  luxuryProducts.find((product) => product.category === 'watches'),
  ...gamingProducts.slice(0, 2),
  ...luxuryProducts,
  ...gamingProducts,
].filter(Boolean)

export const showcaseProducts = [...new Map(featured.map((product) => [product.id, product])).values()]
