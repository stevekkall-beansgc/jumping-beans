# Affiliate / real-inventory pipeline (Jumping Beans)

Status: LIVE on all 3 member sites via the free Shopify public-feed backend.
The open-feed ingester now supports both Shopify `products.json` and the
unauthenticated WooCommerce Store API. These are merchant-authorized feed
inputs for out-of-network inventory; they are not a general-purpose scraper.
Rakuten Advertising is now wired as the first live out-of-network inventory
lane: the engine refreshes its OAuth access token server-side, searches live
Product Search inventory, normalizes the results, and links out to merchants.
The other account-network backends remain future adapters.

## Out-of-network public catalog lane

Attached non-member `public-feed` catalogs are aggregated by
`scripts/build-inventory-index.mjs` into the generated
`engine/inventory-assets/catalog-index.json`. The engine Worker reads that
index through a Cloudflare Static Asset binding and serves bounded
`GET /api/inventory/catalog` searches. The raw merchant files in
`inventory/catalogs/` remain the source of truth; the generated index is
ignored and rebuilt during the deployment preflight.

The route accepts `q`, `category`, `max` (1–24), `maxPrice`, and
`maxPriceInclusive`. It filters expired or out-of-stock records, deduplicates
merchant identities, retains direct HTTPS product URLs, and returns per-feed
health in `meta.sources`. A failed refresh is labeled `stale` when a last good
catalog exists, or `unavailable` when it does not; neither is presented as a
current match. Member-site-authorized catalogs are intentionally excluded and
continue to be resolved through their native WebMCP tools.

Rebuild or check the generated asset:

```bash
node scripts/build-inventory-index.mjs
node scripts/build-inventory-index.mjs --check
```

## What's wired now (real, live, on prod)

Each partner's `catalog.json` is generated from a real public Shopify
`products.json` feed — real SKUs, real prices, real CDN images, real product
URLs (`landing`). Rebuilt with `scripts/ingest-feed.mjs`:

| Partner | Live source | # products | Categories |
|---|---|---|---|
| petsupply | `wildone.com` | 57 | bowl, toys, leash, collar, harness, carrier, cat*, dog tags… |
| coffee | `deathwishcoffee.com` | 150 | coffee, mugs, accessories, apparel, on-the-go drinkware… |
| watch | `watchgecko.com` | 170 | watches (filtered `--only watches`) |

Regenerate any catalog:

```bash
# from repo root
node scripts/ingest-feed.mjs shopify --host wildone.com      --out partners/petsupply/catalog.json
node scripts/ingest-feed.mjs shopify --host deathwishcoffee.com --out partners/coffee/catalog.json
node scripts/ingest-feed.mjs shopify --host watchgecko.com --only watches --out partners/watch/catalog.json
# WooCommerce Store API (public, no API key) — use only with merchant permission
node scripts/ingest-feed.mjs woocommerce --host example.com --out catalog.json
# then redeploy the partner (from INSIDE its dir, or Functions get dropped):
#   (cd partners/watch && npx wrangler pages deploy . --project-name watch)
```

Ingester flags: `--host` (Shopify or WooCommerce domain), `--out` (target file), `--max`,
`--only "substring"` (keep only product_type containing it), `--category`
(fallback category), `--map "a:b,c:d"` (force feed category → our category),
`--expires-days` (rolling expiry, default 30).

## Merchant registry and freshness

`inventory/merchant-registry.json` is the source of truth for attached merchant
feeds. Discovery checks a merchant-supplied HTTPS domain for the Shopify
`products.json` endpoint and the WooCommerce Store API, then records a disabled
candidate. Attachment is a separate explicit step:

```sh
node scripts/merchant-registry.mjs discover --host shop.example --name "Shop Example"
node scripts/merchant-registry.mjs attach --id shopify:shop.example --permission merchant-authorized
```

`scripts/publish-live-inventory.mjs` is a manual catalog-candidate command. It
checks current readiness, refreshes attached Shopify and WooCommerce catalogs,
rebuilds the index, and runs the product gate. It preserves the last successful
catalog when a feed fails and never publishes; its tracked catalog changes still
require review through the immutable Cloudflare release workflow.

The six-hour BeanSched clock is a separate production monitor. After a release,
provision a dedicated detached worktree at the exact published SHA, build its
ignored deterministic index once, and point the existing
`jumping-beans-merchant-refresh` entry at:

```sh
node scripts/monitor-production.mjs --release-sha <full-release-sha> --release-tag <annotated-release-tag>
```

Every run fails unless the worktree is clean and the annotated tag resolves to
that SHA. It then runs the product gate, exact four-origin asset smoke, and the
30-day token/14-day scenario-inventory check without changing project files or
production. This cutover is pending; the job remains disabled until the release
worktree is provisioned and one manual dry cycle passes.

## Open registry strategy

The recommended open registry is **Open Products Facts**. It is useful for
product identity, brand, category, and barcode enrichment, but it is not a
live offer feed: it does not establish current merchant stock, price, checkout
links, or affiliate rights. Open Food Facts is the narrower food equivalent;
Open Icecat is useful for structured specifications after registration.

These sources are therefore enrichment layers only. The merchant registry's
Shopify/WooCommerce entries remain the inventory authority for current price,
availability, images, and canonical product links. For a simple public-feed
attachment, Jumping Beans displays the published facts and redirects directly
to the merchant; it does not claim an affiliate relationship. See
`inventory/source-registry.json` for the source policy and licensing notes.

