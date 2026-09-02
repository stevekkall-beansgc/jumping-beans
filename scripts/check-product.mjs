#!/usr/bin/env node
// Dependency-free, deterministic product gate for all Jumping Beans surfaces.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const failures = [];
let assertions = 0;

function check(condition, message) {
  assertions += 1;
  if (!condition) failures.push(message);
}

function includesAll(text, required, context) {
  for (const value of required) check(text.includes(value), `${context} is missing ${JSON.stringify(value)}`);
}

function runNode(label, args) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    failures.push(`${label} failed:\n${[result.stdout, result.stderr].filter(Boolean).join("\n").trim()}`);
  } else {
    console.log(`✓ ${label}${result.stdout.trim() ? `: ${result.stdout.trim()}` : ""}`);
  }
}

async function filesUnder(directory, extensions) {
  const found = [];
  async function walk(current) {
    for (const name of (await readdir(current)).sort()) {
      if (name === ".git" || name === "node_modules") continue;
      const absolute = path.join(current, name);
      const info = await stat(absolute);
      if (info.isDirectory()) await walk(absolute);
      else if (extensions.has(path.extname(name))) found.push(absolute);
    }
  }
  await walk(directory);
  return found;
}

function rel(absolute) {
  return path.relative(root, absolute);
}

function checkHtml(html, file) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  check(!duplicates.length, `${file} has duplicate IDs: ${duplicates.join(", ")}`);
  for (const match of html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)) {
    check(ids.includes(match[1]), `${file} label points to missing #${match[1]}`);
  }
  includesAll(html, [
    '<html lang="en">',
    '<meta name="viewport"',
    "design-system/tokens.css",
    "design-system/primitives.css",
    "data-product-theme=",
    'class="bl-skip-link"',
    "<main",
    "<h1",
  ], file);
  check(!html.includes("<style"), `${file} contains an inline style block`);
}

runNode("generated UI freshness", ["scripts/sync-static-ui.mjs", "--check"]);
runNode("engine bundle freshness", ["engine/bundle-static.mjs", "--check"]);
runNode("engine identity contracts", ["engine/identity.test.mjs"]);
runNode("personal experience hydration contracts", ["engine/personal-experience.test.mjs"]);

const scriptFiles = [];
for (const directory of ["engine", "partners", "scripts", "shared"]) {
  scriptFiles.push(...await filesUnder(path.join(root, directory), new Set([".js", ".mjs"])));
}
for (const file of scriptFiles.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
  check(result.status === 0, `${rel(file)} JavaScript syntax failed: ${(result.stderr || result.stdout).trim()}`);
}
console.log(`✓ JavaScript syntax (${scriptFiles.length} files)`);

const jsonFiles = [path.join(root, "design-system.source.json")];
for (const directory of ["engine/design-system", "partners", "shared"]) {
  jsonFiles.push(...await filesUnder(path.join(root, directory), new Set([".json"])));
}
for (const file of jsonFiles.sort()) {
  try {
    JSON.parse(await readFile(file, "utf8"));
    check(true, `${rel(file)} JSON parses`);
  } catch (error) {
    check(false, `${rel(file)} JSON failed: ${error.message}`);
  }
}
console.log(`✓ JSON syntax (${jsonFiles.length} files)`);

