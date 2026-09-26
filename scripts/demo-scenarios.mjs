// The three bounded recipes used by local readiness, production smoke, and
// self-serve acceptance. Keep user-facing docs aligned with these values.
export const SELF_SERVE_SCENARIOS = Object.freeze([
  Object.freeze({ partner: "petsupply", category: "dog gear", maxPrice: 50, maxPriceInclusive: false, prompt: "Shopping for dog gear under $50." }),
  Object.freeze({ partner: "coffee", category: "coffee", maxPrice: 15, maxPriceInclusive: false, prompt: "Shopping for coffee under $15. Show customer stories first." }),
  Object.freeze({ partner: "watch", category: "watches", maxPrice: 500, maxPriceInclusive: false, prompt: "Shopping for watches under $500." }),
]);

export const scenarioFor = (partner) => SELF_SERVE_SCENARIOS.find((scenario) => scenario.partner === partner);
