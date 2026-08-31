// Server-owned pending confirmation grant. This endpoint creates no interest.
import { stageInterest } from "./_store.js";
import { authorizeWrite, rateLimit, readJson } from "./_request.js";
import { INTEREST_PRODUCT_SKUS } from "../../interest-products.js";
import { validateStagedAction, verifyActionHash } from "../../action-contract.js";

function json(body, status = 200, headers = {}) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } }); }
export async function onRequestPost({ request, env }) {
  const parsed = await readJson(request, { allowedFields: ["action"] });
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, parsed.status);
  const check = validateStagedAction(parsed.body.action, { validSkus: INTEREST_PRODUCT_SKUS });
  if (!check.ok || !await verifyActionHash(parsed.body.action)) return json({ ok: false, error: check.code || "semantic-payload-mismatch" }, 400);
  try {
    const auth = await authorizeWrite(request, env, { allowSessionBootstrap: true });
    if (!auth.ok) return json({ ok: false, error: auth.error, ...(auth.csrfToken ? { csrfToken: auth.csrfToken } : {}) }, auth.status, auth.setCookie ? { "set-cookie": auth.setCookie } : {});
    const limited = await rateLimit(env, { kind: "stage", subject: auth.subject, limit: 10 });
    if (!limited.ok) return json({ ok: false, error: limited.error }, limited.status, { "retry-after": String(limited.retryAfter) });
    const staged = await stageInterest(env, parsed.body.action, auth.sessionId, new URL(request.url).origin);
    return json({ ok: true, ...staged, fact: "Review this exact action before confirmation. No demand signal has been recorded." }, 201);
  } catch (error) { return json({ ok: false, error: error?.code || "storage-failed" }, 503); }
}
