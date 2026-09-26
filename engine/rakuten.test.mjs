import assert from "node:assert/strict";
import test from "node:test";
import { handleRakutenInventory, parseProductSearch } from "./rakuten.mjs";

const xml = `<result><TotalMatches>1</TotalMatches><TotalPages>1</TotalPages><item>
  <mid>12345</mid><merchantname>Example Merchant</merchantname><linkid>abc</linkid>
  <sku>SKU-1</sku><productname>Tea &amp; Coffee Set</productname>
  <category><primary>Kitchen</primary><secondary>Kitchen~~Drinkware</secondary></category>
  <price currency="USD">40.00</price><saleprice currency="USD">32.50</saleprice>
  <linkurl>https://example.com/products/tea-set</linkurl><imageurl>https://example.com/tea.jpg</imageurl>
</item></result>`;

test("parses and normalizes Rakuten Product Search XML", () => {
  const result = parseProductSearch(xml, { observedAt: "2026-09-03T12:00:00.000Z" });
  assert.equal(result.totalMatches, 1);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    sku: "rakuten-12345-SKU-1",
    name: "Tea & Coffee Set",
    category: "kitchen",
    listPrice: 40,
    listPriceSource: "merchant",
    merchantPageDiscountPercent: null,
    merchantPageDiscountEvidence: null,
    dealPrice: 32.5,
    imageUrl: "https://example.com/tea.jpg",
    expiresAt: "2026-09-03T18:00:00.000Z",
    landing: "https://example.com/products/tea-set",
    vendor: "Example Merchant",
    merchant: "Example Merchant",
    partnerId: "12345",
    partnerName: "Example Merchant",
    source: "rakuten",
    sourceType: "out-of-network affiliate",
    sourceLabel: "Rakuten Advertising",
    sourceDescription: "Live product record from Rakuten Advertising; the merchant owns the destination page.",
    observedAt: "2026-09-03T12:00:00.000Z",
    verificationLabel: "Live Rakuten API record; price and availability may change on the merchant site",
    collateral: [],
    currency: "USD",
  });
});

test("Rakuten route refreshes a token and returns normalized products without secrets", async () => {
  const calls = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (calls.length === 1) return new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 });
    return new Response(xml, { status: 200 });
  };
  try {
    const response = await handleRakutenInventory(new Request("https://jumping-beans-engine.steve-k-kall.workers.dev/api/inventory/rakuten?q=tea&max=1", {
      headers: { Origin: "https://jumping-beans-engine.steve-k-kall.workers.dev" },
    }), {
      ENGINE_PUBLIC_ORIGIN: "https://jumping-beans-engine.steve-k-kall.workers.dev",
      RAKUTEN_CLIENT_ID: "client-id",
      RAKUTEN_CLIENT_SECRET: "client-secret",
      RAKUTEN_REFRESH_TOKEN: "refresh-token",
      RAKUTEN_ACCOUNT_ID: "account-id",
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.items[0].name, "Tea & Coffee Set");
    assert.equal(JSON.stringify(payload).includes("access-token"), false);
    assert.match(calls[0].url, /api\.linksynergy\.com\/token$/);
    assert.match(calls[1].url, /keyword=tea/);
    assert.match(calls[1].init.headers.Authorization, /^Bearer /);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("Rakuten route rejects cross-origin browser calls", async () => {
  const response = await handleRakutenInventory(new Request("https://jumping-beans-engine.steve-k-kall.workers.dev/api/inventory/rakuten", {
    headers: { Origin: "https://example.com" },
  }), { ENGINE_PUBLIC_ORIGIN: "https://jumping-beans-engine.steve-k-kall.workers.dev" });
  assert.equal(response.status, 403);
});
