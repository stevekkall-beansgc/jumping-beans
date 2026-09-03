import assert from "node:assert/strict";
import test from "node:test";
import { fetchWooCommerce } from "./ingest-feed.mjs";

test("normalizes public WooCommerce Store API products", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /wp-json\/wc\/store\/v1\/products\?per_page=3&page=1/);
    return new Response(JSON.stringify([
      {
        id: 10,
        name: "Ceramic Pour Over",
        sku: "WOO-10",
        permalink: "https://shop.example/products/ceramic-pour-over/",
        is_in_stock: true,
        categories: [{ name: "Coffee" }],
        brands: [{ name: "Example Roasters" }],
        prices: { currency_code: "USD", currency_minor_unit: 2, price: "2499", regular_price: "2999", sale_price: "2499" },
        images: [{ src: "https://shop.example/images/pour-over.jpg" }],
      },
      { id: 11, name: "Sold Out", is_in_stock: false, prices: { price: "999", regular_price: "999", sale_price: "999" } },
    ]), { status: 200, headers: { "X-WP-TotalPages": "1" } });
  };
  try {
    const [product] = await fetchWooCommerce("shop.example", 3);
    assert.equal(product.sku, "WOO-10");
    assert.equal(product.name, "Ceramic Pour Over");
    assert.equal(product.category, "coffee");
    assert.equal(product.listPrice, 29.99);
    assert.equal(product.listPriceSource, "merchant");
    assert.equal(product.dealPrice, 24.99);
    assert.equal(product.imageUrl, "https://shop.example/images/pour-over.jpg");
    assert.equal(product.landing, "https://shop.example/products/ceramic-pour-over/");
    assert.equal(product.vendor, "Example Roasters");
    assert.equal(product.source, "woocommerce");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
