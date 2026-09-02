// Jumping Beans partner: Watch Co (watch). Imperative WebMCP tool.
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
const MAX_PRICE = 10_000_000;
const MAX_CATEGORIES = 12;
const MAX_RULES = 30;
const ALLOWED_FEED_STYLES = new Set(["visual", "balanced", "compare", "custom"]);
const ALLOWED_FORMATS = new Set(["testimonial", "price-proof", "video", "no-urgency"]);
const ALLOWED_SCOPES = new Set(["everywhere", "category"]);
const ALLOWED_INPUT_KEYS = new Set(["categories", "maxPrice", "preferencePlane"]);
const ALLOWED_PLANE_KEYS = new Set(["feedStyle", "category", "maxPrice", "formats", "rules"]);
const ALLOWED_RULE_KEYS = new Set(["text", "scope", "category"]);

const catalog = await fetch("/catalog.json").then((r) => r.json());
const TESTIMONIALS = {
  "NIV-77007Q45": {
    type: "testimonial",
    text: "The finishing and dial detail feel exceptional at this price.",
    source: "Watch Co customer story",
  },
};

function plainRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype);
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function boundedText(value, limit, { empty = false } = {}) {
  return typeof value === "string" && value.length <= limit && (empty || value.trim().length > 0);
}

function validPrice(value) {
  return Number.isFinite(value) && value >= 0 && value <= MAX_PRICE;
}

function normalizePreferencePlane(value) {
  if (value == null) return null;
  if (!plainRecord(value) || !hasOnlyKeys(value, ALLOWED_PLANE_KEYS)) return false;
  if (!Object.hasOwn(value, "feedStyle") || !Object.hasOwn(value, "category") || !Object.hasOwn(value, "maxPrice") || !Object.hasOwn(value, "formats") || !Object.hasOwn(value, "rules")) return false;
  if (!ALLOWED_FEED_STYLES.has(value.feedStyle) || !boundedText(value.category, 80, { empty: true }) || (value.maxPrice !== null && !validPrice(value.maxPrice))) return false;
  if (!Array.isArray(value.formats) || value.formats.length > ALLOWED_FORMATS.size || new Set(value.formats).size !== value.formats.length || !value.formats.every((format) => ALLOWED_FORMATS.has(format))) return false;
  if (!Array.isArray(value.rules) || value.rules.length > MAX_RULES) return false;
  const rules = [];
  for (const rule of value.rules) {
    if (!plainRecord(rule) || !hasOnlyKeys(rule, ALLOWED_RULE_KEYS) || !Object.hasOwn(rule, "text") || !Object.hasOwn(rule, "scope") || !Object.hasOwn(rule, "category")) return false;
    if (!boundedText(rule.text, 240) || !ALLOWED_SCOPES.has(rule.scope) || !boundedText(rule.category, 80, { empty: true }) || (rule.scope === "category" && !rule.category.trim())) return false;
    rules.push({ text: rule.text.trim(), scope: rule.scope, category: rule.category.trim() });
  }
  return {
    feedStyle: value.feedStyle,
    category: value.category.trim(),
    maxPrice: value.maxPrice,
    formats: [...value.formats],
    rules,
  };
}

function normalizeInput(value) {
  if (!plainRecord(value) || !hasOnlyKeys(value, ALLOWED_INPUT_KEYS)) return null;
  const { categories } = value;
  if (!Array.isArray(categories) || categories.length > MAX_CATEGORIES || new Set(categories).size !== categories.length || !categories.every((category) => boundedText(category, 80))) return null;
  if (Object.hasOwn(value, "maxPrice") && !validPrice(value.maxPrice)) return null;
  const preferencePlane = normalizePreferencePlane(value.preferencePlane);
  if (preferencePlane === false) return null;
  return { categories: [...categories], maxPrice: value.maxPrice, preferencePlane };
}

