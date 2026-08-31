// P0 capability, authorization, resolver, and journey primitives.
// WebMCP tool names adapt into this boundary; they do not bypass it.

export const CAPABILITIES = Object.freeze([
  Object.freeze({ id: "offers.discover", version: "1.0.0", title: "Discover eligible offers", mode: "read", requiredScope: "offers:read", outcomeType: "offer_set_ready" }),
  Object.freeze({ id: "preferences.stage", version: "1.0.0", title: "Stage presentation preferences", mode: "write", requiredScope: "preferences:stage", outcomeType: "preference_staged" }),
  Object.freeze({ id: "preferences.apply", version: "1.0.0", title: "Apply presentation preferences", mode: "write", requiredScope: "preferences:apply", outcomeType: "preference_applied" }),
  Object.freeze({ id: "memory.forget", version: "1.0.0", title: "Forget saved offer memory", mode: "write", requiredScope: "memory:delete", outcomeType: "memory_deleted" }),
  Object.freeze({ id: "deal_watch.stage", version: "1.0.0", title: "Stage a deal watch", mode: "write", requiredScope: "watch:stage", outcomeType: "watch_staged" }),
  Object.freeze({ id: "deal_watch.commit", version: "1.0.0", title: "Commit a browser-local deal watch", mode: "write", requiredScope: "watch:commit", outcomeType: "watch_saved" }),
  Object.freeze({ id: "interest.record", version: "1.0.0", title: "Record Watch Co demand interest", mode: "write", requiredScope: "interest:write", outcomeType: "interest_recorded" }),
]);
export const PARTNER_RESULT_LIMIT = 24;
export const PARTNER_TIMEOUT_MS = 3500;

