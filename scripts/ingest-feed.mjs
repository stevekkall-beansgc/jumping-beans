// Reusable product-feed ingester → normalized `catalog.json` for Jumping Beans
// partners. Multiple backends; each returns items in a canonical Deal shape:
//
//   {
//     sku, name, category, listPrice, listPriceSource, merchantPageDiscountPercent,
//     merchantPageDiscountEvidence, dealPrice, imageUrl, expiresAt,
//     landing, vendor, source
//   }
//
// - `source`: which backend produced the record (shopify | amazon | ebay | cj | impact | rakuten)
// - `landing`: real product URL (the affiliate deep-link / goto target)
//
// Usage:
//   node scripts/ingest-feed.mjs shopify --host chubbies.com --out partners/petsupply/catalog.json --category "pet-supplies"
//   node scripts/ingest-feed.mjs woocommerce --host example.com --out catalog.json
//
// Account-backend keys are read from env (SECRET_MANAGER / .env) — NEVER from
// this file. Free Shopify backend needs no keys.
import { writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const backend = args[0];

function flag(name, dflt) {
  const i = args.indexOf(name);
  return i === -1 ? dflt : args[i + 1];
}
function has(name) {
  return args.includes(name);
}

const OUT = flag("--out", path.join(__dirname, "..", "catalog.json"));
const MAX = Number(flag("--max", "250"));
const CATEGORY = flag("--category", "general");
const EXPIRES_DAYS = Number(flag("--expires-days", "30"));
// --only "substring" : for shopify, keep only products whose product_type
// contains this (case-insensitive). e.g. watch store -> --only watches.
const ONLY = flag("--only", "");
// --map "sourceCat1:targetCat1,sourceCat2:targetCat2" : force feed categories
// onto our partner categories so the engine's persona filters actually match.
const MAPS = {};
flag("--map", "").split(",").filter(Boolean).forEach((kv) => {
  const [k, v] = kv.split(":");
  if (k && v) MAPS[k.trim().toLowerCase()] = v.trim();
});
function mapCat(c) {
  const low = String(c || "").toLowerCase();
  return MAPS[low] || low || CATEGORY;
}

function canonical(item, source = backend, sharedExpiresAt = null) {
  const dealPrice = Number(item.dealPrice);
  const candidateListPrice = Number(item.listPrice);
  const hasMerchantListPrice = item.listPriceSource === "merchant"
    && Number.isFinite(candidateListPrice)
    && candidateListPrice > dealPrice;
  const unavailable = item.availability === "out-of-stock";
  const listPrice = hasMerchantListPrice && !unavailable ? candidateListPrice : null;
  const ex = item.expiresAt || sharedExpiresAt || new Date(Date.now() + EXPIRES_DAYS * 864e5).toISOString();
  return {
    sku: String(item.sku),
    name: String(item.name),
    category: mapCat(item.category || CATEGORY),
    listPrice,
    listPriceSource: hasMerchantListPrice && !unavailable ? "merchant" : null,
    // A feed compare-at field is a price fact, not proof that a percentage was
    // displayed on the product page. A separate audited capture must set these.
    merchantPageDiscountPercent: null,
    merchantPageDiscountEvidence: null,
    dealPrice,
    imageUrl: item.imageUrl || "",
    expiresAt: ex,
    landing: item.landing || "",
    vendor: item.vendor || "",
    ...(item.availability ? { availability: item.availability } : {}),
    source,
  };
}

/* ------------------------------------------------ Shopify (free, no keys) */
async function fetchShopify(host, max) {
  const items = [];
  const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 864e5).toISOString();
  let page = 1;
  while (items.length < max) {
    const url = `https://${host}/products.json?limit=250&page=${page}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`shopify ${host} HTTP ${res.status}`);
    const d = await res.json();
    const prods = d?.products || [];
    if (!prods.length) break;
    for (const p of prods) {
      if (items.length >= max) break;
      const availableVariant = (p.variants || []).find((x) => x.available);
      const v = availableVariant || p.variants?.[0];
      if (!v) continue;
      const ptype = (p.product_type || "").toLowerCase();
      if (ONLY && !ptype.includes(ONLY.toLowerCase())) continue;
      items.push({
        sku: v.sku || `${p.handle}-${v.id}`,
        name: p.title,
        category: (ptype || (p.tags || [])[0] || CATEGORY).toLowerCase(),
        listPrice: v.compare_at_price ? Number(v.compare_at_price) : null,
        listPriceSource: v.compare_at_price ? "merchant" : null,
        dealPrice: Number(v.price),
        imageUrl: p.images?.[0]?.src || p.image?.src || "",
        landing: `https://${host}/products/${p.handle}`,
        vendor: p.vendor,
        availability: availableVariant ? "in-stock" : "out-of-stock",
      });
    }
    page += 1;
  }
  return items.map((item) => canonical(item, "shopify", expiresAt));
}

