// Jumping Beans Engine — partner origins + shared constants.
//
// Build constant, per unit: the engine keeps its own list of partner origins
// (partners must NOT import this cross-origin at runtime — each unit is
// self-contained). LOCAL_* run local dev on localhost (no origin-trial token
// needed); PROD_* are the registered origins. Switch ORIGINS to PROD after deploy.

const HOST = location.hostname;

export const ORIGINS = {
  // Local dev servers (serve.py on these ports, WebMCP-isolated).
  petsupply: "http://localhost:8084",
  coffee: "http://localhost:8085",
  watch: "http://localhost:8086",
  // Production (registered origin-trial origins):
  // petsupply: "https://jumping-beans-petsupply.netlify.app",
  // coffee: "https://jumping-beans-coffee.vercel.app",
  // watch: "https://jumping-beans-watch.vercel.app",
};

export const PARTNER_ORIGINS = [
  ORIGINS.petsupply,
  ORIGINS.coffee,
  ORIGINS.watch,
];

export const PARTNER_NAMES = {
  [ORIGINS.petsupply]: "Petsupply",
  [ORIGINS.coffee]: "Coffee Co",
  [ORIGINS.watch]: "Watch Co",
};

export const TOOL_NAMES = {
  matchingDeals: "get_matching_deals",
  registerInterest: "register_interest",
};

export const SUPPORTED = typeof document.modelContext?.getTools === "function";

// Personas (self-contained per-unit copy of shared/personas.json).
export const PERSONAS = [
  {
    personaId: "alex-budget-parent",
    displayName: "Alex — budget parent",
    recurringCategories: ["dog-food"],
    budgetCeilings: { "dog-food": 35 },
    preferredChannels: ["email", "app"],
    bio: "Buys recurring supplies on a strict monthly budget; wants the smallest total spend, not the newest thing.",
  },
  {
    personaId: "jamie-gift-shopper",
    displayName: "Jamie — gift shopper",
    recurringCategories: ["jewelry"],
    budgetCeilings: { "jewelry": 500 },
    preferredChannels: ["app"],
    bio: "Shopping for someone else; wants one coordinated gift in budget, keeps the recipient out of the loop.",
  },
];
