// Authoritative D1 repository for Watch writes. The injected/local paths are
// test seams only; production with no WATCH_DB fails closed.
import { ACTION_AUDIENCE, INTEREST_RETENTION_DAYS, INTEREST_RETENTION_MS, NON_OUTCOMES, randomId, redactReceipt, receiptFact, sha256 } from "../../action-contract.js";

const local = { pending: new Map(), actions: new Map(), interests: [], sessions: new Map(), rates: new Map() };
const grantDigest = (grant) => sha256(`watch-grant:${grant}`);
const nowIso = () => new Date().toISOString();
const statement = (db, sql, ...bindings) => db.prepare(sql).bind(...bindings);

function localRepository() {
  return {
    kind: "local-development-seam",
    async stage(pending) { local.pending.set(pending.grantId, pending); },
    async pending(grantId) { return local.pending.get(grantId) || null; },
    async action(digest) { return local.actions.get(digest) || null; },
    async commitAtomic({ pending, receipt, record }) {
      if (local.actions.has(receipt.idempotencyKeyDigest)) throw Object.assign(new Error("unique"), { code: "unique" });
      local.actions.set(receipt.idempotencyKeyDigest, receipt); local.interests.push(record); local.pending.set(pending.grantId, { ...pending, consumedAt: nowIso() });
      return { claimed: true };
    },
    async records(product) { return local.interests.filter((record) => record.product === product); },
    async createSession(session) { local.sessions.set(session.sessionDigest, session); },
    async session(digest) { return local.sessions.get(digest) || null; },
    async rate({ bucket, windowStart }) { const key = `${bucket}:${windowStart}`; const count = (local.rates.get(key) || 0) + 1; local.rates.set(key, count); return count; },
  };
}

function d1Repository(db) {
  return {
    kind: "cloudflare-d1",
    async stage(pending) {
      await statement(db, "/* watch:stage */ INSERT INTO watch_pending_actions (grant_id, grant_digest, action_id, idempotency_key_digest, semantic_payload_hash, action_json, session_subject, audience_origin, audience_path, issued_at, expires_at, consumed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)", pending.grantId, pending.grantDigest, pending.action.actionId, pending.idempotencyKeyDigest, pending.action.semanticPayloadHash, JSON.stringify(pending.action), pending.sessionId, pending.audienceOrigin, pending.audiencePath, pending.issuedAt, pending.expiresAt).run();
    },
    async pending(grantId) { return statement(db, "/* watch:pending */ SELECT * FROM watch_pending_actions WHERE grant_id = ?", grantId).first(); },
    async action(digest) {
      const row = await statement(db, "/* watch:action */ SELECT receipt_json, semantic_payload_hash, session_subject, action_id FROM watch_action_receipts WHERE idempotency_key_digest = ?", digest).first();
      return row ? { ...JSON.parse(row.receipt_json), semanticPayloadHash: row.semantic_payload_hash, sessionId: row.session_subject, actionId: row.action_id } : null;
    },
    async commitAtomic({ pending, receipt, record }) {
      const results = await db.batch([
        statement(db, "/* watch:commit-claim */ INSERT INTO watch_action_receipts (idempotency_key_digest, action_id, semantic_payload_hash, session_subject, receipt_json, committed_at) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM watch_pending_actions WHERE grant_id = ? AND grant_digest = ? AND action_id = ? AND idempotency_key_digest = ? AND semantic_payload_hash = ? AND session_subject = ? AND audience_origin = ? AND audience_path = ? AND expires_at > ? AND consumed_at IS NULL)", receipt.idempotencyKeyDigest, receipt.actionId, receipt.semanticPayloadHash, receipt.sessionId, JSON.stringify(redactReceipt(receipt)), receipt.committedAt, pending.grantId, pending.grantDigest, pending.action.actionId, pending.idempotencyKeyDigest, pending.action.semanticPayloadHash, pending.sessionId, pending.audienceOrigin, pending.audiencePath, nowIso()),
        statement(db, "/* watch:commit-consume */ UPDATE watch_pending_actions SET consumed_at = ? WHERE grant_id = ? AND consumed_at IS NULL", nowIso(), pending.grantId),
        statement(db, "/* watch:commit-interest */ INSERT INTO watch_interests (record_id, action_id, product, target_price_minor, currency, created_at, expires_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM watch_action_receipts WHERE idempotency_key_digest = ? AND action_id = ?)", record.recordId, record.actionId, record.product, record.targetPriceMinor, record.currency, record.createdAt, record.expiresAt, receipt.idempotencyKeyDigest, record.actionId),
      ]);
      return { claimed: [0, 1, 2].every((index) => Number(results?.[index]?.meta?.changes || 0) === 1) };
    },
    async records(product) { const rows = await statement(db, "/* watch:summary */ SELECT target_price_minor, expires_at FROM watch_interests WHERE product = ? AND expires_at > ?", product, nowIso()).all(); return rows.results || []; },
    async createSession(session) { await statement(db, "/* watch:session-create */ INSERT INTO watch_write_sessions (session_digest, csrf_digest, audience_origin, created_at, expires_at) VALUES (?, ?, ?, ?, ?)", session.sessionDigest, session.csrfDigest, session.audienceOrigin, session.createdAt, session.expiresAt).run(); },
    async session(digest) { return statement(db, "/* watch:session */ SELECT * FROM watch_write_sessions WHERE session_digest = ?", digest).first(); },
    async rate({ bucket, windowStart }) { const row = await statement(db, "/* watch:rate */ INSERT INTO watch_rate_limits (bucket, window_start, count) VALUES (?, ?, 1) ON CONFLICT(bucket, window_start) DO UPDATE SET count = count + 1 RETURNING count", bucket, windowStart).first(); return Number(row?.count || 0); },
  };
}