/* ---------------- WooCommerce Store API (public, no keys) ---------------- */
async function fetchWooCommerce(host, max) {
  const items = [];
  const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 864e5).toISOString();
  let page = 1;
  const perPage = Math.min(100, Math.max(1, max));
  while (items.length < max) {
    const url = `https://${host}/wp-json/wc/store/v1/products?per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`woocommerce ${host} HTTP ${res.status}`);
    const products = await res.json();
    if (!Array.isArray(products) || !products.length) break;
    for (const p of products) {
      if (items.length >= max || p.is_in_stock === false) continue;
      const prices = p.prices || {};
      const minorUnit = Number.isInteger(Number(prices.currency_minor_unit)) ? Number(prices.currency_minor_unit) : 2;
      const amount = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? number / (10 ** minorUnit) : null;
      };
      const currentPrice = amount(prices.price);
      const salePrice = amount(prices.sale_price);
      const regularPrice = amount(prices.regular_price);
      const dealPrice = salePrice != null && salePrice >= 0 && (regularPrice == null || salePrice < regularPrice)
        ? salePrice
        : currentPrice;
      if (dealPrice == null || dealPrice < 0) continue;
      const category = p.categories?.[0]?.name || p.tags?.[0]?.name || CATEGORY;
      const vendor = p.brands?.[0]?.name || new URL(`https://${host}`).hostname;
      items.push({
        sku: p.sku || `woocommerce-${p.id}`,
        name: p.name,
        category: String(category).toLowerCase(),
        listPrice: regularPrice != null && regularPrice > dealPrice ? regularPrice : null,
        listPriceSource: regularPrice != null && regularPrice > dealPrice ? "merchant" : null,
        dealPrice,
        imageUrl: p.images?.[0]?.src || "",
        landing: p.permalink || `https://${host}/?p=${p.id}`,
        vendor,
        availability: "in-stock",
      });
    }
    const totalPages = Number(res.headers.get("X-WP-TotalPages"));
    if ((Number.isFinite(totalPages) && page >= totalPages) || products.length < perPage) break;
    page += 1;
  }
  return items.map((item) => canonical(item, "woocommerce", expiresAt));
}

/* ------------------------- Account feeds (Amazon/ebay/CJ/Impact/Rakuten) ---
   These need partner-account API keys. Read from env (Secret Manager), never
   hardcoded. Implement each backend as a function returning normalized items.
   Placeholders below document the credential + endpoint for each.
---------------------------------------------------------------------------*/
async function fetchAccount(backend) {
  const key = process.env[`${backend.toUpperCase()}_KEY`] ;
  if (!key) {
    throw new Error(
      `${backend} backend needs an API key in env ${backend.toUpperCase()}_KEY ` +
      `(wire it via Secret Manager; see docs/AFFILIATE_SETUP.md).`
    );
  }
  // TODO: implement per network using `key`. Shape returned = normalized items.
  return [];
}

async function main() {
  const handlers = { shopify: fetchShopify, woocommerce: fetchWooCommerce, amazon: fetchAccount, ebay: fetchAccount,
    cj: fetchAccount, impact: fetchAccount, rakuten: fetchAccount };
  const fn = handlers[backend];
  if (!fn) throw new Error(`unknown backend: ${backend}`);
  const host = flag("--host", "");
  const items = ["shopify", "woocommerce"].includes(backend) ? await fn(host, MAX) : await fn(backend);
  await writeFile(OUT, JSON.stringify(items, null, 2));
  console.log(`Wrote ${items.length} deals (${backend}) -> ${OUT}`);
  if (items[0]) console.log("sample:", JSON.stringify(items[0], null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

export { canonical, fetchShopify, fetchWooCommerce };
