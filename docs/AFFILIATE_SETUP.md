# Affiliate / real-inventory pipeline (Jumping Beans)

Status: LIVE on all 3 partners via the free Shopify public-feed backend. The
account-network backends (Amazon PA-API, eBay, Walmart, CJ, Impact, Rakuten)
are scaffolded in the ingester but need your account API keys to light up.

## What's wired now (real, live, on prod)

Each partner's `catalog.json` is generated from a real public Shopify
`products.json` feed — real SKUs, real prices, real CDN images, real product
URLs (`landing`). Rebuilt with `scripts/ingest-feed.mjs`:

| Partner | Live source | # products | Categories |
|---|---|---|---|
| petsupply | `wildone.com` | 57 | bowl, toys, leash, collar, harness, carrier, cat*, dog tags… |
| coffee | `deathwishcoffee.com` | 60 | coffee, mugs, accessories, apparel, on-the-go drinkware… |
| watch | `watchgecko.com` | 60 | watches (filtered `--only watches`) |

Regenerate any catalog:

```bash
# from repo root
node scripts/ingest-feed.mjs shopify --host wildone.com      --out partners/petsupply/catalog.json
node scripts/ingest-feed.mjs shopify --host deathwishcoffee.com --out partners/coffee/catalog.json
node scripts/ingest-feed.mjs shopify --host watchgecko.com --only watches --out partners/watch/catalog.json
# then redeploy the partner (from INSIDE its dir, or Functions get dropped):
#   (cd partners/watch && npx wrangler pages deploy . --project-name watch)
```

Ingester flags: `--host` (shopify domain), `--out` (target file), `--max`,
`--only "substring"` (keep only product_type containing it), `--category`
(fallback category), `--map "a:b,c:d"` (force feed category → our category),
`--expires-days` (rolling expiry, default 30).

## Deal shape (the contract the engine expects — unchanged from before)

```jsonc
{ "sku","name","category","listPrice","dealPrice","imageUrl","expiresAt",
  "landing",   // NEW: real product URL (the goto / affiliate deep-link target)
  "vendor","source" }
```

`listPrice` falls back to `dealPrice * 1.2` when the store has no compare-at
price, so cards still render a "% off" deal framing over real products.

## Cross-origin note

Shopify CDN images serve `Access-Control-Allow-Origin: *`, so the engine's
`<img crossorigin="anonymous">` cards render fine under COEP
(`require-corp`). Verified.

## Account sheets — commission networks (add later, keys via Secret Manager)

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

### 6. Rakuten Advertising (formerly LinkShare)
- Join https://rakutenadvertising.com (publisher) — approved per advertiser.
- Get **API key (token)** + per-advertiser **MID/network key**.
- Env: `RAKUTEN_KEY`.
- Feed: `https://api.rakutenmarketing.com/token` OAuth, then product search.

## Guardrails (standing rules)
- No spend without approval — several networks have fee/volume tiers; state
  cost before enabling.
- Keys only in GCP Secret Manager (BeanLaunch source of truth) → CF KV via
  `bl`. Never in repo, docs, or memory.
- The abstraction is preserved: any backend produces the same normalized deal
  shape, so the engine's `getTools`/`executeTool`/`buildFeed` cross-origin
  WebMCP function is unchanged regardless of inventory source.
