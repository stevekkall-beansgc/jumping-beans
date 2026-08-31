// Watch Co — declarative register_interest form handling (SPEC §4b).
// Human and agent-invoked submissions share validation, outcome language, and
// the same 30-day local fallback contract.
import {
  INTEREST_PRODUCTS,
  INTEREST_PRODUCT_SKUS,
  INTEREST_RETENTION_DAYS,
  INTEREST_RETENTION_MS,
  LOCAL_INTEREST_KEY,
  activeInterestRecords,
} from "./interest-products.js";

const form = document.getElementById("interest");
const product = document.getElementById("interest-product");
const msg = document.getElementById("interest-msg");
const submit = document.getElementById("interest-submit");

function requestId() {
  return globalThis.crypto?.randomUUID?.()
    || `watch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

product.replaceChildren(...INTEREST_PRODUCTS.map((item) => {
  const option = document.createElement("option");
  option.value = item.sku;
  option.textContent = item.name;
  return option;
}));

async function store(data) {
  return fetch("/api/register-interest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
}

function readLocal() {
  try {
    return activeInterestRecords(JSON.parse(localStorage.getItem(LOCAL_INTEREST_KEY) || "[]"));
  } catch {
    return [];
  }
}

function storeLocal(data) {
  const pricePoint = Number(data.pricePoint);
  if (!INTEREST_PRODUCT_SKUS.has(data.product)) {
    throw new RangeError("Choose a product from the current Watch Co catalog.");
  }
  if (!Number.isFinite(pricePoint) || pricePoint <= 0) {
    throw new RangeError("Target price must be greater than zero.");
  }
  const createdAt = new Date();
  const existing = readLocal().find((record) => record.requestId && record.requestId === data.requestId);
  if (existing) return existing;
  const record = {
    product: data.product,
    pricePoint,
    requestId: data.requestId || requestId(),
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + INTEREST_RETENTION_MS).toISOString(),
  };
  localStorage.setItem(LOCAL_INTEREST_KEY, JSON.stringify([...readLocal(), record]));
  return record;
}

function show(text, state = "success") {
  if (!msg) return;
  msg.textContent = text;
  msg.dataset.state = state;
  msg.hidden = false;
}

async function action(data) {
  submit.disabled = true;
  submit.setAttribute("aria-busy", "true");
  show("Recording the target price…");
  try {
    const pricePoint = Number(data.pricePoint);
    if (data.confirmed !== "true") {
      throw new Error("Explicit confirmation is required before a demand signal can be recorded.");
    }
    if (!INTEREST_PRODUCT_SKUS.has(data.product)) {
      throw new RangeError("Choose a product from the current Watch Co catalog.");
    }
    if (!Number.isFinite(pricePoint) || pricePoint <= 0) {
      throw new RangeError("Target price must be greater than zero.");
    }

    let response;
    try {
      response = await store({ ...data, pricePoint, confirmed: true, requestId: data.requestId || requestId() });
    } catch {
      response = null;
    }

    if (response?.ok) {
      const body = await response.json();
      show(body.message || `Target price recorded for up to ${INTEREST_RETENTION_DAYS} days. No notification or purchase was created.`);
      return { ok: true, ...body };
    }

    // serve.py deliberately returns 404/501 for API routes. Only those local
    // development responses may use browser storage; server validation errors
    // remain errors and are never disguised as successful local writes.
    if (!response || response.status === 404 || response.status === 501) {
      const recorded = storeLocal({ ...data, pricePoint });
      const message = `Target price recorded in this browser for up to ${INTEREST_RETENTION_DAYS} days. It is a non-binding demand signal; no notification or purchase was created.`;
      show(message);
      return {
        ok: true,
        recorded,
        localFallback: true,
        retentionDays: INTEREST_RETENTION_DAYS,
        message,
      };
    }

    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `The demand store rejected this request (${response.status}).`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The target price was not recorded.";
    show(`${message} No demand signal, notification, or purchase was created.`, "error");
    return { ok: false, error: message, persisted: false };
  } finally {
    submit.disabled = false;
    submit.removeAttribute("aria-busy");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  if (event.agentInvoked) {
    // An agent may stage the declarative action, but it cannot turn its own
    // invocation into a demand signal. The human must review and submit the
    // now-unchecked confirmation control in this page.
    const confirmation = form.elements.namedItem("confirmed");
    if (confirmation) confirmation.checked = false;
    show("The agent staged this target price. Review it and press Record target price to confirm.", "success");
    const staged = Promise.resolve({
      ok: true,
      staged: true,
      persisted: false,
      requiresUserConfirmation: true,
      outcome: "No demand signal was recorded; a person must submit the reviewed form.",
    });
    event.respondWith?.(staged);
    return;
  }
  const result = action(data);
});
