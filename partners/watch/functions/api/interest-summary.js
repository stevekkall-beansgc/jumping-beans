// CF Pages Function: GET /api/interest-summary?product=X (SPEC §4c/4d).
import { summary } from "./_store.js";
import { INTEREST_PRODUCT_SKUS } from "../../interest-products.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const product = url.searchParams.get("product") || "";
  if (!INTEREST_PRODUCT_SKUS.has(product)) {
    return new Response(JSON.stringify({ ok: false, error: "unknown product" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  try {
    return new Response(JSON.stringify(await summary(env, product)), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error?.code || "storage-failed" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}
