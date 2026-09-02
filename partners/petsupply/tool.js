// Partner A — Petsupply. Imperative WebMCP tool: get_matching_deals.
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
const PARTNER_NAME = "Petsupply";
const PARTNER_ID = "petsupply";
const TOOL_NAME = "get_matching_deals";
const MAX_RESPONSE_DEALS = 24;
const ALLOWED_FORMATS = new Set(["testimonial", "price-proof", "video", "no-urgency"]);
const ALLOWED_FEED_STYLES = new Set(["visual", "balanced", "compare", "custom"]);

const catalog = await fetch("/catalog.json").then((r) => r.json());
const TESTIMONIALS = {
  "WO-CLR-WV-S-BLK": {
    type: "testimonial",
    text: "The quick-release collar is simple, sturdy, and easy to use every day.",
    source: "Petsupply customer story",
  },
};
const partnerState = globalThis.__JB_PARTNER_CONTEXT__ ??= { preferencePlane: null };

function normalizePreferencePlane(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const formats = Array.isArray(value.formats)
    ? [...new Set(value.formats.filter((format) => ALLOWED_FORMATS.has(format)))]
    : [];
  const rules = Array.isArray(value.rules)
    ? value.rules
        .filter((rule) => rule && typeof rule === "object" && !Array.isArray(rule))
        .map((rule) => {
          const text = typeof rule.text === "string" ? rule.text.trim().slice(0, 240) : "";
          const scope = rule.scope === "category" ? "category" : "everywhere";
          const category = typeof rule.category === "string" ? rule.category.trim().slice(0, 80) : "";
          return text ? { text, scope, category: scope === "category" ? category : "" } : null;
        })
        .filter(Boolean)
    : [];
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
  window.dispatchEvent(new CustomEvent("jb:preference-plane", { detail: partnerState.preferencePlane }));
}

function enrich(deal) {
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
  return {
    ...deal,
    collateral: [
      { type: "image", url: deal.imageUrl, label: "Merchant product image" },
      ...priceProof,
      ...(TESTIMONIALS[deal.sku] ? [TESTIMONIALS[deal.sku]] : []),
    ],
  };
}

await document.modelContext.registerTool(
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
        },
      },
      required: ["categories"],
    },
    annotations: { readOnlyHint: true },
    execute: async ({ categories, maxPrice, preferencePlane }, { signal } = {}) => {
      const plane = normalizePreferencePlane(preferencePlane);
      const ceiling = Number.isFinite(maxPrice) && maxPrice >= 0
        ? maxPrice
        : plane?.maxPrice;
      if (!Array.isArray(categories) || !categories.every((category) => typeof category === "string") || (ceiling != null && (!Number.isFinite(ceiling) || ceiling < 0))) return { deals: [] };
      setPreferencePlane(plane);
      const requestedFormats = new Set(plane?.formats || []);
      const categoryKey = (plane?.category || "").trim().toLocaleLowerCase();
      return {
        deals: catalog
          .filter(
            (d) =>
              categories.includes(d.category) &&
              (ceiling == null || d.dealPrice <= ceiling) &&
              (!signal || !signal.aborted)
          )
          .map((deal) => {
            const collateral = enrich(deal).collateral;
            const rankedCollateral = [
              ...collateral.filter((item) => item.type === "image"),
              ...collateral.filter((item) => requestedFormats.has(item.type) && item.type !== "image"),
              ...collateral.filter((item) => !requestedFormats.has(item.type) && item.type !== "image"),
            ];
            return {
              ...enrich(deal),
              collateral: rankedCollateral,
            };
          })
          .sort((a, b) => {
            const aCategory = categoryKey && String(a.category || "").trim().toLocaleLowerCase() === categoryKey ? 1 : 0;
            const bCategory = categoryKey && String(b.category || "").trim().toLocaleLowerCase() === categoryKey ? 1 : 0;
            if (aCategory !== bCategory) return bCategory - aCategory;
            const aFormats = (a.collateral || []).filter((item) => requestedFormats.has(item.type) && item.type !== "image").length;
            const bFormats = (b.collateral || []).filter((item) => requestedFormats.has(item.type) && item.type !== "image").length;
            if (aFormats !== bFormats) return bFormats - aFormats;
            return Number(a.dealPrice || 0) - Number(b.dealPrice || 0);
          })
          .slice(0, MAX_RESPONSE_DEALS)
          .map((d) => ({
            ...d,
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
