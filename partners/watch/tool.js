// Partner A — Watch Co. Imperative WebMCP tool: get_matching_deals.
// Use via the Model Context Tool Inspector / ChatGPT browser, or the engine.
//
// Self-contained deployment contract: localhost/loopback partners expose only
// to the matching local engine; deployed partners expose only to production.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const RUNTIME_MODE = LOCAL_HOSTS.has(location.hostname) ? "local" : "production";
const ENGINE_ORIGINS = Object.freeze({
  local: `${location.protocol}//${location.hostname}:8082`,
  production: "https://jumping-beans-engine.steve-k-kall.workers.dev",
});
const CONCIERGE_ORIGIN = ENGINE_ORIGINS[RUNTIME_MODE];
const PARTNER_NAME = "Watch Co";
const PARTNER_ID = "watch";
const TOOL_NAME = "get_matching_deals";
const MAX_RESPONSE_DEALS = 24;
const ALLOWED_FORMATS = new Set(["testimonial", "price-proof", "video", "no-urgency"]);
const ALLOWED_FEED_STYLES = new Set(["visual", "balanced", "compare", "custom"]);
const OUTPUT_DEAL_KEYS = new Set(["sku", "name", "category", "listPrice", "listPriceSource", "dealPrice", "imageUrl", "expiresAt", "landing", "vendor", "source", "partnerId", "partnerName", "interestEligible", "merchantPageDiscountPercent", "merchantPageDiscountEvidence", "collateral", "provenance"]);

const canRegisterNativeTool = typeof document.modelContext?.registerTool === "function";
const catalog = canRegisterNativeTool ? await fetch("/catalog.json").then((r) => r.json()) : [];

// Local catalog adapter, deliberately separate from the source taxonomy.  Its
// aliases and facts are derived from displayable catalog fields only; it never
// assigns an external taxonomy code or mutates the partner record.
const MAX_PRICE = 10_000_000;
const MAX_CATEGORIES = 12;
const MAX_RULES = 30;
const ALLOWED_INPUT_KEYS = new Set(["categories", "maxPrice", "preferencePlane", "match", "expiresAfter", "expiresBefore", "explain"]);
const ALLOWED_MATCH_KEYS = new Set(["include", "exclude", "bundle"]);
const LOCAL_ALIASES = Object.freeze({ canine: "dog", canines: "dog", puppy: "dog", java: "coffee", timepiece: "watch", timepieces: "watch", leads: "lead", harnesses: "harness", watches: "watch" });
const STOP_WORDS = new Set(["a", "and", "for", "only", "show", "shopping", "the", "with", "from", "gear", "equipment", "coffee", "watches", "watch", "dog", "cat", "no", "not", "exclude", "excluding", "prefer", "customer", "stories", "story", "first", "images", "image", "photos", "photo", "visual"]);

