// Jumping Beans — shared deployment origins + tool-name constants.
//
// Every unit imports this so the cross-origin contract (exposedTo / fromOrigins)
// is defined in ONE place. Swap placeholder origins for real ones after deploy.
//
// Also: each origin must be enrolled in the WebMCP Chrome origin trial
// (trial id 4163014905550602241) and the token delivered per unit — the
// Origin-Trial header config lives next to each unit deploy config.

export const ORIGINS = {
  engine: "http://localhost:8082",        // Concierge app (local dev)
  petsupply: "http://localhost:8084",     // Partner A served from repo root
  coffee: "https://jumping-beans-coffee.vercel.app",        // Coffee Co
  watch: "https://jumping-beans-watch.vercel.app",        // Watch Co
};

export const TOOL_NAMES = {
  matchingDeals: "get_matching_deals",
  registerInterest: "register_interest",
};

export const PARTNER_ORIGINS = [ORIGINS.petsupply,
  ORIGINS.coffee,
  ORIGINS.watch];
