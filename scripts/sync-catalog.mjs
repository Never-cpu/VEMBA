// Refresh the public catalog from actual retailers' public Shopify APIs.
// Run with Node 20+ from any directory: node scripts/sync-catalog.mjs
// USD prices are for one explicitly identified variant, checked at import time.
// The snapshot deliberately makes no claims about current inventory or ratings.
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { luxuryProducts } from '../src/data/luxuryCatalog.js';
import { gamingProducts } from '../src/data/gamingCatalog.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imageDirectory = join(root, 'public', 'images', 'catalog');
const dataDirectory = join(root, 'public', 'data');
const existingSnapshotPath = join(dataDirectory, 'retail-products.json');
const fetchedAt = new Date().toISOString();
const checkedDate = fetchedAt.slice(0, 10);
const existingPaths = new Set([...luxuryProducts, ...gamingProducts].map((p) => {
  const url = new URL(p.sourceUrl);
  return `${url.hostname.replace(/^www\./, '')}${url.pathname}`;
}));
const configs = [
  {
    id: 'rc', name: 'Ring Concierge', baseUrl: 'https://ringconcierge.com',
    category: 'jewellery', limit: 30, optional: true,
    paths: ['earrings', 'bracelets', 'necklaces'].map((collection) => `/collections/${collection}/products.json?limit=50`),
    accepts: (p) => /earring|bracelet|necklace|charm/i.test(p.product_type),
  },
  {
    id: 'wg', name: 'WatchGuyNYC', baseUrl: 'https://www.watchguynyc.com',
    category: 'watches', limit: 30, optional: true, paths: ['/products.json?limit=250'],
    accepts: (p) => p.product_type === 'Watch' && p.vendor !== 'Breitling',
  },
  {
    id: 'hp', name: 'Headphones.com', baseUrl: 'https://headphones.com',
    category: 'audio', limit: 30, optional: true, paths: ['/products.json?limit=150'],
    accepts: (p) => /headphones|speakers|dac|amp/i.test(p.product_type)
      && !/open[ -]box|clearance|b[ -]stock|damaged/i.test(p.title),
  },
  {
    id: 'kc', name: 'Keychron', baseUrl: 'https://www.keychron.com',
    category: 'gaming', limit: 30, optional: true, paths: ['/products.json?limit=150'],
    accepts: (p) => /keyboard|mice/i.test(p.product_type) && !/iso layout/i.test(p.title),
  },
  {
    id: 'nb', name: 'NOBULL', baseUrl: 'https://www.nobullproject.com', currencyPath: '/meta.json',
    category: 'shoes', limit: 200, minimum: 100, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'of', name: 'Orthofeet', baseUrl: 'https://www.orthofeet.com', currencyPath: '/meta.json',
    category: 'shoes', limit: 680, minimum: 450, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'ol', name: 'OluKai', baseUrl: 'https://olukai.com', currencyPath: '/meta.json',
    category: 'shoes', limit: 480, minimum: 300, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'ab', name: 'Allbirds', baseUrl: 'https://www.allbirds.com', currencyPath: '/meta.json',
    category: 'shoes', limit: 390, minimum: 250, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'kz', name: 'Kizik', baseUrl: 'https://www.kizik.com', currencyPath: '/meta.json',
    category: 'shoes', limit: 320, minimum: 200, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'vs', name: 'Vessi', baseUrl: 'https://vessi.com', currencyPath: '/meta.json',
    category: 'shoes', limit: 300, minimum: 200, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'md', name: 'MediDepot', baseUrl: 'https://medidepot.com', currencyPath: '/meta.json',
    category: 'wheelchairs', limit: 550, minimum: 300, paginate: true, downloadImages: false, optional: true,
    paths: ['/collections/wheelchairs/products.json?limit=250'],
    accepts: (p) => /wheel[ -]?chair/i.test(`${p.product_type} ${p.title}`),
  },
  {
    id: 'bf', name: 'Branch Furniture', baseUrl: 'https://www.branchfurniture.com', currencyPath: '/meta.json',
    category: 'furniture', limit: 250, minimum: 30, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'om', name: 'Outmore Living', baseUrl: 'https://outmoreliving.com', currencyPath: '/meta.json',
    category: 'furniture', limit: 37, minimum: 20, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'usm', name: 'USA Medical Supply', baseUrl: 'https://usamedicalsupply.com', currencyPath: '/meta.json',
    category: 'mobility', limit: 640, minimum: 300, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'lg', name: 'Lulu and Georgia', baseUrl: 'https://www.luluandgeorgia.com', currencyPath: '/meta.json',
    category: 'furniture', limit: 700, minimum: 250, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'br', name: 'Brooklinen', baseUrl: 'https://www.brooklinen.com',
    category: 'home', limit: 350, minimum: 200, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'pa', name: 'Parachute', baseUrl: 'https://www.parachutehome.com',
    category: 'home', limit: 350, minimum: 200, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'mi', name: 'Miansai', baseUrl: 'https://www.miansai.com',
    category: 'jewellery', limit: 350, minimum: 200, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'an', name: 'Anker', baseUrl: 'https://us.anker.com',
    category: 'electronics', limit: 200, minimum: 100, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'sh', name: 'Schoolhouse', baseUrl: 'https://www.schoolhouse.com',
    category: 'home', limit: 250, minimum: 200, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'sc', name: 'Sunday Citizen', baseUrl: 'https://sundaycitizen.co',
    category: 'home', limit: 350, minimum: 200, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'mf', name: 'MINISFORUM', baseUrl: 'https://store.minisforum.com',
    category: 'electronics', limit: 68, minimum: 30, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'cw', name: 'CHUWI', baseUrl: 'https://store.chuwi.com',
    category: 'electronics', limit: 19, minimum: 10, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'ip', name: 'Instant Pot', baseUrl: 'https://instantpot.com',
    category: 'appliances', limit: 121, minimum: 50, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'cf', name: 'Chefman', baseUrl: 'https://chefman.com',
    category: 'appliances', limit: 174, minimum: 50, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'tw', name: 'ThermoWorks', baseUrl: 'https://www.thermoworks.com',
    category: 'kitchen-electronics', limit: 400, minimum: 150, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'],
    accepts: (p) => {
      const tags = Array.isArray(p.tags) ? p.tags.join(' ') : String(p.tags || '');
      return !/book-nodisc|silicone tools/i.test(tags)
        && !/\b(cookbooks?|recipes?|books?|hats?|t-shirts?|shirts?|spatulas?|turners?|scrapers?|calibration weights?)\b/i.test(`${p.product_type || ''} ${p.title || ''}`);
    },
  },
  {
    id: 'cy', name: 'Coway', baseUrl: 'https://cowaymega.com',
    category: 'appliances', limit: 63, minimum: 30, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'ug', name: 'UGREEN', baseUrl: 'https://www.ugreen.com',
    category: 'electronics', limit: 250, minimum: 100, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'st', name: 'Satechi', baseUrl: 'https://satechi.net',
    category: 'electronics', limit: 141, minimum: 50, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'be', name: 'Beelink', baseUrl: 'https://www.bee-link.com',
    category: 'electronics', limit: 44, minimum: 20, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'ac', name: 'ACEMAGIC', baseUrl: 'https://acemagic.com',
    category: 'electronics', limit: 49, minimum: 20, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'gm', name: 'GMKtec', baseUrl: 'https://www.gmktec.com',
    category: 'electronics', limit: 64, minimum: 20, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'ao', name: 'AOOSTAR', baseUrl: 'https://aoostar.com',
    category: 'electronics', limit: 24, minimum: 10, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'mg', name: 'MAINGEAR', baseUrl: 'https://maingear.com',
    category: 'electronics', limit: 100, minimum: 30, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'],
    accepts: (p) => !/test product|test bundle|gag gift|never gonna happen|figurine/i.test(`${p.title || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : p.tags || ''}`),
  },
  {
    id: 'co', name: 'COSORI', baseUrl: 'https://cosori.com',
    category: 'appliances', limit: 38, minimum: 20, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'lv', name: 'Levoit', baseUrl: 'https://levoit.com',
    category: 'appliances', limit: 136, minimum: 50, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'at', name: 'Airthereal', baseUrl: 'https://airthereal.com',
    category: 'appliances', limit: 146, minimum: 50, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'ba', name: 'Blueair', baseUrl: 'https://www.blueair.com',
    category: 'appliances', limit: 200, minimum: 50, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'], accepts: () => true,
  },
  {
    id: 'bd', name: 'BLACK+DECKER', baseUrl: 'https://www.blackanddecker.com',
    category: 'appliances', limit: 150, minimum: 30, paginate: true, downloadImages: false, optional: true,
    paths: ['/products.json?limit=250'],
    accepts: (p) => /vacuum|blender|mixer|kettle|coffee maker|air fryer|cooker|fan|heater|humidifier|dehumidifier|microwave|toaster/i.test(`${p.product_type || ''} ${p.title || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : p.tags || ''}`),
  },
];