function plainRecord(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype); }
function validPrice(value) { return Number.isFinite(value) && value >= 0 && value <= MAX_PRICE; }
function text(value) { return String(value || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function tokens(value) { return text(value).split(/\s+/).filter(Boolean).map((token) => LOCAL_ALIASES[token] || token); }
function sourceText(deal) { return [deal.name, deal.category, deal.vendor, deal.sku].filter(Boolean).join(" "); }
function hasTerm(words, ...values) { return values.some((value) => words.includes(value)); }
function deriveFacts(deal) {
  const words = tokens(sourceText(deal)); const name = text(deal.name); const coffee = words.includes("coffee"); const watches = words.includes("watch") || words.includes("watches");
  const bundle = hasTerm(words, "bundle", "kit") || /starter bundle/.test(name);
  const components = ["lead", "harness", "beans", "dripper", "watch", "strap"].filter((value) => words.includes(value));
  const facts = { bundle, components, searchableTerms: [...new Set(words)] };
  for (const key of ["dog", "cat", "nylon", "leather", "cotton", "rubber", "silicone", "steel", "resin", "reflective", "automatic", "quartz", "digital", "dark", "light", "medium", "decaf", "ground", "pods", "running", "walking", "diving", "espresso", "filter", "travel", "formal", "everyday", "fetch"]) if (words.includes(key)) facts[key] = true;
  if (facts.dog || facts.cat) facts.species = facts.dog ? "dog" : "cat";
  for (const key of ["nylon", "leather", "cotton", "rubber", "silicone", "steel", "resin"]) if (facts[key]) { facts.material = key; break; }
  for (const key of ["automatic", "quartz", "digital"]) if (facts[key]) { facts.movement = key; break; }
  for (const key of ["dark", "light", "medium"]) if (facts[key]) { facts.roast = key; break; }
  facts.reflective = Boolean(facts.reflective);
  facts.uses = ["running", "walking", "diving", "espresso", "filter", "travel", "formal", "everyday", "fetch"].filter((key) => facts[key]);
  if (bundle) facts.kind = "kit";
  else for (const key of ["lead", "harness", "collar", "toy", "bowl", "watch", "strap", "pods", "filter"]) if (words.includes(key)) { facts.kind = key; break; }
  if (coffee) { if (bundle && !components.includes("beans")) components.push("beans"); if (!bundle) facts.kind = words.includes("pods") ? "pods" : "beans"; facts.form = /whole bean/.test(name) ? "whole bean" : words.includes("ground") ? "ground" : words.includes("pods") ? "pods" : undefined; facts.caffeine = words.includes("decaf") ? "decaf" : "regular"; }
  if (watches && !bundle) facts.kind ||= words.includes("strap") ? "strap" : "watch";
  return facts;
}
function levenshteinAtMostOne(a, b) { if (Math.abs(a.length - b.length) > 1) return false; let changes = 0; for (let i = 0, j = 0; i < a.length && j < b.length;) { if (a[i] === b[j]) { i++; j++; } else if (++changes > 1) return false; else if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return true; }
function lexicalSignal(query, facts) { const words = facts.searchableTerms; const terms = tokens(query).filter((term) => !STOP_WORDS.has(term)); const matched = [];
  for (const term of terms) { const exact = words.includes(term); const prefix = !exact && words.some((word) => word.startsWith(term) || term.startsWith(word)); const fuzzy = !exact && !prefix && term.length > 3 && words.some((word) => levenshteinAtMostOne(word, term)); if (exact || prefix || fuzzy) matched.push({ term, kind: exact ? "token" : prefix ? "prefix" : "fuzzy" }); }
  const phrase = text(query); if (phrase && text(sourceText({ name: facts.searchableTerms.join(" ") })).includes(phrase)) matched.push({ term: phrase, kind: "phrase" });
  return matched;
}
function valueMatches(actual, expected) { return Array.isArray(actual) ? actual.includes(expected) : actual === expected; }
function parseMatch(value, rules) {
  if (value == null) value = {}; if (!plainRecord(value) || !Object.keys(value).every((key) => ALLOWED_MATCH_KEYS.has(key))) return null;
  const include = plainRecord(value.include) ? value.include : {}; const exclude = plainRecord(value.exclude) ? value.exclude : {}; if (!plainRecord(value.include || {}) || !plainRecord(value.exclude || {})) return null;
  const words = tokens(rules.join(" ")).join(" "); const requested = { ...include }; const blocked = { ...exclude };
  const has = (term) => new RegExp(`\\b${term}\\b`, "i").test(words);
  for (const key of ["nylon", "leather", "cotton", "steel", "resin", "automatic", "quartz", "digital", "dark", "light", "medium", "decaf", "pods", "ground", "reflective"]) if (has(key) && !new RegExp(`\\b(?:no|not|exclude|excluding|without)\\s+[^.;,]*\\b${key}`, "i").test(words)) {
    const attribute = ["nylon", "leather", "cotton", "steel", "resin"].includes(key) ? "material" : ["automatic", "quartz", "digital"].includes(key) ? "movement" : ["dark", "light", "medium"].includes(key) ? "roast" : key === "pods" || key === "ground" ? "form" : key === "decaf" ? "caffeine" : "reflective";
    requested[attribute] = key === "reflective" ? true : key;
  }
  if (/whole\s+bean/.test(words)) requested.form = "whole bean";
  if (/\bonly\b[^.;,]*\b(?:bundle|kit)\b|\brequire bundle\b/.test(words)) requested.bundle = true;
  for (const key of ["lead", "harness", "collar", "bowl", "toy", "beans", "pods", "dripper", "grinder", "watch", "strap", "filter"]) if (has(key) && !new RegExp(`\\b(?:no|not|exclude|excluding|without)\\s+[^.;,]*\\b${key}\\b`, "i").test(words) && !/bundle/.test(words) && !requested.bundle) requested.kind = key;
  if (/\bno\s+kits?\b|\bexclude\s+[^.;,]*\bbundles?\b/.test(words)) blocked.bundle = true;
  for (const key of ["leather", "pods", "decaf"]) if (new RegExp(`\\b(?:no|not|exclude|excluding|without)\\s+[^.;,]*\\b${key}`, "i").test(words)) blocked[key === "leather" ? "material" : key === "pods" ? "form" : "caffeine"] = key;
  if (/lead\s+and\s+harness/.test(words)) { requested.bundle = true; requested.components = ["lead", "harness"]; }
  if (/beans\s+and\s+dripper/.test(words)) { requested.bundle = true; requested.components = ["beans", "dripper"]; }
  if (/watch\s+and\s+(?:spare\s+)?strap/.test(words)) { requested.bundle = true; requested.components = ["watch", "strap"]; }
  const componentLabel = words.match(/bundle components:\s*([a-z, ]+)/);
  if (componentLabel) { requested.bundle = true; requested.components = componentLabel[1].split(/\s*,\s*/).filter(Boolean); }
  if (!/\bbundle\b/.test(words) && /only\s+(?:a\s+)?(?:watch|lead|harness)/.test(words)) requested.bundle = false;
  if (has("beans") && has("coffee") && !requested.bundle) requested.kind = "beans";
  return { include: requested, exclude: blocked, query: rules.join(" ") };
}
function categoryMatch(categories, rules, deal) {
  if (categories.length) return categories.includes(deal.category);
  const words = tokens(rules.join(" "));
  const localCategory = words.includes("dog") ? "dog gear" : words.includes("cat") ? "cat gear" : words.includes("coffee") ? "coffee" : words.includes("watch") ? "watches" : null;
  return localCategory === deal.category;
}
function expiryLimit(value) { if (value == null) return null; const parsed = typeof value === "string" ? Date.parse(value) : value; return Number.isFinite(parsed) ? parsed : false; }
function normalizeCatalogInput(input) {
  if (!plainRecord(input) || !Object.keys(input).every((key) => ALLOWED_INPUT_KEYS.has(key))) return null;
  const { categories } = input;
  if (!Array.isArray(categories) || categories.length > MAX_CATEGORIES || !categories.every((category) => typeof category === "string" && category.trim() && category.length <= 80)) return null;
  if (Object.hasOwn(input, "maxPrice") && !validPrice(input.maxPrice)) return null;
  if (input.explain != null && typeof input.explain !== "boolean") return null;
  const after = expiryLimit(input.expiresAfter); const before = expiryLimit(input.expiresBefore); if (after === false || before === false || (after && before && after > before)) return null;
  return { ...input, categories: categories.map((category) => category.trim()), expiresAfter: after, expiresBefore: before };
}
const TESTIMONIALS = {
  "NIV-77007Q45": {
    type: "testimonial",
    text: "The finishing and dial detail feel exceptional at this price.",
    source: "Watch Co customer story",
  },
};
// This marker is the bounded read-side half of Watch Co's target-price
// contract. The write flow remains authoritative and accepts this same set in
// interest-products.js; unmarked catalog records can never be selected by the
// engine for a target-price handoff.
const INTEREST_ELIGIBLE_SKUS = new Set(["NIV-77007Q45", "NIV-77006Q45", "NIV-77005Q45", "NIV-77004Q45"]);
const partnerState = globalThis.__JB_PARTNER_CONTEXT__ ??= { preferencePlane: null };

function normalizePreferencePlane(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const planeKeys = new Set(["feedStyle", "category", "maxPrice", "formats", "rules"]);
  if (!Object.keys(value).every((key) => planeKeys.has(key))) return null;
  const formats = Array.isArray(value.formats)
    ? value.formats.every((format) => ALLOWED_FORMATS.has(format)) && new Set(value.formats).size === value.formats.length
      ? [...value.formats]
      : null
    : [];
  if (formats === null) return null;
  const rules = Array.isArray(value.rules)
    ? value.rules
        .filter((rule) => rule && typeof rule === "object" && !Array.isArray(rule))
        .map((rule) => {
          if (!Object.keys(rule).every((key) => ["text", "scope", "category"].includes(key))) return null;
          const text = typeof rule.text === "string" ? rule.text.trim().slice(0, 240) : "";
          const scope = rule.scope === "category" ? "category" : "everywhere";
          const category = typeof rule.category === "string" ? rule.category.trim().slice(0, 80) : "";
          return text ? { text, scope, category: scope === "category" ? category : "" } : null;
        })
        .filter(Boolean)
    : [];
  if (Array.isArray(value.rules) && rules.length !== value.rules.length) return null;
  return {
    feedStyle: ALLOWED_FEED_STYLES.has(value.feedStyle) ? value.feedStyle : "balanced",
    category: typeof value.category === "string" ? value.category.trim().slice(0, 80) : "",
    maxPrice: Number.isFinite(value.maxPrice) && value.maxPrice >= 0 ? value.maxPrice : null,
    formats,
    rules,
  };
}

function setPreferencePlane(value) {
  partnerState.preferencePlane = normalizePreferencePlane(value);
  partnerState.updatedAt = new Date().toISOString();
  globalThis.window?.dispatchEvent?.(new CustomEvent("jb:preference-plane", { detail: partnerState.preferencePlane }));
}

function outputDeal(value) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => OUTPUT_DEAL_KEYS.has(key)));
}