export function opaqueId(prefix) { const random = globalThis.crypto?.randomUUID?.(); return random ? `${prefix}_${random}` : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
export function createJourney({ intentType, surface = "web", protocol = "webmcp" }) { return { journeyId: opaqueId("journey"), parentRequestId: opaqueId("request"), intentType, intentVersion: "1.0.0", surface, protocol, startedAt: new Date().toISOString(), status: "active" }; }
export function capabilityFor(id, version = "1.0.0") { return CAPABILITIES.find((capability) => capability.id === id && capability.version === version) || null; }

// Grants are purpose-bound, short-lived evidence. Absence is always a denial.
export function createInvocationGrant({ capabilityId, version = "1.0.0", subject = "jumping-beans-web", audienceOrigin, scopes = [], purpose, expiresAt }) {
  const capability = capabilityFor(capabilityId, version);
  if (!capability || !audienceOrigin || !purpose || !scopes.includes(capability.requiredScope)) return null;
  return { grantId: opaqueId("grant"), capabilityId, version, subject, audienceOrigin, scopes: [...new Set(scopes)], purpose, issuedAt: new Date().toISOString(), expiresAt: expiresAt || new Date(Date.now() + 5 * 60_000).toISOString() };
}
export function authorizeInvocation({ capabilityId, version = "1.0.0", grant, callerOrigin, expectedOrigin, purpose, now = Date.now() }) {
  const capability = capabilityFor(capabilityId, version);
  if (!capability) return { allowed: false, code: "unknown-capability" };
  if (!grant) return { allowed: false, code: "missing-grant", capability };
  if (grant.capabilityId !== capabilityId || grant.version !== version) return { allowed: false, code: "wrong-capability", capability };
  if (!callerOrigin || callerOrigin !== expectedOrigin || grant.audienceOrigin !== expectedOrigin) return { allowed: false, code: "wrong-origin", capability };
  if (!Array.isArray(grant.scopes) || !grant.scopes.includes(capability.requiredScope)) return { allowed: false, code: "insufficient-scope", capability };
  if (!grant.purpose || grant.purpose !== purpose) return { allowed: false, code: "wrong-purpose", capability };
  if (!grant.expiresAt || Number.isNaN(Date.parse(grant.expiresAt)) || Date.parse(grant.expiresAt) <= now) return { allowed: false, code: "expired-grant", capability };
  return { allowed: true, code: "allowed", capability, grantId: grant.grantId };
}
export async function invokeCapability({ capabilityId, version = "1.0.0", grant, callerOrigin, expectedOrigin, purpose, input, validateInput = () => true, validateOutput = () => true, handler }) {
  const authorization = authorizeInvocation({ capabilityId, version, grant, callerOrigin, expectedOrigin, purpose });
  if (!authorization.allowed) return { ok: false, authorization };
  if (!validateInput(input)) return { ok: false, authorization, code: "invalid-input" };
  try { const value = await handler(input); return validateOutput(value) ? { ok: true, authorization, value } : { ok: false, authorization, code: "invalid-output" }; }
  catch (error) { return { ok: false, authorization, code: "handler-failed", error }; }
}

export function createContextSnapshot({ profile, preferences, applied, demoContextGranted = false }) {
  const source = demoContextGranted ? "explicit-demo-context" : "anonymous-browser-context";
  return { contextSnapshotId: opaqueId("context"), source, scope: "Jumping Beans product in this browser", capturedAt: new Date().toISOString(), values: { personaId: demoContextGranted ? profile?.personaId || null : null, recurringCategories: demoContextGranted ? [...(profile?.recurringCategories || [])] : [], budgetCeilings: demoContextGranted ? { ...(profile?.budgetCeilings || {}) } : {}, preferredChannels: [], presentationFormats: [...(preferences?.formats || [])], maxPrice: preferences?.maxPrice ?? null, applied: Boolean(applied) }, provenance: { demoContext: demoContextGranted ? "user-approved for this resolution" : "not transmitted", preferences: applied ? "user-entered" : "draft-not-transmitted" }, trust: { userContext: demoContextGranted ? "explicitly-approved-demo-context" : "anonymous", businessAuthorization: "not-provided" } };
}
export function projectPartnerContext(context, origin) {
  const values = context?.values || {}; const approved = context?.provenance?.demoContext === "user-approved for this resolution";
  return { recipient: origin, purpose: "find eligible offer records", retention: "request-only", approved, fields: { categories: approved ? [...(values.recurringCategories || [])] : [], maxPrice: approved && Number.isFinite(values.maxPrice) ? values.maxPrice : undefined }, fieldProvenance: { categories: approved ? "explicit-demo-context" : "not-transmitted", maxPrice: approved ? "user-entered" : "not-transmitted" } };
}
export function createEvent(journey, type, payload = {}) { return { eventId: opaqueId("event"), journeyId: journey.journeyId, occurredAt: new Date().toISOString(), type, source: "jumping-beans-engine", observedOrInferred: "observed", schemaVersion: "1.0.0", ...payload }; }

function normalizedText(value) { return String(value || "").trim().toLocaleLowerCase(); }
function offerIdentity(deal, index) { return normalizedText(deal.gtin || deal.upc || deal.id || deal.sku) || `${normalizedText(deal.merchant || deal.partnerName)}:${normalizedText(deal.name)}:${normalizedText(deal.category)}:${index}`; }
export function offerProvenance(deal = {}) { return { origin: deal.partnerOrigin || deal.origin || null, partnerName: deal.partnerName || deal.merchant || deal.vendor || null, sourceType: deal.sourceType || "unknown", sourceLabel: deal.sourceLabel || "Source label unavailable", observedAt: deal.observedAt || null, verification: deal.verificationLabel || "Verification status unavailable" }; }
export function validateOffer(deal) {
  if (!deal || typeof deal !== "object" || Array.isArray(deal)) return false;
  if (!["sku", "name", "category", "partnerId"].every((key) => typeof deal[key] === "string" && deal[key].trim())) return false;
  if (![deal.listPrice, deal.dealPrice].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) return false;
  if (deal.expiresAt && (Number.isNaN(Date.parse(deal.expiresAt)) || Date.parse(deal.expiresAt) <= Date.now())) return false;
  return !deal.collateral || (Array.isArray(deal.collateral) && deal.collateral.every((item) => item && typeof item.type === "string"));
}
export function validatePartnerEnvelope(value, { maxOffers = PARTNER_RESULT_LIMIT } = {}) { return Boolean(value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.deals) && value.deals.length <= maxOffers && value.deals.every(validateOffer)); }
function timeoutAfter(ms) { return new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("partner deadline exceeded"), { code: "timeout" })), ms)); }
export function isCompatibilityInputError(error) { return /json|string|serializ|argument|input/i.test(String(error?.message || error)); }

