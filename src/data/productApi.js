// Refreshed by `npm run catalog:sync`. The snapshot keeps product browsing
// available when a catalog refresh cannot be reached.
export const PRODUCTS_API_URL = "/data/retail-products.json";
const REQUEST_TIMEOUT_MS = 45000;

export const isRetailProductId = (id) => typeof id === "string" && /^retail-[a-z0-9]+-\d+$/.test(id);
const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const isHttpsUrl = (value) => {
  if (!hasText(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isProductPhoto = (value) => typeof value === "string"
  && (/^\/images\/(?:catalog|gaming|luxury)\/[a-zA-Z0-9._-]+$/.test(value)
    || /^https:\/\/cdn\.shopify\.com\/[^\s"'<>]+\.(?:jpe?g|png|webp)(?:\?.*)?$/i.test(value));
const stringArray = (value) => Array.isArray(value) && value.every(hasText);

// Validate fetched and cached records before components read prices or arrays.
// Old placeholder products deliberately fail this check.
export function isCachedProduct(product) {
  return Boolean(product && typeof product === "object"
    && product.source === "retailer-api"
    && isRetailProductId(product.id)
    && hasText(product.slug) && /^[a-z0-9-]+$/.test(product.slug)
    && hasText(product.name)
    && hasText(product.category)
    && hasText(product.collection)
    && hasText(product.description)
    && hasText(product.eyebrow)
    && hasText(product.sourceName)
    && isHttpsUrl(product.sourceUrl)
    && isHttpsUrl(product.imageSourceUrl)
    && /^\d{4}-\d{2}-\d{2}$/.test(product.priceCheckedAt)
    && product.currency === "USD"
    && Number.isFinite(product.price) && product.price > 0
    && product.rating == null
    && (product.inStock == null || typeof product.inStock === "boolean")
    && (product.createdAt == null || (hasText(product.createdAt) && Number.isFinite(Date.parse(product.createdAt))))
    && (product.sizeGuideUrl == null || isHttpsUrl(product.sizeGuideUrl))
    && (product.stock === null || (Number.isInteger(product.stock) && product.stock >= 0))
    && isProductPhoto(product.image)
    && Array.isArray(product.images) && product.images.length > 0 && product.images.every(isProductPhoto)
    && (product.imageAlts == null || stringArray(product.imageAlts))
    && [product.colors, product.sizes, product.materials, product.details].every(stringArray)
    && Array.isArray(product.reviews) && product.reviews.length === 0);
}

export async function fetchProductCatalog({ signal } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(PRODUCTS_API_URL, { signal: controller.signal, cache: "no-cache" });
    if (!response.ok) throw new Error(`Product catalog request failed (${response.status}).`);
    const result = await response.json();
    if (result.version !== 1 || !Array.isArray(result.products)) {
      throw new Error("The product catalog response was invalid.");
    }
    const products = result.products.filter(isCachedProduct);
    if (!products.length) throw new Error("The product catalog is currently empty.");
    return [...new Map(products.map((product) => [product.id, product])).values()];
  } catch (error) {
    if (timedOut) throw new Error("The product catalog took too long to respond. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