function repository(env) {
  if (env?.WATCH_ACTION_REPOSITORY) return env.WATCH_ACTION_REPOSITORY;
  if (env?.WATCH_DB) return d1Repository(env.WATCH_DB);
  if (env?.WATCH_WRITE_MODE === "local-development") return localRepository();
  throw Object.assign(new Error("authoritative write storage is unavailable"), { code: "storage-unavailable" });
}

function publicAuthority(repo) { return repo.kind === "cloudflare-d1" ? "watch-server-authoritative" : "watch-local-development-seam"; }
export async function stageInterest(env, action, sessionId, audienceOrigin) {
  const repo = repository(env); const grantId = randomId("grant"); const confirmationGrant = randomId("confirm"); const idempotencyKeyDigest = await sha256(action.idempotencyKey);
  const pending = { grantId, grantDigest: await grantDigest(confirmationGrant), idempotencyKeyDigest, action, sessionId, audienceOrigin, audiencePath: ACTION_AUDIENCE, issuedAt: nowIso(), expiresAt: action.expiresAt, consumedAt: null };
  await repo.stage(pending);
  return { grantId, confirmationGrant, expiresAt: pending.expiresAt, authority: publicAuthority(repo) };
}

const SESSION_TTL_MS = 30 * 60 * 1000;
export async function createWriteSession(env, { sessionId, csrfToken, audienceOrigin }) {
  const repo = repository(env); const createdAt = new Date();
  const session = { sessionDigest: await sha256(`watch-session:${sessionId}`), csrfDigest: await sha256(`watch-csrf:${csrfToken}`), audienceOrigin, createdAt: createdAt.toISOString(), expiresAt: new Date(createdAt.getTime() + SESSION_TTL_MS).toISOString() };
  await repo.createSession(session); return session;
}
export async function validateWriteSession(env, { sessionId, csrfToken, audienceOrigin }) {
  const record = await repository(env).session(await sha256(`watch-session:${sessionId}`));
  const csrfDigest = await sha256(`watch-csrf:${csrfToken || ""}`);
  if (!record || Date.parse(record.expiresAt || record.expires_at) <= Date.now()) return { ok: false, code: "invalid-session" };
  if ((record.audienceOrigin || record.audience_origin) !== audienceOrigin || (record.csrfDigest || record.csrf_digest) !== csrfDigest) return { ok: false, code: "csrf-or-origin-mismatch" };
  return { ok: true, subject: record.sessionDigest || record.session_digest };
}
export async function takeWriteRateLimit(env, { kind, subject, limit, windowSeconds = 60 }) {
  const windowStart = Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds;
  const count = await repository(env).rate({ bucket: `${kind}:${subject}`, windowStart });
  return { allowed: count <= limit, retryAfter: windowSeconds - Math.floor((Date.now() / 1000) % windowSeconds), count };
}