function applicableRules(preferencePlane, categories) {
  if (!preferencePlane) return [];
  const selected = new Set(categories.map((category) => category.toLocaleLowerCase()));
  return preferencePlane.rules.filter((rule) => rule.scope === "everywhere" || selected.has(rule.category.toLocaleLowerCase()));
}

function rulePriceLimit(text) {
  const match = text.match(/\b(under|below|up to|at or below|maximum(?: price)?(?: of)?|max(?: price)?(?: of)?|no more than)\s*\$?\s*(\d+(?:\.\d{1,2})?)\b/i);
  if (!match) return null;
  const value = Number(match[2]);
  return validPrice(value) ? { value, exclusive: /^(under|below)$/i.test(match[1]) } : null;
}

function activePriceLimit(maxPrice, preferencePlane, rules) {
  const limits = [];
  if (validPrice(maxPrice)) limits.push({ value: maxPrice, exclusive: false });
  if (preferencePlane && validPrice(preferencePlane.maxPrice)) limits.push({ value: preferencePlane.maxPrice, exclusive: false });
  for (const rule of rules) {
    const limit = rulePriceLimit(rule.text);
    if (limit) limits.push(limit);
  }
  return limits.sort((a, b) => a.value - b.value || Number(b.exclusive) - Number(a.exclusive))[0] || null;
}

function formatPriority(preferencePlane, rules) {
  const priority = [];
  const add = (format) => { if (!priority.includes(format)) priority.push(format); };
  for (const rule of rules) {
    const text = rule.text.toLocaleLowerCase();
    if (/\b(image|images|photo|photos|visual)\b/.test(text)) add("image");
    if (/\b(testimonial|testimonials|review|reviews|customer stor(?:y|ies))\b/.test(text)) add("testimonial");
    if (/\b(price proof|proof|compare|comparison|discount|savings)\b/.test(text)) add("price-proof");
    if (/\bvideo|videos\b/.test(text)) add("video");
  }
  if (preferencePlane?.feedStyle === "visual") add("image");
  if (preferencePlane?.feedStyle === "compare") add("price-proof");
  for (const format of preferencePlane?.formats || []) if (format !== "no-urgency") add(format);
  for (const format of ["image", "price-proof", "testimonial", "video"]) add(format);
  return priority;
}

function savings(deal) {
  return deal.listPriceSource === "merchant" && Number.isFinite(deal.listPrice) && deal.listPrice > deal.dealPrice
    ? deal.listPrice - deal.dealPrice
    : 0;
}

function sortDeals(deals, preferencePlane, rules) {
  const indexed = deals.map((deal, index) => ({ deal, index }));
  const ruleText = rules.map((rule) => rule.text).join(" ").toLocaleLowerCase();
  const cheapestFirst = /\b(cheapest|lowest price|low price|budget)\b/.test(ruleText);
  const compareFirst = preferencePlane?.feedStyle === "compare" || /\b(compare|comparison|discount|savings|price proof)\b/.test(ruleText);
  const visualFirst = preferencePlane?.feedStyle === "visual" || /\b(image|images|photo|photos|visual)\b/.test(ruleText);
  const testimonialFirst = preferencePlane?.formats.includes("testimonial") || /\b(testimonial|testimonials|review|reviews|customer stor(?:y|ies))\b/.test(ruleText);
  indexed.sort((a, b) => {
    if (cheapestFirst && a.deal.dealPrice !== b.deal.dealPrice) return a.deal.dealPrice - b.deal.dealPrice;
    if (compareFirst && savings(a.deal) !== savings(b.deal)) return savings(b.deal) - savings(a.deal);
    if (visualFirst) {
      const imageDifference = Number(Boolean(b.deal.imageUrl)) - Number(Boolean(a.deal.imageUrl));
      if (imageDifference) return imageDifference;
    }
    if (testimonialFirst) {
      const testimonialDifference = Number(Boolean(TESTIMONIALS[b.deal.sku])) - Number(Boolean(TESTIMONIALS[a.deal.sku]));
      if (testimonialDifference) return testimonialDifference;
    }
    return a.index - b.index;
  });
  return indexed.map(({ deal }) => deal);
}

