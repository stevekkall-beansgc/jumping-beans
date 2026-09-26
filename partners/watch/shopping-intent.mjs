// Engine-local, deterministic vocabulary. No catalog facts or official taxonomy
// codes are inferred. See ADR 0001 and the Phase 0 taxonomy registry at e9338f6.
export const INTENT_VERSION = "1.0.0";
const MAX_PRICE = 10_000_000;
const VERTICALS = { "pet-supplies": "dog gear", coffee: "coffee", timepieces: "watches" };
const TYPES = {
  "pet-supplies": { lead: "leads?|leash(?:es)?", harness: "harness(?:es)?", collar: "collars?", bowl: "bowls?" },
  coffee: { beans: "(?:java )?beans?", "single-serve-pods": "(?:coffee )?pods?|capsules?|k-cups?", dripper: "drippers?|pour-over brewers?", grinder: "grinders?" },
  timepieces: { watch: "(?:wrist ?)?watches|(?:wrist ?)?watch|timepieces?", strap: "(?:spare )?(?:straps?|watch bands?)" },
};
const ATTRIBUTES = {
  "pet-supplies": { material: { nylon: "nylon", leather: "leather" }, reflective: { true: "reflective|high.visibility", false: "non[ -]?reflective" }, useCase: { running: "running|jogging", walking: "walking|walks?" } },
  coffee: { roast: { dark: "dark(?: roast)?", medium: "medium(?: roast)?", light: "light(?: roast)?" }, form: { "whole bean": "whole[ -]beans?", ground: "ground", pods: "pods?|capsules?|k-cups?" }, caffeine: { decaf: "decaf(?:feinated)?", regular: "regular caffeine|caffeinated|non[ -]decaf" }, useCase: { espresso: "espresso", "pour-over": "pour[ -]over" } },
  timepieces: { movement: { automatic: "automatic|self[ -]winding", quartz: "quartz", manual: "manual[ -]wind(?:ing)?" }, material: { steel: "(?:stainless )?steel", titanium: "titanium", leather: "leather", nylon: "nylon" }, useCase: { diving: "diving|dive", dress: "dress|formal", running: "running" } },
};
const POLICIES = {
  repair: ["repair options|repairable", "Show repair options first"],
  proof: ["price proof|price evidence", "Show price proof"],
  evidence: ["show evidence|show proof", "Show evidence"],
  warranty: ["warranty", "Show warranty terms first"],
  shipping: ["shipping", "Show shipping terms"],
  returns: ["return policy|returns", "Show return policy"],
  video: ["videos?", "Show video first"],
  image: ["images?|photos?|visual", "Show images first"],
  testimonial: ["testimonials?|reviews?|customer stor(?:y|ies)", "Show customer stories first"],
  cheapest: ["cheapest|lowest price|low price|lower prices", "Show lowest price first"],
  compare: ["compare|comparison|discount|savings", "Show comparison first"],
};
const pattern = (value) => new RegExp(`\\b(?:${value})\\b`, "gi");
const unique = (items) => [...new Set(items)];
const scalar = (value) => value === "true" ? true : value === "false" ? false : value;
const record = (value) => value && typeof value === "object" && !Array.isArray(value);
const clean = (value) => value.replace(/\s+/g, " ").replace(/^[\s,;:.—-]+|[\s,;:.—-]+$/g, "").trim();