function normalizePending(row) {
  if (!row) return null;
  return { grantId: row.grantId || row.grant_id, grantDigest: row.grantDigest || row.grant_digest, idempotencyKeyDigest: row.idempotencyKeyDigest || row.idempotency_key_digest, action: row.action || JSON.parse(row.action_json), sessionId: row.sessionId || row.session_subject, audienceOrigin: row.audienceOrigin || row.audience_origin, audiencePath: row.audiencePath || row.audience_path, expiresAt: row.expiresAt || row.expires_at, consumedAt: row.consumedAt || row.consumed_at };
}
export async function commitInterest(env, { action, grantId, confirmationGrant, sessionId, audienceOrigin }) {
  const repo = repository(env); const idempotencyKeyDigest = await sha256(action.idempotencyKey); const prior = await repo.action(idempotencyKeyDigest);
  if (prior) {
    if (prior.semanticPayloadHash !== action.semanticPayloadHash || prior.sessionId !== sessionId || prior.actionId !== action.actionId) return { kind: "conflict" };
    return { kind: "replay", receipt: redactReceipt(prior) };
  }
  const pending = normalizePending(await repo.pending(grantId));
  if (!pending || pending.consumedAt) return { kind: "rejected", status: 403, code: "forged-or-consumed-grant" };
  if (Date.parse(pending.expiresAt) <= Date.now()) return { kind: "rejected", status: 410, code: "expired-grant" };
  if (pending.sessionId !== sessionId || pending.audienceOrigin !== audienceOrigin || pending.audiencePath !== ACTION_AUDIENCE || pending.action.actionId !== action.actionId || pending.action.idempotencyKey !== action.idempotencyKey || pending.action.semanticPayloadHash !== action.semanticPayloadHash || pending.grantDigest !== await grantDigest(confirmationGrant)) return { kind: "rejected", status: 403, code: "confirmation-binding-mismatch" };
  const committedAt = new Date(); const record = { recordId: randomId("interest"), actionId: action.actionId, product: action.semanticPayload.product, targetPriceMinor: action.semanticPayload.targetPriceMinor, currency: action.semanticPayload.currency, createdAt: committedAt.toISOString(), expiresAt: new Date(committedAt.getTime() + INTEREST_RETENTION_MS).toISOString() };
  const receipt = { receiptId: randomId("receipt"), schemaVersion: "1.0.0", actionId: action.actionId, actionType: action.actionType, capability: action.capability, authority: publicAuthority(repo), lineage: action.lineage, lineageTrust: "browser-self-attested", semanticPayloadHash: action.semanticPayloadHash, idempotencyKeyDigest, grantId, policyVersion: "1.0.0", status: "committed", storageAuthority: repo.kind, recordId: record.recordId, committedAt: record.createdAt, expiresAt: record.expiresAt, replayed: false, fact: receiptFact(action.semanticPayload), retentionDays: INTEREST_RETENTION_DAYS, nonOutcomes: [...NON_OUTCOMES], sessionId };
  try {
    const result = await repo.commitAtomic({ pending, receipt, record });
    if (result.claimed) return { kind: "committed", receipt: redactReceipt(receipt) };
  } catch (error) {
    if (error?.code !== "unique" && !/unique|constraint/i.test(String(error?.message || ""))) throw error;
  }
  const claimed = await repo.action(idempotencyKeyDigest);
  if (claimed) return claimed.semanticPayloadHash === action.semanticPayloadHash && claimed.sessionId === sessionId && claimed.actionId === action.actionId ? { kind: "replay", receipt: redactReceipt(claimed) } : { kind: "conflict" };
  return { kind: "rejected", status: 403, code: "confirmation-binding-mismatch" };
}
export async function summary(env, product) {
  const records = await repository(env).records(product); const prices = records.map((record) => (record.targetPriceMinor ?? record.target_price_minor) / 100).sort((a, b) => a - b);
  if (!prices.length) return { count: 0, medianPrice: null, minPrice: null, maxPrice: null, window: `last-${INTEREST_RETENTION_DAYS}-days`, retentionDays: INTEREST_RETENTION_DAYS };
  const mid = Math.floor(prices.length / 2); return { count: prices.length, medianPrice: prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2, minPrice: prices[0], maxPrice: prices.at(-1), window: `last-${INTEREST_RETENTION_DAYS}-days`, retentionDays: INTEREST_RETENTION_DAYS };
}