const MINIMUM_CATALOG_SIZE = 2001;
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const onlyArgument = process.argv.find((argument) => argument.startsWith('--only='));
const onlySourceIds = onlyArgument
  ? new Set(onlyArgument.slice('--only='.length).split(',').map((id) => id.trim()).filter(Boolean))
  : null;
if (onlySourceIds) {
  const unknownIds = [...onlySourceIds].filter((id) => !configs.some((source) => source.id === id));
  if (unknownIds.length || !onlySourceIds.size) {
    throw new Error(`Unknown or empty catalog source selection: ${unknownIds.join(', ') || '(empty)'}.`);
  }
}

function classifyProduct(item, fallback) {
  const tags = Array.isArray(item.tags) ? item.tags.join(' ') : item.tags || '';
  const productText = `${item.product_type || ''} ${item.title || ''}`.toLowerCase();
  const text = `${productText} ${tags}`.toLowerCase();
  if (/wheel[ -]?chair/.test(text)) return 'wheelchairs';
  const computerAccessory = /\b(stands?|mounts?|sleeves?|bags?|chargers?|docks?|hubs?|adapters?|mice|keyboards?|cables?|cases?|risers?|enclosures?)\b/.test(productText);
  if (!computerAccessory && /\b(laptops?|notebooks?|chromebooks?|ultrabooks?|macbooks?(?: air| pro)?|mini\s*pcs?|desktop\s*pcs?|desktop computers?|work\s*stations?|custom pcs?|pre[- ]configured pcs?|nas)\b/.test(productText)) return 'computers';
  if (/\b(air fryers?|pressure cookers?|slow cookers?|rice cookers?|instant pots?|coffee makers?|espresso machines?|blenders?|toasters?|microwaves?|vacuums?|air purifiers?|water purifiers?|humidifiers?|dehumidifiers?)\b/.test(text)) return 'appliances';
  if (/\b(overbed table|dining table|side table|coffee table|desk|table)\b/.test(text)) return 'tables';
  if (/\b(chair|recliner|sofa|couch|ottoman|stool|bench|seating)\b/.test(text)) return 'chairs';
  if (/\b(shoes?|sneakers?|footwear|boots?|sandals?|slippers?|loafers?|clogs?)\b/.test(text)) return 'shoes';
  if (/\b(shirts?|shirts|tops|pants|shorts|leggings|jackets?|hoodies|socks|apparel|clothing)\b/.test(text)) return 'apparel';
  return fallback;
}

