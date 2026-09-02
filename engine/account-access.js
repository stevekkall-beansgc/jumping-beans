import { normalizePreferencePlane } from "./preference-plane.mjs";

export const ACCOUNT_DRAFT_KEY = "jumping-beans.account-return.v1";
const RETURN_TTL = 30 * 60 * 1000;
const VIEWS = ["product", "network", "demo"];
const INTENTS = ["save", "import", "profile"];
export const accountIntent = (value) => INTENTS.includes(value) ? value : "save";
export const accountReturnView = (value) => VIEWS.includes(value) ? value : "product";

export function accountGateCopy(intent, signedIn) {
  const purpose = {
    save: "save preferences across devices",
    import: "import browser memory into your account",
    profile: "edit your account profile",
  }[accountIntent(intent)];
  return signedIn
    ? `You can now ${purpose}. Review the details below and choose the action yourself. Signing in never saves or imports automatically.`
    : `Sign in to ${purpose}. Browsing, setup, local drafts, Save and apply in this browser, and Apply once without saving remain available without an account.`;
}

// Render only the user-editable nickname, never the identity provider's name,
// email, token, or arbitrary response/error payload.
export function accountDisplayName(value) {
  return typeof value === "string" && !/@|https?:|bearer\s|(?:token|secret|session|csrf|receipt)[\s:=_-]/i.test(value)
    ? value.slice(0, 120) : "";
}

function draftFields(fields = {}) {
  return Object.fromEntries(["product-category", "product-max-price", "product-style", "product-prompt-input", "product-rule-text", "product-rule-scope", "preview-words-input", "rule-edit-text", "rule-edit-scope"].map((id) => [id, typeof fields[id] === "string" ? fields[id].slice(0, 240) : ""]));
}

export function accountDraftSnapshot(state, fields, now = Date.now()) {
  // Deliberate allowlist: no identity, memory, receipts, applied grants, or
  // authentication values can enter this temporary, tab-local draft.
  return {
    version: 1, createdAt: now, intent: accountIntent(state.accountIntent),
    returnView: accountReturnView(state.accountReturnView),
    returnScroll: Number.isFinite(state.accountReturnScroll) ? Math.max(0, Math.min(state.accountReturnScroll, 10000000)) : 0,
    returnFocus: ["header-account", "product-account-save"].includes(state.accountReturnFocus?.id) ? state.accountReturnFocus.id : "header-account",
    preferences: normalizePreferencePlane(state.preferences),
    editingRuleId: normalizePreferencePlane(state.preferences).rules.some((rule) => rule.id === state.editingRuleId) ? state.editingRuleId : null,
    productStage: ["empty", "saved", "preview"].includes(state.productStage) ? state.productStage : "empty",
    productReturnStage: state.productReturnStage === "saved" ? "saved" : "empty",
    productSetupPath: ["style", "words", "manual", "saved"].includes(state.productSetupPath) ? state.productSetupPath : null,
    productBuilderVisible: state.productBuilderVisible === true,
    fields: draftFields(fields),
  };
}

export function readAccountDraft(storage, now = Date.now()) {
  try {
    const raw = storage.getItem(ACCOUNT_DRAFT_KEY);
    storage.removeItem(ACCOUNT_DRAFT_KEY);
    if (!raw || raw.length > 24000) return null;
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Number.isFinite(value.createdAt) || now < value.createdAt || now - value.createdAt > RETURN_TTL) return null;
    return accountDraftSnapshot({ ...value, accountIntent: value.intent, accountReturnView: value.returnView, accountReturnScroll: value.returnScroll, accountReturnFocus: { id: value.returnFocus } }, value.fields, value.createdAt);
  } catch { return null; }
}
