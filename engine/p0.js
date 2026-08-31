// P0 capability and journey primitives.
// These are deliberately in-process: they wrap the working WebMCP engine
// without turning a four-origin demo into a distributed platform.

export const CAPABILITIES = Object.freeze([
  Object.freeze({
    id: "offers.discover",
    version: "1.0.0",
    title: "Discover eligible offers",
    mode: "read",
    requiredScope: "offers:read",
    outcomeType: "offer_set_ready",
  }),
  Object.freeze({
    id: "preferences.stage",
    version: "1.0.0",
    title: "Stage presentation preferences",
    mode: "write",
    requiredScope: "preferences:stage",
    outcomeType: "preference_staged",
  }),
  Object.freeze({
    id: "preferences.apply",
    version: "1.0.0",
    title: "Apply presentation preferences",
    mode: "write",
    requiredScope: "preferences:apply",
    outcomeType: "preference_applied",
  }),
  Object.freeze({
    id: "memory.forget",
    version: "1.0.0",
    title: "Forget saved offer memory",
    mode: "write",
    requiredScope: "memory:delete",
    outcomeType: "memory_deleted",
  }),
  Object.freeze({
    id: "deal_watch.stage",
    version: "1.0.0",
    title: "Stage a deal watch",
    mode: "write",
    requiredScope: "watch:stage",
    outcomeType: "watch_staged",
  }),
]);

export function opaqueId(prefix) {
  const random = globalThis.crypto?.randomUUID?.();
  return random
    ? prefix + "_" + random
    : prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}

export function createJourney({ intentType, surface = "web", protocol = "webmcp" }) {
  return {
    journeyId: opaqueId("journey"),
    parentRequestId: opaqueId("request"),
    intentType,
    intentVersion: "1.0.0",
    surface,
    protocol,
    startedAt: new Date().toISOString(),
    status: "active",
  };
}

export function createContextSnapshot({ profile, preferences, applied }) {
  return {
    contextSnapshotId: opaqueId("context"),
    source: "user-controlled-browser-context",
    scope: "Jumping Beans product in this browser",
    capturedAt: new Date().toISOString(),
    values: {
      personaId: profile?.personaId || null,
      recurringCategories: [...(profile?.recurringCategories || [])],
      budgetCeilings: { ...(profile?.budgetCeilings || {}) },
      preferredChannels: [...(profile?.preferredChannels || [])],
      presentationFormats: [...(preferences?.formats || [])],
      maxPrice: preferences?.maxPrice ?? null,
      applied: Boolean(applied),
    },
    trust: {
      userContext: "explicit-or-user-approved",
      businessAuthorization: "not-provided",
    },
  };
}

export function createEvent(journey, type, payload = {}) {
  return {
    eventId: opaqueId("event"),
    journeyId: journey.journeyId,
    occurredAt: new Date().toISOString(),
    type,
    source: "jumping-beans-engine",
    observedOrInferred: "observed",
    schemaVersion: "1.0.0",
    ...payload,
  };
}

function priceCeiling(deal, profile, preferences) {
  const explicit = preferences?.maxPrice;
  const profileCeiling = profile?.budgetCeilings?.[deal.category];
  const limits = [explicit, profileCeiling].filter((value) => Number.isFinite(value) && value >= 0);
  return limits.length ? Math.min(...limits) : null;
}

function offerIdentity(deal, index) {
  return deal.sku || deal.id || `${deal.partnerOrigin || deal.origin || "unknown"}:${deal.name || index}`;
}

export function offerProvenance(deal = {}) {
  return {
    origin: deal.partnerOrigin || deal.origin || null,
    partnerName: deal.partnerName || deal.merchant || deal.vendor || null,
    sourceType: deal.sourceType || "unknown",
    sourceLabel: deal.sourceLabel || "Source label unavailable",
    observedAt: deal.observedAt || null,
    verification: deal.verificationLabel || "Verification status unavailable",
  };
}

export function evaluateOffer(deal, { profile, preferences } = {}) {
  const price = Number(deal?.dealPrice);
  const ceiling = priceCeiling(deal || {}, profile, preferences);
  if (!Number.isFinite(price) || price < 0) {
    return { eligible: false, eligibilityReason: "Offer has no usable deal price", relevance: "not-evaluated" };
  }
  if (ceiling != null && price > ceiling) {
    return {
      eligible: false,
      eligibilityReason: `Offer price is above the ${ceiling.toFixed(2)} user budget ceiling`,
      relevance: "not-evaluated",
    };
  }
  const categories = new Set(profile?.recurringCategories || []);
  if (!categories.size) {
    return { eligible: true, eligibilityReason: "Within the active budget", relevant: true, relevanceReason: "No category preference is set" };
  }
  if (deal?.category && categories.has(deal.category)) {
    return { eligible: true, eligibilityReason: "Within the active budget", relevant: true, relevanceReason: "Category matches the user profile" };
  }
  return {
    eligible: true,
    eligibilityReason: "Within the active budget",
    relevant: false,
    relevanceReason: deal?.category
      ? "Category is outside the user profile"
      : "Offer did not provide a category for relevance matching",
  };
}

