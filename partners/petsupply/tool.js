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

const catalog = await fetch("/catalog.json").then((r) => r.json());
const TESTIMONIALS = {
  "WO-CLR-WV-S-BLK": {
    type: "testimonial",
    text: "The quick-release collar is simple, sturdy, and easy to use every day.",
    source: "Petsupply customer story",
  },
};

function enrich(deal) {
  const savedPct = Math.round((1 - deal.dealPrice / deal.listPrice) * 100);
  return {
    ...deal,
    collateral: [
      { type: "image", url: deal.imageUrl, label: "Merchant product image" },
      { type: "price-proof", text: `${savedPct}% below list price`, source: PARTNER_NAME },
      ...(TESTIMONIALS[deal.sku] ? [TESTIMONIALS[deal.sku]] : []),
    ],
  };
}

await document.modelContext.registerTool(
  {
    name: TOOL_NAME,
    title: "Get matching deals",
    description:
      "Return catalog offers in the given categories, optionally under a max price. The opted-in shop supplies records from a public feed; Jumping Beans has not independently verified them.",
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
      },
      required: ["categories"],
    },
    annotations: { readOnlyHint: true },
    execute: async ({ categories, maxPrice }, { signal } = {}) => {
      if (!Array.isArray(categories) || !categories.every((category) => typeof category === "string") || (maxPrice != null && (!Number.isFinite(maxPrice) || maxPrice < 0))) return { deals: [] };
      return {
        deals: catalog
          .filter(
            (d) =>
              categories.includes(d.category) &&
              (maxPrice == null || d.dealPrice <= maxPrice) &&
              (!signal || !signal.aborted)
          )
          .map((d) => ({
            ...enrich(d),
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