// Each origin has an independent deadline. Malformed results never reach ranking.
export async function resolvePartnerTools({ tools, allowedOrigins, execute, inputForOrigin, timeoutMs = PARTNER_TIMEOUT_MS, maxOffers = PARTNER_RESULT_LIMIT, expectedToolName = "get_matching_deals" }) {
  const unique = new Map(); for (const tool of Array.isArray(tools) ? tools : []) if (tool?.origin && !unique.has(tool.origin)) unique.set(tool.origin, tool);
  const origins = [...new Set(allowedOrigins || [])];
  const outcomes = Object.fromEntries(origins.map((origin) => [origin, { status: unique.has(origin) ? "ready" : "failed", count: 0, reason: unique.has(origin) ? "awaiting invocation" : "no exact allowlisted capability" }]));
  const runs = origins.map(async (origin) => {
    const tool = unique.get(origin);
    if (!tool || tool.name !== expectedToolName || tool.origin !== origin) { outcomes[origin] = { status: "failed", count: 0, reason: "unrecognized capability or origin" }; return []; }
    try {
      const raw = await Promise.race([execute(tool, inputForOrigin(origin)), timeoutAfter(timeoutMs)]); const value = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!validatePartnerEnvelope(value, { maxOffers })) { outcomes[origin] = { status: "invalid", count: 0, reason: "invalid partner response envelope" }; return []; }
      outcomes[origin] = { status: value.deals.length ? "ready" : "no-match", count: value.deals.length, reason: value.deals.length ? "validated offers" : "partner returned no matching offers" };
      const observedAt = new Date().toISOString(); return value.deals.map((deal) => ({ ...deal, origin: tool.origin, partnerOrigin: tool.origin, partnerName: deal.partnerName || tool.partnerName || null, sourceType: "opted-in partner", sourceLabel: "WebMCP offer tool", sourceDescription: "The partner opted in to return a validated structured offer record.", observedAt, verificationLabel: "Partner-provided through WebMCP; not independently verified by Jumping Beans" }));
    } catch (error) { outcomes[origin] = { status: error?.code === "timeout" ? "timeout" : "failed", count: 0, reason: error?.code === "timeout" ? "partner response exceeded deadline" : "partner tool invocation failed" }; return []; }
  });
  return { deals: (await Promise.all(runs)).flat(), originOutcomes: outcomes };
}

