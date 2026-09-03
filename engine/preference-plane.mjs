// Pure preference-plane rules shared by the product shell, account storage,
// and tests. Preference data is intentionally separate from identity and
// execution evidence: only the fields emitted here may be persisted or shared.
import { canonicalCategory, normalizeShoppingIntent, redactShoppingIntent, intentPolicyRules, partnerPriceCeiling } from "./shopping-intent.mjs";

export const STARTER_STYLES = Object.freeze({
  visual: Object.freeze({
    label: "Visual",
    description: "Let the product and its images do most of the explaining.",
    formats: Object.freeze(["video", "testimonial"]),
  }),
  balanced: Object.freeze({
    label: "Balanced",
    description: "Show the useful facts first, without making every choice feel like work.",
    formats: Object.freeze(["price-proof"]),
  }),
  compare: Object.freeze({
    label: "Compare",
    description: "Make price and evidence easy to scan side by side.",
    formats: Object.freeze(["price-proof", "no-urgency"]),
  }),
  custom: Object.freeze({
    label: "Start with my own words",
    description: "Describe what matters in your own words and shape it from there.",
    formats: Object.freeze(["price-proof"]),
  }),
});

const ALLOWED_STYLES = new Set(Object.keys(STARTER_STYLES));
const ALLOWED_SCOPES = new Set(["everywhere", "category"]);
const ALLOWED_FORMATS = new Set(["testimonial", "price-proof", "video", "no-urgency"]);
const MAX_PRICE = 10_000_000;
const MAX_RULES = 30;

const plainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype);
const text = (value, limit = 160) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const normalizedKey = (value) => text(value, 160).toLocaleLowerCase();

function migratedScope(rule) {
  if (ALLOWED_SCOPES.has(rule.scope)) return rule.scope;
  if (rule.scope === "global") return "everywhere";
  if (["for-category", "for_this_category"].includes(rule.scope)) return "category";
  // Old rules had no explicit scope and applied everywhere. An unknown scope
  // is rejected so malformed input can never be widened to everywhere.
  return rule.scope == null || rule.scope === "" ? "everywhere" : null;
}

function normalizedRule(rule) {
  if (!plainObject(rule)) return null;
  const id = text(rule.id || rule.ruleId, 160);
  const value = text(rule.text || rule.description, 240);
  const scope = migratedScope(rule);
  const category = text(rule.category, 80);
  if (!id || !value || !scope || (scope === "category" && !category)) return null;

  const paused = rule.state === "paused" || rule.paused === true || rule.active === false;
  return {
    id,
    key: text(rule.key, 160) || id,
    text: value,
    scope,
    category: scope === "category" ? category : "",
    active: !paused,
  };
}

function normalizedFormats(value) {
  const source = Array.isArray(value?.formats)
    ? value.formats
    : Array.isArray(value?.presentationFormats)
      ? value.presentationFormats
      : [];
  return [...new Set(source.filter((format) => ALLOWED_FORMATS.has(format)))];
}

function normalizedPrice(value) {
  const candidate = value?.maxPrice ?? value?.budget?.maxPrice ?? value?.budgetCeiling;
  return Number.isFinite(candidate) && candidate >= 0 && candidate <= MAX_PRICE ? candidate : null;
}

export function normalizePreferencePlane(value = {}) {
  const source = plainObject(value) ? value : {};
  const uniqueRules = new Map();
  if (Array.isArray(source.rules)) {
    for (const candidate of source.rules) {
      const rule = normalizedRule(candidate);
      if (!rule) continue;
      const id = normalizedKey(rule.id);
      if (!uniqueRules.has(id) && uniqueRules.size >= MAX_RULES) continue;
      uniqueRules.set(id, rule);
    }
  }

  return {
    feedStyle: ALLOWED_STYLES.has(source.feedStyle) ? source.feedStyle : "balanced",
    category: text(source.category, 80),
    maxPrice: normalizedPrice(source),
    ...(source.maxPriceInclusive === false && normalizedPrice(source) !== null ? { maxPriceInclusive: false } : {}),
    formats: normalizedFormats(source),
    rules: [...uniqueRules.values()],
  };
}

export function selectStarterStyle(style) {
  const key = ALLOWED_STYLES.has(style) ? style : "balanced";
  return { feedStyle: key, formats: [...STARTER_STYLES[key].formats] };
}