function enrich(deal, priority) {
  const hasMerchantListPrice = deal.listPriceSource === "merchant"
    && Number.isFinite(deal.listPrice)
    && deal.listPrice > deal.dealPrice;
  const priceProof = hasMerchantListPrice
    ? [{
        type: "price-proof",
        text: `${Math.round((1 - deal.dealPrice / deal.listPrice) * 100)}% below merchant comparison price`,
        source: `${PARTNER_NAME} catalog compare-at price`,
      }]
    : [];
  const collateral = [
    { type: "image", url: deal.imageUrl, label: "Merchant product image" },
    ...priceProof,
    ...(TESTIMONIALS[deal.sku] ? [TESTIMONIALS[deal.sku]] : []),
  ];
  return {
    ...deal,
    collateral: collateral.sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type)),
  };
}

await document.modelContext.registerTool(
  {
    name: TOOL_NAME,
    title: "Get matching deals",
    description:
      "Return Watch Co catalog offers in the given categories, optionally under a max price. The opted-in shop supplies records from a public feed; Jumping Beans has not independently verified them.",
    inputSchema: {
      type: "object",
      properties: {
        categories: { type: "array", maxItems: MAX_CATEGORIES, uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 80 }, description: "e.g. ['general']" },
        maxPrice: { type: "number", minimum: 0, maximum: MAX_PRICE, description: "Optional ceiling on dealPrice" },
        preferencePlane: {
          type: "object",
          description: "User-approved, request-only presentation preferences with no identity, account, session, receipt, grant, or idempotency data.",
          properties: {
            feedStyle: { type: "string", enum: ["visual", "balanced", "compare", "custom"] },
            category: { type: "string", maxLength: 80 },
            maxPrice: { type: ["number", "null"], minimum: 0, maximum: MAX_PRICE },
            formats: { type: "array", maxItems: 4, uniqueItems: true, items: { type: "string", enum: [...ALLOWED_FORMATS] } },
            rules: {
              type: "array",
              maxItems: MAX_RULES,
              items: {
                type: "object",
                properties: {
                  text: { type: "string", minLength: 1, maxLength: 240 },
                  scope: { type: "string", enum: ["everywhere", "category"] },
                  category: { type: "string", maxLength: 80 },
                },
                required: ["text", "scope", "category"],
                additionalProperties: false,
              },
            },
          },
          required: ["feedStyle", "category", "maxPrice", "formats", "rules"],
          additionalProperties: false,
        },
      },
      required: ["categories"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async (input, { signal } = {}) => {
      const normalized = normalizeInput(input);
      if (!normalized) return { deals: [] };
      const { categories, maxPrice, preferencePlane } = normalized;
      const rules = applicableRules(preferencePlane, categories);
      const priceLimit = activePriceLimit(maxPrice, preferencePlane, rules);
      const priority = formatPriority(preferencePlane, rules);
      const matches = catalog.filter(
        (deal) =>
          categories.includes(deal.category) &&
          (!priceLimit || (priceLimit.exclusive ? deal.dealPrice < priceLimit.value : deal.dealPrice <= priceLimit.value)) &&
          (!signal || !signal.aborted)
      );
      return {
        deals: sortDeals(matches, preferencePlane, rules)
          .slice(0, MAX_RESPONSE_DEALS)
          .map((d) => ({
            ...enrich(d, priority),
            partnerId: PARTNER_ID,
            partnerName: PARTNER_NAME,
            provenance: {
              actor: PARTNER_NAME,
              source: d.source || "partner catalog",
              verification: "partner-provided; not independently verified by Jumping Beans",
              expiresAt: d.expiresAt,
            },
          })),
      };
    },
  },
  { exposedTo: [CONCIERGE_ORIGIN] }
);

console.log(`[${PARTNER_ID}] registered:`, TOOL_NAME);
