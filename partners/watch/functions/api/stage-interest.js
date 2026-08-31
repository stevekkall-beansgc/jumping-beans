// Server-owned pending confirmation grant. This endpoint creates no interest.
import { stageInterest } from "./_store.js";
import { INTEREST_PRODUCT_SKUS } from "../../interest-products.js";
import { validateStagedAction, verifyActionHash } from "../../action-contract.js";

function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } }); }
export async function onRequestPost({ request, env }) {
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: "request body must be JSON" }, 400); }
  const sessionId = request.headers.get("x-watch-session") || "";
  if (!body || Object.keys(body).length !== 1 || !body.action || !sessionId) return json({ ok: false, error: "action and session are required" }, 400);
  const check = validateStagedAction(body.action, { validSkus: INTEREST_PRODUCT_SKUS });
  if (!check.ok || !await verifyActionHash(body.action)) return json({ ok: false, error: check.code || "semantic-payload-mismatch" }, 400);
  try { const staged = await stageInterest(env, body.action, sessionId, new URL(request.url).origin); return json({ ok: true, ...staged, fact: "Review this exact action before confirmation. No demand signal has been recorded." }, 201); }
  catch (error) { return json({ ok: false, error: error?.code || "storage-failed" }, 503); }
}