For WooCommerce candidate discovery, the registry also tracks the WooCommerce
Showcase, BuiltWith, Store Leads, and Wappalyzer directories. These are
incomplete technology directories, not open inventory licenses. A discovered
domain must still pass the WooCommerce endpoint check. It may be attached as
`public-feed` for direct link-out, or with merchant/network approval for any
broader use.

## Deal shape (the contract the engine expects — unchanged from before)

```jsonc
{ "sku","name","category","listPrice","listPriceSource","merchantPageDiscountPercent","merchantPageDiscountEvidence","dealPrice","imageUrl","expiresAt",
  "landing",   // NEW: real product URL (the goto / affiliate deep-link target)
  "vendor","source" }
```

`listPrice` is the merchant's compare-at price only when it is present and
higher than the current price; `listPriceSource` is then `"merchant"`.
Otherwise both fields are `null`. A compare-at price is a price fact only: it
does not authorize a percentage or discount claim. Set
`merchantPageDiscountPercent` and
`merchantPageDiscountEvidence: "merchant-page-displayed-percent"` only when a
captured merchant product page explicitly displays that exact percentage.
Storefronts and WebMCP tools must otherwise suppress percentage/discount copy.

## Cross-origin note

Shopify CDN images serve `Access-Control-Allow-Origin: *`, so the engine's
`<img crossorigin="anonymous">` cards render fine under COEP
(`require-corp`). Verified.

## Account feeds — commission networks (add later, keys via Worker secrets)

The ingester has `amazon` / `ebay` / `cj` / `impact` / `rakuten` backends that
currently throw unless env `{BACKEND}_KEY` is set. To light them up:

1. Create the account (below), get API/prod credentials.
2. Store keys in GCP Secret Manager (BeanLaunch) — project `downtown-504818` —
   e.g. `affiliate__AMAZON_KEY`, then mirror to CF via `bl`. Never in repo.
3. Implement the backend fetch in `scripts/ingest-feed.mjs` (there's a clear
   `TODO` per network); it returns normalized items → same contract.

### 1. Amazon Product Advertising API (PA-API)
- Sign up as an **Amazon Associate** (paid-free tier has quotas; beyond that is
  spend → approval first). https://affiliate-program.amazon.com/
- Generate **Access Key + Secret Access Key** (IAM-style) in Associates →
  Product Advertising API. Also need a PartnerTag (your Associates tag).
- Env: `AMAZON_KEY`, `AMAZON_SECRET`, `AMAZON_PARTNER_TAG`.
- API: `webservices.amazon.com/paapi5/searchitems`, params `Keywords`,
  `SearchIndex`/`Category`, `Resources: ItemInfo,Offers,Images`.
- Note: returns `https://www.amazon.com/dp/{ASIN}?tag={PartnerTag}` deep-links —
  ideal `landing` values.

### 2. eBay Partner Network (EPN)
- Join at https://partnernetwork.ebay.com/ (approval). Enrollment digital/hard.
- Get **eBay app keys** (Client ID/Secret) via the eBay Developer Program:
  https://developer.ebay.com/my/ — app must be approved for EPN.
- Env: `EBAY_KEY` (+ `EBAY_EPN_TAG`).
- Feed: Browse API `GET /buy/browse/v1/item_summary/search`.

### 3. Walmart Affiliate
- Apply: https://affiliates.walmart.com / marketplace.walmart.com → Supplier
  API. Get **Consumer ID + Private Key** + Publisher ID.
- Env: `WALMART_KEY` (+ tag).
- Feed: Affiliate Product API `https://api.bluecore.com/.../product` (or
  Supplier/Partner API v3).

### 4. CJ Affiliate (commission junction)
- Join https://www.cj.com/ as advertiser/publisher (approval per advertiser).
- Get **Publisher Website ID (PID) + API key** (webservices v3).
- Env: `CJ_KEY`.
- Feed: `https://api.cj.com/v3/offers` or **Product Catalog Search** with an
  advertiser's PID.

### 5. Impact (formerly Impact Radius)
- Join https://impact.com/ (partner account). Get **Account SID + auth token**
  from the Impact Partners API settings.
- Env: `IMPACT_KEY`.
- Feed: Impact Product Catalog API `/product-feed`.

### 6. Rakuten Advertising (live out-of-network lane)
- Join https://rakutenadvertising.com as a publisher; product availability is
  limited to advertisers for which the publisher has the required relationship.
- The engine uses these Cloudflare Worker secrets: `RAKUTEN_CLIENT_ID`,
  `RAKUTEN_CLIENT_SECRET`, `RAKUTEN_REFRESH_TOKEN`, and
  `RAKUTEN_ACCOUNT_ID`. `RAKUTEN_SECURITY_TOKEN` is reserved for Advanced
  Reports; it is not needed for product inventory. `RAKUTEN_WEB_SERVICE_TOKEN`
  is retained for account administration but is not used by Product Search.
- Runtime route: `GET /api/inventory/rakuten?q={category}&max=24`.
- APIs: `https://api.linksynergy.com/token` for OAuth refresh, then
  `https://api.linksynergy.com/productsearch/1.0` for live XML product data.
- Results are labeled **out-of-network affiliate**, kept separate from the
  three WebMCP member sites, and never claim a merchant-page discount unless
  the merchant supplies explicit percentage evidence.

## Guardrails (standing rules)
- No spend without approval — several networks have fee/volume tiers; state
  cost before enabling.
- Keys only in GCP Secret Manager (BeanLaunch source of truth) → CF KV via
  `bl`. Never in repo, docs, or memory.
- The abstraction is preserved: any backend produces the same normalized deal
  shape, so the engine's `getTools`/`executeTool`/`buildFeed` cross-origin
  WebMCP function is unchanged regardless of inventory source.
