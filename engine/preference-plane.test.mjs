import assert from "node:assert/strict";
import test from "node:test";
import {
  editPreferenceRule,
  effectiveRules,
  forgetPreferenceRule,
  normalizePreferencePlane,
  preferenceSharingPayload,
  reviewPreferencePlane,
  selectStarterStyle,
  setPreferenceRuleActive,
} from "./preference-plane.mjs";

test("starter styles produce deterministic independent drafts", () => {
  assert.deepEqual(selectStarterStyle("compare"), { feedStyle: "compare", formats: ["price-proof", "no-urgency"] });
  assert.deepEqual(selectStarterStyle("unknown"), { feedStyle: "balanced", formats: ["price-proof"] });
  const selected = selectStarterStyle("visual");
  selected.formats.push("no-urgency");
  assert.deepEqual(selectStarterStyle("visual").formats, ["video", "testimonial"]);
});

test("normalization migrates current saved preferences into the safe canonical shape", () => {
  const plane = normalizePreferencePlane({
    feedStyle: "visual",
    category: "  watches  ",
    budget: { maxPrice: 100 },
    presentationFormats: ["video", "video", "unknown"],
    tone: "legacy-field-is-not-retained",
    accountId: "account-secret",
    sessionId: "session-secret",
    rules: [
      { ruleId: "global-proof", description: "Show evidence", scope: "global", state: "active", receiptId: "receipt-secret" },
      { id: "watch-price", key: "price", text: "Keep watches under $100", scope: "for-category", category: " Watches ", paused: true },
      { id: "bad-scope", text: "Must not become global", scope: "private" },
      { id: "missing-category", text: "Must not become global", scope: "category" },
    ],
  });
  assert.deepEqual(plane, {
    feedStyle: "visual",
    category: "watches",
    maxPrice: 100,
    formats: ["video"],
    rules: [
      { id: "global-proof", key: "global-proof", text: "Show evidence", scope: "everywhere", category: "", active: true },
      { id: "watch-price", key: "price", text: "Keep watches under $100", scope: "category", category: "Watches", active: false },
    ],
  });
});

test("category rules override matching global rule keys without hiding independent rules", () => {
  const plane = {
    category: "watches",
    rules: [
      { id: "global-proof", key: "proof", text: "Show evidence", scope: "everywhere" },
      { id: "global-price", key: "price", text: "Prefer lower prices", scope: "everywhere" },
      { id: "watch-price", key: "price", text: "Keep watches under $100", scope: "category", category: "Watches" },
      { id: "watch-video", key: "video", text: "Lead with watch video", scope: "category", category: "watches" },
      { id: "coffee-price", key: "price", text: "Keep coffee under $30", scope: "category", category: "coffee" },
    ],
  };
  assert.deepEqual(effectiveRules(plane).map((rule) => rule.id), ["global-proof", "watch-price", "watch-video"]);
  assert.deepEqual(effectiveRules(plane, "coffee").map((rule) => rule.id), ["global-proof", "coffee-price"]);
  assert.deepEqual(effectiveRules(plane, "tea").map((rule) => rule.id), ["global-proof", "global-price"]);
});

test("pause, edit, and forget affect one rule and never mutate the input", () => {
  const original = normalizePreferencePlane({
    category: "watches",
    rules: [
      { id: "proof", text: "Show proof", scope: "everywhere" },
      { id: "price", text: "Stay under $100", scope: "category", category: "watches" },
    ],
  });
  const paused = setPreferenceRuleActive(original, "proof", false);
  assert.equal(original.rules[0].active, true);
  assert.equal(paused.rules[0].active, false);
  assert.equal(paused.rules[1].active, true);

  const edited = editPreferenceRule(paused, "price", { text: "Stay under $80", receiptId: "ignored" });
  assert.equal(paused.rules[1].text, "Stay under $100");
  assert.equal(edited.rules[1].text, "Stay under $80");
  assert.equal(edited.rules[0].active, false);

  const forgotten = forgetPreferenceRule(edited, "price");
  assert.deepEqual(forgotten.rules.map((rule) => rule.id), ["proof"]);
  assert.equal(edited.rules.length, 2);
});

test("review distinguishes use-once from saved network sharing", () => {
  const plane = normalizePreferencePlane({ category: "coffee", formats: ["price-proof"] });
  const once = reviewPreferencePlane(plane, { save: false });
  const saved = reviewPreferencePlane(plane, { save: true });
  assert.equal(once.mode, "use-once");
  assert.equal(once.persisted, false);
  assert.equal(once.retention, "not saved");
  assert.match(once.sharing, /this visit only/);
  assert.equal(saved.mode, "saved-network");
  assert.equal(saved.persisted, true);
  assert.match(saved.retention, /Forget preferences/);
  assert.match(saved.sharing, /future visits until you pause or revoke/);
});

test("normalized and shared preference payloads redact identity and execution fields", () => {
  const sensitiveValues = ["user-secret", "credential-secret", "session-secret", "grant-secret", "idempotency-secret", "receipt-secret"];
  const input = {
    feedStyle: "compare",
    category: "coffee",
    maxPrice: 45,
    formats: ["price-proof"],
    user: { id: sensitiveValues[0] },
    credential: sensitiveValues[1],
    sessionIdentifier: sensitiveValues[2],
    grantId: sensitiveValues[3],
    idempotencyKey: sensitiveValues[4],
    receiptId: sensitiveValues[5],
    rules: [{ id: "proof", text: "Show price proof", scope: "everywhere", csrfToken: "csrf-secret" }],
  };
  const normalized = normalizePreferencePlane(input);
  const shared = preferenceSharingPayload(input);
  const serialized = JSON.stringify({ normalized, shared });
  for (const secret of [...sensitiveValues, "csrf-secret"]) assert.equal(serialized.includes(secret), false, secret);
  assert.deepEqual(Object.keys(shared), ["feedStyle", "category", "maxPrice", "formats", "rules"]);
  assert.deepEqual(Object.keys(shared.rules[0]), ["text", "scope", "category"]);
});
