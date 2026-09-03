import { interpretPreferenceWords } from "../engine/preference-canvas.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { ACCOUNT_DRAFT_KEY, accountDraftSnapshot, readAccountDraft, accountGateCopy, accountDisplayName, accountIntent, accountReturnView } from "../engine/account-access.js";
import { normalizePreferencePlane, reviewPreferencePlane } from "../engine/preference-plane.mjs";
import { accountJourneyAfterLogout, mergeAccountResponse } from "../engine/personal-experience.js";

const draft = { editingRuleId: "repair", preferences: { feedStyle: "compare", category: "watches", rules: [{ id: "repair", text: "Show repair options", scope: "everywhere" }], sessionId: "private-session" }, account: { user: { email: "private@example.invalid" }, csrfToken: "private-csrf" }, memory: [{ receipt: "private-receipt" }], accountIntent: "import", accountReturnView: "network", productStage: "preview", productSetupPath: "manual", productBuilderVisible: true, applied: true };
const snapshot = accountDraftSnapshot(draft, { "product-rule-text": "Still typing", "rule-edit-text": "Unfinished repair edit", credential: "private-password" }, 1000);
assert.equal(snapshot.preferences.category, "watches");
assert.equal(snapshot.intent, "import");
assert.equal(snapshot.returnView, "network");
assert.equal(snapshot.fields["product-rule-text"], "Still typing");
assert.equal(snapshot.editingRuleId, "repair");
assert.equal(snapshot.fields["rule-edit-text"], "Unfinished repair edit");
assert.equal(accountDraftSnapshot({ ...draft, editingRuleId: "not-a-rule" }).editingRuleId, null);
assert.doesNotMatch(JSON.stringify(snapshot), /private-|csrf|credential|receipt|session|applied/);
const storage = (raw) => ({ value: raw, getItem(key) { assert.equal(key, ACCOUNT_DRAFT_KEY); return this.value; }, removeItem() { this.value = null; } });
const saved = storage(JSON.stringify(snapshot));
assert.equal(readAccountDraft(saved, 2000).preferences.rules[0].text, "Show repair options");
assert.equal(saved.value, null, "return draft is consumed once");
for (const value of ["not-json", JSON.stringify({ ...snapshot, createdAt: -2000000 }), JSON.stringify({ ...snapshot, createdAt: 3000 }), JSON.stringify({ ...snapshot, version: 9 })]) assert.equal(readAccountDraft(storage(value), 2000), null);
assert.equal(readAccountDraft({ getItem() { throw new Error("denied"); } }), null);
assert.equal(accountReturnView("//elsewhere.invalid"), "product");
assert.equal(accountIntent("logout"), "save");
for (const intent of ["save", "import", "profile"]) {
  assert.match(accountGateCopy(intent, false), /Sign in to/);
  assert.match(accountGateCopy(intent, false), /This visit only/);
  assert.match(accountGateCopy(intent, true), /never saves or imports automatically/);
}
assert.equal(accountDisplayName("Friendly nickname"), "Friendly nickname");
for (const name of ["private@example.invalid", "csrf: private-token", "Bearer private-token", "session_id: secret"]) assert.equal(accountDisplayName(name), "");

