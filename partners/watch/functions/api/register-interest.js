// Grant-consuming commit endpoint. Stage first at /api/stage-interest.
import { commitInterest } from "./_store.js";
import { INTEREST_PRODUCT_SKUS } from "../../interest-products.js";
import { validateStagedAction, verifyActionHash } from "../../action-contract.js";

function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } }); }
function session(request) { return request.headers.get("x-watch-session") || ""; }
export async function onRequestPost({ request, env }) {
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: "request body must be JSON" }, 400); }
  if (!body || typeof body !== "object" || Object.keys(body).some((key) => !["action", "grantId", "confirmationGrant"].includes(key))) return json({ ok: false, error: "invalid commit envelope" }, 400);
  const check = validateStagedAction(body.action, { validSkus: INTEREST_PRODUCT_SKUS });
  if (!check.ok || !await verifyActionHash(body.action)) return json({ ok: false, error: check.code || "semantic-payload-mismatch" }, 400);
  if (typeof body.grantId !== "string" || typeof body.confirmationGrant !== "string" || !session(request)) return json({ ok: false, error: "confirmation grant and session are required" }, 401);
  try {
    const result = await commitInterest(env, { action: body.action, grantId: body.grantId, confirmationGrant: body.confirmationGrant, sessionId: session(request), audienceOrigin: new URL(request.url).origin });
    if (result.kind === "conflict") return json({ ok: false, error: "idempotency-conflict" }, 409);
    if (result.kind === "rejected") return json({ ok: false, error: result.code }, result.status);
    const replayed = result.kind === "replay";
    return json({ ok: true, message: replayed ? "The original target-price receipt was returned; retention was not extended." : "Target price recorded as a non-binding demand signal. No notification, purchase, or reservation was created.", receipt: result.receipt, replayed }, replayed ? 200 : 201);
  } catch (error) { return json({ ok: false, error: error?.code || "storage-failed" }, 503); }
}