// Redact before interpretation so addresses, credentials, and phone numbers
// cannot accidentally become shopping constraints. No redacted span is shared.
function localText(value) {
  return value.normalize("NFKC").replace(/[–—]/g, "-")
    .replace(/(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, " ")
    .replace(/\b(?:password|token|api[ _-]?key|secret|cookie|session|receipt|account|email|phone|address)\s*[:=]\s*[^;\n]+/gi, " ")
    .replace(/\b(?:bearer\s+\S+|\d{3}[- .]\d{3}[- .]\d{4})\b/gi, " ");
}

function modeAt(text, index) {
  const prefix = text.slice(0, index).split(/[;.!?]|\bbut\b/i).at(-1).replace(/\b(?:not|never)\s+(?:shopping for|looking for|want)/gi, "not ");
  const cues = [...prefix.matchAll(/\b(exclude|excluding|except|avoid|without|not|no|never|prefer|preferably|only|include|with|want|shopping for|looking for)\b/gi)];
  const cue = cues.at(-1)?.[1].toLowerCase();
  return ["exclude", "excluding", "except", "avoid", "without", "not", "no", "never"].includes(cue) ? "excluded" : ["prefer", "preferably"].includes(cue) ? "preferred" : "required";
}

const MONEY = String.raw`(?:\$|USD\s*)\s*([+-]?\d(?:[\d,]*\d)?(?:\.\d+)?|\.\d+)`;
function amount(value) {
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) return null;
  const price = Number(value.replaceAll(",", ""));
  return Number.isFinite(price) && price <= MAX_PRICE ? price : null;
}

function parseBudget(text, issues) {
  const bounds = [];
  const spans = [];
  const add = (side, raw, inclusive, match) => {
    const price = amount(raw);
    if (price === null || /^(?:[a-z0-9]|\.\d|,\d|\.\.)/i.test(text.slice(match.index + match[0].length))) issues.push("invalid-budget");
    else bounds.push({ side, price, inclusive });
    spans.push([match.index, match.index + match[0].length]);
  };
  const ranges = new RegExp(`\\b(?:between|from)\\s*${MONEY}\\s*(?:and|to|-)\\s*${MONEY}`, "gi");
  for (const match of text.matchAll(ranges)) {
    add("min", match[1], true, match); add("max", match[2], true, match);
  }
  const ceilings = new RegExp(`\\b(no more than|not more than|at most|up to|under|below|less than|budget(?: of|:)?|maximum(?: of|:)?|max(?:imum)? price:?)\\s*${MONEY}`, "gi");
  const floors = new RegExp(`\\b(no less than|at least|over|above|more than|minimum(?: of|:)?)\\s*${MONEY}`, "gi");
  for (const [regex, side] of [[ceilings, "max"], [floors, "min"]]) {
    for (const match of text.matchAll(regex)) {
      if (spans.some(([a, b]) => match.index >= a && match.index < b)) continue;
      if (modeAt(text, match.index) === "excluded") { issues.push("negated-budget"); continue; }
      add(side, match[2], !/^(under|below|less than|over|above|more than)$/i.test(match[1]), match);
    }
  }
  const remaining = [...text].map((char, i) => spans.some(([a, b]) => i >= a && i < b) ? " " : char).join("");
  // Never turn an incomplete amount, an unsupported currency or an unlabelled
  // amount into an unconstrained search. Measurements without money are not prices.
  if (/[$€£¥]|\b(?:USD|EUR|GBP)\b/i.test(remaining)) issues.push("unresolved-budget");
  const budget = { currency: "USD", minPrice: null, minInclusive: true, maxPrice: null, maxInclusive: true };
  for (const side of ["min", "max"]) {
    const candidates = bounds.filter((bound) => bound.side === side);
    if (unique(candidates.map((bound) => bound.price)).length > 1) issues.push("conflicting-budget");
    if (candidates.length) {
      budget[`${side}Price`] = candidates[0].price;
      budget[`${side}Inclusive`] = candidates.every((bound) => bound.inclusive);
    }
  }
  if (budget.minPrice !== null && budget.maxPrice !== null && (budget.minPrice > budget.maxPrice || (budget.minPrice === budget.maxPrice && (!budget.minInclusive || !budget.maxInclusive)))) issues.push("conflicting-budget");
  return { budget: bounds.length ? budget : null, spans, remaining };
}