function enrich(deal) {
  const hasExplicitMerchantPageDiscount = deal.merchantPageDiscountEvidence === "merchant-page-displayed-percent"
    && Number.isFinite(deal.merchantPageDiscountPercent)
    && deal.merchantPageDiscountPercent > 0
    && deal.merchantPageDiscountPercent <= 100;
  const priceProof = hasExplicitMerchantPageDiscount
    ? [{
        type: "price-proof",
        text: `${deal.merchantPageDiscountPercent}% off shown on the merchant product page`,
        source: `${PARTNER_NAME} merchant product page`,
      }]
    : [];
  return {
    ...deal,
    interestEligible: INTEREST_ELIGIBLE_SKUS.has(deal.sku),
    collateral: [
      { type: "image", url: deal.imageUrl, label: "Merchant product image" },
      ...priceProof,
      ...(TESTIMONIALS[deal.sku] ? [TESTIMONIALS[deal.sku]] : []),
    ],
  };
}

function savings(deal) {
  return deal.listPriceSource === "merchant" && Number.isFinite(deal.listPrice) && deal.listPrice > deal.dealPrice
    ? deal.listPrice - deal.dealPrice
    : 0;
}

if (canRegisterNativeTool) await document.modelContext.registerTool(
  {
    name: TOOL_NAME,
    title: "Get matching deals",
    description:
      "Return catalog offers in the given categories, optionally under a max price and redacted preference plane. The opted-in shop supplies records from a public feed; Jumping Beans has not independently verified them.",
    inputSchema: {
      type: "object",
      properties: {
        categories: {
          type: "array",
          items: { type: "string" },
          description: "e.g. ['dog-food','cat-supplies']",
        },
        maxPrice: {
          type: "number",
          description: "Optional ceiling on dealPrice",
        },
        match: {
          type: "object",
          description: "Optional catalog-local include/exclude/bundle selectors. Values are matched only against locally derived catalog facts.",
          properties: {
            include: { type: "object" },
            exclude: { type: "object" },
            bundle: { type: ["boolean", "null"] },
          },
          additionalProperties: false,
        },
        expiresAfter: { type: ["string", "number"], description: "Optional strict lower bound for a source offer expiry." },
        expiresBefore: { type: ["string", "number"], description: "Optional strict upper bound for a source offer expiry." },
        explain: { type: "boolean", description: "Return catalog-match signals for a direct tool caller; omitted for engine-compatible offer envelopes." },
        preferencePlane: {
          type: "object",
          description: "Canonical redacted preference plane used only for presentation choices.",
          properties: {
            feedStyle: { type: "string", enum: ["visual", "balanced", "compare", "custom"] },
            category: { type: "string" },
            maxPrice: { type: ["number", "null"] },
            formats: {
              type: "array",
              items: { type: "string", enum: ["testimonial", "price-proof", "video", "no-urgency"] },
            },
            rules: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  scope: { type: "string", enum: ["everywhere", "category"] },
                  category: { type: "string" },
                },
              },
            },
          },
          additionalProperties: false,
        },
      },
      required: ["categories"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async (input, { signal } = {}) => {
      const normalized = normalizeCatalogInput(input);
      if (!normalized) return { deals: [] };
      const { categories, maxPrice, preferencePlane } = normalized;
      const plane = normalizePreferencePlane(preferencePlane);
      if (preferencePlane != null && !plane) return { deals: [] };
      const ceilings = [maxPrice, plane?.maxPrice].filter((value) => Number.isFinite(value) && value >= 0);
      const ceiling = ceilings.length ? Math.min(...ceilings) : null;
      if (ceiling != null && (!Number.isFinite(ceiling) || ceiling < 0)) return { deals: [] };
      setPreferencePlane(plane);
      const requestedFormats = new Set(plane?.formats || []);
      const categoryKey = (plane?.category || "").trim().toLocaleLowerCase();
      const rules = (plane?.rules || []).filter((rule) => rule.scope !== "category" || categories.includes(rule.category)).map((rule) => rule.text);
      const matcher = parseMatch(normalized.match, rules);
      if (!matcher) return { deals: [] };
      const now = Date.now();
      const matches = [];
      for (const deal of catalog) {
        // A catalog record explicitly marked unavailable is not an offer. This
        // avoids presenting stale merchant inventory as a usable WebMCP result.
        if (deal.availability === "out-of-stock" || !categoryMatch(categories, rules, deal) || (ceiling != null && deal.dealPrice > ceiling) || (signal && signal.aborted)) continue;
        const expiry = deal.expiresAt == null ? null : Date.parse(deal.expiresAt);
        if (deal.expiresAt != null && (!Number.isFinite(expiry) || expiry <= now)) continue;
        if ((normalized.expiresAfter != null || normalized.expiresBefore != null) && expiry == null) continue;
        if (normalized.expiresAfter != null && expiry <= normalized.expiresAfter) continue;
        if (normalized.expiresBefore != null && expiry > normalized.expiresBefore) continue;
        const facts = deriveFacts(deal);
        if (!Object.entries(matcher.include).every(([key, value]) => key === "components" ? Array.isArray(value) && value.every((item) => facts.components.includes(item)) : valueMatches(facts[key], value))) continue;
        // An absent source fact is not silently treated as a positive match for an inclusion;
        // exclusions are only used where the local catalog adapter has a determinate value.
        if (Object.entries(matcher.exclude).some(([key, value]) => facts[key] != null && valueMatches(facts[key], value))) continue;
        const signals = lexicalSignal(matcher.query, facts);
        matches.push({ deal, facts, signals, expiry });
      }
      return {
        deals: matches
          .map(({ deal, facts, signals, expiry }) => {
            const collateral = enrich(deal).collateral;
            const rankedCollateral = [
              ...collateral.filter((item) => requestedFormats.has(item.type) && item.type !== "image"),
              ...collateral.filter((item) => item.type === "image"),
              ...collateral.filter((item) => !requestedFormats.has(item.type) && item.type !== "image"),
            ];
            return {
              ...enrich(deal),
              collateral: rankedCollateral,
              __match: { facts, signals, expiry },
            };
          })
          .sort((a, b) => {
            const aSignals = a.__match.signals.length; const bSignals = b.__match.signals.length;
            if (aSignals !== bSignals) return bSignals - aSignals;
            if (requestedFormats.has("testimonial")) {
              const testimonialDifference = Number(Boolean(TESTIMONIALS[b.sku])) - Number(Boolean(TESTIMONIALS[a.sku]));
              if (testimonialDifference) return testimonialDifference;
            }
            const aCategory = categoryKey && String(a.category || "").trim().toLocaleLowerCase() === categoryKey ? 1 : 0;
            const bCategory = categoryKey && String(b.category || "").trim().toLocaleLowerCase() === categoryKey ? 1 : 0;
            if (aCategory !== bCategory) return bCategory - aCategory;
            const aFormats = (a.collateral || []).filter((item) => requestedFormats.has(item.type) && item.type !== "image").length;
            const bFormats = (b.collateral || []).filter((item) => requestedFormats.has(item.type) && item.type !== "image").length;
            if (aFormats !== bFormats) return bFormats - aFormats;
            const aFresh = a.__match.expiry || 0; const bFresh = b.__match.expiry || 0;
            if (aFresh !== bFresh) return bFresh - aFresh;
            const aSavings = savings(a); const bSavings = savings(b);
            if (aSavings !== bSavings) return bSavings - aSavings;
            return Number(a.dealPrice || 0) - Number(b.dealPrice || 0);
          })
          .slice(0, MAX_RESPONSE_DEALS)
          .map((d) => ({
            ...outputDeal(d),
            partnerId: PARTNER_ID,
            partnerName: PARTNER_NAME,
            provenance: {
              actor: PARTNER_NAME,
              source: d.source || "partner catalog",
              verification: "partner-provided; not independently verified by Jumping Beans",
              expiresAt: d.expiresAt,
            },
          })),
        ...(normalized.explain ? { matchedSignals: matches.map(({ deal, facts, signals }) => ({ sku: deal.sku, signals, localAttributes: Object.fromEntries(Object.entries(facts).filter(([key]) => !["searchableTerms"].includes(key))), sourceTaxonomy: deal.taxonomy ?? null, unmapped: deal.taxonomy == null })) } : {}),
      };
    },
  },
  { exposedTo: [CONCIERGE_ORIGIN] }
);

if (canRegisterNativeTool) console.log(`[${PARTNER_ID}] registered:`, TOOL_NAME);
