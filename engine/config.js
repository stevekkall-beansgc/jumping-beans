// Jumping Beans Engine — partner origins + shared constants.
//
// Each independently deployed unit keeps a self-contained copy of this runtime
// contract. Local pages resolve every origin from the hostname that served the
// page; non-local pages use the explicit production allowlist.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const localOrigin = (port) => `${location.protocol}//${location.hostname}:${port}`;

export const RUNTIME_MODE = LOCAL_HOSTS.has(location.hostname) ? "local" : "production";

export const ORIGIN_SETS = Object.freeze({
  local: Object.freeze({
    engine: localOrigin(8082),
    petsupply: localOrigin(8084),
    coffee: localOrigin(8085),
    watch: localOrigin(8086),
  }),
  production: Object.freeze({
    engine: "https://jumping-beans-engine.steve-k-kall.workers.dev",
    petsupply: "https://petsupply.pages.dev",
    coffee: "https://coffee-amk.pages.dev",
    watch: "https://watch-ce8.pages.dev",
  }),
});

export const ORIGINS = ORIGIN_SETS[RUNTIME_MODE];

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
// Categories are the REAL categories present in each partner's live feed:
// petsupply (Wild One): bowl/toys/leash/collar/harness/carrier/cat*...
// coffee (Death Wish): coffee/mugs/accessories/apparel/on-the-go drinkware...
// watch (WatchGecko): watches.
export const PERSONAS = [
  {
    personaId: "alex-budget-parent",
    displayName: "Alex — budget parent",
    recurringCategories: [
      "bowl", "toys", "leash", "collar", "harness", "carrier",
      "wipes", "dog tags", "poop bags", "coffee", "mugs",
    ],
    budgetCeilings: {
      "bowl": 40, "toys": 30, "leash": 40, "collar": 30, "harness": 50,
      "carrier": 120, "wipes": 25, "dog tags": 25, "poop bags": 20,
      "coffee": 40, "mugs": 35,
    },
    preferredChannels: ["email", "app"],
    bio: "Buys recurring supplies on a strict monthly budget; wants the smallest total spend, not the newest thing.",
  },
  {
    personaId: "jamie-gift-shopper",
    displayName: "Jamie — gift shopper",
    recurringCategories: [
      "watches", "accessories", "apparel", "mugs", "on-the-go drinkware",
      "custom bundle", "carrier", "gift card",
    ],
    budgetCeilings: {
      "watches": 1500, "accessories": 60, "apparel": 80, "mugs": 45,
      "on-the-go drinkware": 50, "custom bundle": 200, "carrier": 150, "gift card": 200,
    },
    preferredChannels: ["app"],
    bio: "Shopping for someone else; wants one coordinated gift in budget, keeps the recipient out of the loop.",
  },
];
