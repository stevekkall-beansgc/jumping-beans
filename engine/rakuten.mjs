// Rakuten Advertising Product Search integration.
// Credentials are read only from Worker secrets. This module never returns
// token material to the browser.

const TOKEN_URL = "https://api.linksynergy.com/token";
const PRODUCT_SEARCH_URL = "https://api.linksynergy.com/productsearch/1.0";
const MAX_QUERY_LENGTH = 120;
const MAX_RESULTS = 24;

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
  return String(value || "").replace(/[&=?{}\\()[\];~|$!><*%-]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.trunc(number))) : fallback;
}

function xmlText(value) {
  return String(value || "")
    .replaceAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replaceAll(/&amp;/g, "&")
    .replaceAll(/&lt;/g, "<")
    .replaceAll(/&gt;/g, ">")
    .replaceAll(/&quot;/g, '"')
    .replaceAll(/&apos;/g, "'")
    .replaceAll(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replaceAll(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function field(block, name) {
  const match = String(block).match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return xmlText(match?.[1] || "").trim();
}

function fieldWithCurrency(block, name) {
  const match = String(block).match(new RegExp(`<${name}(?:\\s+currency=["']([^"']+)["'])?[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!match) return { value: null, currency: null };
  const value = Number(xmlText(match[2]).replace(/,/g, "").trim());
  return { value: Number.isFinite(value) ? value : null, currency: match[1] || null };
}

function urlOrEmpty(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function categoryFor(block, fallback) {
  const primary = field(block, "primary");
  const secondary = field(block, "secondary").split("~~")[0];
  return (primary || secondary || fallback || "general").toLowerCase().trim();
}

export function parseProductSearch(xml, { observedAt = new Date().toISOString(), fallbackCategory = "general" } = {}) {
  const items = [...String(xml || "").matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => {
    const block = match[1];
    const price = fieldWithCurrency(block, "price");
    const salePrice = fieldWithCurrency(block, "saleprice");
    const dealPrice = salePrice.value != null && salePrice.value >= 0 ? salePrice.value : price.value;
    const listPrice = price.value != null && dealPrice != null && price.value > dealPrice ? price.value : null;
    const mid = field(block, "mid");
    const sku = field(block, "sku") || field(block, "linkid");
    if (!sku || !field(block, "productname") || dealPrice == null || dealPrice < 0) return null;
    return {
      sku: `rakuten-${mid || "merchant"}-${sku}`,
      name: field(block, "productname"),
      category: categoryFor(block, fallbackCategory),
      listPrice,
      listPriceSource: listPrice == null ? null : "merchant",
      merchantPageDiscountPercent: null,
      merchantPageDiscountEvidence: null,
      dealPrice,
      imageUrl: urlOrEmpty(field(block, "imageurl")),
      expiresAt: new Date(Date.parse(observedAt) + 6 * 60 * 60 * 1000).toISOString(),
      landing: urlOrEmpty(field(block, "linkurl")),
      vendor: field(block, "merchantname"),
      merchant: field(block, "merchantname"),
      partnerId: mid || "rakuten",
      partnerName: field(block, "merchantname") || "Rakuten advertiser",
      source: "rakuten",
      sourceType: "out-of-network affiliate",
      sourceLabel: "Rakuten Advertising",
      sourceDescription: "Live product record from Rakuten Advertising; the merchant owns the destination page.",
      observedAt,
      verificationLabel: "Live Rakuten API record; price and availability may change on the merchant site",
      collateral: [],
      currency: salePrice.currency || price.currency || "USD",
    };
  }).filter(Boolean);
  const totalMatch = String(xml || "").match(/<TotalMatches>([^<]*)<\/TotalMatches>/i);
  const pagesMatch = String(xml || "").match(/<TotalPages>([^<]*)<\/TotalPages>/i);
  return {
    items,
    totalMatches: totalMatch ? Number(totalMatch[1]) || items.length : items.length,
    totalPages: pagesMatch ? Number(pagesMatch[1]) || 1 : 1,
  };
}

async function getAccessToken(env) {
  const clientId = env.RAKUTEN_CLIENT_ID;
  const clientSecret = env.RAKUTEN_CLIENT_SECRET;
  const refreshToken = env.RAKUTEN_REFRESH_TOKEN;
  const accountId = env.RAKUTEN_ACCOUNT_ID;
  if (!clientId || !clientSecret || !refreshToken || !accountId) {
    const error = new Error("Rakuten integration is not configured");
    error.code = "rakuten-not-configured";
    throw error;
  }
  const tokenKey = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ refresh_token: refreshToken, scope: accountId }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = new Error("Rakuten token exchange failed");
    error.code = response.status === 401 ? "rakuten-auth-failed" : "rakuten-token-failed";
    error.status = response.status;
    throw error;
  }
  const token = await response.json();
  if (!token?.access_token) {
    const error = new Error("Rakuten token response was invalid");
    error.code = "rakuten-token-invalid";
    throw error;
  }
  return token.access_token;
}

export async function searchRakuten(env, { query = "", category = "", max = 12, page = 1 } = {}) {
  const observedAt = new Date().toISOString();
  const keyword = clean(query);
  const categoryTerm = clean(category, 80);
  const limit = boundedNumber(max, 12, 1, MAX_RESULTS);
  const pageNumber = boundedNumber(page, 1, 1, 100);
  const accessToken = await getAccessToken(env);
  const params = new URLSearchParams({ language: "en_US", max: String(limit), page: String(pageNumber) });
  if (keyword) params.set("keyword", keyword);
  if (categoryTerm) params.set("cat", categoryTerm);
  const response = await fetch(`${PRODUCT_SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/xml" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = new Error("Rakuten Product Search failed");
    error.code = response.status === 401 ? "rakuten-access-token-rejected" : "rakuten-product-search-failed";
    error.status = response.status;
    throw error;
  }
  const parsed = parseProductSearch(await response.text(), { observedAt, fallbackCategory: categoryTerm });
  return { ...parsed, observedAt, query: keyword, category: categoryTerm, page: pageNumber, limit };
}

function trustedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return origin === new URL(env.ENGINE_PUBLIC_ORIGIN || request.url).origin;
}

export async function handleRakutenInventory(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/inventory/rakuten") return null;
  if (request.method !== "GET") return json({ error: "method-not-allowed" }, 405, { Allow: "GET" });
  if (!trustedOrigin(request, env)) return json({ error: "origin-rejected" }, 403);
  try {
    const result = await searchRakuten(env, {
      query: url.searchParams.get("q") || "",
      category: url.searchParams.get("category") || "",
      max: url.searchParams.get("max") || 12,
      page: url.searchParams.get("page") || 1,
    });
    return json({
      source: "rakuten",
      sourceType: "out-of-network affiliate",
      observedAt: result.observedAt,
      query: result.query,
      category: result.category,
      page: result.page,
      limit: result.limit,
      items: result.items,
      meta: { totalMatches: result.totalMatches, totalPages: result.totalPages },
    }, 200, { "Cache-Control": "public, max-age=300, s-maxage=300" });
  } catch (error) {
    const status = error.code === "rakuten-not-configured" ? 503 : 502;
    return json({ error: error.code || "rakuten-unavailable" }, status);
  }
}