export function normalizeShoppingIntent(value, { category = "", maxLength = 240 } = {}) {
  const issues = [];
  const raw = typeof value === "string" ? value.trim() : "";
  const limit = Math.min(Number.isInteger(maxLength) && maxLength > 0 ? maxLength : 240, 8000);
  if (typeof value !== "string" || raw.length > limit) issues.push("invalid-input");
  const text = localText(raw.slice(0, limit));
  const prices = parseBudget(text, issues);
  const words = prices.remaining;
  const hits = [];
  const add = (regex, vertical, kind, name, val) => {
    for (const match of words.matchAll(pattern(regex))) {
      if (val === "watch" && /^watch$/i.test(match[0]) && /^\s+(?:the|how|as|this|that)\b/i.test(words.slice(match.index + match[0].length))) continue;
      if (val === "lead" && /^lead$/i.test(match[0]) && /^\s+(?:with|the|by|me|us)\b/i.test(words.slice(match.index + match[0].length))) continue;
      hits.push({ vertical, kind, name, value: val, index: match.index, end: match.index + match[0].length, mode: modeAt(words, match.index) });
    }
  };
  add("dog gear|pet supplies|dog supplies|canine|dogs?", "pet-supplies", "vertical");
  add("coffee|java", "coffee", "vertical");
  for (const [vertical, types] of Object.entries(TYPES)) for (const [type, regex] of Object.entries(types)) add(regex, vertical, "type", "productType", type);
  for (const [vertical, attributes] of Object.entries(ATTRIBUTES)) for (const [name, values] of Object.entries(attributes)) for (const [val, regex] of Object.entries(values)) add(regex, vertical, "attribute", name, scalar(val));
  const manualVertical = Object.keys(VERTICALS).find((vertical) => VERTICALS[vertical] === (typeof category === "string" ? category.toLowerCase() : ""));
  const anchors = unique(hits.filter((hit) => hit.mode !== "excluded" && hit.kind !== "attribute").map((hit) => hit.vertical));
  // Shared materials and uses (leather/running) cannot invent a vertical.
  const vertical = manualVertical || (anchors.length === 1 ? anchors[0] : null);
  if (anchors.length > 1) issues.push("multiple-verticals");
  if (manualVertical && anchors.some((anchor) => anchor !== manualVertical)) issues.push("conflicting-category");
  const attributes = {}, preferences = {}, exclusions = {};
  const addExcluded = (name, val) => { exclusions[name] = unique([...(exclusions[name] || []), val]); };
  const includedTypes = [];
  const relevant = hits.filter((hit) => hit.vertical === vertical && !hits.some((other) => other.vertical === hit.vertical && other.kind === hit.kind && other.name === hit.name && other.index <= hit.index && other.end >= hit.end && other.end - other.index > hit.end - hit.index));
  for (const hit of relevant) {
    // "whole bean" describes form, not a second product alongside coffee pods.
    if (hit.kind === "type" && hit.value === "beans" && /whole[ -]$/i.test(words.slice(0, hit.index))) continue;
    if (hit.kind === "type") {
      if (hit.mode === "excluded") {
        // "leather straps" constrains material; it doesn't exclude every strap.
        if (!relevant.some((other) => other.kind === "attribute" && other.name === "material" && other.mode === "excluded" && other.index < hit.index && hit.index - other.end < 2)) addExcluded("productType", hit.value);
      } else includedTypes.push(hit.value);
    }
    if (hit.kind !== "attribute") continue;
    if (hit.mode === "excluded") addExcluded(hit.name, hit.value);
    else {
      const target = hit.mode === "preferred" || hit.name === "useCase" ? preferences : attributes;
      if (Object.hasOwn(target, hit.name) && target[hit.name] !== hit.value) issues.push("conflicting-attributes");
      target[hit.name] = hit.value;
    }
  }
  const bundles = [...words.matchAll(pattern("bundles?|kits?|sets?"))].map((match) => modeAt(words, match.index) === "excluded" ? "excluded" : "requested");
  if (unique(bundles).length > 1) issues.push("conflicting-bundle");
  const bundleKind = bundles[0] || "unspecified";
  const types = unique(includedTypes);
  if (types.length > 1 && bundleKind !== "requested") issues.push("multiple-product-types");
  const productType = bundleKind === "requested" ? null : types[0] || null;
  for (const [name, val] of Object.entries(attributes)) if (exclusions[name]?.includes(val)) issues.push("conflicting-attributes");
  if (productType && exclusions.productType?.includes(productType)) issues.push("conflicting-product-types");
  if (/\b(?:either|or)\b/i.test(words) && (relevant.length > 1 || bundles.length)) issues.push("alternatives");
  const policies = Object.entries(POLICIES).filter(([, [regex]]) => [...words.matchAll(pattern(regex))].some((match) => modeAt(words, match.index) !== "excluded")).map(([key]) => key);
  // Unknown words stay in this local result. Only the allowlisted projection
  // below may cross WebMCP. No unknown strings become taxonomy keys.
  let unknown = words;
  const covered = [...relevant.map((hit) => [hit.index, hit.end]), ...[...words.matchAll(pattern("bundles?|kits?|sets?"))].map((m) => [m.index, m.index + m[0].length])];
  unknown = [...unknown].map((char, i) => covered.some(([a, b]) => i >= a && i < b) ? " " : char).join("");
  for (const [, [regex]] of Object.entries(POLICIES)) unknown = unknown.replace(pattern(regex), " ");
  unknown = clean(unknown.replace(/\b(?:i|a|an|the|me|my|some|please|shopping for|looking for|looking to buy|find|show|want|need|buy|category|only|prefer|preferably|exclude|excluding|except|avoid|without|not|no|never|and|or|with|include|for|first|options|equipment|brewing|caffeine|roast|spare|under|below)\b/gi, " ").replace(/[:;,]/g, " "));
  const status = issues.length ? "clarification" : vertical ? unknown ? "partial" : "ready" : raw ? "unknown" : "empty";
  const intent = {
    version: INTENT_VERSION, status, vertical, category: vertical ? VERTICALS[vertical] : null, productType,
    taxonomy: { key: vertical && productType ? `jb:temporary:${vertical}:${productType}` : null, keyStatus: "temporary", taxonomy: "gs1-gpc", taxonomyVersion: null, officialCode: null, officialCodeStatus: "unmapped" },
    attributes, preferences, exclusions, budget: prices.budget,
    bundle: { kind: bundleKind, componentsRequested: bundleKind === "requested" ? types : [], componentStatus: bundleKind === "requested" ? types.length ? "user-requested" : "unspecified" : "not-applicable" },
    policies, issues: unique(issues),
  };
  return { intent, unknown, budgetSpans: prices.spans, clarification: issues.length ? "Please clarify the conflicting or unsupported category, product constraints, or price amount before continuing." : "" };
}

