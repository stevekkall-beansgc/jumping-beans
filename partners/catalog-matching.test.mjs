import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.dirname(fileURLToPath(import.meta.url));
const future = "2030-01-01T00:00:00.000Z";

async function partnerTool(partner, catalog) {
  const source = await readFile(path.join(root, partner, "tool.js"), "utf8");
  let registered;
  const context = vm.createContext({
    location: { hostname: `${partner}.example`, protocol: "https:" },
    catalogJSON: JSON.stringify(catalog), console: { log() {} },
    window: { dispatchEvent() {} }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
  });
  vm.runInContext("globalThis.fetch=async()=>({json:async()=>JSON.parse(catalogJSON)});globalThis.document={modelContext:{registerTool:async tool=>globalThis.registered=tool}}", context);
  await vm.runInContext(`(async()=>{${source}})()`, context, { timeout: 1000 });
  registered = context.registered;
  return { registered, execute: async (input) => {
    context.inputJSON = JSON.stringify(input);
    return JSON.parse(JSON.stringify(await vm.runInContext("registered.execute(JSON.parse(inputJSON))", context, { timeout: 1000 })));
  } };
}

const plane = (rule) => ({ feedStyle: "balanced", category: "", maxPrice: null, formats: [], rules: [{ text: rule, scope: "everywhere", category: "" }] });

for (const [partner, category, name, rule, expectedSku] of [
  ["petsupply", "dog gear", "Reflective nylon dog running harness", "only reflective nylon harness", "petsupply-1"],
  ["coffee", "coffee", "Dark roast whole bean espresso coffee", "only dark roast whole bean", "coffee-1"],
  ["watch", "watches", "Steel automatic dive watch", "only automatic steel watch", "watch-1"],
]) {
  test(`${partner} keeps matching local, bounded, and explainable`, async () => {
    const tool = await partnerTool(partner, [
      { sku: expectedSku, name, category, dealPrice: 20, listPrice: 30, listPriceSource: "merchant", imageUrl: `https://${partner}.example/a.png`, landing: `https://${partner}.example/a`, source: "fixture", expiresAt: future },
      { sku: `${partner}-old`, name: `${name} bundle`, category, dealPrice: 10, listPrice: null, listPriceSource: null, imageUrl: `https://${partner}.example/b.png`, landing: `https://${partner}.example/b`, source: "fixture", expiresAt: "2020-01-01T00:00:00.000Z" },
    ]);
    assert.equal(tool.registered.name, "get_matching_deals");
    assert.equal(tool.registered.annotations.readOnlyHint, true);
    const result = await tool.execute({ categories: [category], maxPrice: 20, preferencePlane: plane(rule), explain: true });
    assert.deepEqual(result.deals.map((deal) => deal.sku), [expectedSku]);
    assert.equal(result.matchedSignals[0].sourceTaxonomy, null);
    assert.equal(result.matchedSignals[0].unmapped, true);
    assert.ok(result.matchedSignals[0].signals.length > 0);
    assert.deepEqual(await tool.execute({ categories: [category], identity: { email: "never-share@example.test" } }), { deals: [] });
    assert.deepEqual(await tool.execute({ categories: [category], preferencePlane: { ...plane(rule), session: "never-share" } }), { deals: [] });
    assert.deepEqual(await tool.execute({ categories: [category], maxPrice: -1 }), { deals: [] });
  });
}

test("Petsupply maps canonical dog gear only into local dog inventory and preserves the price ceiling", async () => {
  const tool = await partnerTool("petsupply", [
    { sku: "dog-toy", name: "Playful Plush Dog Toy", category: "toys", dealPrice: 11.25, listPrice: 15, listPriceSource: "merchant", imageUrl: "https://petsupply.example/dog-toy.png", landing: "https://petsupply.example/dog-toy", source: "fixture", expiresAt: future },
    { sku: "dog-tag", name: "Custom Dog Tag", category: "dog tags", dealPrice: 17, listPrice: 20, listPriceSource: "merchant", imageUrl: "https://petsupply.example/dog-tag.png", landing: "https://petsupply.example/dog-tag", source: "fixture", expiresAt: future },
    { sku: "dog-leash-over-budget", name: "Lightweight Dog Leash", category: "leash", dealPrice: 24, listPrice: 30, listPriceSource: "merchant", imageUrl: "https://petsupply.example/dog-leash.png", landing: "https://petsupply.example/dog-leash", source: "fixture", expiresAt: future },
    { sku: "cat-toy", name: "Playful Plush Cat Toy", category: "toys", dealPrice: 8.5, listPrice: 10, listPriceSource: "merchant", imageUrl: "https://petsupply.example/cat-toy.png", landing: "https://petsupply.example/cat-toy", source: "fixture", expiresAt: future },
    { sku: "coffee", name: "Coffee Beans", category: "coffee", dealPrice: 12, listPrice: null, listPriceSource: null, imageUrl: "https://petsupply.example/coffee.png", landing: "https://petsupply.example/coffee", source: "fixture", expiresAt: future },
  ]);
  const toys = await tool.execute({ categories: ["dog gear"], maxPrice: 20, preferencePlane: plane("dog toys") });
  const dog = await tool.execute({ categories: ["dog gear"], maxPrice: 20, preferencePlane: plane("dog") });
  assert.deepEqual(toys.deals.map((deal) => deal.sku), ["dog-toy"]);
  assert.deepEqual(dog.deals.map((deal) => deal.sku), ["dog-toy", "dog-tag"]);
  assert.ok([...toys.deals, ...dog.deals].every((deal) => deal.dealPrice <= 20));
});

test("percentage price proof requires an explicit merchant-page display marker", async () => {
  const tool = await partnerTool("petsupply", [
    { sku: "page-percent", name: "Dog Toy With Page Evidence", category: "toys", dealPrice: 15, listPrice: 20, listPriceSource: "merchant", merchantPageDiscountPercent: 25, merchantPageDiscountEvidence: "merchant-page-displayed-percent", imageUrl: "https://petsupply.example/page-percent.png", landing: "https://petsupply.example/page-percent", source: "fixture", expiresAt: future },
    { sku: "compare-only", name: "Dog Toy With Compare-at Only", category: "toys", dealPrice: 15, listPrice: 20, listPriceSource: "merchant", imageUrl: "https://petsupply.example/compare-only.png", landing: "https://petsupply.example/compare-only", source: "fixture", expiresAt: future },
  ]);
  const result = await tool.execute({ categories: ["dog gear"], preferencePlane: plane("dog toys") });
  const proof = (sku) => result.deals.find((deal) => deal.sku === sku)?.collateral.find((item) => item.type === "price-proof");
  assert.equal(proof("compare-only"), undefined);
  assert.equal(proof("page-percent")?.text, "25% off shown on the merchant product page");
});
