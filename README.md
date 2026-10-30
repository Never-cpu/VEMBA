# Vemba storefront

A React/Vite demo shop with real product listings and original retailer photographs.

```sh
npm install
npm run setup:https
npm run dev
```

Open **https://localhost:5173**. The Windows setup command creates a localhost
server certificate and trusts its public certificate for the current Windows
user. Accept the Windows certificate prompt for `localhost` when it appears.
It supports `localhost`, `127.0.0.1`, and `::1`; it does not install a
general-purpose certificate authority. Re-running the command reuses an existing
valid certificate or renews it near expiry.

Vite development and preview servers use HTTPS. Use the HTTPS address rather than
an old HTTP bookmark. HTTP and HTTPS have separate browser storage, so saved bags
from an HTTP session do not automatically move to the HTTPS address.

The private certificate is stored in `.local/https/localhost.pfx`, ignored by Git
and excluded from production output. This certificate is for this computer only;
a deployed site needs a valid HTTPS certificate for its public domain.

## Shared product reviews

Product reviews are loaded from and saved to the shared `/api/reviews` service.
The service stores submitted reviews in `data/reviews.jsonl` on the server and
rejects a display name that has already reviewed another product. Existing
browser-only reviews are uploaded the next time that browser opens a product page.

For local development, `npm run dev` starts Vite with the review API middleware.
For production, build the storefront and run the Node server:

```sh
npm run build
npm start
```

Deploy the Node server behind HTTPS and keep `data/reviews.jsonl` on persistent
server storage. Static-only hosting cannot share submitted reviews between visitors.

References: [Vite HTTPS configuration](https://vite.dev/config/server-options#server-https)
and [Microsoft's localhost certificate example](https://learn.microsoft.com/en-us/powershell/module/pki/new-selfsignedcertificate#example-9).

## Product catalog

The catalog combines the PlayStation and luxury edit with public retailer feeds for
watches, jewellery, audio, gaming, computers, home appliances, footwear, furniture,
home goods, and wheelchairs. Computer and electronics feeds include Anker,
MINISFORUM, CHUWI, Beelink, ACEMAGIC, GMKtec, AOOSTAR, MAINGEAR, UGREEN, and Satechi.
Home appliance and kitchen electronics feeds include Instant Pot, Chefman, Coway,
ThermoWorks, COSORI, Levoit, Airthereal, Blueair, and BLACK+DECKER. Other retailer feeds include
Orthofeet, OluKai, Allbirds, Kizik, Vessi, MediDepot, USA Medical Supply, Branch
Furniture, Outmore Living, Lulu and Georgia, Brooklinen, Parachute, Miansai,
Schoolhouse, and Sunday Citizen, alongside Ring Concierge, WatchGuyNYC,
Headphones.com, and Keychron.

Refresh the imported products and their photos with:

```sh
npm run catalog:sync
```

To refresh selected feeds without contacting every retailer, pass source IDs after
`--only=` (for example, `npm run catalog:sync -- --only=mf,ip,cf`).

The importer checks each retailer's USD currency, paginates public feeds, and selects a
priced variant. It keeps existing catalog photos locally and uses retailer-hosted
Shopify CDN photos for the large footwear, furniture, and mobility feeds to avoid
copying thousands of image files into the project. It writes
`public/data/retail-products.json` with original listings, variant and size options,
gallery photos, retailer size-guide links where available, availability, and price
check dates. The script publishes only when at least 2,001 valid products are available.

The browser loads this hosted snapshot, so ordinary browsing does not depend on
retailer availability. The shop paginates the catalog in groups of 24. Refresh the
catalog and rebuild/redeploy to publish newer prices or products. Prices are dated
references. Public feeds do not provide exact inventory counts or retailer review
totals, so the catalog does not claim either.
Checkout has a debit/credit card demo form and opens a gift-card capture form in
a new tab. The demo does not submit or persist payment or gift-card details, and
the payment button stays disabled. No payments are collected or orders placed
with retailers.

The previous generated product sprite, interior images, invented listings,
and placeholder product API have been removed. Old saved placeholder products are
filtered out of the cart, wishlist, and product cache.

## Homepage spotlight

The homepage randomly selects four products from the local gaming and luxury
catalog every two hours. Each featured product costs one quarter of its original
price (75% off), rounded to the nearest cent. The same offer applies on product
pages, in the bag and at checkout until the next selection refreshes. Original
catalog prices and cached retailer data stay unchanged.

The selection uses the two-hour cycle as a random seed, so refreshing the page,
opening another tab or loading the imported catalog does not reroll the offers.

Edit `src/data/homeSpotlight.js` to change `durationHours`, `productCount`,
`priceDivisor` or the schedule's `startsAt` timestamp. The default schedule starts
at midnight on 14 October 2026 in Lagos (UTC+01:00). These are Vemba spotlight
prices; the original retailer links retain their own pricing.

## Verification

```sh
npm run build
npm run qa
```

QA expects a running dev server at `https://localhost:5173`. Set `VEMBA_URL` for
another address and `CHROME_PATH` if Chrome is installed elsewhere. Set
`VEMBA_LIVE=1` to also check the shipped retailer snapshot and all imported photos.

On PowerShell, for example:

```powershell
$env:VEMBA_LIVE = '1'
npm run qa
```