// Copy allowed enums/numbers only, including when handed a mutated snapshot.
// Never spread a caller's structured object into a partner request.
export function redactShoppingIntent(value) {
  const vertical = Object.hasOwn(VERTICALS, value?.vertical) ? value.vertical : null;
  const types = TYPES[vertical] || {};
  const attributes = {}, preferences = {}, exclusions = {};
  const allowed = { ...(ATTRIBUTES[vertical] || {}), productType: types };
  for (const [key, values] of Object.entries(allowed)) {
    const valid = (val) => Object.keys(values).some((candidate) => scalar(candidate) === val);
    if (key !== "productType" && valid(value?.attributes?.[key])) attributes[key] = value.attributes[key];
    if (key !== "productType" && valid(value?.preferences?.[key])) preferences[key] = value.preferences[key];
    if (Array.isArray(value?.exclusions?.[key])) {
      const items = unique(value.exclusions[key].filter(valid));
      if (items.length) exclusions[key] = items;
    }
  }
  const productType = Object.hasOwn(types, value?.productType) ? value.productType : null;
  const budget = record(value?.budget) ? { currency: "USD", minPrice: null, minInclusive: value.budget.minInclusive !== false, maxPrice: null, maxInclusive: value.budget.maxInclusive !== false } : null;
  if (budget) for (const key of ["minPrice", "maxPrice"]) if (Number.isFinite(value.budget[key]) && value.budget[key] >= 0 && value.budget[key] <= MAX_PRICE && Math.abs(value.budget[key] * 100 - Math.round(value.budget[key] * 100)) < 1e-6) budget[key] = value.budget[key];
  const kind = ["requested", "excluded"].includes(value?.bundle?.kind) ? value.bundle.kind : "unspecified";
  const components = kind === "requested" && Array.isArray(value?.bundle?.componentsRequested) ? unique(value.bundle.componentsRequested.filter((type) => Object.hasOwn(types, type))) : [];
  return {
    version: INTENT_VERSION, status: ["ready", "partial", "clarification", "unknown", "empty"].includes(value?.status) ? value.status : "unknown",
    vertical, category: vertical ? VERTICALS[vertical] : null, productType,
    taxonomy: { key: vertical && productType ? `jb:temporary:${vertical}:${productType}` : null, keyStatus: "temporary", taxonomy: "gs1-gpc", taxonomyVersion: null, officialCode: null, officialCodeStatus: "unmapped" },
    attributes, preferences, exclusions, budget,
    bundle: { kind, componentsRequested: components, componentStatus: components.length ? "user-requested" : kind === "requested" ? "unspecified" : "not-applicable" },
    policies: Array.isArray(value?.policies) ? unique(value.policies.filter((key) => Object.hasOwn(POLICIES, key))) : [],
  };
}

