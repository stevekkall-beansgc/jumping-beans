// Bounded search over the generated public merchant-catalog index.
// The index is a Cloudflare Static Asset, not Worker source or paid storage.

const INDEX_PATH = "/catalog-index.json";
const MAX_QUERY_LENGTH = 120;
const MAX_RESULTS = 24;
const MAX_INDEX_BYTES = 12 * 1024 * 1024;
const MAX_PRICE = 10_000_000;

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function clean(value, max = MAX_QUERY_LENGTH) {
  return String(value || "").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function words(value) {
  return clean(value).toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function boundedInteger(value, fallback, min, max) {
  return Math.trunc(boundedNumber(value, fallback, min, max));
}

function validHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

async function boundedText(response) {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_INDEX_BYTES) throw new Error("catalog-index-too-large");
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_INDEX_BYTES) {
        await reader.cancel();
        throw new Error("catalog-index-too-large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

function normalizeIndex(value) {
  if (!value || typeof value !== "object" || value.version !== 1 || !Array.isArray(value.items) || !Array.isArray(value.sources)) return null;
  return {
    version: value.version,
    generatedAt: value.generatedAt,
    sources: value.sources.filter((source) => source && typeof source === "object").map((source) => ({
      id: String(source.id || ""), name: String(source.name || ""), platform: String(source.platform || ""),
      host: String(source.host || ""), status: String(source.status || "unknown"), itemCount: Number(source.itemCount) || 0,
      lastCheckedAt: source.lastCheckedAt || null, lastSuccessAt: source.lastSuccessAt || null,
      expiresAt: source.expiresAt || null, lastError: source.lastError || null,
    })),
    items: value.items,
  };
}

function itemSearchText(item) {
  return [item.name, item.category, item.vendor, item.merchant, item.sku].map((value) => clean(value).toLocaleLowerCase()).join(" ");
}

function categoryMatches(item, category) {
  if (!category) return true;
  const expected = clean(category).toLocaleLowerCase();
  const actual = clean(item.category).toLocaleLowerCase();
  return actual === expected || actual.includes(expected) || expected.includes(actual);
}

function normalizeResult(item, now, sources = []) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const expires = Date.parse(item.expiresAt);
  const dealPrice = Number(item.dealPrice);
  const landing = validHttpUrl(item.landing);
  if (!String(item.sku || "") || !String(item.name || "") || !Number.isFinite(expires) || expires <= now || !Number.isFinite(dealPrice) || dealPrice < 0 || item.availability === "out-of-stock") return null;
  const listPrice = Number(item.listPrice);
  const validListPrice = item.listPriceSource === "merchant" && Number.isFinite(listPrice) && listPrice > dealPrice;
  const source = sources.find((candidate) => candidate.id === item.partnerId);
  const merchant = String(item.merchant || source?.name || item.vendor || "Merchant");
  return {
    sku: String(item.sku), name: String(item.name), category: String(item.category || "general"),
    listPrice: validListPrice ? listPrice : null, listPriceSource: validListPrice ? "merchant" : null,
    merchantPageDiscountPercent: null, merchantPageDiscountEvidence: null, dealPrice,
    imageUrl: validHttpUrl(item.imageUrl), expiresAt: new Date(expires).toISOString(), landing,
    vendor: String(item.vendor || merchant), merchant,
    partnerId: String(item.partnerId || ""), partnerName: String(item.partnerName || merchant),
    source: "merchant-catalog", sourceType: "out-of-network public catalog", sourceLabel: "Public merchant catalog",
    sourceDescription: String(item.sourceDescription || "Public merchant catalog snapshot; direct merchant link-out."),
    observedAt: item.observedAt || source?.lastSuccessAt || null,
    verificationLabel: String(item.verificationLabel || (source?.status === "stale" ? "Last successful catalog snapshot; the merchant feed needs refresh" : "Catalog snapshot; price and availability may have changed on the merchant site")),
    currency: "USD", collateral: [],
  };
}

export function searchCatalogIndex(index, { query = "", category = "", max = MAX_RESULTS, maxPrice = null, maxPriceInclusive = true, now = Date.now() } = {}) {
  const keyword = clean(query).toLocaleLowerCase();
  const terms = words(keyword);
  const categoryTerm = clean(category).toLocaleLowerCase();
  const ceiling = maxPrice != null && maxPrice !== "" && Number.isFinite(Number(maxPrice))
    ? Math.min(MAX_PRICE, Math.max(0, Number(maxPrice)))
    : null;
  const limit = boundedInteger(max, MAX_RESULTS, 1, MAX_RESULTS);
  const seen = new Set();
  const matches = [];
  for (const rawItem of index.items) {
    const item = normalizeResult(rawItem, now, index.sources);
    if (!item || !categoryMatches(item, categoryTerm)) continue;
    if (ceiling != null && (maxPriceInclusive ? item.dealPrice > ceiling : item.dealPrice >= ceiling)) continue;
    const searchText = itemSearchText(item);
    if (terms.length && !terms.every((term) => searchText.includes(term))) continue;
    const skuIdentity = `${item.partnerId}|sku|${item.sku}`;
    const linkIdentity = `${item.partnerId}|link|${item.landing}`;
    if (seen.has(skuIdentity) || seen.has(linkIdentity)) continue;
    seen.add(skuIdentity);
    seen.add(linkIdentity);
    const exactCategory = categoryTerm && item.category.toLocaleLowerCase() === categoryTerm;
    const score = (exactCategory ? 100 : 0) + terms.reduce((sum, term) => sum + (item.name.toLocaleLowerCase().includes(term) ? 5 : 1), 0);
    matches.push({ item, score });
  }
  matches.sort((a, b) => b.score - a.score || a.item.dealPrice - b.item.dealPrice || a.item.name.localeCompare(b.item.name) || a.item.sku.localeCompare(b.item.sku));
  return { items: matches.slice(0, limit).map(({ item }) => item), totalMatches: matches.length, limit, query: clean(query), category: clean(category) };
}

async function loadIndex(env) {
  if (!env?.INVENTORY_ASSETS || typeof env.INVENTORY_ASSETS.fetch !== "function") {
    const error = new Error("catalog inventory is not configured"); error.code = "catalog-not-configured"; throw error;
  }
  const response = await env.INVENTORY_ASSETS.fetch(new Request(`https://inventory-assets.local${INDEX_PATH}`, { headers: { accept: "application/json" } }));
  if (!response.ok) { const error = new Error("catalog index unavailable"); error.code = "catalog-index-unavailable"; throw error; }
  const index = normalizeIndex(JSON.parse(await boundedText(response)));
  if (!index) { const error = new Error("catalog index invalid"); error.code = "catalog-index-invalid"; throw error; }
  return index;
}

function trustedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return origin === new URL(env.ENGINE_PUBLIC_ORIGIN || request.url).origin;
}

export async function handleCatalogInventory(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/inventory/catalog") return null;
  if (request.method !== "GET") return json({ error: "method-not-allowed" }, 405, { Allow: "GET" });
  if (!trustedOrigin(request, env)) return json({ error: "origin-rejected" }, 403);
  try {
    const index = await loadIndex(env);
    const result = searchCatalogIndex(index, {
      query: url.searchParams.get("q") || "",
      category: url.searchParams.get("category") || "",
      max: url.searchParams.get("max") || MAX_RESULTS,
      maxPrice: url.searchParams.has("maxPrice") ? url.searchParams.get("maxPrice") : null,
      maxPriceInclusive: url.searchParams.get("maxPriceInclusive") !== "false",
    });
    const sources = index.sources.map((source) => ({
      id: source.id, name: source.name, platform: source.platform, host: source.host, status: source.status,
      itemCount: source.itemCount, lastCheckedAt: source.lastCheckedAt, lastSuccessAt: source.lastSuccessAt,
      expiresAt: source.expiresAt, lastError: source.lastError,
    }));
    return json({
      source: "merchant-catalog", sourceType: "out-of-network public catalog", observedAt: new Date().toISOString(),
      query: result.query, category: result.category, limit: result.limit, items: result.items,
      meta: { totalMatches: result.totalMatches, returned: result.items.length, generatedAt: index.generatedAt, sources },
    }, 200, { "Cache-Control": "public, max-age=300, s-maxage=300" });
  } catch (error) {
    const status = error.code === "catalog-not-configured" ? 503 : 502;
    return json({ error: error.code || "catalog-unavailable" }, status);
  }
}

export { boundedText, normalizeIndex, normalizeResult };
