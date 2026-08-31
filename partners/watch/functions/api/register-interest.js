// CF Pages Function: POST /api/register-interest (SPEC §4b/4c).
import { addInterest } from "./_store.js";
import { INTEREST_PRODUCT_SKUS } from "../../interest-products.js";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "request body must be JSON" }, 400);
  }
  if (body.confirmed !== true) {
    return json({ ok: false, error: "explicit confirmation is required" }, 400);
  }
  const product = String(body.product || "").trim();
  if (!product) return json({ ok: false, error: "product is required" }, 400);
  if (!INTEREST_PRODUCT_SKUS.has(product)) {
    return json({ ok: false, error: "product must be an eligible SKU from the current Watch Co catalog" }, 400);
  }

  const pricePoint = Number(body.pricePoint);
  if (!Number.isFinite(pricePoint) || pricePoint <= 0) {
    return json({ ok: false, error: "pricePoint must be greater than zero" }, 400);
  }

  const stored = await addInterest(env, product, pricePoint);
  return json({
    ok: true,
    message: `Target price recorded for up to ${stored.retentionDays} days as a non-binding demand signal. No notification or purchase was created.`,
    recorded: stored.record,
    storage: stored.storage,
    retentionDays: stored.retentionDays,
  });
}
