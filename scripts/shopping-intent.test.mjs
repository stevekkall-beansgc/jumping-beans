import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeShoppingIntent, redactShoppingIntent, partnerPriceCeiling } from "../engine/shopping-intent.mjs";
import { interpretPreferenceWords } from "../engine/preference-canvas.mjs";
import { normalizePreferencePlane, preferenceSharingPayload } from "../engine/preference-plane.mjs";
import { createContextSnapshot, projectPartnerContext } from "../engine/p0.js";
import { createAdapter, defaultRoot, loadCorpus } from "../evaluation/product-matching/harness.mjs";

const corpus = await loadCorpus();
function draft(words, manual = {}) {
  const parsed = interpretPreferenceWords(words);
  return normalizePreferencePlane({ ...manual, ...parsed, rules: parsed.remainder ? [{ id: "local-only", text: parsed.remainder, scope: "everywhere" }] : [] });
}
function project(preferences, applied = true) {
  return projectPartnerContext(createContextSnapshot({ preferences, applied }), "https://watch.example");
}
const intent = (words) => normalizeShoppingIntent(words).intent;

test("every words-mode corpus case has the expected normalized constraints or unresolved outcome", () => {
  for (const entry of corpus.cases.filter((entry) => entry.mode === "words")) {
    const parsed = normalizeShoppingIntent(entry.prompt);
    if (entry.expected.outcome === "clarification") {
      assert.equal(parsed.intent.status, "clarification", entry.id);
      assert.ok(interpretPreferenceWords(entry.prompt).clarification, entry.id);
      continue;
    }
    if (entry.expected.outcome === "no-match") {
      assert.ok(["unknown", "empty"].includes(parsed.intent.status), entry.id);
      assert.deepEqual(project(draft(entry.prompt, entry.manual)).fields.categories, [], entry.id);
      continue;
    }
    const actual = preferenceSharingPayload(draft(entry.prompt, entry.manual)).intent;
    assert.equal(actual.status, "ready", entry.id);
    const hard = entry.expected.hard;
    if (hard.categories) assert.ok(hard.categories.includes(actual.category), entry.id);
    if (hard.maxPrice != null) {
      assert.equal(actual.budget.maxPrice, hard.maxPrice, entry.id);
      assert.equal(actual.budget.maxInclusive, true, entry.id);
    }
    if (hard.belowPrice != null) {
      assert.equal(actual.budget.maxPrice, hard.belowPrice, entry.id);
      assert.equal(actual.budget.maxInclusive, false, entry.id);
    }
    for (const [key, val] of Object.entries(hard.equals || {})) {
      const value = key === "kind" ? actual.productType : key === "bundle" ? actual.bundle.kind === "requested" : actual.attributes[key];
      assert.equal(value, val, `${entry.id}: ${key}`);
    }
    for (const [key, val] of Object.entries(hard.notEquals || {})) {
      assert.ok(key === "bundle" ? actual.bundle.kind === "excluded" : actual.exclusions[key]?.includes(val), `${entry.id}: ${key}`);
    }
    for (const type of hard.contains?.components || []) assert.ok(actual.bundle.componentsRequested.includes(type), `${entry.id}: ${type}`);
    assert.equal(actual.taxonomy.officialCode, null, entry.id);
    assert.equal(actual.taxonomy.officialCodeStatus, "unmapped", entry.id);
  }
});

test("aliases, word boundaries, scoped negation and non-decaf do not invent opposite constraints", () => {
  assert.equal(intent("I need a canine leash").productType, "lead");
  assert.equal(intent("Find java beans").category, "coffee");
  assert.equal(intent("A stainless steel timepiece").attributes.material, "steel");
  assert.equal(intent("coffee, non-decaf whole beans").attributes.caffeine, "regular");
  assert.equal(intent("dog gear; non-reflective harness").attributes.reflective, false);
  assert.deepEqual(intent("coffee; not pods or decaf; only ground").exclusions.form, ["pods"]);
  assert.deepEqual(intent("watches; no leather straps and bundles").exclusions, { material: ["leather"] });
  for (const words of ["Not shopping for watches", "Never looking for coffee", "Not category: watches", "Watch the coffeehouse show", "leadership workshop"]) assert.equal(intent(words).vertical, null, words);
  const excluded = intent("dog gear; not reflective, leather or bundles; only nylon");
  assert.deepEqual(excluded.exclusions, { material: ["leather"], reflective: [true] });
  assert.equal(excluded.attributes.material, "nylon");
  const presentation = preferenceSharingPayload({ category: "watches", rules: [{ id: "video", text: "Lead with watch video", scope: "everywhere" }] });
  assert.equal(presentation.intent.status, "partial");
  assert.equal(presentation.intent.category, "watches");
  assert.deepEqual(presentation.intent.policies, ["video"]);
});

test("conflicts, alternatives, malformed prices and oversized/non-string input request clarification", () => {
  for (const words of [
    "coffee or watches", "coffee; only light and dark roast", "coffee; only decaf, no decaf",
    "dog gear; lead and harness", "watches; only bundles, no kits", "coffee; dark or medium roast",
    "coffee under $-1", "coffee under $20.001", "coffee under $20,00", "coffee under $1e3",
    "coffee under $", "coffee under €20", "coffee under USD NaN", "coffee not under $20",
    "coffee under $10000001", "coffee from $30 to $20", "coffee over $20 and up to $20",
    "coffee under $20 and up to $30", "coffee " + "x".repeat(240), {}, [], 42,
  ]) assert.equal(intent(words).status, "clarification", String(words));
  assert.equal(intent("").status, "empty");
  assert.equal(intent("orbital widgets").status, "unknown");
  assert.equal(intent("coffee with a mythical feature").status, "partial");
  assert.equal(intent("under 40 inches").budget, null);
});

