// Grant-consuming commit endpoint. Stage first at /api/stage-interest.
import { commitInterest } from "./_store.js";
import { authorizeWrite, rateLimit, readJson } from "./_request.js";
import { INTEREST_PRODUCT_SKUS } from "../../interest-products.js";
import { validateStagedAction, verifyActionHash } from "../../action-contract.js";

function json(body, status = 200, headers = {}) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } }); }
export async function onRequestPost({ request, env }) {
  const parsed = await readJson(request, { allowedFields: ["action", "grantId", "confirmationGrant"] });
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, parsed.status);
  const { action, grantId, confirmationGrant } = parsed.body;
  const check = validateStagedAction(action, { validSkus: INTEREST_PRODUCT_SKUS });
  if (!check.ok || !await verifyActionHash(action)) return json({ ok: false, error: check.code || "semantic-payload-mismatch" }, 400);
  if (typeof grantId !== "string" || typeof confirmationGrant !== "string" || grantId.length > 200 || confirmationGrant.length > 200) return json({ ok: false, error: "confirmation-grant-required" }, 401);
  try {
    const auth = await authorizeWrite(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const limited = await rateLimit(env, { kind: "commit", subject: auth.subject, limit: 8 });
    if (!limited.ok) return json({ ok: false, error: limited.error }, limited.status, { "retry-after": String(limited.retryAfter) });
    const result = await commitInterest(env, { action, grantId, confirmationGrant, sessionId: auth.sessionId, audienceOrigin: new URL(request.url).origin });
    if (result.kind === "conflict") return json({ ok: false, error: "idempotency-conflict" }, 409);
    if (result.kind === "rejected") {
      const failed = await rateLimit(env, { kind: "failed-grant", subject: auth.subject, limit: 5 });
      if (!failed.ok) return json({ ok: false, error: failed.error }, failed.status, { "retry-after": String(failed.retryAfter) });
      return json({ ok: false, error: result.code }, result.status);
    }
    const replayed = result.kind === "replay";
    return json({ ok: true, message: replayed ? "The original target-price receipt was returned; retention was not extended." : "Target price recorded as a non-binding demand signal. No notification, purchase, or reservation was created.", receipt: result.receipt, replayed }, replayed ? 200 : 201);
  } catch (error) { return json({ ok: false, error: error?.code || "storage-failed" }, 503); }
}