export function intentPolicyRules(intent) {
  return redactShoppingIntent(intent).policies.map((key) => ({ text: POLICIES[key][1], scope: "everywhere", category: "" }));
}

// The native v1 partners accept only category, ceiling and {text,scope,category}
// rules (Watch rejects extra fields). Compile structured constraints to bounded
// generated labels in that existing envelope. Raw prose is never interpolated.
export function intentPartnerRules(value) {
  const intent = redactShoppingIntent(value);
  const labels = [];
  if (intent.productType) labels.push(`Product type: ${intent.productType}`);
  for (const [key, val] of Object.entries(intent.attributes)) labels.push(`Require ${key}: ${val}`);
  for (const [key, val] of Object.entries(intent.preferences)) labels.push(`Prefer ${key}: ${val}`);
  for (const [key, vals] of Object.entries(intent.exclusions)) for (const val of vals) labels.push(`Exclude ${key}: ${val}`);
  if (intent.bundle.kind !== "unspecified") labels.push(intent.bundle.kind === "requested" ? "Require bundle" : "Exclude bundles");
  if (intent.bundle.componentsRequested.length) labels.push(`Bundle components: ${intent.bundle.componentsRequested.join(", ")}`);
  if (intent.budget?.minPrice !== null && intent.budget?.minPrice !== undefined) labels.push(`Minimum price: ${intent.budget.minInclusive ? "at least" : "over"} $${intent.budget.minPrice}`);
  if (intent.budget?.maxPrice !== null && intent.budget?.maxPrice !== undefined) labels.push(`${intent.budget.maxInclusive ? "Up to" : "Under"} $${intent.budget.maxPrice}`);
  return [...intentPolicyRules(intent), ...labels.map((text) => ({ text, scope: intent.category ? "category" : "everywhere", category: intent.category || "" }))];
}

export function canonicalCategory(value) {
  return typeof value === "string" ? Object.values(VERTICALS).find((category) => category === value.trim().toLowerCase()) || null : null;
}

// Partners currently accept an inclusive numeric ceiling. The predecessor
// float preserves a strict upper bound even for non-cent partner prices.
export function partnerPriceCeiling(budget) {
  if (budget?.maxPrice == null) return null;
  if (budget.maxInclusive !== false) return budget.maxPrice;
  if (budget.maxPrice === 0) return -1;
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setFloat64(0, budget.maxPrice);
  bytes.setBigUint64(0, bytes.getBigUint64(0) - 1n);
  return bytes.getFloat64(0);
}