test("all supported price wording preserves exact bounds, zero, cents and grouping", () => {
  for (const words of ["up to $20", "at most USD 20", "no more than $20", "budget: $20"]) {
    assert.equal(intent(`coffee ${words}`).budget.maxPrice, 20, words);
    assert.equal(intent(`coffee ${words}`).budget.maxInclusive, true, words);
  }
  for (const words of ["under $20", "below USD 20", "less than $20"]) assert.equal(intent(`coffee ${words}`).budget.maxInclusive, false, words);
  assert.equal(intent("coffee under $1,200.50").budget.maxPrice, 1200.5);
  assert.equal(intent("coffee up to $0").budget.maxPrice, 0);
  assert.equal(intent("coffee under $20 and below $20").status, "ready");
  assert.deepEqual(intent("coffee between $10.50 and $20").budget, { currency: "USD", minPrice: 10.5, minInclusive: true, maxPrice: 20, maxInclusive: true });
  assert.equal(intent("coffee over $10 and below $20").budget.minInclusive, false);
  const bound = partnerPriceCeiling(intent("coffee under $20").budget);
  assert.ok(bound < 20 && bound > 19.99, "strict comparison also excludes sub-cent prices at the boundary");
  assert.deepEqual(project(draft("coffee under $0")).fields.categories, []);
});

test("use cases stay preferences and requested components never claim catalog bundle evidence", async () => {
  for (const [words, use] of [["dog gear; prefer running equipment", "running"], ["coffee; prefer espresso brewing", "espresso"], ["watches for diving", "diving"]]) {
    assert.equal(intent(words).preferences.useCase, use);
    assert.equal(intent(words).attributes.useCase, undefined);
  }
  assert.deepEqual(intent("coffee bundle").bundle, { kind: "requested", componentsRequested: [], componentStatus: "unspecified" });
  const registry = JSON.parse(await readFile(new URL("../shared/taxonomy/v1/catalog-classifications.json", import.meta.url), "utf8"));
  assert.equal(intent("coffee pods").taxonomy.key, registry.classifications[0].canonical.key);
  assert.equal(intent("timepiece").taxonomy.key, registry.classifications[2].canonical.key);
  assert.equal(registry.classifications[1].bundle.componentStatus, "not-provided");
});

test("only active applicable rules contribute; manual category and stricter ceiling remain authoritative", () => {
  const plane = { category: "coffee", maxPrice: 15, rules: [
    { id: "all", key: "roast", text: "only light roast", scope: "everywhere" },
    { id: "coffee", key: "roast", text: "only dark roast", scope: "category", category: "coffee" },
    { id: "wrong", text: "only quartz under $1", scope: "category", category: "watches" },
    { id: "paused", text: "only decaf", scope: "everywhere", active: false },
    { id: "budget", text: "under $20", scope: "everywhere" },
  ] };
  const shared = preferenceSharingPayload(plane);
  assert.deepEqual(shared.intent.attributes, { roast: "dark" });
  assert.equal(shared.intent.budget.maxPrice, 15);
  assert.equal(shared.intent.budget.maxInclusive, true);
  assert.deepEqual(project({ ...plane, category: "orbital widgets" }).fields.categories, []);
  assert.deepEqual(project({ ...draft("canine leads"), category: "" }).fields.categories, [], "clearing a category cannot be undone by a remaining rule");
});

test("drafts never share; approved projections contain only generated allowed values and native v1 keys", () => {
  const words = "coffee; only dark roast; contact jane@example.invalid; password=under $999; private-memo-123";
  const preferences = draft(words);
  assert.deepEqual(project(preferences, false).fields, { categories: [] });
  const snapshot = createContextSnapshot({ preferences, applied: true });
  const wire = projectPartnerContext(snapshot, "https://watch.example").fields;
  assert.deepEqual(Object.keys(wire.preferencePlane), ["feedStyle", "category", "maxPrice", "formats", "rules"]);
  assert.ok(wire.preferencePlane.rules.some((rule) => rule.text === "Require roast: dark"));
  const serialized = JSON.stringify(wire);
  for (const secret of ["jane", "example.invalid", "password", "999", "private-memo", words]) assert.ok(!serialized.includes(secret), secret);
  snapshot.values.recurringCategories.push("secret-category");
  snapshot.values.preferencePlane.intent.attributes.token = "secret-token";
  snapshot.values.preferencePlane.intent.taxonomy.officialCode = "invented-code";
  snapshot.values.preferencePlane.rules.push({ text: "secret-rule", scope: "everywhere", category: "secret-category" });
  snapshot.values.preferencePlane.extra = "secret-field";
  const next = projectPartnerContext(snapshot, "https://coffee.example").fields;
  assert.doesNotMatch(JSON.stringify(next), /secret-|invented-code/);
  wire.preferencePlane.rules[0].text = "mutated";
  assert.doesNotMatch(JSON.stringify(projectPartnerContext(snapshot, "https://petsupply.example").fields), /mutated/);
  assert.deepEqual(redactShoppingIntent({ ...intent("coffee pods"), productType: "secret-product", vertical: "secret-vertical" }).attributes, {});
});

test("native v1 projection still executes unchanged partners and excludes strict price boundaries", async () => {
  const run = await createAdapter(defaultRoot, corpus);
  for (const entry of corpus.cases.filter((entry) => entry.mode === "words" && entry.tags.includes("exclusive-boundary"))) {
    const result = await run(entry);
    assert.equal(result.status, "results", entry.id);
    assert.ok(result.rawDeals.length, entry.id);
    assert.ok(result.rawDeals.every((deal) => deal.dealPrice < entry.expected.hard.belowPrice), entry.id);
  }
});
