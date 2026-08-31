// Canonical, dependency-free contract for Watch Co consequential writes.
// This module is shared by the browser staging flow and Pages Functions.

export const ACTION_SCHEMA_VERSION = "1.0.0";
export const INTEREST_ACTION_TYPE = "interest.record";
export const INTEREST_CAPABILITY = "interest.record@1.0.0";
export const INTEREST_SCOPE = "interest:write";
export const INTEREST_CURRENCY = "USD";
export const INTEREST_RETENTION_DAYS = 30;
export const INTEREST_RETENTION_MS = INTEREST_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const STAGE_GRANT_TTL_MS = 5 * 60 * 1000;
export const ACTION_AUDIENCE = "/api/register-interest";
export const NON_OUTCOMES = Object.freeze(["no-notification", "no-purchase", "no-reservation"]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function validId(value, prefix) { return new RegExp(`^${prefix}_[a-zA-Z0-9_-]{12,160}$`).test(value); }
export function randomId(prefix) { return `${prefix}_${globalThis.crypto?.randomUUID?.()?.replaceAll("-", "") || `${Date.now()}${Math.random().toString(36).slice(2)}`}`; }

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function minorUnits(value) {
  const raw = typeof value === "number" ? value.toFixed(2) : text(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}
export function normalizeInterestPayload(input, { validSkus } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("interest payload must be an object");
  const allowed = new Set(["product", "pricePoint", "currency"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new TypeError("interest payload contains an unknown field");
  const product = text(input.product);
  if (!product || (validSkus && !validSkus.has(product))) throw new RangeError("product must be an eligible Watch Co SKU");
  const targetPriceMinor = minorUnits(input.pricePoint);
  if (targetPriceMinor == null) throw new RangeError("pricePoint must be a positive USD amount with at most two decimal places");
  if ((input.currency || INTEREST_CURRENCY) !== INTEREST_CURRENCY) throw new RangeError("currency must be USD");
  return Object.freeze({ product, targetPriceMinor, currency: INTEREST_CURRENCY, purpose: "non-binding-demand-signal", retentionDays: INTEREST_RETENTION_DAYS, nonOutcomes: [...NON_OUTCOMES] });
}
export async function stageAction({ payload, validSkus, lineage = {}, now = Date.now() }) {
  const semanticPayload = normalizeInterestPayload(payload, { validSkus });
  const semanticPayloadHash = await sha256(canonicalJson(semanticPayload));
  const actionId = randomId("action"); const idempotencyKey = randomId("idem");
  return Object.freeze({ schemaVersion: ACTION_SCHEMA_VERSION, actionType: INTEREST_ACTION_TYPE, capability: INTEREST_CAPABILITY, scope: INTEREST_SCOPE, authority: "watch-server-pending", actionId, idempotencyKey, semanticPayload, semanticPayloadHash, lineage: { journeyId: text(lineage.journeyId) || null, requestId: text(lineage.requestId) || null, stageInvocationId: text(lineage.stageInvocationId) || randomId("stage"), stageEventId: text(lineage.stageEventId) || null, trust: "browser-self-attested" }, stagedAt: new Date(now).toISOString(), expiresAt: new Date(now + STAGE_GRANT_TTL_MS).toISOString() });
}
export function validateStagedAction(action, { validSkus, now = Date.now() } = {}) {
  if (!action || typeof action !== "object" || Array.isArray(action)) return { ok: false, code: "invalid-action" };
  const allowed = new Set(["schemaVersion", "actionType", "capability", "scope", "authority", "actionId", "idempotencyKey", "semanticPayload", "semanticPayloadHash", "lineage", "stagedAt", "expiresAt"]);
  if (Object.keys(action).some((key) => !allowed.has(key))) return { ok: false, code: "invalid-action" };
  if (action.schemaVersion !== ACTION_SCHEMA_VERSION || action.actionType !== INTEREST_ACTION_TYPE || action.capability !== INTEREST_CAPABILITY || action.scope !== INTEREST_SCOPE || !validId(action.actionId, "action") || !validId(action.idempotencyKey, "idem")) return { ok: false, code: "invalid-action" };
  const stagedAt = Date.parse(action.stagedAt); const expiresAt = Date.parse(action.expiresAt);
  if (!Number.isFinite(stagedAt) || !Number.isFinite(expiresAt) || expiresAt <= now || expiresAt - stagedAt > STAGE_GRANT_TTL_MS + 1000) return { ok: false, code: "expired-action" };
  try { normalizeInterestPayload({ product: action.semanticPayload?.product, pricePoint: action.semanticPayload?.targetPriceMinor / 100, currency: action.semanticPayload?.currency }, { validSkus }); } catch { return { ok: false, code: "invalid-action" }; }
  return { ok: true };
}
export async function verifyActionHash(action) { const normalized = normalizeInterestPayload({ product: action.semanticPayload?.product, pricePoint: action.semanticPayload?.targetPriceMinor / 100, currency: action.semanticPayload?.currency }); return (await sha256(canonicalJson(normalized))) === action.semanticPayloadHash; }
export function redactReceipt(receipt) { const { confirmationGrant, idempotencyKey, sessionId, ...safe } = receipt || {}; return safe; }
export function receiptFact(payload) { return `Record interest in ${payload.product} at or below ${(payload.targetPriceMinor / 100).toFixed(2)} ${payload.currency} for up to ${payload.retentionDays} days.`; }