export function filterEligibleDeals(deals, context = {}) {
  return (Array.isArray(deals) ? deals : []).filter((deal) => evaluateOffer(deal, context).eligible);
}

export function rankDeals(deals, preferences = {}) {
  const formats = new Set(preferences.formats || []);
  return [...deals].sort((a, b) => {
    const aCollateral = (a.collateral || []).some((item) => formats.has(item.type)) ? 1 : 0;
    const bCollateral = (b.collateral || []).some((item) => formats.has(item.type)) ? 1 : 0;
    if (aCollateral !== bCollateral) return bCollateral - aCollateral;
    const aDiscount = Number(a.listPrice || 0) - Number(a.dealPrice || 0);
    const bDiscount = Number(b.listPrice || 0) - Number(b.dealPrice || 0);
    if (aDiscount !== bDiscount) return bDiscount - aDiscount;
    const priceDifference = Number(a.dealPrice || 0) - Number(b.dealPrice || 0);
    if (priceDifference !== 0) return priceDifference;
    return String(offerIdentity(a, 0)).localeCompare(String(offerIdentity(b, 0)));
  });
}

export function resolveOfferDeals(deals, { profile, preferences, limit = 12 } = {}) {
  const considered = (Array.isArray(deals) ? deals : []).map((deal, index) => {
    const evaluation = evaluateOffer(deal, { profile, preferences });
    return {
      deal,
      offerId: offerIdentity(deal, index),
      ...evaluation,
      provenance: offerProvenance(deal),
    };
  });
  const eligibleRecords = considered.filter((record) => record.eligible);
  const relevantRecords = eligibleRecords.filter((record) => record.relevant);
  const rankedDeals = rankDeals(relevantRecords.map((record) => record.deal), preferences);
  const ranked = rankedDeals.map((deal, index) => {
    const record = relevantRecords.find((candidate) => candidate.deal === deal);
    return {
      ...deal,
      resolution: {
        offerId: record?.offerId || offerIdentity(deal, index),
        eligibility: record?.eligibilityReason || "Within the active budget",
        relevance: record?.relevanceReason || "Relevant to the user profile",
        rank: index + 1,
      },
      provenance: record?.provenance || offerProvenance(deal),
    };
  });
  const exposed = ranked.slice(0, Math.max(0, Number.isInteger(limit) ? limit : 12));
  const withheld = considered
    .filter((record) => !record.eligible || !record.relevant)
    .map((record) => ({
      offerId: record.offerId,
      origin: record.provenance.origin,
      stage: record.eligible ? "relevance" : "eligibility",
      reason: record.eligible ? record.relevanceReason : record.eligibilityReason,
    }));
  return {
    considered,
    eligible: eligibleRecords.map((record) => record.deal),
    relevant: relevantRecords.map((record) => record.deal),
    ranked,
    exposed,
    withheld,
    reason: preferences?.maxPrice == null
      ? "profile category, budget, and presentation relevance"
      : "profile category, budget, explicit price ceiling, and presentation relevance",
  };
}

export function decisionReceipt({ journey, context, resolution, connectedOrigins = [], originOutcomes = {} }) {
  const origins = [...new Set(connectedOrigins)].map((origin) => ({
    origin,
    status: originOutcomes[origin]?.status || "connected",
    consideredCount: resolution.considered.filter((record) => record.provenance.origin === origin).length,
    eligibleCount: resolution.eligible.filter((deal) => (deal.partnerOrigin || deal.origin) === origin).length,
    exposedCount: resolution.exposed.filter((deal) => deal.provenance?.origin === origin).length,
  }));
  return {
    journeyId: journey.journeyId,
    contextSnapshotId: context.contextSnapshotId,
    capability: "offers.discover@1.0.0",
    policy: "browser-local offer discovery; no business authorization asserted",
    consideredCount: resolution.considered.length,
    eligibleCount: resolution.eligible.length,
    relevantCount: resolution.relevant.length,
    exposedCount: resolution.exposed.length,
    withheldCount: resolution.withheld.length,
    connectedOrigins: [...connectedOrigins],
    origins,
    reason: resolution.reason,
    createdAt: new Date().toISOString(),
  };
}
