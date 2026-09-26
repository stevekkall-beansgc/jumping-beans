import assert from "node:assert/strict";
import test from "node:test";
import { handleCatalogInventory, searchCatalogIndex } from "./catalog.mjs";

const future = new Date(Date.now() + 86_400_000).toISOString();
const index = {
  version: 1,
  generatedAt: "2026-09-03T12:00:00.000Z",
  sources: [
    { id: "woocommerce:one.example", name: "One", platform: "woocommerce", host: "one.example", status: "ready", itemCount: 2, lastSuccessAt: "2026-09-03T11:00:00.000Z" },
    { id: "woocommerce:tilta.com", name: "Tilta", platform: "woocommerce", host: "tilta.com", status: "unavailable", itemCount: 0, lastError: "woocommerce tilta.com HTTP 429" },
  ],
  items: [
    { sku: "ONE-1", name: "Dog Walking Bowl", category: "dog gear", dealPrice: 12, listPrice: 15, listPriceSource: "merchant", expiresAt: future, landing: "https://one.example/products/one-1", vendor: "One", merchant: "One", partnerId: "woocommerce:one.example", partnerName: "One", imageUrl: "https://one.example/one.jpg", observedAt: "2026-09-03T11:00:00.000Z" },
    { sku: "ONE-1", name: "Dog Walking Bowl duplicate", category: "dog gear", dealPrice: 13, expiresAt: future, landing: "https://one.example/products/one-1", partnerId: "woocommerce:one.example", partnerName: "One" },
    { sku: "ONE-2", name: "Coffee Mug", category: "mugs", dealPrice: 20, expiresAt: future, landing: "https://one.example/products/one-2", partnerId: "woocommerce:one.example", partnerName: "One" },
    { sku: "OLD", name: "Expired Bowl", category: "dog gear", dealPrice: 1, expiresAt: "2020-01-01T00:00:00.000Z", landing: "https://one.example/old", partnerId: "woocommerce:one.example", partnerName: "One" },
  ],
};

test("catalog search filters expiry, category, price, and duplicate merchant links", () => {
  const result = searchCatalogIndex(index, { query: "dog", category: "dog gear", maxPrice: 12, now: Date.parse("2026-09-03T12:00:00.000Z") });
  assert.equal(result.totalMatches, 1);
  assert.equal(result.items[0].sku, "ONE-1");
  assert.equal(result.items[0].landing, "https://one.example/products/one-1");
  assert.equal(result.items[0].listPriceSource, "merchant");
});

test("catalog route returns source health and rejects a foreign origin", async () => {
  const env = {
    ENGINE_PUBLIC_ORIGIN: "https://jumping-beans-engine.example",
    INVENTORY_ASSETS: { fetch: async () => new Response(JSON.stringify(index), { headers: { "content-type": "application/json" } }) },
  };
  const response = await handleCatalogInventory(new Request("https://jumping-beans-engine.example/api/inventory/catalog?q=dog&category=dog%20gear&max=1", { headers: { Origin: env.ENGINE_PUBLIC_ORIGIN } }), env);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.items.length, 1);
  assert.equal(payload.meta.sources.find((source) => source.name === "Tilta").status, "unavailable");
  assert.equal(payload.meta.sources.find((source) => source.name === "Tilta").lastError, "woocommerce tilta.com HTTP 429");
  const rejected = await handleCatalogInventory(new Request("https://jumping-beans-engine.example/api/inventory/catalog", { headers: { Origin: "https://evil.example" } }), env);
  assert.equal(rejected.status, 403);
});
