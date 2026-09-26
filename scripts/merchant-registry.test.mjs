import assert from "node:assert/strict";
import test from "node:test";
import { catalogPathFor, merchantId, normalizedHost } from "./merchant-registry.mjs";
import { safeCatalogPath } from "./refresh-merchants.mjs";

test("normalizes merchant identity and keeps catalog paths project-relative", () => {
  assert.equal(normalizedHost("https://WWW.Example.com/store"), "example.com");
  assert.equal(merchantId("shopify", "example.com"), "shopify:example.com");
  assert.equal(catalogPathFor("woocommerce", "example.com"), "inventory/catalogs/woocommerce-example-com.json");
  assert.equal(safeCatalogPath("partners/watch/catalog.json").endsWith("/partners/watch/catalog.json"), true);
  assert.throws(() => safeCatalogPath("../outside.json"), /escapes project root/);
});
