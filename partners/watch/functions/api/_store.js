// Repository seam for Watch writes. The in-memory implementation is only an
// explicit local-development test seam: KV is deliberately not an authority.
import {
  ACTION_AUDIENCE,
  INTEREST_RETENTION_DAYS,
  INTEREST_RETENTION_MS,
  NON_OUTCOMES,
  randomId,
  redactReceipt,
  receiptFact,
  sha256,
} from "../../action-contract.js";

const local = { pending: new Map(), actions: new Map(), interests: [] };
const grantDigest = (grant) => sha256(`watch-grant:${grant}`);
function localRepository() {
  return {
    async stage(pending) { local.pending.set(pending.grantId, pending); },
    async pending(grantId) { return local.pending.get(grantId) || null; },
    async action(idempotencyKeyDigest) { return local.actions.get(idempotencyKeyDigest) || null; },
    async commit({ pending, receipt, record }) { local.actions.set(receipt.idempotencyKeyDigest, { ...receipt, record }); local.interests.push(record); local.pending.set(pending.grantId, { ...pending, consumedAt: new Date().toISOString() }); },
    async records(product) { return local.interests.filter((record) => record.product === product); },
  };
}
function repository(env) {
  if (env?.WATCH_ACTION_REPOSITORY) return env.WATCH_ACTION_REPOSITORY;
  if (env?.WATCH_WRITE_MODE === "local-development") return localRepository();
  throw Object.assign(new Error("authoritative write storage is unavailable"), { code: "storage-unavailable" });
}
export async function stageInterest(env, action, sessionId, audienceOrigin) {
  const repo = repository(env); const grantId = randomId("grant"); const confirmationGrant = randomId("confirm");
  const pending = { grantId, grantDigest: await grantDigest(confirmationGrant), action, sessionId, audienceOrigin, audiencePath: ACTION_AUDIENCE, issuedAt: new Date().toISOString(), expiresAt: action.expiresAt, consumedAt: null };
  await repo.stage(pending);
  return { grantId, confirmationGrant, expiresAt: pending.expiresAt, authority: env?.WATCH_WRITE_MODE === "local-development" ? "watch-local-development-seam" : "watch-server-authoritative" };
}
export async function commitInterest(env, { action, grantId, confirmationGrant, sessionId, audienceOrigin }) {
  const repo = repository(env); const idempotencyKeyDigest = await sha256(action.idempotencyKey); const prior = await repo.action(idempotencyKeyDigest);
  if (prior) {
    if (prior.semanticPayloadHash !== action.semanticPayloadHash || prior.sessionId !== sessionId || prior.actionId !== action.actionId) return { kind: "conflict" };
    return { kind: "replay", receipt: redactReceipt(prior) };
  }
  const pending = await repo.pending(grantId);
  if (!pending || pending.consumedAt) return { kind: "rejected", status: 403, code: "forged-or-consumed-grant" };
  if (Date.parse(pending.expiresAt) <= Date.now()) return { kind: "rejected", status: 410, code: "expired-grant" };
  if (pending.sessionId !== sessionId || pending.audienceOrigin !== audienceOrigin || pending.audiencePath !== ACTION_AUDIENCE || pending.action.actionId !== action.actionId || pending.action.idempotencyKey !== action.idempotencyKey || pending.action.semanticPayloadHash !== action.semanticPayloadHash || pending.grantDigest !== await grantDigest(confirmationGrant)) return { kind: "rejected", status: 403, code: "confirmation-binding-mismatch" };
  const committedAt = new Date();
  const record = { recordId: randomId("interest"), actionId: action.actionId, product: action.semanticPayload.product, targetPriceMinor: action.semanticPayload.targetPriceMinor, currency: action.semanticPayload.currency, createdAt: committedAt.toISOString(), expiresAt: new Date(committedAt.getTime() + INTEREST_RETENTION_MS).toISOString() };
  const receipt = { receiptId: randomId("receipt"), schemaVersion: "1.0.0", actionId: action.actionId, actionType: action.actionType, capability: action.capability, authority: env?.WATCH_WRITE_MODE === "local-development" ? "watch-local-development-seam" : "watch-server-authoritative", lineage: action.lineage, lineageTrust: "browser-self-attested", semanticPayloadHash: action.semanticPayloadHash, idempotencyKeyDigest, grantId, policyVersion: "1.0.0", status: "committed", storageAuthority: env?.WATCH_WRITE_MODE === "local-development" ? "worker-isolate-test-seam" : "repository", recordId: record.recordId, committedAt: record.createdAt, expiresAt: record.expiresAt, replayed: false, fact: receiptFact(action.semanticPayload), retentionDays: INTEREST_RETENTION_DAYS, nonOutcomes: [...NON_OUTCOMES], sessionId };
  await repo.commit({ pending, receipt, record });
  return { kind: "committed", receipt: redactReceipt(receipt) };
}
export async function summary(env, product) {
  const records = (await repository(env).records(product)).filter((record) => Date.parse(record.expiresAt) > Date.now());
  const prices = records.map((record) => record.targetPriceMinor / 100).sort((a, b) => a - b);
  if (!prices.length) return { count: 0, medianPrice: null, minPrice: null, maxPrice: null, window: `last-${INTEREST_RETENTION_DAYS}-days`, retentionDays: INTEREST_RETENTION_DAYS };
  const mid = Math.floor(prices.length / 2);
  return { count: prices.length, medianPrice: prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2, minPrice: prices[0], maxPrice: prices.at(-1), window: `last-${INTEREST_RETENTION_DAYS}-days`, retentionDays: INTEREST_RETENTION_DAYS };
}