// Execute the actual account UI/controller functions with a small DOM fixture.
// No partner APIs, browser polyfills, or substitute transports are installed.
const source = readFileSync(new URL("../engine/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../engine/index.html", import.meta.url), "utf8");
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { id, parentElement: { hidden: false }, hidden: false, value: "", textContent: "", dataset: {}, attrs: {}, children: [], listeners: {}, isConnected: true,
    setAttribute(name, value) { this.attrs[name] = value; }, toggleAttribute(name, value) { if (value) this.attrs[name] = ""; else delete this.attrs[name]; },
    replaceChildren(...items) { this.children = items; }, append(item) { this.children.push(item); },
    focus(options) { assert.equal(options?.preventScroll, true); context.focused = this.id; },
    querySelectorAll() { return [node("account-save-profile"), node("account-save-preferences"), node("account-import")]; },
    addEventListener(type, handler) { this.listeners[type] = handler; },
  });
  return nodes.get(id);
}
const els = Object.fromEntries([...source.matchAll(/(\w+): document.getElementById\("([^"]+)"\)/g)].map(([, key, id]) => [key, node(id)]));
let fetches = 0;
let response = { ok: true, status: 200, json: async () => ({ signedIn: false, signInAvailable: true }) };
const state = { ...draft, account: { signedIn: false, error: "" }, accountAvailability: "ready", accountBusy: false, currentView: "product", draftRevision: 3 };
const context = vm.createContext({ state, els, interpretPreferenceWords, accountJourneyAfterLogout, DEFAULT_PREFERENCES: normalizePreferencePlane({}),
  createContextSnapshot: (value) => value, clearCanvasComposer() {}, invalidateAppliedJourney() {}, ACCOUNT_DRAFT_KEY, accountDraftSnapshot, readAccountDraft, accountGateCopy, accountDisplayName, accountIntent, accountReturnView, normalizePreferencePlane, reviewPreferencePlane, mergeAccountResponse,
  AbortSignal,
  document: { getElementById: node, createElement: () => node(`generated-${nodes.size}`), querySelectorAll: () => [] },
  window: { scrollY: 380, scrollTo: ({ top }) => { context.scroll = top; } },
  location: { pathname: "/", search: "" }, history: { pushState: () => { context.pushed = true; } },
  fetch: async () => { fetches++; return response; },
  STORAGE: { memory: "memory" }, readStored: () => [{ title: "Browser note", detail: "Price proof", key: "local" }], hasStored: () => false,
  money: (value) => `$${value}`, renderJourney: () => {}, showToast: (message) => { context.toast = message; },
  switchView: (view) => { state.currentView = view; },
  hydrateAccountJourney: (_account, _revision, protectedDraft) => { context.protectedDraft = protectedDraft; },
});
vm.runInContext(source.slice(source.indexOf("function renderAccount()"), source.indexOf("function addMemory(")), context);
const handlersStart = source.indexOf('els.headerAccount.addEventListener("click"');
vm.runInContext(source.slice(handlersStart, source.indexOf("function registerEngineTools()")), context);
context.renderAccount();
assert.equal(els.headerAccount.textContent, "Sign in");
assert.equal(els.accountDetails.hidden, true);
assert.match(els.accountGateCopy.textContent, /import browser memory/);
await assert.rejects(context.accountRequest("/api/account/profile", {}));
assert.equal(fetches, 0, "anonymous writes never reach the API");
context.openAccount("profile", node("origin"));
assert.equal(state.currentView, "account");
assert.equal(state.accountReturnScroll, 380);
assert.equal(context.pushed, true);
context.returnFromAccount();
assert.equal(state.currentView, "product");
assert.equal(context.scroll, 380);
assert.equal(context.focused, "origin");

state.account = { signedIn: true, csrfToken: "private-csrf", profile: { displayName: "private@example.invalid" }, user: { email: "private@example.invalid", displayName: "private-provider-name" }, memory: [{ receipt: "private-receipt" }] };
context.renderAccount();
assert.equal(els.headerAccount.textContent, "Account");
assert.equal(els.accountDisplayName.value, "");
assert.equal(els.accountDetails.hidden, false);
assert.doesNotMatch(JSON.stringify([...nodes.values()].map(({ textContent, value, attrs }) => ({ textContent, value, attrs }))), /private-/);
node("account-display-name").value = "Draft nickname";
node("account-display-name").listeners.input();
context.renderAccount();
assert.equal(node("account-display-name").value, "Draft nickname");
node("account-import-confirm").checked = false;
await node("account-import").listeners.click();
assert.equal(fetches, 0, "unchecked imports never reach the API");
assert.match(els.accountActionStatus.textContent, /Nothing has been uploaded/);
assert.equal(context.focused, "account-import-confirm");

response = { ok: false, status: 503, json: async () => ({ error: "private-csrf private@example.invalid" }) };
await node("account-save-preferences").listeners.click();
assert.equal(state.accountAvailability, "unavailable");
assert.equal(els.accountRetry.hidden, false);
assert.match(els.accountActionStatus.textContent, /local draft is unchanged/);
assert.doesNotMatch(els.accountActionStatus.textContent, /private-/);
assert.equal(state.preferences.category, "watches");
assert.equal(node("account-display-name").value, "Draft nickname");
assert.equal(node("account-save-preferences").attrs["aria-disabled"], "true");
await context.loadAccount();
assert.equal(els.accountLogin.attrs["aria-disabled"], "true");
assert.equal(els.accountDetails.hidden, true);
let prevented = false;
node("account-login").listeners.click({ preventDefault() { prevented = true; } });
assert.equal(prevented, true, "outage cannot redirect to sign-in");
response = { ok: true, status: 200, json: async () => ({ signedIn: false, signInAvailable: false }) };
await context.loadAccount();
assert.equal(state.accountAvailability, "unavailable", "unconfigured hosted sign-in stays closed");
response = { ok: true, status: 200, json: async () => ({ signedIn: false, signInAvailable: true }) };
await context.loadAccount();
assert.equal(state.accountAvailability, "ready");
assert.equal(els.accountLogin.attrs["aria-disabled"], "false");
response = { ok: true, status: 200, json: async () => ({ signedIn: true, csrfToken: "fixture", hasPreferences: true }) };
state.accountDraftRestored = true;
await context.loadAccount();
assert.equal(context.protectedDraft, true, "account hydration cannot replace the returning draft");
response = { ok: false, status: 401, json: async () => ({ error: "private-session" }) };
await node("account-save-preferences").listeners.click();
assert.equal(state.account.signedIn, false);
assert.equal(state.account.csrfToken, null);
assert.equal(els.accountDetails.hidden, true);
assert.match(els.accountStatus.textContent, /local draft is unchanged/);

state.account = { signedIn: false, error: "" };
state.accountAvailability = "ready";
context.sessionStorage = { setItem() { throw new Error("storage denied"); } };
prevented = false;
node("account-login").listeners.click({ preventDefault() { prevented = true; } });
assert.equal(prevented, true, "blocked tab storage cannot discard a draft on sign-in");
assert.match(els.accountStatus.textContent, /could not keep your draft/);
let savedReturn;
context.sessionStorage = { setItem(key, value) { assert.equal(key, ACCOUNT_DRAFT_KEY); savedReturn = value; } };
prevented = false;
const callsBeforeSignIn = fetches;
node("account-login").listeners.click({ preventDefault() { prevented = true; } });
assert.equal(prevented, false);
assert.equal(fetches, callsBeforeSignIn, "preparing sign-in does not perform account writes");
assert.doesNotMatch(savedReturn, /private-|csrf|credential|receipt|session/);
context.sessionStorage = storage(savedReturn);
context.restoreAccountDraft();
assert.equal(state.accountDraftRestored, true);
assert.equal(state.preferences.category, "watches");
assert.equal(state.productReviewState, "review", "restoring a draft never restores apply consent");
assert.equal(context.sessionStorage.value, null);

assert.ok(html.indexOf('id="header-account"') < html.indexOf("</header>"));
assert.ok(html.indexOf('id="account-login"') > html.indexOf('id="account-view"'));
assert.ok(!html.slice(html.indexOf('id="demo-view"'), html.indexOf('id="account-view"')).includes('id="account-login"'));
assert.match(html, /id="account-back" href="#product"/);
assert.match(html, /returnTo=%2F%23account/);
assert.doesNotMatch(html, /role="tablist"|data-engine-tab/);
const canvasReturn = accountDraftSnapshot({ ...draft, productStage: "results", canvasRuleId: "repair", canvasRetention: "saved", appliedPreferences: draft.preferences }, { "product-prompt-input": "under $200 or below $80" }, 1000);
assert.equal(canvasReturn.productStage, "results");
assert.equal(canvasReturn.canvasRuleId, "repair");
assert.equal(canvasReturn.canvasRetention, "saved");
assert.equal(canvasReturn.resultSelection.category, "watches");
assert.doesNotMatch(JSON.stringify(canvasReturn), /private-|csrf|receipt|applied|grant/);
const recovered = readAccountDraft(storage(JSON.stringify(canvasReturn)), 1500);
assert.equal(recovered.productStage, "results");
assert.equal(recovered.resultSelection.category, "watches");
context.sessionStorage=storage(JSON.stringify({...canvasReturn, createdAt:Date.now()}));
context.restoreAccountDraft();
assert.equal(state.canvasRuleId, "repair");
assert.ok(state.canvasClarification, "ambiguous words remain blocked after sign-in");
assert.equal(state.canvasRetention, "saved");
assert.equal(state.canvasReturnSelection.category, "watches");

// A corrected summary must survive redirect and unrelated edits to preserved prose.
const correctedReturn = accountDraftSnapshot({ ...draft, preferences: { ...draft.preferences, category: "coffee", maxPrice: 80 }, canvasRuleId: "repair" }, { "product-prompt-input": "Shopping for watches under $200. Show repair options" });
context.sessionStorage=storage(JSON.stringify(correctedReturn));
context.restoreAccountDraft();
assert.equal(state.preferences.category,"coffee", "corrected category restores before further typing");
context.markDraftEdited=()=>{}; context.renderProductReview=()=>{}; context.opaqueId=()=>"repair";
context.normalizePreferencePlane=(value)=>normalizePreferencePlane(JSON.parse(JSON.stringify(value)));
vm.runInContext(source.slice(source.indexOf("function updateCanvasWords()"), source.indexOf("function setCanvasEntryMode(")), context);
els.canvasWords.value += " first";
context.updateCanvasWords();
assert.equal(state.preferences.category,"coffee");
assert.equal(state.preferences.maxPrice,80);
els.canvasWords.value=els.canvasWords.value.replace("$200","$100");
context.updateCanvasWords();
assert.equal(state.preferences.category,"coffee");
assert.equal(state.preferences.maxPrice,100);

state.account={signedIn:true,csrfToken:"fixture"};state.accountAvailability="ready";
state.preferenceSource="account";state.memorySource="account";state.savedPreferences=draft.preferences;state.hasSavedPreferences=true;
response={ok:true,status:200,json:async()=>({signedIn:false})};
await node("account-logout").listeners.click();
assert.equal(state.savedPreferences,null,"account-only saved selection cannot survive logout");
assert.equal(state.hasSavedPreferences,false);
assert.equal(state.applied,false);
assert.equal(state.canvasReturnSelection,null);

console.log("account access contracts pass (draft return, privacy, gates, controls, unavailable service)");
