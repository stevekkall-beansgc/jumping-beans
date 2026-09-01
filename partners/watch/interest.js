// Watch Co demand signal: stage first, then commit the exact server-bound action.
import { INTEREST_PRODUCTS, INTEREST_PRODUCT_SKUS, INTEREST_RETENTION_DAYS } from "./interest-products.js";
import { minorUnits, stageAction } from "./action-contract.js";

const form = document.getElementById("interest");
const product = document.getElementById("interest-product");
const msg = document.getElementById("interest-msg");
const submit = document.getElementById("interest-submit");
const confirmation = document.getElementById("interest-confirmed");
const actionDetail = document.getElementById("interest-action");
const receiptDetail = document.getElementById("interest-receipt");
const LOCAL_DEVELOPMENT = new URLSearchParams(location.search).get("watch-local-development") === "1";
let csrfToken = null;
let pending = null;

product.replaceChildren(...INTEREST_PRODUCTS.map((item) => { const option = document.createElement("option"); option.value = item.sku; option.textContent = item.name; return option; }));
function show(text, state = "success") { msg.textContent = text; msg.dataset.state = state; msg.hidden = false; }
function prefillHandoff() {
  const query = new URLSearchParams(location.search);
  const handoffProduct = query.get("jb_watch_product");
  const handoffTargetPrice = query.get("jb_target_price");
  if (handoffProduct == null && handoffTargetPrice == null) return;
  const targetMinor = minorUnits(handoffTargetPrice);
  if (!INTEREST_PRODUCT_SKUS.has(handoffProduct) || targetMinor == null) {
    show("The Jumping Beans handoff was incomplete or invalid. Nothing was staged or recorded; choose a Watch Co product and target price to continue.", "error");
    return;
  }
  product.value = handoffProduct;
  form.elements.pricePoint.value = (targetMinor / 100).toFixed(2);
  show("Jumping Beans prefilled this exact product and target price only. Watch Co owns staging, explicit confirmation, and any server persistence; nothing has been recorded.");
}
async function request(path, body) { return fetch(path, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", ...(csrfToken ? { "x-watch-csrf": csrfToken } : {}) }, body: JSON.stringify(body) }); }
function showAction() { actionDetail.hidden = false; actionDetail.textContent = `Action ${pending.action.actionId} is staged until ${new Date(pending.expiresAt).toLocaleTimeString()}. Authority: ${pending.authority}. Review the exact product and price, then confirm.`; }
function showReceipt(receipt, replayed) { receiptDetail.hidden = false; receiptDetail.textContent = `${replayed ? "Original receipt returned" : "Committed"}: ${receipt.status} · ${receipt.authority} · receipt ${receipt.receiptId} · expires ${new Date(receipt.expiresAt).toLocaleDateString()}. No notification, purchase, or reservation was created.`; }
async function stage(data) {
  const action = await stageAction({ payload: { product: data.product, pricePoint: data.pricePoint }, validSkus: INTEREST_PRODUCT_SKUS });
  let response = await request("/api/stage-interest", { action }); let body = await response.json().catch(() => ({}));
  if (response.status === 401 && body.error === "session-initialized" && body.csrfToken) { csrfToken = body.csrfToken; response = await request("/api/stage-interest", { action }); body = await response.json().catch(() => ({})); }
  if (!response.ok) throw new Error(body.error || "The action could not be staged.");
  pending = { action, ...body }; confirmation.checked = false; confirmation.disabled = false; submit.textContent = "Confirm and record target price"; showAction(); show("Action staged. Nothing has been recorded; confirm the exact reviewed action.");
}
async function commit() {
  const response = await request("/api/register-interest", { action: pending.action, grantId: pending.grantId, confirmationGrant: pending.confirmationGrant }); const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `The demand store rejected this request (${response.status}).`);
  showReceipt(body.receipt, body.replayed); show(body.message); pending = null; confirmation.disabled = true; submit.textContent = "Stage another target price";
}
form.addEventListener("submit", async (event) => {
  event.preventDefault(); submit.disabled = true; submit.setAttribute("aria-busy", "true");
  try {
    const data = Object.fromEntries(new FormData(form).entries());
    if (event.agentInvoked) { await stage({ ...data, pricePoint: form.elements.pricePoint.value }); show("The agent staged the action only. A person must review and confirm it in this page."); return; }
    if (!pending) { await stage(data); return; }
    if (!confirmation.checked) throw new Error("Explicit confirmation is required for this exact staged action.");
    await commit();
  } catch (error) {
    // A local substitute is never reported as a merchant write. It is available
    // only by an explicit local-development URL switch for fixture work.
    const message = error instanceof Error ? error.message : "The target price was not recorded.";
    if (LOCAL_DEVELOPMENT && /storage-unavailable|Failed to fetch/.test(message)) show(`Local development mode: server write unavailable. No merchant demand signal was recorded.`, "error");
    else show(`${message} No demand signal, notification, purchase, or reservation was created.`, "error");
  } finally { submit.disabled = false; submit.removeAttribute("aria-busy"); }
});

prefillHandoff();