function priceCeiling(deal, profile, preferences) { const limits = [preferences?.maxPrice, profile?.budgetCeilings?.[deal.category]].filter((value) => Number.isFinite(value) && value >= 0); return limits.length ? Math.min(...limits) : null; }
export function evaluateOffer(deal, { profile, preferences } = {}) { const price = Number(deal?.dealPrice); const ceiling = priceCeiling(deal || {}, profile, preferences); if (!Number.isFinite(price) || price < 0) return { eligible: false, eligibilityReason: "Offer has no usable deal price", relevance: "not-evaluated" }; if (ceiling != null && price > ceiling) return { eligible: false, eligibilityReason: `Offer price is above the ${ceiling.toFixed(2)} user budget ceiling`, relevance: "not-evaluated" }; const categories = new Set(profile?.recurringCategories || []); if (!categories.size) return { eligible: true, eligibilityReason: "Within the active budget", relevant: true, relevanceReason: "No category preference is set" }; if (deal?.category && categories.has(deal.category)) return { eligible: true, eligibilityReason: "Within the active budget", relevant: true, relevanceReason: "Category matches the approved context" }; return { eligible: true, eligibilityReason: "Within the active budget", relevant: false, relevanceReason: deal?.category ? "Category is outside the approved context" : "Offer did not provide a category for relevance matching" }; }
export function filterEligibleDeals(deals, context = {}) { return (Array.isArray(deals) ? deals : []).filter((deal) => evaluateOffer(deal, context).eligible); }
export function rankDeals(deals, preferences = {}) { const formats = new Set(preferences.formats || []); return [...deals].sort((a, b) => { const ac = (a.collateral || []).some((item) => formats.has(item.type)) ? 1 : 0; const bc = (b.collateral || []).some((item) => formats.has(item.type)) ? 1 : 0; if (ac !== bc) return bc - ac; const ad = Number(a.listPrice || 0) - Number(a.dealPrice || 0); const bd = Number(b.listPrice || 0) - Number(b.dealPrice || 0); if (ad !== bd) return bd - ad; if (Number(a.dealPrice || 0) !== Number(b.dealPrice || 0)) return Number(a.dealPrice || 0) - Number(b.dealPrice || 0); return offerIdentity(a, 0).localeCompare(offerIdentity(b, 0)); }); }
export function resolveOfferDeals(deals, { profile, preferences, limit = 12 } = {}) {
  const seen = new Set(); const considered = (Array.isArray(deals) ? deals : []).map((deal, index) => ({ deal, offerId: offerIdentity(deal, index), ...evaluateOffer(deal, { profile, preferences }), provenance: offerProvenance(deal) })).filter((record) => { if (seen.has(record.offerId)) return false; seen.add(record.offerId); return true; });
  const eligibleRecords = considered.filter((record) => record.eligible); const relevantRecords = eligibleRecords.filter((record) => record.relevant);
  const ranked = rankDeals(relevantRecords.map((record) => record.deal), preferences).map((deal, index) => { const record = relevantRecords.find((candidate) => candidate.deal === deal); return { ...deal, resolution: { offerId: record?.offerId || offerIdentity(deal, index), eligibility: record?.eligibilityReason || "Within the active budget", relevance: record?.relevanceReason || "Relevant to the user profile", rank: index + 1 }, provenance: record?.provenance || offerProvenance(deal) }; });
  const exposureLimit = Math.max(0, Number.isInteger(limit) ? limit : 12); const exposed = ranked.slice(0, exposureLimit);
  const withheld = [...considered.filter((record) => !record.eligible || !record.relevant).map((record) => ({ offerId: record.offerId, origin: record.provenance.origin, stage: record.eligible ? "relevance" : "eligibility", reason: record.eligible ? record.relevanceReason : record.eligibilityReason })), ...ranked.slice(exposureLimit).map((deal) => ({ offerId: deal.resolution.offerId, origin: deal.provenance.origin, stage: "exposure", reason: `Withheld by the comparison limit of ${exposureLimit}` }))];
  return { considered, eligible: eligibleRecords.map((record) => record.deal), relevant: relevantRecords.map((record) => record.deal), ranked, exposed, withheld, reason: preferences?.maxPrice == null ? "approved category context, budget, and presentation ranking" : "approved category context, budget, explicit price ceiling, and presentation ranking" };
}
export function decisionReceipt({ journey, context, resolution, connectedOrigins = [], originOutcomes = {} }) {
  const allOrigins = [...new Set([...connectedOrigins, ...Object.keys(originOutcomes)])];
  return { receiptId: opaqueId("receipt"), journeyId: journey.journeyId, requestId: journey.parentRequestId, contextSnapshotId: context.contextSnapshotId, capability: "offers.discover@1.0.0", policy: "browser-local offer discovery; no business authorization asserted", consideredCount: resolution.considered.length, eligibleCount: resolution.eligible.length, relevantCount: resolution.relevant.length, exposedCount: resolution.exposed.length, withheldCount: resolution.withheld.length, connectedOrigins: allOrigins, origins: allOrigins.map((origin) => ({ origin, status: originOutcomes[origin]?.status || "failed", reason: originOutcomes[origin]?.reason || "no invocation outcome", returnedCount: originOutcomes[origin]?.count || 0, consideredCount: resolution.considered.filter((record) => record.provenance.origin === origin).length, eligibleCount: resolution.eligible.filter((deal) => (deal.partnerOrigin || deal.origin) === origin).length, exposedCount: resolution.exposed.filter((deal) => deal.provenance?.origin === origin).length })), reason: resolution.reason, contextDisclosure: { source: context.source, demoContext: context.provenance?.demoContext, retention: "request-only partner projection" }, createdAt: new Date().toISOString() };
}
