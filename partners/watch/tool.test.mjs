import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContextSnapshot, projectPartnerContext } from "../../engine/p0.js";

const catalog = JSON.parse(await readFile(new URL("./catalog.json", import.meta.url), "utf8"));
let registration;

globalThis.location = { hostname: "watch-ce8.pages.dev", protocol: "https:" };
globalThis.fetch = async () => ({ json: async () => catalog });
globalThis.document = {
  modelContext: {
    registerTool: async (tool, options) => { registration = { tool, options }; },
  },
};

await import(`./tool.js?test=${Date.now()}`);

const plane = (changes = {}) => ({
  feedStyle: "balanced",
  category: "watches",
  maxPrice: null,
  formats: ["price-proof"],
  rules: [],
  ...changes,
});

test("registers only the native Watch tool for the exact engine origin", () => {
  assert.equal(registration.tool.name, "get_matching_deals");
  assert.deepEqual(registration.options, { exposedTo: ["https://jumping-beans-engine.steve-k-kall.workers.dev"] });
  assert.equal(registration.tool.inputSchema.additionalProperties, false);
  assert.equal(registration.tool.inputSchema.properties.preferencePlane.additionalProperties, false);
});

test("applies the strictest native preference-plane price ceiling", async () => {
  const result = await registration.tool.execute({
    categories: ["watches"],
    maxPrice: 900,
    preferencePlane: plane({
      maxPrice: 850,
      rules: [{ text: "Only show offers under $800", scope: "category", category: "watches" }],
    }),
  });
  assert.ok(result.deals.length > 0);
  assert.ok(result.deals.every((deal) => deal.dealPrice < 800));
});

test("consumes the engine's canonical redacted projection without identifiers", async () => {
  const context = createContextSnapshot({
    profile: null,
    applied: true,
    preferences: {
      feedStyle: "visual",
      category: "watches",
      maxPrice: 1200,
      formats: ["testimonial"],
      rules: [{ id: "rule_browser_only", text: "Show customer stories first", scope: "everywhere", category: "", active: true }],
    },
  });
  const projection = projectPartnerContext(context, "https://watch-ce8.pages.dev");
  assert.deepEqual(projection.fields.preferencePlane.rules, [
    { text: "Show customer stories first", scope: "everywhere", category: "" },
    { text: "Up to $1200", scope: "category", category: "watches" },
  ]);
  assert.equal(JSON.stringify(projection.fields).includes("rule_browser_only"), false);
  const result = await registration.tool.execute(projection.fields);
  assert.ok(result.deals.every((deal) => deal.dealPrice <= 1200));
  assert.ok(result.deals.some((deal) => deal.sku === "NIV-77007Q45"));
  assert.ok(result.deals.some((deal) => deal.collateral.some((item) => item.type === "testimonial")));
});

test("does not widen category-scoped rules to another category", async () => {
  const result = await registration.tool.execute({
    categories: ["watches"],
    preferencePlane: plane({
      rules: [{ text: "Only show offers under $1", scope: "category", category: "coffee" }],
    }),
  });
  assert.equal(result.deals.length, 24);
});

test("visual preferences lead with source-backed customer imagery and testimony", async () => {
  const result = await registration.tool.execute({
    categories: ["watches"],
    preferencePlane: plane({
      feedStyle: "visual",
      formats: ["testimonial"],
      rules: [{ text: "Show customer stories first", scope: "everywhere", category: "" }],
    }),
  });
  assert.equal(result.deals[0].sku, "NIV-77007Q45");
  assert.equal(result.deals[0].collateral[0].type, "testimonial");
  assert.equal(result.deals[0].collateral[0].source, "Watch Co customer story");
});

test("compare preferences may rank merchant price facts without fabricating percentage proof", async () => {
  const result = await registration.tool.execute({
    categories: ["watches"],
    preferencePlane: plane({ feedStyle: "compare", formats: ["price-proof", "no-urgency"] }),
  });
  const returnedSavings = result.deals.map((deal) => deal.listPriceSource === "merchant" ? deal.listPrice - deal.dealPrice : 0);
  assert.equal(returnedSavings[0], Math.max(...catalog.map((deal) => deal.listPriceSource === "merchant" ? deal.listPrice - deal.dealPrice : 0)));
  for (const deal of result.deals) {
    const proof = deal.collateral.find((item) => item.type === "price-proof");
    assert.equal(Boolean(proof), false);
  }
});

test("does not return unavailable FORZO records and marks only supported target-price products", async () => {
  const result = await registration.tool.execute({ categories: ["watches"], maxPrice: 1200, preferencePlane: plane({ maxPrice: 1200, formats: ["testimonial"] }) });
  assert.equal(result.deals.some((deal) => /^FZO-/.test(deal.sku)), false);
  assert.equal(result.deals.some((deal) => deal.interestEligible === true && !/^NIV-/.test(deal.sku)), false);
  assert.ok(result.deals.some((deal) => deal.sku === "NIV-77007Q45" && deal.interestEligible === true));
  assert.ok(catalog.filter((deal) => /^FZO-/.test(deal.sku)).every((deal) => deal.listPrice === null && deal.listPriceSource === null && deal.availability === "out-of-stock"));
});

test("rejects non-canonical or sensitive preference input", async () => {
  const topLevelIdentity = await registration.tool.execute({ categories: ["watches"], preferencePlane: plane(), identity: { name: "Alex" } });
  const nestedIdentifier = await registration.tool.execute({
    categories: ["watches"],
    preferencePlane: plane({ rules: [{ id: "rule_secret", text: "Show images first", scope: "everywhere", category: "" }] }),
  });
  assert.deepEqual(topLevelIdentity, { deals: [] });
  assert.deepEqual(nestedIdentifier, { deals: [] });
});

test("preserves the legacy bounded read shape and abort behavior", async () => {
  const bounded = await registration.tool.execute({ categories: ["watches"], maxPrice: 700 });
  const aborted = await registration.tool.execute({ categories: ["watches"] }, { signal: { aborted: true } });
  assert.ok(bounded.deals.length > 0 && bounded.deals.length <= 24);
  assert.ok(bounded.deals.every((deal) => deal.dealPrice <= 700));
  assert.deepEqual(aborted, { deals: [] });
});
