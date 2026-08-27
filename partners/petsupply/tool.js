// Partner A — Petsupply. Imperative WebMCP tool: get_matching_deals.
// Use via the Model Context Tool Inspector / ChatGPT browser, or the engine.
//
// Build constant, per unit: the Concierge engine origin this shop exposes its
// tool to. Different in prod vs local dev — set once per deploy.

const CONCIERGE_ORIGIN = "http://localhost:8082"; // prod: https://<engine>.workers.dev
const PARTNER_NAME = "Petsupply";
const PARTNER_ID = "petsupply";
const TOOL_NAME = "get_matching_deals";

const catalog = await fetch("/catalog.json").then((r) => r.json());

await document.modelContext.registerTool(
  {
    name: TOOL_NAME,
    title: "Get matching deals",
    description:
      "Return current deals in the given categories, optionally under a max price. Deals are live and verified by the shop.",
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
      return {
        deals: catalog
          .filter(
            (d) =>
              categories.includes(d.category) &&
              (maxPrice == null || d.dealPrice <= maxPrice) &&
              (!signal || !signal.aborted)
          )
          .map((d) => ({
            ...d,
            partnerId: PARTNER_ID,
            partnerName: PARTNER_NAME,
          })),
      };
    },
  },
  { exposedTo: [CONCIERGE_ORIGIN] }
);

console.log(`[${PARTNER_ID}] registered:`, TOOL_NAME);
