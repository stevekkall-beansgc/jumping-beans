// Jumping Beans — shared deployment origins + tool-name constants.
//
// Reference deployment contract for generators and documentation. Browser
// units carry a self-contained adapter because they deploy independently.
export const ORIGIN_SETS = Object.freeze({
  local: Object.freeze({
    engine: "http://localhost:8082",
    petsupply: "http://localhost:8084",
    coffee: "http://localhost:8085",
    watch: "http://localhost:8086",
  }),
  production: Object.freeze({
    engine: "https://jumping-beans-engine.steve-k-kall.workers.dev",
    petsupply: "https://petsupply.pages.dev",
    coffee: "https://coffee-amk.pages.dev",
    watch: "https://watch-ce8.pages.dev",
  }),
});

export const ORIGINS = ORIGIN_SETS.production;

export const TOOL_NAMES = {
  matchingDeals: "get_matching_deals",
  registerInterest: "register_interest",
};

export const PARTNER_ORIGINS = [ORIGINS.petsupply,
  ORIGINS.coffee,
  ORIGINS.watch];
