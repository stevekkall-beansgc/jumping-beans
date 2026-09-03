import { normalizePreferencePlane } from "./preference-plane.mjs";
import { normalizeShoppingIntent } from "./shopping-intent.mjs";

// Deterministic interpretation only. No requests, persistence, or inferred identity.
export function interpretPreferenceWords(value) {
  let remainder = typeof value === "string" ? value.trim().slice(0, 240) : "";
  const { intent, clarification } = normalizeShoppingIntent(value);
  if (clarification) return { remainder, clarification };
  // Keep product/attribute wording as an editable local priority. Only broad
  // canonical category phrases are consolidated into the manual category row.
  // Projection reparses the active rules and never forwards their raw wording.
  remainder = remainder.replace(/\b(?:shopping for|category:)\s*(watches|dog gear|coffee)(?=\s*(?:$|[.;,]|(?:under|below|up to)\b))/gi, (match, category) => intent.category === category.toLowerCase() ? "" : match);
  const budget = intent.budget;
  // Lower bounds/ranges remain visible priorities; the manual form has only a
  // ceiling. A simple ceiling carries its inequality as an additive scalar.
  if (budget?.maxPrice != null && budget.minPrice == null) remainder = remainder.replace(/\b(?:no more than|not more than|at most|up to|under|below|less than|budget(?: of|:)?|maximum(?: of|:)?|max(?:imum)? price:?)\s*(?:\$|USD\s*)\s*\d[\d,]*(?:\.\d+)?/gi, "");
  remainder = remainder.replace(/\s+/g, " ").replace(/^[\s,;:.—-]+|[\s,;:.—-]+$/g, "").replace(/^(?:and|with)\s+|\s+(?:and|with)$/gi, "").trim();
  return { ...(budget?.maxPrice != null ? { maxPrice: budget.maxPrice, maxPriceInclusive: budget.maxInclusive } : {}), ...(intent.category ? { category: intent.category } : {}), remainder, clarification: "" };
}

// Older chat drafts repeated parsed facts in a raw rule. Consolidate only exact
// matches in the editable copy; the saved record stays untouched until saving.
export function canvasDraft(value) {
  const plane = normalizePreferencePlane(value);
  plane.rules = plane.rules.flatMap((rule) => {
    const parsed = interpretPreferenceWords(rule.text);
    if ((parsed.maxPrice === undefined && parsed.category === undefined) || parsed.clarification || (parsed.maxPrice !== undefined && (parsed.maxPrice !== plane.maxPrice || (parsed.maxPriceInclusive === false) !== (plane.maxPriceInclusive === false))) || (parsed.category !== undefined && parsed.category !== plane.category.toLowerCase())) return [rule];
    return parsed.remainder ? [{ ...rule, text: parsed.remainder }] : [];
  });
  return plane;
}

export function selectionSummary(plane) {
  return [plane.category || "Any category", plane.maxPrice == null ? "Any budget" : `${plane.maxPriceInclusive === false ? "Under" : "Up to"} $${plane.maxPrice.toFixed(2)}`, ...plane.rules.filter((rule) => rule.active).map((rule) => rule.text)].join(" · ");
}

export function canvasResultState({ applying, applied, paused, supported, outcomes = {}, deals = [], expectedOrigins = [] }) {
  if (applying) return { kind: "loading", title: "Finding matching offers…", message: "Checking opted-in member sites with your approved selection." };
  if (!applied) return { kind: "idle", title: "Your matching offers", message: "Choose Show matching offers to use your selection." };
  if (paused) return { kind: "paused", title: "Network sharing is paused", message: "No preferences were sent to member sites. You can resume sharing in the network details." };
  if (!supported) return { kind: "unavailable", title: "Member offers aren’t available in this browser", message: "Native WebMCP is unavailable here. Open inventory remains available as a labeled baseline." };
  const failed = expectedOrigins.some((origin) => !outcomes[origin]) || Object.values(outcomes).some((outcome) => !["ready", "no-match"].includes(outcome.status));
  if (failed || !Object.keys(outcomes).length) return { kind: "partial", title: deals.length ? "Some member sites couldn’t respond" : "Member sites couldn’t complete this search", message: "Results may be incomplete. Change your selection or try again; no substitute partner results are created." };
  if (!deals.length) return { kind: "no-match", title: "No opted-in offer matches this selection", message: "Try a broader category or budget. Open inventory below is a separate baseline, not a personalized match." };
  return { kind: "results", title: "Your matching offers", message: "These member offers match your approved selection. Prices and product claims remain partner-provided." };
}
