import { normalizePreferencePlane } from "./preference-plane.mjs";

// Deterministic interpretation only. No requests, persistence, or inferred identity.
export function interpretPreferenceWords(value) {
  let remainder = String(value || "").trim().slice(0, 240);
  // Negation, alternatives and open-ended categories remain literal priorities.
  if (/\b(?:not|never|except|exclude|avoid)\s+(?:category:|(?:shopping for|under|below|up to)\b)/i.test(remainder)) return { remainder, clarification: "" };
  if (/\bshopping for\s+(?:watches|dog gear|coffee)\s+(?:and|or)\s+(?:category:\s*)?(?:shopping for\s*)?(?:watches|dog gear|coffee)\b/i.test(remainder)) return { remainder, clarification: "Choose one category in your words, or use the manual form and remove the category list from your words." };
  const budgets = [...remainder.matchAll(/\b(?:under|below|up to)\s*(?:\$|USD\s*)(\d+(?:,\d{3})*(?:\.\d{1,2})?)(?![\d]|[.,]\d)/gi)];
  const categories = [...remainder.matchAll(/\b(?:shopping for|category:)\s*(watches|dog gear|coffee)(?=\s*(?:$|[.;,]|(?:under|below|up to)\b))/gi)];
  const prices = [...new Set(budgets.map((match) => Number(match[1].replaceAll(",", ""))))];
  const names = [...new Set(categories.map((match) => match[1].toLowerCase()))];
  const ambiguous = prices.length > 1 || prices.some((price) => price > 10000000) || names.length > 1;
  if (ambiguous) return { remainder, clarification: "Use one category and budget in your words, or use the manual form and remove the conflicting amounts or categories from your words." };
  for (const match of [...budgets, ...categories]) remainder = remainder.replace(match[0], "");
  remainder = remainder.replace(/\s+/g, " ").replace(/^[\s,;:.—-]+|[\s,;:.—-]+$/g, "").replace(/^(?:and|with)\s+|\s+(?:and|with)$/gi, "").trim();
  return { ...(prices.length ? { maxPrice: prices[0] } : {}), ...(names.length ? { category: names[0] } : {}), remainder, clarification: "" };
}

// Older chat drafts repeated parsed facts in a raw rule. Consolidate only exact
// matches in the editable copy; the saved record stays untouched until saving.
export function canvasDraft(value) {
  const plane = normalizePreferencePlane(value);
  plane.rules = plane.rules.flatMap((rule) => {
    const parsed = interpretPreferenceWords(rule.text);
    if ((parsed.maxPrice === undefined && parsed.category === undefined) || parsed.clarification || (parsed.maxPrice !== undefined && parsed.maxPrice !== plane.maxPrice) || (parsed.category !== undefined && parsed.category !== plane.category.toLowerCase())) return [rule];
    return parsed.remainder ? [{ ...rule, text: parsed.remainder }] : [];
  });
  return plane;
}

export function selectionSummary(plane) {
  return [plane.category || "Any category", plane.maxPrice == null ? "Any budget" : `Up to $${plane.maxPrice.toFixed(2)}`, ...plane.rules.filter((rule) => rule.active).map((rule) => rule.text)].join(" · ");
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