const surfaceFiles = [
  "engine/index.html",
  "partners/petsupply/index.html",
  "partners/coffee/index.html",
  "partners/watch/index.html",
  "partners/watch/merchant/index.html",
];
const surfaces = new Map();
for (const file of surfaceFiles) {
  const html = await readFile(path.join(root, file), "utf8");
  surfaces.set(file, html);
  checkHtml(html, file);
  for (const match of html.matchAll(/<(?:link|script)[^>]+(?:href|src)="((?:\.\.\/|\.\/)[^"?#]+)"/g)) {
    const asset = path.resolve(root, path.dirname(file), match[1]);
    check(asset.startsWith(root + path.sep), `${file} references an asset outside the product repo`);
    try {
      check((await stat(asset)).isFile(), `${file} local asset is not a file: ${match[1]}`);
    } catch {
      check(false, `${file} references missing local asset ${match[1]}`);
    }
  }
}

const engineHtml = surfaces.get("engine/index.html");
includesAll(engineHtml, [
  "A → your preference → B",
  'id="memory-step"',
  'id="preference-controls"',
  'id="apply-preferences"',
  "Save and apply to Site B",
  'id="apply-once"',
  "Apply once without saving",
  'id="next-step"',
  "Open inventory",
  "Opted-in partner",
  "Before saving",
  "Scope",
  "Retention",
  "Outcome",
  'id="watch-confirmation"',
  'id="confirm-watch"',
  'id="forget-all"',
  'id="account-login"',
  'id="account-import-confirm"',
  "Import selected browser memory",
], "engine consent journey");

const engineApp = await readFile(path.join(root, "engine/app.js"), "utf8");
includesAll(engineApp, [
  "frame.allow = `tools ${origin}; cross-origin-isolated ${origin}`",
  "getTools({ fromOrigins: PARTNER_ORIGINS })",
  "PARTNER_ORIGINS.includes(tool.origin)",
  "executeTool(tool, JSON.stringify(input))",
  'sourceKind === "open"',
  'status: "not-requested"',
  "will not create a substitute partner result",
  "Source and verification",
  "requiresUserConfirmation: true",
  "persisted: false",
  'state.appliedMode = persist ? "saved" : "once"',
  "Apply once creates no persisted preference or offer note",
  "createPartnerFrames();",
  "projectPartnerContext(state.contextSnapshot, origin)",
  "resolvePartnerTools",
  "originOutcomes",
  "comparisonMarkup",
  "No opted-in offer matches this context",
  "get_journey_receipt",
  "profile: PERSONAS[0]",
  "rerunAppliedJourney",
  "appliedJourneyRevision",
  "hydrateAccountJourney",
  "mergeAccountResponse",
  "draftRevision",
  "hasBrowserPersistence",
  "hasMerchantListPrice",
  "% below merchant comparison price",
], "engine WebMCP, provenance, and consent contract");
check(!engineApp.includes("% below list") && !engineApp.includes("Listed price"), "Engine renders an unsupported generic list-price claim");
check(!engineApp.includes("jb_presentation") && !engineApp.includes("jb_memory"), "Engine does not pass preference state through partner URL parameters");
const petsupplyTool = await readFile(path.join(root, "partners/petsupply/tool.js"), "utf8");
const coffeeTool = await readFile(path.join(root, "partners/coffee/tool.js"), "utf8");
const sharedStorefront = await readFile(path.join(root, "shared/storefront.js"), "utf8");
includesAll(petsupplyTool, ["preferencePlane", "normalizePreferencePlane", "jb:preference-plane"], "petsupply preference-plane adapter");
includesAll(coffeeTool, ["preferencePlane", "normalizePreferencePlane", "jb:preference-plane"], "coffee preference-plane adapter");
includesAll(sharedStorefront, ["__JB_PARTNER_CONTEXT__", "preferencePlane", "jb:preference-plane", "relevantRules", "presentationScore"], "shared partner storefront preference-plane contract");
check(!sharedStorefront.includes("jb_presentation"), "shared storefront no longer relies on query-string presentation hints");
includesAll(engineHtml, [
  'id="demo-profile"',
  'value="alex-budget-parent"',
  'value="jamie-gift-shopper"',
  "Use the selected labeled demo profile for this request",
], "engine explicit demo-profile selection contract");
const profileSelectionBlock = engineApp.slice(
  engineApp.indexOf('els.demoProfile?.addEventListener("change"'),
  engineApp.indexOf('document.getElementById("apply-preferences")'),
);
includesAll(profileSelectionBlock, [
  "PERSONAS.find",
  "state.profile =",
  "if (!state.applied)",
  "No profile data will be sent until you enable demo context and apply preferences.",
  "await rerunAppliedJourney()",
], "engine profile selection and applied-journey refresh contract");
check(!profileSelectionBlock.includes("discoverPartnerDeals("), "Draft profile selection directly invokes native partner discovery");
const nativePreferenceToolBlock = engineApp.slice(
  engineApp.indexOf('name: "set_display_preferences"'),
  engineApp.indexOf('name: "build_offer_journey"'),
);
includesAll(nativePreferenceToolBlock, ["markDraftEdited({ preferences: true })", "state.preferences ="], "native preference staging hydration-race contract");
const engineWorker = await readFile(path.join(root, "engine/index.mjs"), "utf8");
includesAll(engineWorker, [
  'headers.set("Permissions-Policy", base.PERMISSIONS)',
  'PERMISSIONS: `tools=(${permissionsPolicy})`',
  'import { handleIdentity } from "./identity.mjs"',
  "const identityResponse = await handleIdentity(request, env);",
], "engine WebMCP response policy");
const identitySource = await readFile(path.join(root, "engine/identity.mjs"), "utf8");
const identityMigration = await readFile(path.join(root, "engine/migrations/0001_identity.sql"), "utf8");
const engineWrangler = await readFile(path.join(root, "engine/wrangler.toml"), "utf8");
includesAll(identitySource, [
  "GOOGLE_OIDC_CLIENT_ID",
  "GOOGLE_OIDC_CLIENT_SECRET",
  "code_challenge_method",
  "nonce",
  "safeReturnPath",
  "token_digest",
  "csrf_digest",
  "explicit-browser-memory-import",
  "import-confirmation-required",
  "origin-rejected",
  "hasPreferences",
  "hasMemory",
], "engine hosted identity contract");
check(!/postMessage|MessagePort|executeTool|getTools/.test(identitySource), "Engine identity introduces a non-native partner bridge or invocation path");
includesAll(identityMigration, ["engine_users", "engine_identities", "engine_sessions", "engine_user_data", "token_digest", "csrf_digest"], "engine identity D1 migration contract");
includesAll(engineWrangler, ["[[d1_databases]]", 'binding = "ENGINE_DB"', "ENGINE_PUBLIC_ORIGIN", "ENGINE_IDENTITY_MODE"], "engine identity D1 binding contract");
const spikeEngine = await readFile(path.join(root, "spikes/a-cross-origin/engine/tool.js"), "utf8");
const spikePartner = await readFile(path.join(root, "spikes/a-cross-origin/partner/tool.js"), "utf8");
const spikeServer = await readFile(path.join(root, "spikes/a-cross-origin/serve.py"), "utf8");
includesAll(spikeEngine, [
  'const PRODUCER_ORIGIN = "http://127.0.0.1:8183"',
  'const TOOL_NAME = "get_items"',
  "const DISCOVERY_ATTEMPTS = 3",
  "const DISCOVERY_RETRY_MS = 250",
  'const useBareAllow = new URL(location.href).searchParams.get("allow") === "bare"',
  '? "tools; cross-origin-isolated"',
  ': `tools ${PRODUCER_ORIGIN}; cross-origin-isolated ${PRODUCER_ORIGIN}`',
  "const modelContextMembers = document.modelContext",
  'const nonNativeMembers = modelContextMembers.filter((member) => member.startsWith("codex"))',
  "nativeSurface: nonNativeMembers.length === 0",
  "non-native modelContext adapter detected",
  'toolchangeSupported: typeof document.modelContext?.addEventListener === "function"',
  'addEventListener("toolchange"',
  "void discoverPartnerTool(evidence)",
  'frame.src = `${PRODUCER_ORIGIN}/`',
  "getTools({ fromOrigins: [PRODUCER_ORIGIN] })",
  "discoveryAttempts.push",
  "document.modelContext.executeTool",
], "minimal native consumer reproduction contract");
includesAll(spikePartner, [
  'const CONSUMER_ORIGIN = "http://127.0.0.1:8182"',
  "const registrationEvidence = {",
  "crossOriginIsolated,",
  'name: "get_items"',
  "document.modelContext.registerTool",
  "{ exposedTo: [CONSUMER_ORIGIN] }",
], "minimal native producer reproduction contract");
includesAll(spikeServer, [
  "if PORT == 8082",
  '"http://127.0.0.1:8084"',
  '"http://127.0.0.1:8085"',
  '"http://127.0.0.1:8086"',
  "f\"tools=(self {LOCAL_ENGINE_PARTNER_ORIGINS})\"",
], "local full-engine response-policy contract");
includesAll(spikeServer, [
  "'tools=(self \"http://127.0.0.1:8183\")'",
  "elif PORT == 8182",
], "minimal native response-policy contract");
includesAll(engineApp, [
  "function observeNativeToolChanges()",
  'document.modelContext.addEventListener("toolchange"',
  "const revision = state.appliedJourneyRevision",
  "if (!state.applied || revision !== state.appliedJourneyRevision) return",
  "observeNativeToolChanges();",
], "engine native toolchange reconciliation contract");
const toolchangeBlock = engineApp.slice(
  engineApp.indexOf("function observeNativeToolChanges()"),
  engineApp.indexOf("function choosePartnerOffer("),
);
check((toolchangeBlock.match(/revision !== state\.appliedJourneyRevision/g) || []).length === 2, "Native toolchange reconciliation does not reject stale pre- and post-discovery results");
const p0Source = await readFile(path.join(root, "engine/p0.js"), "utf8");
includesAll(p0Source, [
  "offers.discover",
  "createJourney",
  "createContextSnapshot",
  "resolveOfferDeals",
  "const categories = new Set(profile?.recurringCategories || [])",
  "decisionReceipt",
  "observedOrInferred: \"observed\"",
], "P0 capability and journey primitives");
check(!p0Source.includes('id: "deal_watch.commit"') && !p0Source.includes("watch_saved"), "Capability catalog still advertises the removed local deal-watch commit");
const p0 = await import(`${pathToFileURL(path.join(root, "engine/p0.js")).href}?check=${Date.now()}`);
const handoffCapability = p0.capabilityFor("deal_watch.stage");
check(handoffCapability?.title === "Stage a Watch Co handoff" && handoffCapability?.outcomeType === "watch_handoff_staged", "Capability catalog does not describe the Watch Co handoff stage");
check(p0.capabilityFor("deal_watch.commit") === null, "Removed local deal-watch commit remains resolvable");
const engineOrigin = "https://engine.invalid";
const discoverGrant = p0.createInvocationGrant({ capabilityId: "offers.discover", audienceOrigin: engineOrigin, scopes: ["offers:read"], purpose: "test-discovery" });
check(p0.authorizeInvocation({ capabilityId: "offers.discover", callerOrigin: engineOrigin, expectedOrigin: engineOrigin, purpose: "test-discovery" }).code === "missing-grant", "Capability boundary permits a missing grant");
check(p0.authorizeInvocation({ capabilityId: "offers.discover", grant: discoverGrant, callerOrigin: "https://other.invalid", expectedOrigin: engineOrigin, purpose: "test-discovery" }).code === "wrong-origin", "Capability boundary permits a wrong origin");
check(p0.authorizeInvocation({ capabilityId: "offers.discover", grant: { ...discoverGrant, scopes: [] }, callerOrigin: engineOrigin, expectedOrigin: engineOrigin, purpose: "test-discovery" }).code === "insufficient-scope", "Capability boundary permits insufficient scope");
check(p0.authorizeInvocation({ capabilityId: "offers.discover", grant: { ...discoverGrant, expiresAt: new Date(0).toISOString() }, callerOrigin: engineOrigin, expectedOrigin: engineOrigin, purpose: "test-discovery" }).code === "expired-grant", "Capability boundary permits an expired grant");
check(p0.authorizeInvocation({ capabilityId: "offers.discover", grant: discoverGrant, callerOrigin: engineOrigin, expectedOrigin: engineOrigin, purpose: "test-discovery" }).allowed, "Capability boundary rejects a valid scoped grant");
const contractDeal = (sku, price, origin) => ({ sku, name: `Offer ${sku}`, category: "coffee", listPrice: price + 10, listPriceSource: "merchant", dealPrice: price, partnerId: origin, partnerName: origin, collateral: [{ type: "price-proof" }] });
const noComparisonDeal = { ...contractDeal("no-comparison", 10, "one"), listPrice: null, listPriceSource: null, collateral: [] };
check(p0.validateOffer(noComparisonDeal), "Partner contract rejects an offer with no merchant comparison price");
check(!p0.validateOffer({ ...noComparisonDeal, listPrice: 12 }), "Partner contract accepts a comparison price without merchant evidence");
check(!p0.validateOffer({ ...noComparisonDeal, collateral: [{ type: "price-proof", text: "unsupported savings" }] }), "Partner contract accepts price-proof collateral without merchant comparison evidence");
check(!p0.validateOffer({ ...contractDeal("bad-comparison", 10, "one"), listPriceSource: null }), "Partner contract accepts a merchant comparison without its source marker");
check(!p0.validateOffer({ ...contractDeal("bad-order", 10, "one"), listPrice: 9 }), "Partner contract accepts a comparison price below the current price");
const contractOrigins = ["https://one.invalid", "https://two.invalid", "https://three.invalid", "https://four.invalid"];
const partnerContract = await p0.resolvePartnerTools({
  tools: contractOrigins.map((origin) => ({ origin, name: "get_matching_deals" })), allowedOrigins: contractOrigins,
  timeoutMs: 10, inputForOrigin: () => ({ categories: [] }), execute: (tool) => {
    if (tool.origin === contractOrigins[1]) return Promise.resolve({ deals: [{ nope: true }] });
    if (tool.origin === contractOrigins[2]) return new Promise(() => {});
    if (tool.origin === contractOrigins[3]) return Promise.reject(new Error("offline"));
    return Promise.resolve({ deals: [contractDeal("one", 20, "one"), contractDeal("two", 10, "one")] });
  },
});
check(partnerContract.deals.length === 2, "Partner adapter drops valid partial results");
check(partnerContract.originOutcomes[contractOrigins[0]].status === "ready", "Partner adapter misses ready outcome");
check(partnerContract.originOutcomes[contractOrigins[1]].status === "invalid", "Partner adapter accepts malformed output");
check(partnerContract.originOutcomes[contractOrigins[2]].status === "timeout", "Partner adapter does not bound a timeout");
check(partnerContract.originOutcomes[contractOrigins[3]].status === "failed", "Partner adapter does not normalize failed partner outcome");
const comparison = p0.resolveOfferDeals([contractDeal("a", 30, "a"), contractDeal("b", 10, "b"), contractDeal("c", 20, "c")], { profile: null, preferences: { formats: [] }, limit: 2 });
check(comparison.exposed.map((deal) => deal.sku).join(",") === "b,c", "Multi-offer comparison ordering is not deterministic");
check(comparison.withheld.some((item) => item.stage === "exposure" && item.offerId === "unattributed:a"), "Comparison truncation is not represented as withholding");
const anonymousContext = p0.createContextSnapshot({ profile: { personaId: "seed", recurringCategories: ["coffee"] }, preferences: { formats: [] }, applied: false });
check(p0.projectPartnerContext(anonymousContext, contractOrigins[0]).fields.categories.length === 0, "Default/demo persona context is transmitted without approval");
const draftDemoContext = p0.createContextSnapshot({ profile: { personaId: "seed", recurringCategories: ["coffee"] }, preferences: { formats: ["video"], maxPrice: 10 }, applied: false, demoContextGranted: true });
check(draftDemoContext.source === "anonymous-browser-context" && draftDemoContext.values.maxPrice == null && !p0.projectPartnerContext(draftDemoContext, contractOrigins[0]).approved, "Draft demo context can reach a partner projection");
const appliedDemoContext = p0.createContextSnapshot({ profile: { personaId: "seed", recurringCategories: ["coffee"] }, preferences: { formats: ["video"], maxPrice: 10 }, applied: true, demoContextGranted: true });
check(appliedDemoContext.source === "explicit-applied-demo-context" && p0.projectPartnerContext(appliedDemoContext, contractOrigins[0]).fields.maxPrice === 10, "Explicit applied demo context is not distinct from anonymous context");
const appliedPreferenceContext = p0.createContextSnapshot({ profile: { personaId: "seed", recurringCategories: ["coffee"] }, preferences: { category: "watches", feedStyle: "compare", formats: ["price-proof"], rules: [{ id: "local-only", text: "Show repair options first", scope: "category", category: "watches" }] }, applied: true });
const appliedPreferenceProjection = p0.projectPartnerContext(appliedPreferenceContext, contractOrigins[0]);
check(appliedPreferenceProjection.approved && appliedPreferenceProjection.fields.categories[0] === "watches" && appliedPreferenceProjection.fields.preferencePlane.rules[0].text === "Show repair options first" && !Object.hasOwn(appliedPreferenceProjection.fields, "maxPrice") && !/personaId|session|credential|receipt|grant|idempotency/i.test(JSON.stringify(appliedPreferenceProjection.fields)), "Native partner projection carries only the approved redacted preference plane");
const sameSkuDifferentOrigins = p0.resolveOfferDeals([
  { ...contractDeal("shared", 10, "one"), origin: contractOrigins[0] },
  { ...contractDeal("shared", 11, "two"), origin: contractOrigins[1] },
], { profile: null, preferences: { formats: [] } });
check(sameSkuDifferentOrigins.considered.length === 2 && new Set(sameSkuDifferentOrigins.considered.map((record) => record.offerId)).size === 2, "Equal SKUs from different origins collapse into one offer identity");
const invalidPartnerResponses = [
  { deals: [{ ...contractDeal("bad-extra", 10, "one"), unexpected: true }] },
  { deals: [{ ...contractDeal("bad-collateral", 10, "one"), collateral: [{ type: "image", nested: { unsafe: true } }] }] },
  { deals: [{ ...contractDeal("bad-string", 10, "one"), name: "x".repeat(p0.PARTNER_STRING_MAX_LENGTH + 1) }] },
];
check(invalidPartnerResponses.every((response) => !p0.validatePartnerEnvelope(response)), "Partner response validation permits unbounded fields or nested collateral");
const offerExpiryCases = ["", null, 0, false, {}, "not-a-date", new Date(Date.now() - 1_000).toISOString(), new Date(Date.now() + 60_000).toUTCString()];
check(offerExpiryCases.every((expiresAt) => !p0.validatePartnerEnvelope({ deals: [{ ...contractDeal("offer-expiry", 10, "one"), expiresAt }] })), "Partner offer accepts absent-like, stale, invalid, typed, or non-canonical expiresAt values");
check(p0.validatePartnerEnvelope({ deals: [{ ...contractDeal("offer-expiry-future", 10, "one"), expiresAt: new Date(Date.now() + 60_000).toISOString() }] }), "Partner offer rejects a canonical future expiresAt value");
const provenanceExpiryCases = ["", null, 0, false, "not-a-date", new Date(Date.now() - 1_000).toISOString(), new Date(Date.now() + 60_000).toUTCString()];
check(provenanceExpiryCases.every((expiresAt) => !p0.validatePartnerEnvelope({ deals: [{ ...contractDeal("provenance-expiry", 10, "one"), provenance: { expiresAt } }] })), "Partner provenance accepts absent-like, stale, invalid, or non-canonical expiry values");
check(p0.validatePartnerEnvelope({ deals: [{ ...contractDeal("provenance-future", 10, "one"), provenance: { expiresAt: new Date(Date.now() + 60_000).toISOString() } }] }), "Partner provenance rejects a canonical future expiry value");
const oversizedDeal = { ...contractDeal("oversized", 10, "one"), name: "n".repeat(p0.PARTNER_STRING_MAX_LENGTH), category: "c".repeat(256), sku: "s".repeat(256), partnerId: "p".repeat(256), partnerName: "p".repeat(256), vendor: "v".repeat(256), source: "s".repeat(256), imageUrl: "https://example.invalid/" + "i".repeat(p0.PARTNER_STRING_MAX_LENGTH - 24), landing: "https://example.invalid/" + "l".repeat(p0.PARTNER_STRING_MAX_LENGTH - 24), collateral: Array.from({ length: p0.PARTNER_COLLATERAL_LIMIT }, () => ({ type: "testimonial", text: "t".repeat(p0.PARTNER_STRING_MAX_LENGTH), source: "s".repeat(p0.PARTNER_STRING_MAX_LENGTH), label: "l".repeat(p0.PARTNER_STRING_MAX_LENGTH), title: "h".repeat(p0.PARTNER_STRING_MAX_LENGTH) })) };
check(!p0.validatePartnerEnvelope({ deals: Array.from({ length: 24 }, () => oversizedDeal) }), "Partner response validation permits an oversized serialized payload");
check(!p0.validatePartnerEnvelope({ deals: [contractDeal("limit-bypass", 10, "one")] }, { maxOffers: 99, maxBytes: Number.MAX_SAFE_INTEGER }), "Partner response validation permits caller-expanded limits");
const boundedInvalidOutcome = await p0.resolvePartnerTools({
  tools: [{ origin: contractOrigins[0], name: "get_matching_deals" }], allowedOrigins: [contractOrigins[0]], inputForOrigin: () => ({ categories: [] }),
  execute: () => Promise.resolve({ deals: [{ ...contractDeal("nested", 10, "one"), collateral: [{ type: "image", nested: { untrusted: true } }] }] }),
});
check(boundedInvalidOutcome.deals.length === 0 && boundedInvalidOutcome.originOutcomes[contractOrigins[0]].status === "invalid", "Bounded invalid partner payload does not produce an honest invalid outcome");
check(p0.isCompatibilityInputError(new TypeError("Expected a JSON string input")), "Serialized-input compatibility error does not permit the native retry");
check(!p0.isCompatibilityInputError(new Error("invalid partner response envelope")) && !p0.isCompatibilityInputError(Object.assign(new Error("Expected a JSON string input"), { name: "SecurityError" })), "Partner validation or security failures are retried as protocol variance");
const dealToolBlock = engineApp.slice(
  engineApp.indexOf('name: "set_deal_watch"'),
  engineApp.indexOf('name: "get_profile"'),
);
const dealHandoffBlock = engineApp.slice(
  engineApp.indexOf("function selectedWatchOffer()"),
  engineApp.indexOf("function showToast("),
);
check(!engineApp.includes("jumping-beans-deal-watches"), "Engine retains a localStorage key for a claimed deal watch");
check(!dealHandoffBlock.includes("writeStored(") && !dealHandoffBlock.includes("localStorage") && !dealHandoffBlock.includes("addMemory("), "Engine deal-watch handoff persists or claims a local watch");
check(!dealHandoffBlock.includes("fetch(") && !dealHandoffBlock.includes("XMLHttpRequest") && !dealHandoffBlock.includes("postMessage") && !dealHandoffBlock.includes("MessagePort") && !dealHandoffBlock.includes("/api/"), "Engine deal-watch handoff uses a non-navigation partner transport");
check(dealToolBlock.includes("prepareDealWatch(targetPrice)"), "set_deal_watch does not stage the page confirmation flow");
includesAll(dealHandoffBlock, [
  "watchHandoffOffers().find",
  'destination.searchParams.set("jb_watch_product", watch.sku)',
  'destination.searchParams.set("jb_target_price", watch.target.toFixed(2))',
  "location.assign(href)",
  "persisted: false",
  "Watch Co handoff URL only",
], "engine Watch Co handoff contract");
const comparisonBlock = engineApp.slice(
  engineApp.indexOf("function isWatchHandoffOffer("),
  engineApp.indexOf("function renderControls()"),
);
includesAll(comparisonBlock, [
  "deal?.partnerOrigin === ORIGINS.watch",
  'id="watch-handoff-offer"',
  "state.selectedWatchOfferId",
  "watchHandoffOffers().find",
  "Nothing was saved, sent, or invoked.",
], "selectable Watch Co handoff-offer contract");
check(!comparisonBlock.includes("discoverPartnerDeals("), "Changing the Watch Co handoff offer invokes partner discovery");
check(!/illustrative (?:fallback|preview)/i.test(engineApp), "Engine agent-facing copy retains fabricated partner fallback language");

const engineConfig = await readFile(path.join(root, "engine/config.js"), "utf8");
includesAll(engineConfig, [
  'RUNTIME_MODE = LOCAL_HOSTS.has(location.hostname) ? "local" : "production"',
  "engine: localOrigin(8082)",
  "petsupply: localOrigin(8084)",
  "coffee: localOrigin(8085)",
  "watch: localOrigin(8086)",
  "ORIGINS = ORIGIN_SETS[RUNTIME_MODE]",
], "engine local/production origin contract");

for (const partner of ["petsupply", "coffee", "watch"]) {
  const file = `partners/${partner}/tool.js`;
  const tool = await readFile(path.join(root, file), "utf8");
  includesAll(tool, [
    "document.modelContext.registerTool",
    'const TOOL_NAME = "get_matching_deals"',
    'RUNTIME_MODE = LOCAL_HOSTS.has(location.hostname) ? "local" : "production"',
    'local: `${location.protocol}//${location.hostname}:8082`',
    "readOnlyHint: true",
    "Array.isArray(categories)",
    "{ exposedTo: [CONCIERGE_ORIGIN] }",
    "provenance:",
    "not independently verified by Jumping Beans",
  ], `${file} origin and offer-tool contract`);
  includesAll(tool, [
    "const MAX_RESPONSE_DEALS = 24",
    ".slice(0, MAX_RESPONSE_DEALS)",
  ], `${file} native response-ceiling contract`);
}

const watchHtml = surfaces.get("partners/watch/index.html");
includesAll(watchHtml, [
  'toolname="register_interest"',
  "toolautosubmit",
  'aria-describedby="interest-hint interest-retention"',
  'min="1"',
  'name="confirmed"',
  'value="true"',
  "up to 30 days",
  "server-owned pending action",
  'id="interest-action"',
  'id="interest-receipt"',
  "Watch Co alone stages, confirms, and records",
  'id="interest-confirmed"',
  "required",
  "disabled",
  'step="0.01"',
], "watch form, confirmation, and retention contract");
const watchInterest = await readFile(path.join(root, "partners/watch/interest.js"), "utf8");
const watchHandoffBlock = watchInterest.slice(
  watchInterest.indexOf("function prefillHandoff()"),
  watchInterest.indexOf("async function request("),
);
includesAll(watchHandoffBlock, [
  "new URLSearchParams(location.search)",
  'query.get("jb_watch_product")',
  'query.get("jb_target_price")',
  "INTEREST_PRODUCT_SKUS.has(handoffProduct)",
  "minorUnits(handoffTargetPrice)",
  "form.elements.pricePoint.value",
  "nothing has been recorded",
], "Watch Co safe handoff prefill contract");
check(!watchHandoffBlock.includes("stage(") && !watchHandoffBlock.includes("request("), "Watch handoff prefill silently stages or commits a demand signal");

const partnerCatalogs = new Map();
for (const partner of ["petsupply", "coffee", "watch"]) {
  const catalog = JSON.parse(await readFile(path.join(root, `partners/${partner}/catalog.json`), "utf8"));
  partnerCatalogs.set(partner, catalog);
  check(catalog.every((deal) =>
    (deal.listPrice === null && deal.listPriceSource === null)
    || (deal.listPriceSource === "merchant" && Number.isFinite(deal.listPrice) && deal.listPrice > deal.dealPrice)
  ), `${partner} catalog contains a comparison price without valid merchant evidence`);
}
const ingestSource = await readFile(path.join(root, "scripts/ingest-feed.mjs"), "utf8");
includesAll(ingestSource, ['listPriceSource: v.compare_at_price ? "merchant" : null', "const hasMerchantListPrice", "listPriceSource: hasMerchantListPrice"], "catalog comparison-price provenance contract");
check(!ingestSource.includes("dealPrice * 1.2"), "Catalog ingestion still fabricates comparison prices");
const storefrontSource = await readFile(path.join(root, "shared/storefront.js"), "utf8");
includesAll(storefrontSource, ['deal.listPriceSource === "merchant"', "% below merchant comparison price"], "storefront comparison-price evidence contract");
check(!storefrontSource.includes("% below list") && !storefrontSource.includes("Listed price"), "Storefront renders an unsupported generic list-price claim");
for (const partner of ["petsupply", "coffee", "watch"]) {
  const toolSource = await readFile(path.join(root, `partners/${partner}/tool.js`), "utf8");
  includesAll(toolSource, ['deal.listPriceSource === "merchant"', "...priceProof", "% below merchant comparison price"], `${partner} WebMCP comparison-price evidence contract`);
  check(!toolSource.includes("% below list price"), `${partner} WebMCP tool emits an unsupported generic list-price claim`);
}
const watchCatalog = partnerCatalogs.get("watch");
const productModule = await import(`${pathToFileURL(path.join(root, "partners/watch/interest-products.js")).href}?check=${Date.now()}`);
const catalogBySku = new Map(watchCatalog.map((item) => [item.sku, item]));
for (const product of productModule.INTEREST_PRODUCTS) {
  const catalog = catalogBySku.get(product.sku);
  check(Boolean(catalog), `Watch interest SKU ${product.sku} is absent from catalog.json`);
  check(catalog?.name === product.name, `Watch interest name for ${product.sku} differs from catalog.json`);
  check(catalog?.dealPrice === product.currentPrice, `Watch interest currentPrice for ${product.sku} differs from catalog.json`);
  check(watchHtml.includes(`value="${product.sku}"`), `Watch form is missing eligible SKU ${product.sku}`);
}
check(productModule.activeInterestRecords([
  { product: productModule.INTEREST_PRODUCTS[0].sku, pricePoint: 10, expiresAt: new Date(Date.now() - 1000).toISOString() },
]).length === 0, "Expired local interest records remain active");

const actionContract = await import(`${pathToFileURL(path.join(root, "partners/watch/action-contract.js")).href}?check=${Date.now()}`);
const stageApi = await import(`${pathToFileURL(path.join(root, "partners/watch/functions/api/stage-interest.js")).href}?check=${Date.now()}`);
const api = await import(`${pathToFileURL(path.join(root, "partners/watch/functions/api/register-interest.js")).href}?check=${Date.now()}`);
const summaryApi = await import(`${pathToFileURL(path.join(root, "partners/watch/functions/api/interest-summary.js")).href}?check=${Date.now()}`);
const sku = productModule.INTEREST_PRODUCTS[0].sku;
const action = await actionContract.stageAction({ payload: { product: sku, pricePoint: "100.50" }, validSkus: productModule.INTEREST_PRODUCT_SKUS, now: Date.now() });
check(action.semanticPayload.targetPriceMinor === 10050 && action.semanticPayloadHash.length === 64, "Watch action normalization or SHA-256 hash is not canonical");
const futureAction = { ...action, stagedAt: new Date(Date.now() + 60_000).toISOString(), expiresAt: new Date(Date.now() + 60_000 + actionContract.STAGE_GRANT_TTL_MS).toISOString() };
check(!actionContract.validateStagedAction(futureAction, { validSkus: productModule.INTEREST_PRODUCT_SKUS }).ok, "Watch action accepts a future stagedAt timestamp");
const impossibleDuration = { ...action, expiresAt: new Date(Date.parse(action.stagedAt) + actionContract.STAGE_GRANT_TTL_MS - 1).toISOString() };
check(!actionContract.validateStagedAction(impossibleDuration, { validSkus: productModule.INTEREST_PRODUCT_SKUS }).ok, "Watch action accepts an impossible staging duration");
check(actionContract.minorUnits("10.999") === null, "Watch action accepts non-canonical minor units");
await Promise.all(["extra", "currency"].map(async (field) => {
  try { actionContract.normalizeInterestPayload({ product: sku, pricePoint: "10.00", [field]: field === "extra" ? true : "EUR" }, { validSkus: productModule.INTEREST_PRODUCT_SKUS }); check(false, "Watch action accepts unknown fields or non-USD currency"); }
  catch { check(true, "Watch action rejects unknown fields and non-USD currency"); }
}));
const apiRequest = (path, body, { origin = "https://watch.invalid", cookie, csrf } = {}) => new Request(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json", origin, ...(cookie ? { cookie } : {}), ...(csrf ? { "x-watch-csrf": csrf } : {}) }, body: JSON.stringify(body) });
async function stagedClient(env, action, origin = "https://watch.invalid") {
  const bootstrap = await stageApi.onRequestPost({ request: apiRequest("/api/stage-interest", { action }, { origin }), env }); const boot = await bootstrap.json();
  const cookie = bootstrap.headers.get("set-cookie");
  const staged = await stageApi.onRequestPost({ request: apiRequest("/api/stage-interest", { action }, { origin, cookie, csrf: boot.csrfToken }), env });
  return { bootstrap, boot, cookie, csrf: boot.csrfToken, staged, body: await staged.json(), origin };
}
const localWriteEnv = { WATCH_WRITE_MODE: "local-development" };
check((await stageApi.onRequestPost({ request: apiRequest("/api/stage-interest", { action }), env: { WATCH_INTEREST: {} } })).status === 403, "Watch staging permits a missing production origin policy");
const stagedClientResult = await stagedClient(localWriteEnv, action);
const stagedResponse = stagedClientResult.staged; const stagedBody = stagedClientResult.body;
check(stagedResponse.status === 201 && stagedBody.confirmationGrant && stagedBody.grantId, "Watch stage does not create a server-owned pending grant");
check((await stageApi.onRequestPost({ request: apiRequest("/api/stage-interest", { action }, { origin: "https://evil.invalid" }), env: localWriteEnv })).status === 403, "Watch stage accepts a wrong local-development origin");
const requestOptions = { origin: stagedClientResult.origin, cookie: stagedClientResult.cookie, csrf: stagedClientResult.csrf };
check((await api.onRequestPost({ request: apiRequest("/api/register-interest", { action, grantId: stagedBody.grantId }, requestOptions), env: localWriteEnv })).status === 401, "Watch commit accepts a missing confirmation grant");
check((await api.onRequestPost({ request: apiRequest("/api/register-interest", { action, grantId: stagedBody.grantId, confirmationGrant: "forged" }, requestOptions), env: localWriteEnv })).status === 403, "Watch commit accepts a forged confirmation grant");
const committedResponse = await api.onRequestPost({ request: apiRequest("/api/register-interest", { action, grantId: stagedBody.grantId, confirmationGrant: stagedBody.confirmationGrant }, requestOptions), env: localWriteEnv });
const committedBody = await committedResponse.json();
check(committedResponse.status === 201 && committedBody.receipt.status === "committed", "Watch commit rejects a staged, payload-bound action");
check(!JSON.stringify(committedBody.receipt).includes(stagedBody.confirmationGrant) && !JSON.stringify(committedBody.receipt).includes(action.idempotencyKey), "Watch receipt exposes a grant or raw idempotency key");
const replayResponse = await api.onRequestPost({ request: apiRequest("/api/register-interest", { action, grantId: stagedBody.grantId, confirmationGrant: stagedBody.confirmationGrant }, requestOptions), env: localWriteEnv });
const replayBody = await replayResponse.json();
check(replayResponse.status === 200 && replayBody.replayed && replayBody.receipt.expiresAt === committedBody.receipt.expiresAt, "Watch same-payload replay changes retention or does not return the original receipt");
const realDateNow = Date.now;
try {
  Date.now = () => Date.parse(action.expiresAt) + 1;
  const expiredReplay = await api.onRequestPost({ request: apiRequest("/api/register-interest", { action, grantId: stagedBody.grantId, confirmationGrant: stagedBody.confirmationGrant }, requestOptions), env: localWriteEnv });
  check(expiredReplay.status === 200 && (await expiredReplay.json()).replayed, "Watch committed-action replay fails after the staging grant expires");
} finally { Date.now = realDateNow; }
const changedAction = { ...action, semanticPayload: { ...action.semanticPayload, targetPriceMinor: 99999 } };
changedAction.semanticPayloadHash = await actionContract.sha256(actionContract.canonicalJson(changedAction.semanticPayload));
check((await api.onRequestPost({ request: apiRequest("/api/register-interest", { action: changedAction, grantId: stagedBody.grantId, confirmationGrant: stagedBody.confirmationGrant }, requestOptions), env: localWriteEnv })).status === 409, "Watch changed-payload replay does not return idempotency conflict");

// This D1-shaped double executes the same prepared-statement/batch contract as
// the production WATCH_DB path. Its batch copies state first, proving rollback
// behavior rather than relying on the non-authoritative local seam.
function d1Double({ failCommit = false } = {}) {
  const state = { pending: new Map(), actions: new Map(), interests: [], sessions: new Map(), rates: new Map() };
  let batchQueue = Promise.resolve();
  const clone = () => ({ pending: new Map([...state.pending].map(([key, value]) => [key, { ...value }])), actions: new Map([...state.actions].map(([key, value]) => [key, { ...value }])), interests: state.interests.map((value) => ({ ...value })), sessions: new Map([...state.sessions].map(([key, value]) => [key, { ...value }])), rates: new Map(state.rates) });
  const execute = async (item, target = state) => {
    const { sql, args } = item;
    if (sql.includes("watch:stage")) { const [grant_id, grant_digest, action_id, idempotency_key_digest, semantic_payload_hash, action_json, session_subject, audience_origin, audience_path, issued_at, expires_at] = args; target.pending.set(grant_id, { grant_id, grant_digest, action_id, idempotency_key_digest, semantic_payload_hash, action_json, session_subject, audience_origin, audience_path, issued_at, expires_at, consumed_at: null }); return { meta: { changes: 1 } }; }
    if (sql.includes("watch:commit-claim")) { const pending = target.pending.get(args[6]); const valid = pending && !pending.consumed_at && pending.grant_digest === args[7] && pending.action_id === args[8] && pending.idempotency_key_digest === args[9] && pending.semantic_payload_hash === args[10] && pending.session_subject === args[11] && pending.audience_origin === args[12] && pending.audience_path === args[13] && pending.expires_at > args[14]; if (!valid) return { meta: { changes: 0 } }; if (target.actions.has(args[0])) throw new Error("UNIQUE constraint failed"); target.actions.set(args[0], { receipt_json: args[4], semantic_payload_hash: args[2], session_subject: args[3], action_id: args[1] }); return { meta: { changes: 1 } }; }
    if (sql.includes("watch:commit-consume")) { const pending = target.pending.get(args[1]); if (pending && !pending.consumed_at) { pending.consumed_at = args[0]; return { meta: { changes: 1 } }; } return { meta: { changes: 0 } }; }
    if (sql.includes("watch:commit-interest")) { if (failCommit) throw new Error("injected interest insert failure"); if (!target.actions.has(args[7])) return { meta: { changes: 0 } }; if (target.interests.some((record) => record.action_id === args[1])) throw new Error("UNIQUE constraint failed"); target.interests.push({ record_id: args[0], action_id: args[1], product: args[2], target_price_minor: args[3], currency: args[4], created_at: args[5], expires_at: args[6] }); return { meta: { changes: 1 } }; }
    if (sql.includes("watch:session-create")) { const [session_digest, csrf_digest, audience_origin, created_at, expires_at] = args; target.sessions.set(session_digest, { session_digest, csrf_digest, audience_origin, created_at, expires_at }); return { meta: { changes: 1 } }; }
    if (sql.includes("watch:rate")) { const key = `${args[0]}:${args[1]}`; const count = (target.rates.get(key) || 0) + 1; target.rates.set(key, count); return { count }; }
    throw new Error(`unexpected D1 statement ${sql}`);
  };
  return {
    state,
    prepare(sql) { return { bind(...args) { return { sql, args, run: () => execute({ sql, args }), first: async () => { if (sql.includes("watch:pending")) return state.pending.get(args[0]) || null; if (sql.includes("watch:action")) return state.actions.get(args[0]) || null; if (sql.includes("watch:session")) return state.sessions.get(args[0]) || null; if (sql.includes("watch:rate")) return execute({ sql, args }); return null; }, all: async () => ({ results: state.interests.filter((record) => record.product === args[0] && record.expires_at > args[1]) }) }; } }; },
    async batch(items) { const run = batchQueue.then(async () => { const copy = clone(); const results = []; for (const item of items) results.push(await execute(item, copy)); state.pending = copy.pending; state.actions = copy.actions; state.interests = copy.interests; state.sessions = copy.sessions; state.rates = copy.rates; return results; }); batchQueue = run.catch(() => {}); return run; },
  };
}
const d1 = d1Double(); const d1Env = { WATCH_DB: d1, WATCH_PUBLIC_ORIGIN: "https://watch.invalid" };
const d1Action = await actionContract.stageAction({ payload: { product: sku, pricePoint: "101.00" }, validSkus: productModule.INTEREST_PRODUCT_SKUS });
const d1Client = await stagedClient(d1Env, d1Action); const d1Stage = d1Client.staged; const d1StageBody = d1Client.body;
check(d1Client.bootstrap.status === 401 && /HttpOnly/.test(d1Client.cookie || "") && /SameSite=Strict/.test(d1Client.cookie || "") && /Secure/.test(d1Client.cookie || ""), "Watch production bootstrap does not issue a Secure HttpOnly SameSite session cookie");
check((await stageApi.onRequestPost({ request: apiRequest("/api/stage-interest", { action: d1Action }, { origin: "https://evil.invalid" }), env: d1Env })).status === 403, "Watch stage accepts a wrong production origin");
const csrfRefresh = await stageApi.onRequestPost({ request: apiRequest("/api/stage-interest", { action: d1Action }, { origin: d1Client.origin, cookie: d1Client.cookie }), env: d1Env });
check(csrfRefresh.status === 401 && (await csrfRefresh.clone().json()).csrfToken && csrfRefresh.headers.has("set-cookie"), "Watch stage cannot safely refresh a missing CSRF token");
check((await api.onRequestPost({ request: apiRequest("/api/register-interest", { action: d1Action, grantId: d1StageBody.grantId, confirmationGrant: d1StageBody.confirmationGrant }, { origin: d1Client.origin }), env: d1Env })).status === 401, "Watch commit accepts a missing session cookie");
check((await api.onRequestPost({ request: apiRequest("/api/register-interest", { action: d1Action, grantId: d1StageBody.grantId, confirmationGrant: d1StageBody.confirmationGrant }, { origin: d1Client.origin, cookie: "__Host-watch-session=forged", csrf: d1Client.csrf }), env: d1Env })).status === 403, "Watch commit accepts an invalid session cookie");
const noContentType = new Request("https://watch.invalid/api/stage-interest", { method: "POST", headers: { origin: "https://watch.invalid" }, body: JSON.stringify({ action: d1Action }) });
check((await stageApi.onRequestPost({ request: noContentType, env: d1Env })).status === 415, "Watch stage accepts a non-JSON content type");
const oversized = new Request("https://watch.invalid/api/stage-interest", { method: "POST", headers: { origin: "https://watch.invalid", "content-type": "application/json" }, body: JSON.stringify({ action: "x".repeat(13 * 1024) }) });
check((await stageApi.onRequestPost({ request: oversized, env: d1Env })).status === 413, "Watch stage accepts an oversized body");
const d1CommitBody = () => ({ action: d1Action, grantId: d1StageBody.grantId, confirmationGrant: d1StageBody.confirmationGrant });
const d1Options = { origin: d1Client.origin, cookie: d1Client.cookie, csrf: d1Client.csrf };
const sameKey = await Promise.all([api.onRequestPost({ request: apiRequest("/api/register-interest", d1CommitBody(), d1Options), env: d1Env }), api.onRequestPost({ request: apiRequest("/api/register-interest", d1CommitBody(), d1Options), env: d1Env })]);
check(sameKey.map((response) => response.status).sort().join(",") === "200,201" && d1.state.interests.length === 1, "D1 batch permits duplicate same-key concurrent interest records");
const d1Changed = { ...d1Action, semanticPayload: { ...d1Action.semanticPayload, targetPriceMinor: 99999 } }; d1Changed.semanticPayloadHash = await actionContract.sha256(actionContract.canonicalJson(d1Changed.semanticPayload));
check((await api.onRequestPost({ request: apiRequest("/api/register-interest", { action: d1Changed, grantId: d1StageBody.grantId, confirmationGrant: d1StageBody.confirmationGrant }, d1Options), env: d1Env })).status === 409, "D1 changed-payload replay does not conflict");
const distinct = await Promise.all(["102.00", "103.00"].map(async (pricePoint) => { const next = await actionContract.stageAction({ payload: { product: sku, pricePoint }, validSkus: productModule.INTEREST_PRODUCT_SKUS }); const staged = await stagedClient(d1Env, next); return api.onRequestPost({ request: apiRequest("/api/register-interest", { action: next, grantId: staged.body.grantId, confirmationGrant: staged.body.confirmationGrant }, { origin: staged.origin, cookie: staged.cookie, csrf: staged.csrf }), env: d1Env }); }));
check(distinct.every((response) => response.status === 201) && d1.state.interests.length === 3, "D1 batch loses distinct concurrent actions");
const pendingBeforeRate = d1.state.pending.size;
for (let index = 0; index < 9; index += 1) { const next = await actionContract.stageAction({ payload: { product: sku, pricePoint: `${110 + index}.00` }, validSkus: productModule.INTEREST_PRODUCT_SKUS }); await stageApi.onRequestPost({ request: apiRequest("/api/stage-interest", { action: next }, d1Options), env: d1Env }); }
const rateAction = await actionContract.stageAction({ payload: { product: sku, pricePoint: "120.00" }, validSkus: productModule.INTEREST_PRODUCT_SKUS });
const stageRateResponse = await stageApi.onRequestPost({ request: apiRequest("/api/stage-interest", { action: rateAction }, d1Options), env: d1Env });
check(stageRateResponse.status === 429 && stageRateResponse.headers.has("retry-after") && d1.state.pending.size === pendingBeforeRate + 9, "Watch stage rate limit does not fail before action mutation");
const failedD1 = d1Double(); const failedEnv = { WATCH_DB: failedD1, WATCH_PUBLIC_ORIGIN: "https://watch.invalid" }; const failedAction = await actionContract.stageAction({ payload: { product: sku, pricePoint: "121.00" }, validSkus: productModule.INTEREST_PRODUCT_SKUS }); const failedClient = await stagedClient(failedEnv, failedAction); const failedOptions = { origin: failedClient.origin, cookie: failedClient.cookie, csrf: failedClient.csrf };
for (let index = 0; index < 5; index += 1) await api.onRequestPost({ request: apiRequest("/api/register-interest", { action: failedAction, grantId: failedClient.body.grantId, confirmationGrant: `forged_${index}` }, failedOptions), env: failedEnv });
const failedRate = await api.onRequestPost({ request: apiRequest("/api/register-interest", { action: failedAction, grantId: failedClient.body.grantId, confirmationGrant: "forged_last" }, failedOptions), env: failedEnv });
check(failedRate.status === 429 && failedRate.headers.has("retry-after") && failedD1.state.interests.length === 0, "Watch failed-grant limiter does not reject before merchant mutation");
const failingD1 = d1Double({ failCommit: true }); const failingEnv = { WATCH_DB: failingD1, WATCH_PUBLIC_ORIGIN: "https://watch.invalid" }; const failingAction = await actionContract.stageAction({ payload: { product: sku, pricePoint: "104.00" }, validSkus: productModule.INTEREST_PRODUCT_SKUS }); const failingClient = await stagedClient(failingEnv, failingAction);
check((await api.onRequestPost({ request: apiRequest("/api/register-interest", { action: failingAction, grantId: failingClient.body.grantId, confirmationGrant: failingClient.body.confirmationGrant }, { origin: failingClient.origin, cookie: failingClient.cookie, csrf: failingClient.csrf }), env: failingEnv })).status === 503 && failingD1.state.interests.length === 0 && !failingD1.state.actions.size, "D1 batch failure does not roll back receipt claim and interest insert");
const expiryD1 = d1Double(); expiryD1.state.interests.push({ product: sku, target_price_minor: 10000, expires_at: new Date(Date.now() - 1000).toISOString() });
const expirySummary = await summaryApi.onRequestGet({ request: new Request(`https://watch.invalid/api/interest-summary?product=${sku}`), env: { WATCH_DB: expiryD1 } });
check(expirySummary.status === 200 && (await expirySummary.json()).count === 0, "D1 summary includes expired interest records");
check((await summaryApi.onRequestGet({ request: new Request(`https://watch.invalid/api/interest-summary?product=${sku}`), env: {} })).status === 503, "D1 summary does not fail closed without the binding");
const migration = await readFile(path.join(root, "partners/watch/migrations/0001_write_actions.sql"), "utf8"); const watchWrangler = await readFile(path.join(root, "partners/watch/wrangler.toml"), "utf8");
includesAll(migration, ["watch_pending_actions", "watch_action_receipts", "watch_interests", "watch_write_sessions", "watch_rate_limits", "UNIQUE", "target_price_minor"], "Watch D1 migration contract");
includesAll(watchWrangler, ["[[d1_databases]]", 'binding = "WATCH_DB"', "WATCH_PUBLIC_ORIGIN", "0001_write_actions.sql"], "Watch D1 binding contract");

const merchantHtml = surfaces.get("partners/watch/merchant/index.html");
includesAll(merchantHtml, [
  "../design-system/tokens.css",
  "../storefront.css",
  "./merchant.css",
  "Source and retention",
  "expire after at most 30 days",
  "not an order, reservation, notification signup",
], "merchant semantic demand surface");

const authoredCssFiles = [
  "engine/app.css",
  "shared/storefront.css",
  "partners/watch/merchant/merchant.css",
];
for (const file of authoredCssFiles) {
  const css = await readFile(path.join(root, file), "utf8");
  includesAll(css, ["var(--bl-color-"], `${file} semantic token use`);
  check(!/(?:#[0-9a-f]{3,8}|rgba?\()/i.test(css), `${file} contains a raw authored color`);
}

const sourceConfig = JSON.parse(await readFile(path.join(root, "design-system.source.json"), "utf8"));
includesAll(JSON.stringify(sourceConfig), ["sourceDir", "sourceRef"], "design-system source config");
const centralDir = path.resolve(root, sourceConfig.sourceDir);
const canonicalJson = await readFile(path.join(centralDir, "tokens.json"), "utf8");
const canonicalCss = await readFile(path.join(centralDir, "tokens.css"), "utf8");
const canonicalPrimitives = await readFile(path.join(centralDir, "primitives.css"), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
for (const deployRoot of ["engine", "partners/petsupply", "partners/coffee", "partners/watch"]) {
  const designRoot = path.join(root, deployRoot, "design-system");
  const [json, css, primitives, manifestText] = await Promise.all([
    readFile(path.join(designRoot, "tokens.json"), "utf8"),
    readFile(path.join(designRoot, "tokens.css"), "utf8"),
    readFile(path.join(designRoot, "primitives.css"), "utf8"),
    readFile(path.join(designRoot, "source.json"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  check(json === canonicalJson, `${deployRoot} does not carry the exact canonical tokens.json`);
  check(css.includes(canonicalCss), `${deployRoot} generated tokens.css omits canonical CSS`);
  check(primitives.includes(canonicalPrimitives), `${deployRoot} generated primitives.css omits canonical CSS`);
  check(manifest.source.ref === sourceConfig.sourceRef, `${deployRoot} token manifest ref differs from source config`);
  check(manifest.artifacts["tokens.json"].sha256 === sha256(canonicalJson), `${deployRoot} JSON hash is not traceable`);
  check(manifest.artifacts["tokens.css"].sha256 === sha256(canonicalCss), `${deployRoot} CSS hash is not traceable`);
  check(manifest.artifacts["primitives.css"].sha256 === sha256(canonicalPrimitives), `${deployRoot} primitives hash is not traceable`);
}
const syncSource = await readFile(path.join(root, "scripts/sync-static-ui.mjs"), "utf8");
includesAll(syncSource, ["--source-dir", "--source-ref", "tokens.json", "primitives.css", "source.json"], "token sync reproducibility inputs");

const scaffoldSource = await readFile(path.join(root, "scripts/scaffold-partner.mjs"), "utf8");
check(!/(?:#[0-9a-f]{3,8}|rgba?\()/i.test(scaffoldSource), "Partner scaffold reintroduces raw authored colors");
check(!/live and verified|verified by the shop/i.test(scaffoldSource), "Partner scaffold reintroduces unsupported verification claims");
includesAll(scaffoldSource, ["design-system/tokens.css", "design-system/primitives.css", "class=\"bl-skip-link\"", "not independently verified by Jumping Beans"], "partner scaffold standard output");
check((scaffoldSource.match(/listPrice: null/g) || []).length === 2 && (scaffoldSource.match(/listPriceSource: null/g) || []).length === 2, "Partner scaffold invents comparison evidence for demo products");

const prohibited = [engineApp, scaffoldSource, await readFile(path.join(root, "shared/storefront.js"), "utf8")];
for (const partner of ["petsupply", "coffee", "watch"]) {
  prohibited.push(await readFile(path.join(root, `partners/${partner}/tool.js`), "utf8"));
}
check(prohibited.every((text) => !/live and verified|verified by the shop/i.test(text)),
  "Product code contains an unsupported verification claim");

const staticModule = await import(`${pathToFileURL(path.join(root, "engine/static.js")).href}?check=${Date.now()}`);
for (const route of [
  "/", "/index.html", "/app.js", "/config.js", "/app.css", "/personal-experience.js",
  "/design-system/tokens.css", "/design-system/tokens.json", "/design-system/source.json", "/design-system/primitives.css",
]) {
  check(route in staticModule.default, `engine/static.js is missing ${route}`);
}

if (failures.length) {
  console.error(`\nProduct check failed (${failures.length} finding${failures.length === 1 ? "" : "s"}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("✓ local/prod origins, WebMCP consent, Watch expiry, design adapters, and provenance");
  console.log(`\nProduct check passed (${assertions} assertions).`);
}