async function request(url, mode = 'json') {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(25000),
        headers: {
          Accept: mode === 'json' ? 'application/json' : 'image/jpeg',
          'User-Agent': 'VembaCatalogSync/1.0',
        },
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const retryAfter = Number(response.headers.get('retry-after'));
        if (retryable && attempt < 4) {
          await delay(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 15000) : Math.min(1000 * (2 ** attempt), 15000));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${url}`);
      }
      if (mode === 'json') return await response.json();
      const bytes = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || '';
      const jpeg = contentType.startsWith('image/jpeg') && bytes[0] === 0xff && bytes[1] === 0xd8;
      const png = contentType.startsWith('image/png') && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      if ((!jpeg && !png) || bytes.length < 1000) throw new Error(`Expected an original JPEG or PNG product photo: ${url}`);
      if (bytes.length > 3_000_000) throw new Error(`Product photo exceeds 3 MB: ${url}`);
      return { bytes, extension: jpeg ? 'jpg' : 'png' };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const titleText = (value) => cleanText(value).replace(/\s*[–—-]\s*In Stock\s*$/i, '');
const slugify = (value) => value.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sizeGuideLink(item, source) {
  const html = typeof item.body_html === 'string' ? item.body_html : '';
  const links = html.matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi);
  for (const match of links) {
    const href = (match[1] || match[2] || '').replace(/&amp;/g, '&');
    const label = (match[3] || '').replace(/<[^>]*>/g, ' ');
    if (!/size[\s_-]?(?:guide|chart)|fit[\s_-]?guide|sizing[\s_-]?guide/i.test(`${label} ${href}`)) continue;
    try {
      const url = new URL(href, source.baseUrl);
      if (url.protocol === 'https:') return url.href;
    } catch {
      // Ignore malformed retailer links and use the product listing instead.
    }
  }
  return undefined;
}

// Interleave collections / brands so the import includes a useful variety.
function interleave(groups) {
  const rows = [];
  const maxLength = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < maxLength; index++) {
    for (const group of groups) if (group[index]) rows.push(group[index]);
  }
  return rows;
}

async function fetchProducts(url, source) {
  if (!source.paginate) {
    const result = await request(url);
    if (!Array.isArray(result.products)) throw new Error(`Invalid products response: ${url}`);
    return result.products;
  }

  const pageUrl = new URL(url);
  const products = [];
  const scanLimit = Math.max(source.limit * 2, 250);
  for (let page = 1; page <= 100; page++) {
    pageUrl.searchParams.set('page', String(page));
    const result = await request(pageUrl.href);
    if (!Array.isArray(result.products)) throw new Error(`Invalid products response: ${pageUrl.href}`);
    if (result.products.length === 0) break;
    products.push(...result.products);
    if (products.length >= scanLimit) break;
    await delay(350);
  }
  return products;
}

function normalize(item, source) {
  if (!Number.isSafeInteger(item.id) || !item.handle || !item.title || !source.accepts(item)) return null;
  if (/gift card|personaliz|engraving|repair|warranty|insurance/i.test(item.title)) return null;
  const listingUrl = `${source.baseUrl}/products/${encodeURIComponent(item.handle)}`;
  const parsedUrl = new URL(listingUrl);
  if (existingPaths.has(`${parsedUrl.hostname.replace(/^www\./, '')}${parsedUrl.pathname}`)) return null;
  const variants = (item.variants || []).filter((variant) => Number(variant.price) > 0 && Number.isSafeInteger(variant.id));
  const variant = variants.find((option) => option.available) || variants[0];
  if (!variant) return null;
  const sizeOptionIndex = (item.options || []).findIndex((option) => /size/i.test(cleanText(option.name)));
  const sizeOption = sizeOptionIndex >= 0 ? item.options[sizeOptionIndex] : null;
  const sizePosition = Number(sizeOption?.position) || sizeOptionIndex + 1;
  const sizes = sizeOption
    ? [...new Set(variants.map((option) => cleanText(option[`option${sizePosition}`])).filter((value) => value && value !== 'Default Title'))]
    : [];
  const images = (item.images || []).filter((entry) => /^https:\/\/cdn\.shopify\.com\//.test(entry.src)
    && /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(entry.src));
  const photo = images.find((entry) => entry.id === variant.featured_image?.id)
    || images.find((entry) => entry.variant_ids?.includes(variant.id))
    || images[0];
  if (!photo) return null;
  const id = `retail-${source.id}-${item.id}`;
  const vendor = source.id === 'kc' ? 'Keychron' : cleanText(item.vendor);
  const brand = vendor && (source.id === 'kc' || vendor.toLowerCase() !== source.name.toLowerCase()) ? vendor : '';
  const rawTitle = titleText(item.title);
  const title = source.id === 'hp' ? rawTitle.replace(/\.com\s*$/i, '') : rawTitle;
  const name = source.id === 'rc' ? title.replace(new RegExp(`^${escapeRegExp(source.name)}\\s+`, 'i'), '') : title;
  const variantTitle = cleanText(variant.title) === 'Default Title' ? '' : cleanText(variant.title);
  const category = source.id === 'hp' && /gaming|playstation|xbox/i.test(title)
    ? 'gaming'
    : classifyProduct(item, source.category);
  const imageDownloadUrl = new URL(photo.src);
  imageDownloadUrl.searchParams.set('width', '800');
  imageDownloadUrl.searchParams.set('format', 'jpg');
  const image = source.downloadImages === false ? imageDownloadUrl.href : `/images/catalog/${id}.jpg`;
  const galleryEntries = images.filter((entry) => entry !== photo).slice(0, 7);
  const galleryImages = galleryEntries.map((entry) => {
    const url = new URL(entry.src);
    url.searchParams.set('width', '1200');
    url.searchParams.set('format', 'jpg');
    return url.href;
  });
  return {
    id,
    slug: `${slugify(name)}-${item.id}`,
    name,
    category,
    collection: ['watches', 'jewellery'].includes(category) ? 'luxury' : category,
    eyebrow: brand || category.replace(/-/g, ' '),
    description: `${name}.${variantTitle ? ` Selected option: ${variantTitle}.` : ''}`,
    price: Math.round(Number(variant.price) * 100) / 100,
    currency: 'USD',
    image,
    images: [image, ...galleryImages],
    imageAlts: [cleanText(photo.alt) || name, ...galleryEntries.map((entry) => cleanText(entry.alt) || name)],
    colors: [],
    sizes,
    materials: [],
    details: [
      brand && `Brand: ${brand}`,
      `Product type: ${cleanText(item.product_type)}`,
      variantTitle && `Selected option: ${variantTitle}`,
      variant.sku && `SKU: ${cleanText(variant.sku)}`,
    ].filter(Boolean),
    reviews: [],
    stock: null,
    inStock: typeof variant.available === 'boolean' ? variant.available : null,
    createdAt: item.created_at || item.published_at || null,
    sizeGuideUrl: sizeGuideLink(item, source),
    source: 'retailer-api',
    sourceName: source.name,
    sourceUrl: `${listingUrl}?variant=${variant.id}`,
    sourceProductId: item.id,
    sourceVariantId: variant.id,
    sourceVariantTitle: variantTitle,
    imageSourceUrl: photo.src,
    imageDownloadUrl: source.downloadImages === false ? '' : imageDownloadUrl.href,
    priceCheckedAt: checkedDate,
    isNew: false,
    shippingInformation: 'Vemba delivery details will be available when checkout opens.',
    returnPolicy: 'Vemba return details will be published before checkout opens.',
    warrantyInformation: '',
  };
}

async function importSource(source) {
  const currencyUrl = `${source.baseUrl}${source.currencyPath || '/cart.js'}`;
  const currency = await request(currencyUrl);
  if (currency.currency !== 'USD') throw new Error(`${source.name} returned ${currency.currency}; USD was expected.`);
  const apiUrls = source.paths.map((path) => `${source.baseUrl}${path}`);
  const batches = await Promise.all(apiUrls.map((url) => fetchProducts(url, source)));
  let candidates = interleave(batches);
  if (source.id === 'wg' || source.id === 'hp' || source.id === 'kc') {
    const groups = new Map();
    for (const item of candidates) {
      const key = source.id === 'kc' ? item.product_type : item.vendor;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    candidates = interleave([...groups.values()]);
  }
  const chosen = [];
  const ids = new Set();
  const names = new Set();
  for (const candidate of candidates) {
    const product = normalize(candidate, source);
    if (!product || ids.has(product.id) || names.has(product.name.toLowerCase())) continue;
    product.isNew = chosen.length < 5;
    ids.add(product.id);
    names.add(product.name.toLowerCase());
    chosen.push(product);
    if (chosen.length === source.limit) break;
  }
  const minimum = source.minimum ?? source.limit;
  if (chosen.length < minimum) throw new Error(`${source.name}: only ${chosen.length}/${minimum} required products; existing snapshot retained.`);
  // Small bounded download batches avoid flooding retailer CDNs.
  if (source.downloadImages !== false) {
    for (let index = 0; index < chosen.length; index += 5) {
      await Promise.all(chosen.slice(index, index + 5).map(async (product) => {
        const { bytes, extension } = await request(product.imageDownloadUrl, 'image');
        product.image = `/images/catalog/${product.id}.${extension}`;
        product.images = [product.image];
        await writeFile(join(imageDirectory, `${product.id}.${extension}`), bytes);
      }));
    }
  }
  const photoNote = source.downloadImages === false ? 'retailer-hosted photos' : 'downloaded original photos';
  console.log(`${source.name}: imported ${chosen.length} products with ${photoNote} (USD).`);
  return {
    source: {
      id: source.id, name: source.name, baseUrl: source.baseUrl,
      apiUrl: apiUrls[0], apiUrls, currencyUrl,
      currency: 'USD', productCount: chosen.length, fetchedAt,
    },
    products: chosen,
  };
}

await mkdir(imageDirectory, { recursive: true });
await mkdir(dataDirectory, { recursive: true });
let previousSnapshot = { sources: [], products: [] };
try {
  const savedSnapshot = JSON.parse(await readFile(existingSnapshotPath, 'utf8'));
  previousSnapshot = {
    sources: Array.isArray(savedSnapshot.sources) ? savedSnapshot.sources : [],
    products: Array.isArray(savedSnapshot.products) ? savedSnapshot.products : [],
  };
} catch {
  // A first import has no earlier snapshot to retain.
}
const imported = [];
for (const source of configs.filter((entry) => !onlySourceIds || onlySourceIds.has(entry.id))) {
  try {
    imported.push(await importSource(source));
  } catch (error) {
    if (!source.optional) throw error;
    console.warn(`${source.name}: skipped optional API source. ${error.message}`);
  }
}
const freshProducts = interleave(imported.map((entry) => entry.products));
const freshIds = new Set(freshProducts.map((product) => product.id));
const refreshedSourcePrefixes = imported.map((entry) => `retail-${entry.source.id}-`);
const mergedProducts = [
  ...freshProducts,
  ...previousSnapshot.products.filter((product) => !freshIds.has(product.id)
    && !refreshedSourcePrefixes.some((prefix) => product.id.startsWith(prefix))),
];
const allProducts = [...new Map(mergedProducts.map((product) => [product.id, product])).values()];
const freshSourceIds = new Set(imported.map((entry) => entry.source.id));
const allSources = [
  ...imported.map((entry) => entry.source),
  ...previousSnapshot.sources.filter((source) => !freshSourceIds.has(source.id)),
];
const snapshot = {
  version: 1,
  fetchedAt,
  currency: 'USD',
  note: 'Vemba product catalog snapshot.',
  sources: allSources,
  products: allProducts,
};
if (snapshot.products.length < MINIMUM_CATALOG_SIZE) {
  throw new Error(`Only ${snapshot.products.length} valid products were available; need at least ${MINIMUM_CATALOG_SIZE}. Existing snapshot retained.`);
}
// Publish only after the refreshed feeds and retained snapshot exceed the catalog floor.
const outputPath = existingSnapshotPath;
const temporaryPath = `${outputPath}.next`;
const snapshotText = `${JSON.stringify(snapshot)}\n`;
await writeFile(temporaryPath, snapshotText, 'utf8');
try {
  await rename(temporaryPath, outputPath);
} catch (error) {
  if (!['EPERM', 'EEXIST', 'EBUSY'].includes(error.code)) throw error;
  await copyFile(temporaryPath, outputPath);
  await unlink(temporaryPath);
}
const published = JSON.parse(await readFile(outputPath, 'utf8'));
console.log(`Published ${published.products.length} actual products to public/data/retail-products.json (${checkedDate}).`);