export function effectiveRules(plane, category) {
  const normalized = normalizePreferencePlane(plane);
  const requestedCategory = normalizedKey(category ?? normalized.category);
  const effective = new Map();

  for (const rule of normalized.rules) {
    if (rule.active && rule.scope === "everywhere") effective.set(normalizedKey(rule.key), rule);
  }
  for (const rule of normalized.rules) {
    if (rule.active && rule.scope === "category" && normalizedKey(rule.category) === requestedCategory) {
      // Map replacement retains the global rule's position, while a new
      // category-only key is appended in the user's rule order.
      effective.set(normalizedKey(rule.key), rule);
    }
  }
  return [...effective.values()];
}

export function editPreferenceRule(plane, ruleId, changes = {}) {
  const normalized = normalizePreferencePlane(plane);
  if (!plainObject(changes)) return normalized;
  const target = normalizedKey(ruleId);
  const index = normalized.rules.findIndex((rule) => normalizedKey(rule.id) === target);
  if (index < 0) return normalized;

  const current = normalized.rules[index];
  const candidate = normalizedRule({
    ...current,
    ...(Object.hasOwn(changes, "text") ? { text: changes.text } : {}),
    ...(Object.hasOwn(changes, "key") ? { key: changes.key } : {}),
    ...(Object.hasOwn(changes, "scope") ? { scope: changes.scope } : {}),
    ...(Object.hasOwn(changes, "category") ? { category: changes.category } : {}),
    id: current.id,
    active: current.active,
  });
  if (!candidate) return normalized;
  normalized.rules[index] = candidate;
  return normalized;
}

export function setPreferenceRuleActive(plane, ruleId, active) {
  const normalized = normalizePreferencePlane(plane);
  const target = normalizedKey(ruleId);
  const rule = normalized.rules.find((candidate) => normalizedKey(candidate.id) === target);
  if (rule) rule.active = active === true;
  return normalized;
}

export function forgetPreferenceRule(plane, ruleId) {
  const normalized = normalizePreferencePlane(plane);
  const target = normalizedKey(ruleId);
  return { ...normalized, rules: normalized.rules.filter((rule) => normalizedKey(rule.id) !== target) };
}

export function preferenceSharingPayload(plane, { category } = {}) {
  const normalized = normalizePreferencePlane(plane);
  const appliedCategory = text(category, 80) || normalized.category;
  const parsed = normalizeShoppingIntent(effectiveRules(normalized, appliedCategory).map((rule) => rule.text).join("; "), { category: canonicalCategory(appliedCategory) || "", maxLength: 8000 });
  const intent = redactShoppingIntent(parsed.intent);
  // Manual category is authoritative, including an unsupported category. Do
  // not let an unrelated priority silently replace it or widen the request.
  if (!canonicalCategory(appliedCategory)) {
    intent.status = appliedCategory || parsed.unknown || parsed.intent.vertical ? "unknown" : intent.status;
    intent.vertical = null; intent.category = null; intent.productType = null;
  }
  if (normalized.maxPrice !== null) {
    intent.budget ||= { currency: "USD", minPrice: null, minInclusive: true, maxPrice: null, maxInclusive: true };
    if (intent.budget.maxPrice === null || normalized.maxPrice < intent.budget.maxPrice) {
      intent.budget.maxPrice = normalized.maxPrice;
      intent.budget.maxInclusive = normalized.maxPriceInclusive !== false;
    } else if (normalized.maxPrice === intent.budget.maxPrice && normalized.maxPriceInclusive === false) intent.budget.maxInclusive = false;
  }
  if (intent.budget?.minPrice != null && intent.budget.maxPrice != null && (intent.budget.minPrice > intent.budget.maxPrice || (intent.budget.minPrice === intent.budget.maxPrice && (!intent.budget.minInclusive || !intent.budget.maxInclusive)))) intent.status = "clarification";
  const safeIntent = redactShoppingIntent(intent);
  return {
    feedStyle: normalized.feedStyle,
    category: safeIntent.category || "",
    maxPrice: partnerPriceCeiling(safeIntent.budget),
    formats: [...normalized.formats],
    rules: intentPolicyRules(safeIntent),
    intent: safeIntent,
  };
}

export function reviewPreferencePlane(plane, { save = false } = {}) {
  const normalized = normalizePreferencePlane(plane);
  const saved = save === true;
  return {
    mode: saved ? "saved-network" : "use-once",
    persisted: saved,
    preferences: normalized,
    sharedPreferences: preferenceSharingPayload(normalized),
    activeRules: effectiveRules(normalized),
    sharing: saved
      ? "connected member sites can use these preferences on future visits until you pause or revoke network sharing"
      : "connected member sites can use these preferences for this visit only",
    retention: saved ? "saved until you choose Forget preferences" : "not saved",
  };
}
