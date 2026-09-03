// Jumping Beans — agent-led offer memory journey.
// Open/public inventory is the baseline. Opted-in partner tools demonstrate
// the richer offer structure and presentation control WebMCP makes possible.

import {
  ORIGINS,
  PARTNER_ORIGINS,
  PARTNER_NAMES,
  TOOL_NAMES,
  PERSONAS,
  SUPPORTED,
} from "./config.js";
import {
  CAPABILITIES,
  createInvocationGrant,
  createContextSnapshot,
  createEvent,
  createJourney,
  decisionReceipt,
  invokeCapability,
  isCompatibilityInputError,
  opaqueId,
  projectPartnerContext,
  resolvePartnerTools,
  resolveOfferDeals,
} from "./p0.js";
import { accountJourneyAfterLogout, accountJourneyHydration, accountMemoryAfterForget, mergeAccountResponse } from "./personal-experience.js";
import { normalizePreferencePlane, reviewPreferencePlane, selectStarterStyle, STARTER_STYLES } from "./preference-plane.mjs";

import { partnerHandoffUrl, previewPartnerHandoff } from "./preference-handoff.mjs";

import { canvasDraft, interpretPreferenceWords, selectionSummary, canvasResultState } from "./preference-canvas.mjs";

import { ACCOUNT_DRAFT_KEY, accountDraftSnapshot, readAccountDraft, accountGateCopy, accountDisplayName, accountIntent, accountReturnView } from "./account-access.js";

const els = {
  headerAccount: document.getElementById("header-account"),
  accountView: document.getElementById("account-view"),
  accountTitle: document.getElementById("account-title"),
  accountBack: document.getElementById("account-back"),
  accountContinue: document.getElementById("account-continue"),
  accountBadge: document.getElementById("account-badge"),
  accountGateTitle: document.getElementById("account-gate-title"),
  accountGateCopy: document.getElementById("account-gate-copy"),
  accountDraftNotice: document.getElementById("account-draft-notice"),
  accountRetry: document.getElementById("account-retry"),
  accountPreferencePreview: document.getElementById("account-preference-preview"),
  accountImportPreview: document.getElementById("account-import-preview"),
  accountImportProfile: document.getElementById("account-import-profile"),
  status: document.getElementById("status"),
  statusDot: document.getElementById("status-dot"),
  protocol: document.getElementById("protocol-badge"),
  sourceCount: document.getElementById("source-count"),
  browserReadiness: document.getElementById("browser-readiness"),
  agent: document.getElementById("agent-message"),
  memoryStep: document.getElementById("memory-step"),
  nextStep: document.getElementById("next-step"),
  controls: document.getElementById("preference-controls"),
  memoryPreview: document.getElementById("memory-preview-text"),
  memoryOutcome: document.getElementById("memory-outcome"),
  rules: document.getElementById("rules"),
  memoryCue: document.getElementById("memory-cue"),
  memoryList: document.getElementById("memory-list"),
  forgetAll: document.getElementById("forget-all"),
  watchTitle: document.getElementById("watch-title"),
  watchDetail: document.getElementById("watch-detail"),
  watchButton: document.getElementById("watch-button"),
  watchConfirmation: document.getElementById("watch-confirmation"),
  watchFact: document.getElementById("watch-fact"),
  confirmWatch: document.getElementById("confirm-watch"),
  cancelWatch: document.getElementById("cancel-watch"),
  prompt: document.getElementById("prompt"),
  demoContext: document.getElementById("demo-context"),
  demoProfile: document.getElementById("demo-profile"),
  accountStatus: document.getElementById("account-status"),
  accountActionStatus: document.getElementById("account-action-status"),
  accountLogin: document.getElementById("account-login"),
  accountDetails: document.getElementById("account-details"),
  accountDisplayName: document.getElementById("account-display-name"),
  accountSaveProfile: document.getElementById("account-save-profile"),
  accountSavePreferences: document.getElementById("account-save-preferences"),
  accountImportConfirm: document.getElementById("account-import-confirm"),
  accountImport: document.getElementById("account-import"),
  accountMemorySummary: document.getElementById("account-memory-summary"),
  accountForgetMemory: document.getElementById("account-forget-memory"),
  accountForgetProfile: document.getElementById("account-forget-profile"),
  accountLogout: document.getElementById("account-logout"),
  toast: document.getElementById("toast"),
  engineHeader: document.getElementById("engine-header"),
  productHero: document.getElementById("product-hero"),
  productView: document.getElementById("product-view"),
  demoView: document.getElementById("demo-view"),
  savedPreferenceActions: document.getElementById("saved-preference-actions"),
  savedPreferenceNote: document.getElementById("saved-preference-note"),
  savedSelectionSummary: document.getElementById("saved-selection-summary"),
  productReviewSaved: document.getElementById("product-review-saved"),
  productStartFresh: document.getElementById("product-start-fresh"),
  productForgetSaved: document.getElementById("product-forget-saved"),
  productBuilder: document.getElementById("product-builder"),
  productForm: document.getElementById("product-preferences-form"),
  productPreviewRetention: document.getElementById("product-preview-retention"),
  productCategory: document.getElementById("product-category"),
  productMaxPrice: document.getElementById("product-max-price"),
  productStyle: document.getElementById("product-style"),
  productRuleForm: document.getElementById("product-rule-form"),
  productRuleText: document.getElementById("product-rule-text"),
  productRuleScope: document.getElementById("product-rule-scope"),
  productRuleList: document.getElementById("product-rule-list"),
  productReview: document.getElementById("product-preview"),
  productReviewTitle: document.getElementById("product-preview-title"),
  productReviewStateLabel: document.getElementById("product-preview-badge"),
  productReviewStatus: document.getElementById("product-review-status"),
  productReviewRules: document.getElementById("product-review-rules"),
  productReviewSharing: document.getElementById("product-review-sharing"),
  productAppliedActions: document.getElementById("product-applied-actions"),
  productKeepEditing: document.getElementById("product-keep-editing"),
  productTitle: document.getElementById("product-title"),
  pauseSharing: document.getElementById("pause-network-sharing"),
  canvasDraft: document.getElementById("canvas-draft"),
  canvasChat: document.getElementById("canvas-chat"),
  canvasChatForm: document.getElementById("canvas-chat-form"),
  canvasManual: document.getElementById("canvas-manual"),
  canvasEnterManual: document.getElementById("canvas-enter-manual"),
  canvasBackChat: document.getElementById("canvas-back-chat"),
  canvasReview: document.getElementById("canvas-review"),
  canvasReviewSelection: document.getElementById("canvas-review-selection"),
  canvasEditing: document.getElementById("canvas-editing"),
  canvasClarification: document.getElementById("canvas-clarification"),
  canvasFormats: document.getElementById("canvas-formats"),
  canvasSharingDetail: document.getElementById("canvas-sharing-detail"),
  canvasVisit: document.getElementById("canvas-visit"),
  canvasSave: document.getElementById("canvas-save"),
  canvasShowOffers: document.getElementById("canvas-show-offers"),
  canvasBackResults: document.getElementById("canvas-back-results"),
  canvasResults: document.getElementById("canvas-results"),
  canvasResultsTitle: document.getElementById("canvas-results-title"),
  canvasResultsStatus: document.getElementById("canvas-results-status"),
  canvasResultsFeed: document.getElementById("canvas-results-feed"),
  canvasNetworkDetails: document.getElementById("canvas-network-details"),
  canvasRetry: document.getElementById("canvas-retry"),
  canvasSync: document.getElementById("canvas-sync"),
  canvasWords: document.getElementById("product-prompt-input"),
  actionTriggerQuote: document.getElementById("action-trigger-quote"),
  actionPreviewName: document.getElementById("action-preview-name"),
  actionPreviewCopy: document.getElementById("action-preview-copy"),
  actionPreviewLink: document.getElementById("action-preview-link"),
  connectionStatus: document.querySelector(".connection-status"),
};

const STORAGE = {
  preferences: "jumping-beans-preferences",
  memory: "jumping-beans-offer-memory",
  networkSharing: "jumping-beans-network-sharing",
};
const DEFAULT_PREFERENCES = normalizePreferencePlane({ formats: ["price-proof"], tone: "calm" });
const ACTION_TRIGGER_COPY = {
  message: {
    quote: "“Get the coffee I liked last week, ground, and keep it under $15.”",
    description: "A request in a conversation can start the chain without sending the user to a storefront first.",
  },
  article: {
    quote: "“That setup looks right. Find the matching item and show me proof before I decide.”",
    description: "An article can become an action surface: the assistant can resolve the referenced item and ask what to do next.",
  },
  product: {
    quote: "“I’m looking at this now. Compare it, adapt the presentation, and let me choose the next action.”",
    description: "A product page can hand off a focused action chain instead of adding another ad or duplicate search box.",
  },
};
const loadedAt = new Date().toISOString();
const OPEN_INVENTORY = {
  sku: "open-wildone-walk-kit",
  merchant: "Wild One",
  name: "Everyday Walk Kit",
  category: "dog gear",
  listPrice: 92,
  listPriceSource: "merchant",
  dealPrice: 88,
  imageUrl:
    "https://cdn.shopify.com/s/files/1/0011/7532/2687/files/WO_VM_HarnessWalkKit_StepInHarness_WaterproofLeash_Lilac_PDP_01_4x5_Web.jpg?v=1771034687",
  landing: "https://wildone.com/products/step-in-harness-waterproof-leash-dog-walk-kit",
  sourceType: "open inventory",
  sourceLabel: "Public catalog snapshot",
  sourceDescription: "Publicly listed inventory bundled with this demo. No merchant tool or account connection was required.",
  observedAt: loadedAt,
  verificationLabel: "Unverified snapshot; the merchant price may have changed",
  collateral: [],
};

function readStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function hasStored(key) {
  try {
    return localStorage.getItem(key) != null;
  } catch {
    return false;
  }
}

function removeStored(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // The in-memory state still updates when browser storage is unavailable.
  }
}

const storedPreferences = readStored(STORAGE.preferences, DEFAULT_PREFERENCES);
const initialPreferences = normalizePreferencePlane({
  ...storedPreferences,
  formats: Array.isArray(storedPreferences.formats) && storedPreferences.formats.length
    ? storedPreferences.formats
    : [...DEFAULT_PREFERENCES.formats],
});
const storedMemory = readStored(STORAGE.memory, []);
const savedPreferences = hasStored(STORAGE.preferences)
  ? normalizePreferencePlane(initialPreferences)
  : null;
const state = {
  profile: PERSONAS[0],
  preferences: canvasDraft(initialPreferences),
  appliedPreferences: { ...initialPreferences, formats: [...initialPreferences.formats] },
  memory: Array.isArray(storedMemory) ? storedMemory : [],
  partnerDeals: [],
  rakutenDeals: [],
  rakutenStatus: "idle",
  rakutenMeta: null,
  catalogDeals: [],
  catalogStatus: "idle",
  catalogMeta: null,
  connectedTools: [],
  sourceA: OPEN_INVENTORY,
  sourceB: null,
  applied: false,
  appliedMode: null,
  pendingWatch: null,
  pendingRemember: false,
  discoveryComplete: false,
  hasSavedPreferences: hasStored(STORAGE.preferences),
  savedPreferences,
  journey: createJourney({ intentType: "offer_discovery", surface: "web", protocol: "webmcp" }),
  contextSnapshot: null,
  events: [],
  capabilityResolution: null,
  decisionReceipt: null,
  connectedOrigins: [],
  originOutcomes: {},
  demoContextGranted: false,
  appliedJourneyRevision: 0,
  selectedWatchOfferId: null,
  account: { signedIn: false, csrfToken: null, profile: {}, preferences: {}, memory: [], error: "" },
  accountAvailability: "loading",
  accountIntent: "save",
  accountReturnView: "product",
  accountReturnFocus: null,
  accountReturnScroll: 0,
  accountDraftRestored: false,
  accountDraftFields: null,
  accountBusy: false,
  draftRevision: 0,
  preferenceSource: "browser",
  memorySource: "browser",
  networkSharingPaused: readStored(STORAGE.networkSharing, true) === false,
  currentView: "product",
  productStage: "preview",
  productReturnStage: hasStored(STORAGE.preferences) ? "saved" : "empty",
  productSetupPath: null,
  productBuilderVisible: false,
  productReviewState: "idle",
  productApplyMode: null,
  canvasRetention: "once",
  canvasEntryMode: "chat",
  canvasReviewVisible: false,
  canvasRuleId: null,
  canvasClarification: "",
  canvasSaveFailed: false,
  productDraftDirty: false,
  editingRuleId: null,
};

function recordEvent(type, payload = {}) {
  const event = createEvent(state.journey, type, payload);
  state.events = [...state.events, event].slice(-200);
  return event;
}

const formatLabels = {
  testimonial: "Testimonials",
  "price-proof": "Price proof",
  video: "Short video (when supplied)",
  "no-urgency": "No urgency",
};
const preferredFormats = ["testimonial", "video", "price-proof"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function hasExplicitMerchantPageDiscount(deal) {
  return deal?.merchantPageDiscountEvidence === "merchant-page-displayed-percent"
    && Number.isFinite(deal.merchantPageDiscountPercent)
    && deal.merchantPageDiscountPercent > 0
    && deal.merchantPageDiscountPercent <= 100;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function imageUrlAtWidth(value, width) {
  const url = safeUrl(value);
  if (!url) return null;
  if (url.hostname === "cdn.shopify.com") url.searchParams.set("width", String(width));
  return url;
}

function responsiveImageSrcset(value) {
  const url = safeUrl(value);
  if (!url || url.hostname !== "cdn.shopify.com") return "";
  return [320, 480, 512, 640, 960]
    .map((width) => `${imageUrlAtWidth(url.href, width).href} ${width}w`)
    .join(", ");
}

function safeOrigin(value) {
  return safeUrl(value)?.origin || value || "unknown origin";
}

function absoluteTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "long",
  }).format(date);
}

function updateConnections() {
  const origins = [...new Set(state.connectedTools.map((tool) => tool.origin).filter(Boolean))];
  state.connectedOrigins = origins;
  renderBrowserReadiness();
  const names = origins.map((origin) => PARTNER_NAMES[origin] || safeOrigin(origin));
  const discovered = origins.length;
  if (!SUPPORTED) {
    els.status.textContent = "Open inventory ready. WebMCP is unavailable here; no opted-in partner result is available.";
    els.protocol.textContent = "WebMCP · unavailable in this browser";
    els.sourceCount.textContent = "No tool check available";
    els.statusDot.dataset.on = "0";
    return;
  }
  if (!state.applied) {
    els.status.textContent = "Open inventory ready. Member sites have not been asked for preferences.";
    els.protocol.textContent = "WebMCP · not requested";
    els.sourceCount.textContent = "No partner request sent";
    els.statusDot.dataset.on = "0";
    return;
  }
  if (state.networkSharingPaused) {
    els.status.textContent = "Open inventory ready. Network sharing is paused; no preferences were sent to member sites.";
    els.protocol.textContent = "WebMCP · sharing paused";
    els.sourceCount.textContent = "No partner request sent while paused";
    els.statusDot.dataset.on = "0";
    return;
  }
  if (!state.discoveryComplete) {
    els.status.textContent = "Open inventory ready. Checking opted-in partner sites.";
    els.protocol.textContent = "WebMCP · checking partner sites";
    els.sourceCount.textContent = `Checking ${PARTNER_ORIGINS.length} sites`;
    els.statusDot.dataset.on = "0";
    return;
  }
  const outcomes = Object.values(state.originOutcomes || {});
  const ready = outcomes.filter((outcome) => outcome.status === "ready").length;
  const noMatch = outcomes.filter((outcome) => outcome.status === "no-match").length;
  if (ready || noMatch) {
    const responses = ready + noMatch;
    const resultLabel = ready
      ? `${ready} site${ready === 1 ? "" : "s"} returned offers${noMatch ? `; ${noMatch} returned no match` : ""}`
      : `${noMatch} site${noMatch === 1 ? "" : "s"} responded with no matching offers`;
    els.status.textContent = `Open inventory ready. ${resultLabel}.`;
    els.protocol.textContent = `WebMCP · ${responses} partner response${responses === 1 ? "" : "s"}`;
    els.sourceCount.textContent = resultLabel;
    els.statusDot.dataset.on = ready ? "1" : "0";
    return;
  }
  els.status.textContent = discovered
    ? `Open inventory ready. ${discovered} opted-in site${discovered === 1 ? "" : "s"} connected: ${names.join(", ")}.`
    : "Open inventory ready. No opted-in offer tools responded.";
  els.protocol.textContent = discovered
    ? `WebMCP · ${discovered} opted-in site${discovered === 1 ? "" : "s"}`
    : "WebMCP · no opted-in tools found";
  els.sourceCount.textContent = discovered
    ? `${discovered} connected: ${names.join(", ")}`
    : "0 connected";
  els.statusDot.dataset.on = discovered ? "1" : "0";
}

function renderBrowserReadiness() {
  if (!els.browserReadiness) return;
  const title = document.createElement("strong");
  const copy = document.createElement("p");
  title.className = "bl-callout__title";
  const respondingOrigins = PARTNER_ORIGINS.filter((origin) => ["ready", "no-match"].includes(state.originOutcomes?.[origin]?.status));
  const connectedOrigins = new Set(state.connectedTools.map((tool) => tool.origin));
  const verified = state.applied && !state.networkSharingPaused
    && state.productReviewState !== "applying" && state.discoveryComplete
    && respondingOrigins.length === PARTNER_ORIGINS.length
    && PARTNER_ORIGINS.every((origin) => connectedOrigins.has(origin));
  if (verified) {
    title.textContent = `Native WebMCP verified with all ${PARTNER_ORIGINS.length} member sites`;
    copy.textContent = "Each allowlisted site completed the current read-only offer check. Matched cards and the separate storefront preview can now show the same approved selection.";
    els.browserReadiness.dataset.tone = "success";
  } else if (SUPPORTED && state.applied && state.networkSharingPaused) {
    title.textContent = "Native WebMCP sharing is paused";
    copy.textContent = "No selection is being sent to member sites. Resume network sharing to run a new native check with the current approved selection.";
    els.browserReadiness.dataset.tone = "info";
  } else if (SUPPORTED && state.applied && (!state.discoveryComplete || state.productReviewState === "applying")) {
    title.textContent = "Checking native WebMCP";
    copy.textContent = `Waiting for responses from ${PARTNER_ORIGINS.length} allowlisted member sites. The ordinary-browser storefront preview remains available in the results.`;
    els.browserReadiness.dataset.tone = "info";
  } else if (SUPPORTED && state.applied) {
    title.textContent = "Native member check is incomplete";
    copy.textContent = `${respondingOrigins.length} of ${PARTNER_ORIGINS.length} member sites completed the native check. The separately labeled storefront preview remains available and does not count as a WebMCP match.`;
    els.browserReadiness.dataset.tone = "warning";
  } else if (SUPPORTED) {
    title.textContent = "Native WebMCP check is available";
    copy.textContent = `This isolated browser exposes the native API. Apply a selection to verify all ${PARTNER_ORIGINS.length} allowlisted member sites before the demo claims a native result.`;
    els.browserReadiness.dataset.tone = "info";
  } else {
    title.textContent = "Storefront preview is ready";
    copy.textContent = "This browser cannot run native WebMCP. Apply a Coffee, Dog gear, or Watches selection to open the same visit-only preference handoff on its member storefront. The preview stays clearly separate from a WebMCP match.";
    els.browserReadiness.dataset.tone = "info";
  }
  const renderKey = JSON.stringify([els.browserReadiness.dataset.tone, title.textContent, copy.textContent]);
  if (state.browserReadinessRenderKey === renderKey) return;
  state.browserReadinessRenderKey = renderKey;
  els.browserReadiness.replaceChildren(title, copy);
}

function hasSuccessfulPartnerApplication() {
  return Object.values(state.originOutcomes || {}).some((outcome) => ["ready", "no-match"].includes(outcome?.status));
}

function createPartnerFrames() {
  if (!SUPPORTED) return Promise.resolve([]);
  const waits = PARTNER_ORIGINS.map((origin, index) => {
    const frame = document.createElement("iframe");
    // WebMCP is origin-isolated. Delegate both the tool capability and the
    // cross-origin-isolated capability to each partner document.
    // Name the target origin explicitly as well as delegating the feature.
    // This avoids relying on the browser to expand the `src` shorthand while
    // the frame is being created dynamically.
    frame.allow = `tools ${origin}; cross-origin-isolated ${origin}`;
    // Set the policy before navigation so the initial document receives the
    // delegation; some Chromium builds snapshot iframe policy at navigation.
    frame.src = `${origin}/`;
    frame.className = "partner-frame";
    frame.dataset.origin = origin;
    frame.title = `WebMCP discovery frame for ${PARTNER_NAMES[origin] || `partner ${index + 1}`}`;
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    const wait = new Promise((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      frame.addEventListener("load", settle, { once: true });
      frame.addEventListener("error", settle, { once: true });
      window.setTimeout(settle, 5000);
    });
    document.body.appendChild(frame);
    return wait;
  });
  return Promise.all(waits);
}

async function executeTool(tool, input, { compatibilityRetry = true } = {}) {
  const requestRevision = state.appliedJourneyRevision;
  if (!state.applied || state.networkSharingPaused) throw new Error("Preference application was revoked");
  let raw;
  try {
    // Chrome's imperative WebMCP API accepts the tool input as JSON text.
    // Serialize first so the production path follows the browser contract.
    raw = await document.modelContext.executeTool(tool, JSON.stringify(input));
  } catch (error) {
    if (!compatibilityRetry || !isCompatibilityInputError(error) || !state.applied || state.networkSharingPaused || requestRevision !== state.appliedJourneyRevision) throw error;
    // Older development implementations accepted an object. Keep that
    // compatibility path limited to recognized input-type failures.
    raw = await document.modelContext.executeTool(tool, input);
  }
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

function discoverGrant() {
  return createInvocationGrant({
    capabilityId: "offers.discover",
    audienceOrigin: location.origin,
    scopes: ["offers:read"],
    purpose: "resolve opted-in offer records",
  });
}

async function discoverPartnerDeals(preferences = state.appliedPreferences) {
  const requestRevision = state.appliedJourneyRevision;
  // Native discovery is deferred until the page applies an explicit choice.
  // This keeps draft preferences and a merely toggled demo control in-page.
  if (!state.applied) return { deals: [], originOutcomes: Object.fromEntries(PARTNER_ORIGINS.map((origin) => [origin, { status: "not-requested", count: 0, reason: "awaiting explicit preference application" }])) };
  if (state.networkSharingPaused) return { deals: [], originOutcomes: Object.fromEntries(PARTNER_ORIGINS.map((origin) => [origin, { status: "paused", count: 0, reason: "network sharing is paused by the user" }])) };
  if (!SUPPORTED || typeof document.modelContext.getTools !== "function") return { deals: [], originOutcomes: {} };
  recordEvent("capability.invocation.started", {
    capabilityId: "offers.discover",
    capabilityVersion: "1.0.0",
    requestedOrigins: [...PARTNER_ORIGINS],
  });
  let matching = [];
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const tools = await document.modelContext.getTools({ fromOrigins: PARTNER_ORIGINS });
      if (!state.applied || state.networkSharingPaused || requestRevision !== state.appliedJourneyRevision) return { deals: [], originOutcomes: {} };
      matching = tools
        .filter((tool) => tool.name === TOOL_NAMES.matchingDeals && PARTNER_ORIGINS.includes(tool.origin))
        .filter((tool, index, all) => all.findIndex((candidate) => candidate.origin === tool.origin) === index);
      if (matching.length || attempt === 2) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
  }
  state.connectedTools = matching;
  matching.forEach((tool) => recordEvent("capability.exposed", {
    capabilityId: "offers.discover",
    capabilityVersion: "1.0.0",
    origin: tool.origin,
    toolName: tool.name,
  }));
  if (!matching.length && lastError) {
    recordEvent("capability.invocation.failed", {
      capabilityId: "offers.discover",
      capabilityVersion: "1.0.0",
      reason: "partner discovery failed after compatibility retries",
    });
    return { deals: [], originOutcomes: Object.fromEntries(PARTNER_ORIGINS.map((origin) => [origin, { status: "failed", count: 0, reason: "partner discovery failed" }])) };
  }
  const grant = discoverGrant();
  const invocation = await invokeCapability({
    capabilityId: "offers.discover", grant, callerOrigin: location.origin, expectedOrigin: location.origin,
    purpose: "resolve opted-in offer records", input: matching, validateInput: Array.isArray,
    validateOutput: (value) => value && Array.isArray(value.deals) && value.originOutcomes,
    handler: async () => resolvePartnerTools({
      tools: matching, allowedOrigins: PARTNER_ORIGINS,
      inputForOrigin: (origin) => {
        const projection = projectPartnerContext(state.contextSnapshot, origin);
        return projection.fields;
      },
      execute: (tool, input) => executeTool(tool, input),
    }),
  });
  if (!invocation.ok) {
    recordEvent("capability.invocation.denied", { capabilityId: "offers.discover", reason: invocation.authorization?.code || invocation.code });
    return { deals: [], originOutcomes: Object.fromEntries(PARTNER_ORIGINS.map((origin) => [origin, { status: "failed", count: 0, reason: invocation.authorization?.code || invocation.code }])) };
  }
  Object.entries(invocation.value.originOutcomes).forEach(([origin, outcome]) => recordEvent(`capability.invocation.${outcome.status}`, { capabilityId: "offers.discover", capabilityVersion: "1.0.0", origin, ...outcome }));
  return invocation.value;
}

async function fetchRakutenDeals(preferences = state.appliedPreferences) {
  const category = String(preferences.category || "").trim();
  const params = new URLSearchParams({ max: "24" });
  if (category) params.set("q", category);
  const response = await fetch(`/api/inventory/rakuten?${params}`, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json();
  if (!response.ok || !Array.isArray(payload?.items)) throw new Error(payload?.error || "rakuten-unavailable");
  const ceiling = Number.isFinite(preferences.maxPrice) ? preferences.maxPrice : null;
  const deals = payload.items.filter((deal) => {
    const price = Number(deal?.dealPrice);
    return Number.isFinite(price) && price >= 0 && (
      ceiling == null || price < ceiling || (price === ceiling && preferences.maxPriceInclusive !== false)
    );
  });
  return { deals, meta: payload.meta || null };
}

async function fetchCatalogDeals(preferences = state.appliedPreferences) {
  const category = String(preferences.category || "").trim();
  const params = new URLSearchParams({ max: "24" });
  if (category) {
    params.set("q", category);
    params.set("category", category);
  }
  if (Number.isFinite(preferences.maxPrice)) {
    params.set("maxPrice", String(preferences.maxPrice));
    params.set("maxPriceInclusive", String(preferences.maxPriceInclusive !== false));
  }
  const response = await fetch(`/api/inventory/catalog?${params}`, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json();
  if (!response.ok || !Array.isArray(payload?.items)) throw new Error(payload?.error || "catalog-unavailable");
  return { deals: payload.items, meta: payload.meta || null };
}

function applyPartnerDiscovery(result) {
  state.partnerDeals = result.deals;
  state.originOutcomes = result.originOutcomes;
  state.sourceB = choosePartnerOffer(result.deals);
  const watchOffers = watchHandoffOffers();
  if (!watchOffers.some((deal) => deal.resolution.offerId === state.selectedWatchOfferId)) {
    state.selectedWatchOfferId = watchOffers[0]?.resolution.offerId || null;
  }
  state.discoveryComplete = true;
  updateConnections();
  renderJourney();
}

let nativeToolchangeReconciliationQueued = false;

function observeNativeToolChanges() {
  if (!SUPPORTED || typeof document.modelContext?.addEventListener !== "function") return;
  // `toolchange` only tells us that the browser registry changed. Reconcile it
  // through a fresh, allowlisted native discovery rather than treating the
  // event as a tool registry or reusing a cached RegisteredTool.
  document.modelContext.addEventListener("toolchange", () => {
    if (nativeToolchangeReconciliationQueued) return;
    nativeToolchangeReconciliationQueued = true;
    const revision = state.appliedJourneyRevision;
    window.setTimeout(async () => {
      nativeToolchangeReconciliationQueued = false;
      if (!state.applied || revision !== state.appliedJourneyRevision) return;
      state.discoveryComplete = false;
      state.originOutcomes = {};
      renderBrowserReadiness();
      const result = await discoverPartnerDeals();
      if (!state.applied || revision !== state.appliedJourneyRevision) return;
      applyPartnerDiscovery(result);
    }, 0);
  });
}

function choosePartnerOffer(deals, preferences = state.appliedPreferences) {
  const resolution = resolveOfferDeals(deals, {
    profile: state.demoContextGranted ? state.profile : null,
    preferences,
  });
  state.capabilityResolution = resolution;
  state.decisionReceipt = decisionReceipt({
    journey: state.journey,
    context: state.contextSnapshot,
    resolution,
    connectedOrigins: state.connectedOrigins,
    originOutcomes: state.originOutcomes,
  });
  recordEvent("capability.decision", {
    capabilityId: "offers.discover",
    capabilityVersion: "1.0.0",
    eligibleCount: resolution.eligible.length,
    exposedCount: resolution.exposed.length,
    connectedOriginCount: state.connectedOrigins.length,
    reason: resolution.reason,
  });
  const candidate = resolution.exposed[0];
  return candidate ? { ...candidate, merchant: candidate.partnerName || candidate.vendor || "Opted-in merchant" } : null;
}

function selectedCollateral(deal, preferences) {
  const collateral = Array.isArray(deal.collateral) ? deal.collateral : [];
  const formats = preferences.formats || [];
  const wanted = [
    ...preferredFormats.filter((format) => formats.includes(format) && (format !== "price-proof" || hasExplicitMerchantPageDiscount(deal))),
    ...(hasExplicitMerchantPageDiscount(deal) ? ["price-proof"] : []),
  ];
  for (const type of wanted) {
    const item = collateral.find((entry) => entry.type === type);
    if (item) return item;
  }
  const unavailable = [
    formats.includes("testimonial") && !collateral.some((entry) => entry.type === "testimonial") ? "customer story" : "",
    formats.includes("video") && !collateral.some((entry) => entry.type === "video") ? "short video" : "",
    formats.includes("price-proof") && !hasExplicitMerchantPageDiscount(deal) ? "merchant-page percentage proof" : "",
  ].filter(Boolean);
  return {
    type: "offer-fact",
    text: `${unavailable.length ? `Requested ${unavailable.join(", ")} was not supplied for this offer. ` : ""}Current catalog price ${money(deal.dealPrice)}.`,
    source: "Offer record; requested collateral remains unavailable unless the partner supplies it",
  };
}

function offerImage(deal) {
  const source = safeUrl(deal.imageUrl);
  if (!source) return '<div class="art-placeholder" aria-hidden="true">Offer image unavailable</div>';
  const srcset = responsiveImageSrcset(source.href);
  const responsiveAttributes = srcset
    ? ` sizes="(max-width: 42rem) calc(100vw - 4rem), 12rem" srcset="${escapeHtml(srcset)}"`
    : "";
  return `<img${responsiveAttributes} src="${escapeHtml(imageUrlAtWidth(source.href, 640).href)}" width="640" height="480" alt="${escapeHtml(deal.name || "Offer")} product image" loading="lazy" decoding="async" crossorigin="anonymous">`;
}

function provenanceMarkup(deal, sourceKind) {
  const destination = safeUrl(deal.landing);
  const sourceOrigin = safeUrl(deal.partnerOrigin || deal.origin);
  const isOpen = sourceKind === "open";
  const isAffiliate = sourceKind === "affiliate";
  const isCatalog = sourceKind === "catalog";
  const who = isOpen
    ? `Jumping Beans loaded a public record attributed to ${deal.merchant || deal.vendor || "the catalog merchant"}`
    : isAffiliate
      ? `${deal.partnerName || deal.merchant || "The merchant"} supplied the record through Rakuten Advertising`
      : isCatalog
        ? `${deal.partnerName || deal.merchant || "The merchant"} supplied the record through its public catalog feed`
    : `${deal.partnerName || deal.merchant || "The partner"} returned the record through WebMCP`;
  const source = isOpen
    ? "Public product-feed snapshot bundled with this demo"
    : isAffiliate
      ? "Live Rakuten Advertising Product Search API record"
      : isCatalog
        ? (deal.sourceDescription || "Public merchant catalog snapshot; direct merchant link-out")
    : `WebMCP offer tool${sourceOrigin ? ` at ${sourceOrigin.origin}` : ""}`;
  const when = isOpen
    ? `Loaded into this page ${absoluteTime(deal.observedAt)}; the source capture time is unavailable`
    : isAffiliate
      ? `Rakuten API response received ${absoluteTime(deal.observedAt)}`
      : isCatalog
        ? `Catalog snapshot captured ${absoluteTime(deal.observedAt)}; it expires ${absoluteTime(deal.expiresAt)}`
    : `Tool response received ${absoluteTime(deal.observedAt)}`;
  const evidence = isOpen
    ? `Catalog record ${deal.sku}; no live price check ran`
    : isAffiliate
      ? `Live Rakuten catalog record ${deal.sku}; no merchant-page price check ran`
      : isCatalog
        ? `Public catalog record ${deal.sku}; freshness ends ${absoluteTime(deal.expiresAt)}`
    : `Tool response from ${sourceOrigin?.origin || "the opted-in origin"}; catalog record ${deal.sku || "without a supplied SKU"}`;
  const sourceLink = destination
    ? `<a href="${escapeHtml(destination.href)}" target="_blank" rel="noopener noreferrer">Merchant product page</a>`
    : escapeHtml(source);
  return `
    <details class="bl-disclosure provenance">
      <summary class="bl-disclosure__summary">Source and verification</summary>
      <div class="bl-disclosure__body">
      <dl class="bl-provenance__facts">
        <div><dt>What</dt><dd>${escapeHtml(deal.name)} offer record</dd></div>
        <div><dt>Who</dt><dd>${escapeHtml(who)}</dd></div>
        <div><dt>Source</dt><dd>${sourceLink}<br>${escapeHtml(source)}</dd></div>
        <div><dt>When</dt><dd>${escapeHtml(when)}</dd></div>
        <div><dt>Verification</dt><dd>${escapeHtml(deal.verificationLabel || "Unverified")}</dd></div>
        <div><dt>Evidence</dt><dd>${escapeHtml(evidence)}</dd></div>
      </dl>
      </div>
    </details>`;
}

function offerMarkup(deal, sourceKind, label, preferences) {
  const collateral = selectedCollateral(deal, preferences);
  const noUrgency = preferences.formats.includes("no-urgency");
  const copy = noUrgency
    ? "A clear offer without countdowns or pressure."
    : "A clear offer with the selected information first.";
  const collateralText =
    collateral.type === "testimonial"
      ? `“${escapeHtml(collateral.text)}”`
      : collateral.type === "video"
        ? `${escapeHtml(collateral.title || "Product video")} · ${escapeHtml(collateral.duration || 18)} seconds`
        : escapeHtml(collateral.text);
  const isAffiliate = sourceKind === "affiliate";
  const isCatalog = sourceKind === "catalog";
  const sourceClass = sourceKind === "open" ? "source-open" : isAffiliate || isCatalog ? "source-affiliate" : "source-optin";
  const sourceLabel = sourceKind === "open" ? "Open inventory" : isAffiliate || isCatalog ? "Out-of-network" : "Opted-in partner";
  const comparisonPrice = hasExplicitMerchantPageDiscount(deal)
    ? `<span>${escapeHtml(deal.merchantPageDiscountPercent)}% off shown on the merchant product page</span>`
    : "";
  const reason = sourceKind === "open"
    ? "Found in a bundled public catalog snapshot. No partner connection was needed."
    : isAffiliate
      ? "Found through a live Rakuten Advertising affiliate catalog. The merchant owns the destination and checkout."
      : isCatalog
        ? "Found in a public merchant catalog snapshot. Jumping Beans links directly to that merchant; no affiliate relationship is claimed for this feed."
      : "Matched through an opted-in WebMCP offer tool and rendered using your applied display rules.";
  return `
    <header class="step-card-head">
      <div><p class="step-kicker">${escapeHtml(label)}</p><h3>${escapeHtml(deal.name)}</h3></div>
      <span class="bl-badge source-pill ${sourceClass}" data-status="${sourceKind === "open" ? "neutral" : "success"}">${sourceLabel}</span>
    </header>
    <div class="offer">
      <div class="offer-art">${offerImage(deal)}</div>
      <div>
        <div class="offer-brand">${escapeHtml(deal.merchant || deal.partnerName || "Public catalog")}</div>
        <p class="offer-copy">${copy}</p>
        <div class="offer-price">
          <strong>${money(deal.dealPrice)}</strong>
          ${comparisonPrice}
        </div>
        <p class="reason"><strong>Why it appeared</strong><br>${reason}</p>
        <div class="bl-callout collateral" data-tone="info">
          <div class="collateral-label">${escapeHtml(formatLabels[collateral.type] || "Offer evidence")}</div>
          <div>${collateralText}</div>
          <small>Source: ${escapeHtml(collateral.source || "No source supplied")}</small>
        </div>
      </div>
    </div>
    ${sourceKind === "optin" && partnerDestination(deal.partnerOrigin) ? `<div class="bl-actions"><a class="bl-button" href="${escapeHtml(partnerDestination(deal.partnerOrigin))}" target="_blank" rel="noopener noreferrer">Open adapted partner page</a></div>` : ""}
    ${provenanceMarkup(deal, sourceKind)}`;
}

function renderMemoryStep() {
  renderOfferCard(
    els.memoryStep,
    offerMarkup(state.sourceA, "open", "Site A · recorded from open inventory", DEFAULT_PREFERENCES),
  );
}

function switchView(view, { focusHeading = false } = {}) {
  const nextView = ["demo", "account"].includes(view) ? view : "product";
  if (view === "network" && state.applied) state.productStage = "results";
  state.currentView = nextView;
  renderProductFocus();
  els.headerAccount.toggleAttribute("aria-current", nextView === "account");
  if (nextView === "account") els.headerAccount.setAttribute("aria-current", "page");
  els.connectionStatus?.toggleAttribute("hidden", ["product", "account"].includes(nextView));
  for (const [name, panel] of Object.entries({ product: els.productView, demo: els.demoView, account: els.accountView })) {
    if (!panel) continue;
    panel.hidden = name !== nextView;
  }
  if (nextView === "account") renderAccount();
  if (nextView === "network") renderProductNetwork();
  if (nextView === "product") renderProductShell();
  const hash = nextView === "product" ? "" : `#${nextView}`;
  if (location.hash !== hash) history.replaceState(null, "", `${location.pathname}${location.search}${hash}`);
  if (focusHeading) {
    const heading = nextView === "product"
        ? els.productTitle
        : nextView === "account" ? els.accountTitle : document.getElementById("page-title");
    heading?.focus({ preventScroll: true });
  }
}

function renderProductReview(active = normalizePreferencePlane(state.preferences)) {
  const isApplying = state.productReviewState === "applying";
  const showingResults = state.productStage === "results";
  const selection = showingResults ? normalizePreferencePlane(state.canvasReturnSelection || state.appliedPreferences) : active;
  els.productReview.dataset.reviewState = state.productReviewState;
  els.productReview.setAttribute("aria-busy", String(isApplying));
  els.productReviewTitle.textContent = showingResults ? "Using your selection" : "We’ll use";
  const appliedSuccessfully = showingResults && !isApplying && hasSuccessfulPartnerApplication();
  els.productReviewStateLabel.textContent = showingResults ? (isApplying ? "Finding offers" : appliedSuccessfully ? "Applied" : "Ready to retry") : "Draft";
  els.productReviewStateLabel.dataset.status = appliedSuccessfully ? "success" : "info";
  const facts = [
    { id: "category", text: selection.category || "Any category", edit: "Shopping for" },
    { id: "budget", text: selection.maxPrice == null ? "Any budget" : `${selection.maxPriceInclusive === false ? "Under" : "Up to"} ${money(selection.maxPrice)}`, edit: "Budget" },
    { id: "presentation", text: `${STARTER_STYLES[selection.feedStyle]?.label || "Custom"} · ${selection.formats.map((format) => formatLabels[format]).join(", ") || "Default presentation"}`, edit: "Presentation" },
    ...selection.rules.map((rule) => ({ id: rule.id, text: `${rule.text}${rule.scope === "category" ? ` · For ${rule.category}` : ""}${rule.active ? "" : " · Paused (not shared)"}`, edit: "priority" })),
  ];
  // Keep focused controls mounted across background renders and input updates.
  const markup = facts.map((fact) => `<li class="canvas-fact"><span>${escapeHtml(fact.text)}</span>${showingResults ? "" : `<div class="canvas-fact-actions"><button class="bl-button" data-variant="quiet" type="button" data-fact-edit="${escapeHtml(fact.id)}" aria-label="Edit ${escapeHtml(fact.edit)}">Edit</button>${fact.id === "presentation" || (fact.id === "category" && !selection.category) || (fact.id === "budget" && selection.maxPrice == null) ? "" : `<button class="bl-button" data-variant="quiet" type="button" data-fact-remove="${escapeHtml(fact.id)}" aria-label="Remove ${escapeHtml(fact.edit)}">Remove</button>`}</div>`}</li>`).join("");
  if (state.canvasReviewMarkup !== markup) {
    els.productReviewRules.innerHTML = markup;
    state.canvasReviewMarkup = markup;
  }
  els.productReviewStatus.textContent = showingResults
    ? state.canvasReturnSelection ? "Previous selection retained after sign-in. Nothing was applied again." : state.appliedMode === "saved" ? "Saved in this browser until you use Forget." : state.canvasSaveFailed ? "Used for this visit. This browser could not save the selection; any previous saved copy is unchanged." : "This visit only. Nothing was saved."
    : state.productDraftDirty && state.applied ? "Your latest changes are not applied yet. Current results still use your last approved selection." : "Review or change any item before continuing.";
  els.canvasDraft.hidden = showingResults;
  const manual = state.canvasEntryMode === "manual";
  els.canvasChat.hidden = manual;
  els.canvasManual.hidden = !manual;
  els.canvasEnterManual.setAttribute("aria-expanded", String(manual));
  els.canvasReview.hidden = !(showingResults || state.canvasReviewVisible || state.hasSavedPreferences || state.accountDraftRestored);
  els.canvasReviewSelection.dataset.variant = els.canvasReview.hidden ? "primary" : "secondary";
  els.canvasEditing.hidden = showingResults;
  els.productAppliedActions.hidden = !showingResults;
  els.canvasResults.hidden = !showingResults;
  els.canvasBackResults.hidden = !state.applied;
  els.canvasShowOffers.setAttribute("aria-disabled", String(isApplying));
  els.productKeepEditing.setAttribute("aria-disabled", String(isApplying));
  const save = state.canvasRetention === "saved";
  els.canvasVisit.checked = !save;
  els.canvasSave.checked = save;
  els.canvasShowOffers.setAttribute("aria-label", save ? "Show matching offers and save in this browser" : "Show matching offers for this visit only");
  els.productPreviewRetention.textContent = save ? "Saved until you Forget. Replaces the saved selection in this browser." : "Nothing will be saved. Any saved selection stays unchanged.";
  els.productReviewSharing.textContent = state.networkSharingPaused
    ? "Network sharing is paused. No selection will be sent to member sites until you resume it in results."
    : "Only the category, budget, presentation and active priorities above will be sent to opted-in member sites when you continue.";
  els.canvasSharingDetail.textContent = reviewPreferencePlane(selection, { save }).sharing + ".";
}

function renderProductFocus() {
  els.engineHeader.hidden = false;
  els.productHero.hidden = false;
}

function updateActionChain(trigger = "message") {
  const copy = ACTION_TRIGGER_COPY[trigger] || ACTION_TRIGGER_COPY.message;
  if (els.actionTriggerQuote) els.actionTriggerQuote.textContent = copy.quote;
  if (els.actionPreviewCopy) els.actionPreviewCopy.textContent = `Coffee Co will receive the selected product from this context. ${copy.description}`;
  document.querySelectorAll("[data-action-trigger]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.actionTrigger === trigger));
  });
  if (els.actionPreviewLink) {
    const current = new URL(els.actionPreviewLink.href, location.href);
    const url = new URL(`${current.pathname}${current.search}${current.hash}`, ORIGINS.coffee);
    url.searchParams.set("jb_trigger", trigger);
    els.actionPreviewLink.href = url.href;
  }
}

function renderProductShell() {
  renderProductFocus();
  const active = normalizePreferencePlane(state.preferences);
  // Never rewrite a field while the user is typing or editing a rule.
  for (const [input, value] of [[els.productCategory, active.category], [els.productMaxPrice, active.maxPrice == null ? "" : String(active.maxPrice)], [els.productStyle, active.feedStyle]]) {
    if (document.activeElement !== input && input.validity?.valid !== false) input.value = value;
  }
  els.savedPreferenceActions.hidden = !state.hasSavedPreferences || !state.savedPreferences;
  if (state.savedPreferences) {
    const browserSaved = hasStored(STORAGE.preferences);
    const savedCategory = state.savedPreferences.category || "Any category";
    const savedBudget = state.savedPreferences.maxPrice == null ? "" : ` · ${money(state.savedPreferences.maxPrice)}`;
    els.savedSelectionSummary.textContent = `${browserSaved ? "Saved in this browser" : "Saved in your account"}: ${savedCategory}${savedBudget}`;
    els.savedPreferenceNote.textContent = selectionSummary(state.savedPreferences);
    els.productForgetSaved.hidden = !browserSaved;
  }
  els.productBuilder.open = state.productBuilderVisible;
  for (const input of els.canvasFormats.querySelectorAll("input")) input.checked = active.formats.includes(input.value);
  const ruleRenderKey = JSON.stringify([active.rules, state.editingRuleId]);
  if (state.ruleRenderKey !== ruleRenderKey) {
    renderProductRules(active);
    state.ruleRenderKey = ruleRenderKey;
  }
  renderProductReview(active);
  renderBrowserReadiness();
}

function updateCanvasWords() {
  if (state.productReviewState === "applying") return;
  const interpretation = interpretPreferenceWords(els.canvasWords.value);
  state.canvasClarification = interpretation.clarification;
  els.canvasClarification.textContent = interpretation.clarification;
  els.canvasClarification.hidden = !interpretation.clarification;
  const current = normalizePreferencePlane(state.preferences);
  const parsedFacts = {};
  for (const key of ["category", "maxPrice"]) {
    // A manual correction wins while the corresponding words stay unchanged.
    const previous = state.canvasParsedFacts?.[key];
    const corrected = previous !== undefined && current[key] !== previous;
    if (!corrected && previous !== undefined) {
      current[key] = state.canvasWordsBase?.[key];
      if (key === "maxPrice") current.maxPriceInclusive = state.canvasWordsBase?.maxPriceInclusive;
    }
    const changedInequality = key === "maxPrice" && interpretation.maxPriceInclusive !== state.canvasParsedFacts?.maxPriceInclusive;
    if (interpretation[key] !== undefined && !(corrected && interpretation[key] === previous && !changedInequality)) {
      parsedFacts[key] = interpretation[key];
      if (key === "maxPrice") parsedFacts.maxPriceInclusive = interpretation.maxPriceInclusive;
    }
  }
  state.canvasWordsBase = { category: current.category, maxPrice: current.maxPrice, maxPriceInclusive: current.maxPriceInclusive };
  state.canvasParsedFacts = { category: interpretation.category, maxPrice: interpretation.maxPrice, maxPriceInclusive: interpretation.maxPriceInclusive };
  state.canvasRuleId ||= opaqueId("rule");
  const existing = current.rules.find((rule) => rule.id === state.canvasRuleId);
  const rules = current.rules.filter((rule) => rule.id !== state.canvasRuleId);
  if (interpretation.remainder) rules.push({ ...existing, id: state.canvasRuleId, text: interpretation.remainder, scope: existing?.scope || "everywhere", category: existing?.category || "", active: existing?.active ?? true });
  markDraftEdited({ preferences: true });
  state.preferences = normalizePreferencePlane({ ...current, ...parsedFacts, rules });
  // Structured facts are authoritative immediately; the raw entry is not shared.
  els.productCategory.value = state.preferences.category;
  els.productMaxPrice.value = state.preferences.maxPrice ?? "";
  renderProductReview();
}

function setCanvasEntryMode(mode, { focus = true } = {}) {
  if (state.productReviewState === "applying") return;
  const { scrollX, scrollY } = window;
  state.canvasEntryMode = mode === "manual" ? "manual" : "chat";
  if (state.canvasEntryMode === "manual") state.canvasReviewVisible = true;
  renderProductShell();
  if (focus) (state.canvasEntryMode === "manual" ? els.productCategory : els.canvasWords).focus({ preventScroll: true });
  // This is an in-place edit. Cancel any pending smooth scroll as well as
  // restoring layout/focus adjustments, without changing navigation scrolling.
  window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
}

function reviewCanvasSelection() {
  if (state.productReviewState === "applying") return;
  state.canvasReviewVisible = true;
  renderProductShell();
  // Reviewing is local. Only the separate commitment can save or share.
  (state.canvasClarification ? els.canvasWords : els.productReviewTitle).focus({ preventScroll: true });
}

function settleCanvasWords() {
  if (state.canvasClarification) return;
  state.canvasParsedFacts = null;
  state.canvasWordsBase = null;
  els.canvasWords.value = state.preferences.rules.find((rule) => rule.id === state.canvasRuleId)?.text || "";
}

function editCanvasFact(id) {
  if (id === "category" || id === "budget") {
    setCanvasEntryMode("manual", { focus: false });
    return (id === "category" ? els.productCategory : els.productMaxPrice).focus({ preventScroll: true });
  }
  if (id === "presentation") {
    state.productBuilderVisible = true;
    els.productBuilder.open = true;
    return els.productStyle.focus({ preventScroll: true });
  }
  const rule = state.preferences.rules.find((rule) => rule.id === id);
  if (!rule) return;
  setCanvasEntryMode("chat", { focus: false });
  state.canvasParsedFacts = null;
  state.canvasWordsBase = null;
  state.canvasRuleId = id;
  els.canvasWords.value = rule.text;
  els.canvasWords.focus({ preventScroll: true });
}

function removeCanvasFact(id) {
  markDraftEdited({ preferences: true });
  if (id === "category") state.preferences.category = "";
  else if (id === "budget") { state.preferences.maxPrice = null; delete state.preferences.maxPriceInclusive; }
  else state.preferences.rules = state.preferences.rules.filter((rule) => rule.id !== id);
  settleCanvasWords();
  renderProductShell();
  els.productReviewTitle.focus({ preventScroll: true });
}

function ruleScopeLabel(rule) {
  return rule.scope === "category" ? `For ${rule.category || "this category"}` : "Everywhere";
}

function renderProductRules(preferences) {
  if (!els.productRuleList) return;
  els.productRuleList.replaceChildren();
  if (!preferences.rules.length) {
    const empty = document.createElement("p");
    empty.className = "field-hint product-rule-empty";
    empty.textContent = "No extra rules yet. Your selected style is ready to review on its own.";
    els.productRuleList.append(empty);
    return;
  }
  for (const rule of preferences.rules) {
    const item = document.createElement("article");
    item.className = "product-rule";
    item.dataset.paused = String(!rule.active);
    if (state.editingRuleId === rule.id) {
      item.innerHTML = `
        <form class="product-rule-edit" data-rule-edit="${escapeHtml(rule.id)}">
          <label for="rule-edit-${escapeHtml(rule.id)}">Edit preference</label>
          <input id="rule-edit-${escapeHtml(rule.id)}" name="text" type="text" maxlength="240" value="${escapeHtml(rule.text)}">
          <label for="rule-scope-${escapeHtml(rule.id)}">Where</label>
          <select id="rule-scope-${escapeHtml(rule.id)}" name="scope">
            <option value="everywhere"${rule.scope === "everywhere" ? " selected" : ""}>Everywhere</option>
            <option value="category"${rule.scope === "category" ? " selected" : ""}>For this category</option>
          </select>
          <div class="product-rule-actions"><button class="bl-button" data-variant="secondary" type="submit">Save rule</button><button class="bl-button" data-variant="quiet" data-rule-cancel="${escapeHtml(rule.id)}" type="button">Cancel</button></div>
        </form>`;
    } else {
      item.innerHTML = `
        <div><strong>${escapeHtml(rule.text)}</strong><span>${escapeHtml(ruleScopeLabel(rule))}${rule.active ? "" : " · Paused"}</span></div>
        <div class="product-rule-actions">
          <button class="bl-button" data-variant="quiet" data-rule-edit="${escapeHtml(rule.id)}" type="button">Edit</button>
          <button class="bl-button" data-variant="quiet" data-rule-pause="${escapeHtml(rule.id)}" type="button">${rule.active ? "Pause" : "Use again"}</button>
          <button class="bl-button" data-variant="danger" data-rule-forget="${escapeHtml(rule.id)}" type="button">Forget</button>
        </div>`;
    }
    els.productRuleList.append(item);
  }
}

function currentProductCategory() {
  return (els.productCategory?.value || state.preferences.category || "").trim();
}

function addDraftRule({ text, scope = "everywhere", category = currentProductCategory() }) {
  const ruleText = text.trim().slice(0, 240);
  if (!ruleText) return false;
  if (scope === "category" && !category) {
    setCanvasEntryMode("manual");
    els.productReviewStatus.textContent = "Enter a category in Shopping for, then add your category rule. Your rule draft is unchanged.";
    return false;
  }
  const draft = productPreferenceDraft();
  markDraftEdited({ preferences: true });
  state.preferences = normalizePreferencePlane({
    ...draft,
    rules: [...draft.rules, { id: opaqueId("rule"), text: ruleText, scope, category, active: true }],
  });
  setAgent(`Added “${ruleText}” to your draft. Review what we’ll use before sharing it.`);
  renderProductShell();
  return true;
}

function updateDraftRule(id, changes) {
  const current = normalizePreferencePlane(state.preferences);
  const existing = current.rules.find((rule) => rule.id === id);
  if (!existing) return;
  const scope = changes.scope === "category" ? "category" : "everywhere";
  const category = scope === "category" ? (existing.category || currentProductCategory()) : existing.category;
  if (scope === "category" && !category) {
    setCanvasEntryMode("manual");
    els.productReviewStatus.textContent = "Enter a category in Shopping for, then save your category rule. Your rule draft is unchanged.";
    return;
  }
  markDraftEdited({ preferences: true });
  state.preferences = normalizePreferencePlane({
    ...current,
    rules: current.rules.map((rule) => rule.id === id ? { ...rule, ...changes, scope, category } : rule),
  });
  if (id === state.canvasRuleId) settleCanvasWords();
  state.editingRuleId = null;
  renderProductShell();
}

function pauseDraftRule(id) {
  const current = normalizePreferencePlane(state.preferences);
  const existing = current.rules.find((rule) => rule.id === id);
  if (!existing) return;
  markDraftEdited({ preferences: true });
  state.preferences = normalizePreferencePlane({
    ...current,
    rules: current.rules.map((rule) => rule.id === id ? { ...rule, active: !rule.active } : rule),
  });
  setAgent(existing.active ? "That preference is paused. It will not be used until you turn it back on." : "That preference is active again.");
  renderProductShell();
}

function forgetDraftRule(id) {
  const current = normalizePreferencePlane(state.preferences);
  const existing = current.rules.find((rule) => rule.id === id);
  if (!existing) return;
  markDraftEdited({ preferences: true });
  state.preferences = normalizePreferencePlane({ ...current, rules: current.rules.filter((rule) => rule.id !== id) });
  if (id === state.canvasRuleId) settleCanvasWords();
  state.editingRuleId = null;
  setAgent(`Forgot “${existing.text}” from this draft.`);
  renderProductShell();
}

function productPreferenceDraft() {
  return normalizePreferencePlane({ ...state.preferences, category: els.productCategory.value.trim(), maxPrice: els.productMaxPrice.value === "" ? null : Number(els.productMaxPrice.value), feedStyle: els.productStyle.value });
}

function reviewSavedProductPreferences() {
  if (!state.savedPreferences) return;
  markDraftEdited({ preferences: true });
  state.preferences = canvasDraft(state.savedPreferences);
  state.productStage = "preview";
  state.productDraftDirty = false;
  clearCanvasComposer();
  state.canvasReviewVisible = true;
  renderProductShell();
  els.productReviewTitle.focus({ preventScroll: true });
}

function clearCanvasComposer() {
  state.canvasEntryMode = "chat";
  state.canvasReviewVisible = false;
  state.canvasRuleId = null;
  state.canvasReturnSelection = null;
  state.canvasParsedFacts = null;
  state.canvasWordsBase = null;
  state.canvasClarification = "";
  els.canvasWords.value = "";
  els.productCategory.value = state.preferences.category;
  els.productMaxPrice.value = state.preferences.maxPrice ?? "";
  els.canvasClarification.textContent = "";
  els.canvasClarification.hidden = true;
  els.productRuleText.value = "";
  state.editingRuleId = null;
}

function startFreshProductDraft() {
  markDraftEdited({ preferences: true });
  state.preferences = normalizePreferencePlane(DEFAULT_PREFERENCES);
  state.productStage = "preview";
  state.productBuilderVisible = false;
  state.canvasRetention = "once";
  clearCanvasComposer();
  renderProductShell();
  els.canvasWords.focus({ preventScroll: true });
}

function discardCanvasDraft() {
  markDraftEdited({ preferences: true });
  state.preferences = canvasDraft(state.savedPreferences || DEFAULT_PREFERENCES);
  state.productDraftDirty = false;
  state.productStage = "preview";
  state.canvasRetention = "once";
  state.productBuilderVisible = false;
  clearCanvasComposer();
  renderProductShell();
  els.productReviewStatus.textContent = "Draft discarded. Your saved selection is unchanged.";
  els.canvasWords.focus({ preventScroll: true });
}

function returnToProductEntry() {
  if (state.productReviewState === "applying") return;
  state.productStage = "preview";
  state.productReviewState = "review";
  state.canvasReviewVisible = true;
  renderProductShell();
  (state.canvasEntryMode === "manual" ? els.productCategory : els.canvasWords).focus({ preventScroll: true });
}

function forgetSavedSelection() {
  if (!hasStored(STORAGE.preferences) || !window.confirm("Forget the saved selection in this browser? Your account and other saved offer notes stay unchanged.")) return;
  try {
    const remaining = readStored(STORAGE.memory, []).filter((note) => note.kind !== "preference");
    localStorage.setItem(STORAGE.memory, JSON.stringify(remaining));
    localStorage.removeItem(STORAGE.preferences);
    state.memory = state.memory.filter((note) => note.kind !== "preference");
  } catch {
    els.productReviewStatus.textContent = "This browser could not remove all saved preference data. Try again when browser storage is available.";
    return;
  }
  state.hasSavedPreferences = false;
  state.savedPreferences = null;
  // Revokes local sharing authorization without touching hosted account data.
  state.appliedJourneyRevision += 1;
  state.applied = false;
  state.appliedMode = null;
  state.appliedPreferences = normalizePreferencePlane(DEFAULT_PREFERENCES);
  state.contextSnapshot = createContextSnapshot({ profile: state.profile, preferences: DEFAULT_PREFERENCES, applied: false, demoContextGranted: false });
  invalidateAppliedJourney();
  startFreshProductDraft();
  renderMemory();
  els.productReviewStatus.textContent = "Saved selection forgotten in this browser. Nothing is being applied.";
}

function renderProductNetwork() {
  const deals = state.capabilityResolution?.exposed || [];
  const result = canvasResultState({ applying: state.productReviewState === "applying", applied: state.applied, paused: state.networkSharingPaused, supported: SUPPORTED, outcomes: state.originOutcomes, deals, expectedOrigins: PARTNER_ORIGINS });
  els.canvasResults.dataset.state = result.kind;
  els.canvasResults.setAttribute("aria-busy", String(result.kind === "loading"));
  els.canvasResultsTitle.textContent = result.title;
  els.canvasResultsStatus.textContent = result.message;
  const rakutenDeals = Array.isArray(state.rakutenDeals) ? state.rakutenDeals : [];
  const rakutenStatus = state.rakutenStatus || "idle";
  const rakutenMarkup = rakutenStatus === "loading"
    ? `<section class="bl-callout network-summary" data-tone="info"><h3>Out-of-network inventory · Rakuten Advertising</h3><p>Searching live affiliate inventory for this selection…</p></section>`
    : rakutenStatus === "error"
      ? `<section class="bl-callout network-summary" data-tone="warning"><h3>Out-of-network inventory · Rakuten Advertising</h3><p>Live Rakuten inventory is temporarily unavailable. Member-site results are still shown independently.</p></section>`
      : rakutenDeals.length
        ? `<section class="bl-stack rakuten-inventory"><div><h3>Out-of-network inventory · Rakuten Advertising</h3><p class="field-hint">Live affiliate catalog results. These merchants are separate from the three opted-in member sites and open in their own storefronts.</p></div>${rakutenDeals.slice(0, 6).map((deal) => `<article class="product-offer-card">${offerMarkup(deal, "affiliate", "Rakuten · live merchant inventory", state.appliedPreferences)}</article>`).join("")}</section>`
        : `<section class="bl-callout network-summary" data-tone="info"><h3>Out-of-network inventory · Rakuten Advertising</h3><p>No live Rakuten products matched this category and budget. This is a separate no-result from the member-site search.</p></section>`;
  const catalogDeals = Array.isArray(state.catalogDeals) ? state.catalogDeals : [];
  const catalogStatus = state.catalogStatus || "idle";
  const catalogMarkup = catalogStatus === "loading"
    ? `<section class="bl-callout network-summary" data-tone="info"><h3>Out-of-network inventory · public merchant catalogs</h3><p>Searching the attached merchant catalog snapshots for this selection…</p></section>`
    : catalogStatus === "error"
      ? `<section class="bl-callout network-summary" data-tone="warning"><h3>Out-of-network inventory · public merchant catalogs</h3><p>Attached merchant catalogs are temporarily unavailable. Member-site and Rakuten results are still shown independently.</p></section>`
      : catalogDeals.length
        ? `<section class="bl-stack catalog-inventory"><div><h3>Out-of-network inventory · public merchant catalogs</h3><p class="field-hint">Snapshot results from attached public feeds. Each card links directly to its merchant; no affiliate relationship is claimed for these feeds.</p></div>${catalogDeals.slice(0, 6).map((deal) => `<article class="product-offer-card">${offerMarkup(deal, "catalog", `${deal.partnerName || "Merchant catalog"} · public feed`, state.appliedPreferences)}</article>`).join("")}</section>`
        : `<section class="bl-callout network-summary" data-tone="info"><h3>Out-of-network inventory · public merchant catalogs</h3><p>No current public-catalog products matched this category and budget. Unavailable feeds are reported in Network details.</p></section>`;
  const previewMarkup = selfServePreviewMarkup();
  const markup = result.kind === "loading" ? previewMarkup : [
    ...deals.slice(0, 6).map((deal) => `<article class="product-offer-card">${offerMarkup(deal, "optin", `${deal.partnerName || "Member experience"} · matched to your preferences`, state.appliedPreferences)}</article>`),
    previewMarkup,
    `<section class="bl-stack"><h3>Open inventory · separate baseline</h3><p class="field-hint">Public catalog snapshot, independent of your matching results.</p><article class="product-offer-card">${offerMarkup(state.sourceA, "open", "Open selection", DEFAULT_PREFERENCES)}</article></section>`,
    rakutenMarkup,
    catalogMarkup,
  ].join("");
  if (els.canvasResultsFeed.innerHTML !== markup) els.canvasResultsFeed.innerHTML = markup;
  els.canvasNetworkDetails.innerHTML = networkMarkup();
  els.pauseSharing.textContent = state.networkSharingPaused ? "Resume network sharing" : "Pause network sharing";
  els.pauseSharing.setAttribute("aria-disabled", String(result.kind === "loading"));
  if (state.canvasReturnSelection) {
    els.canvasResultsTitle.textContent = "Your selection is ready after sign-in";
    els.canvasResultsStatus.textContent = "Change selection, then choose Show matching offers to check member sites again. Sign-in does not restore permission to apply preferences.";
  }
  els.canvasRetry.hidden = result.kind === "loading" || !state.applied;
  els.canvasSync.hidden = result.kind === "loading" || state.appliedMode !== "saved" || !state.hasSavedPreferences || !hasStored(STORAGE.preferences) || state.productDraftDirty;
}

async function commitCanvasSelection() {
  if (state.productReviewState === "applying") return;
  if (!els.productForm.checkValidity()) {
    setCanvasEntryMode("manual", { focus: false });
    els.productForm.reportValidity();
    return;
  }
  if (state.canvasClarification) { setCanvasEntryMode("chat"); return; }
  // Do not parse again here: corrected/removed interpretation is the approval.
  await applyPreferences({ persist: state.canvasRetention === "saved" });
}

async function retryCanvasResults() {
  if (state.productReviewState === "applying" || !state.applied) return;
  state.productReviewState = "applying";
  renderProductShell();
  renderProductNetwork();
  const revision = state.appliedJourneyRevision + 1;
  try { await rerunAppliedJourney(); }
  catch {
    state.originOutcomes = Object.fromEntries(PARTNER_ORIGINS.map((origin) => [origin, { status: "failed" }]));
    state.discoveryComplete = true;
  }
  if (!state.applied || revision !== state.appliedJourneyRevision) return;
  state.productReviewState = "applied";
  renderJourney();
}

function renderOfferCard(container, markup) {
  container.innerHTML = markup;
}

function partnerDestination(destination) {
  return partnerHandoffUrl(destination, state.appliedPreferences, {
    origins: PARTNER_ORIGINS, applied: state.applied, paused: state.networkSharingPaused,
  });
}

function selfServePreviewMarkup() {
  const preview = previewPartnerHandoff(state.appliedPreferences, ORIGINS, {
    origins: PARTNER_ORIGINS,
    applied: state.applied,
    paused: state.networkSharingPaused,
  });
  if (!preview) return "";
  const partner = PARTNER_NAMES[ORIGINS[preview.partnerId]] || "member storefront";
  return `<section class="bl-callout self-serve-preview" data-tone="info">
    <h4 class="bl-callout__title">Preview this selection on ${escapeHtml(partner)}</h4>
    <p>This visit-only navigation proves the selected category, budget, and presentation reach a member storefront. It is available in ordinary browsers and does not claim that WebMCP matched an offer.</p>
    <div class="bl-actions"><a class="bl-button" data-variant="secondary" href="${escapeHtml(preview.href)}" target="_blank" rel="noopener noreferrer">Open storefront preview</a></div>
  </section>`;
}

function networkMarkup() {
  if (!state.discoveryComplete) return "";
  const exposed = state.capabilityResolution?.exposed || [];
  const origins = [...new Set([...PARTNER_ORIGINS, ...Object.keys(state.originOutcomes)])];
  const rows = origins.map((origin) => {
    const partnerDeals = exposed.filter((deal) => deal.partnerOrigin === origin);
    const eligible = state.capabilityResolution?.eligible.filter((deal) => deal.partnerOrigin === origin).length || 0;
    const outcome = state.originOutcomes[origin] || { status: "failed", reason: "not discovered" };
    const partnerLabel = PARTNER_NAMES[origin] || "Member experience";
    return `<li><strong>${escapeHtml(partnerLabel)}</strong><span>${escapeHtml(safeOrigin(origin))} · ${escapeHtml(outcome.status)} · ${eligible} eligible · ${partnerDeals.length} exposed</span></li>`;
  });
  if (!rows.length) {
    return `<section class="bl-callout network-summary" data-tone="info"><h4 class="bl-callout__title">Network view</h4><p>No opted-in partner capability responded in this browser. The open catalog remains available as the baseline.</p></section>`;
  }
  const catalogSources = Array.isArray(state.catalogMeta?.sources) ? state.catalogMeta.sources : [];
  const catalogFailures = catalogSources.filter((source) => source.status !== "ready");
  const catalogHealth = catalogSources.length
    ? `<p>Public merchant feeds: ${catalogSources.length - catalogFailures.length} ready, ${catalogFailures.length} not currently ready. A not-ready feed is not presented as a match.</p>${catalogFailures.length ? `<ul class="network-list">${catalogFailures.map((source) => `<li><strong>${escapeHtml(source.name || source.host)}</strong><span>${escapeHtml(source.host || "merchant feed")} · ${escapeHtml(source.status)}${source.lastError ? ` · ${escapeHtml(source.lastError)}` : ""}</span></li>`).join("")}</ul>` : ""}`
    : state.catalogStatus === "error"
      ? "<p>Public merchant catalog status is unavailable for this request; no catalog result is substituted.</p>"
      : "";
  return `<section class="bl-callout network-summary" data-tone="info"><h4 class="bl-callout__title">Network view</h4><p>Each opted-in origin is bounded and reported independently. Ranking uses approved context, price, and selected presentation formats.</p><ul class="network-list">${rows.join("")}</ul>${catalogHealth ? `<h4 class="bl-callout__title">Public catalog health</h4>${catalogHealth}` : ""}</section>`;
}

function isWatchHandoffOffer(deal) {
  return deal?.partnerOrigin === ORIGINS.watch
    && typeof deal.sku === "string"
    && typeof deal.name === "string"
    && Number.isFinite(deal.dealPrice)
    && deal.interestEligible === true
    && typeof deal.resolution?.offerId === "string";
}

function watchHandoffOffers(deals = state.capabilityResolution?.exposed || []) {
  return deals.filter(isWatchHandoffOffer);
}

function comparisonMarkup(deals) {
  if (!deals.length) return "";
  const watchOffers = watchHandoffOffers(deals);
  const handoffChoice = watchOffers.length
    ? `<div class="handoff-offer-choice"><label for="watch-handoff-offer">Watch Co offer for target-price handoff</label><p>Choose one ranked Watch Co offer. This changes only the reviewed handoff; it does not call Watch Co or save anything.</p><select id="watch-handoff-offer">${watchOffers.map((deal) => `<option value="${escapeHtml(deal.resolution.offerId)}"${deal.resolution.offerId === state.selectedWatchOfferId ? " selected" : ""}>#${deal.resolution.rank} · ${escapeHtml(deal.name)} · ${money(deal.dealPrice)}</option>`).join("")}</select></div>`
    : "";
  return `<section class="offer-comparison" aria-label="Eligible partner offer comparison"><h4>Compare eligible partner offers</h4>${handoffChoice}<ol>${deals.map((deal) => `<li><strong>#${deal.resolution.rank} · ${escapeHtml(deal.name)}</strong><span>${escapeHtml(deal.partnerName || deal.merchant || "Partner")} · ${money(deal.dealPrice)} · ${escapeHtml(deal.provenance?.sourceLabel || "WebMCP offer tool")}</span><small>${escapeHtml(deal.resolution.relevance)}. ${escapeHtml(deal.provenance?.verification || "Unverified")}</small></li>`).join("")}</ol></section>`;
}

function renderNextStep() {
  const activePreferences = state.applied ? state.appliedPreferences : DEFAULT_PREFERENCES;
  if (state.discoveryComplete && !state.sourceB && state.partnerDeals.length) {
    renderOfferCard(
      els.nextStep,
      `<header class="step-card-head"><div><p class="step-kicker">Site B · no relevant match</p><h3>No opted-in offer matches this context</h3></div><span class="bl-badge source-pill source-optin" data-status="info">Filtered</span></header><p class="offer-copy">The connected partners returned offers, but none met the current profile, category, or price rules. Adjust the draft choices to widen the result set.</p><p class="reason"><strong>Decision receipt</strong><br>${escapeHtml(state.capabilityResolution?.reason || "Eligibility rules")}; ${state.capabilityResolution?.relevant.length || 0} relevant offer${state.capabilityResolution?.relevant.length === 1 ? "" : "s"}.</p>${selfServePreviewMarkup()}${networkMarkup()}`,
    );
    return;
  }
  if (!state.sourceB) {
    renderOfferCard(
      els.nextStep,
      `<header class="step-card-head"><div><p class="step-kicker">Site B · no partner result</p><h3>No opted-in partner offer is available</h3></div><span class="bl-badge source-pill source-open" data-status="neutral">No result</span></header><p class="offer-copy">No partner offer was returned for this request. Jumping Beans will not create a substitute partner result.</p>${selfServePreviewMarkup()}${networkMarkup()}`,
    );
    return;
  }
  const deal = state.sourceB;
  const sourceKind = "optin";
  const destination =
    deal.partnerOrigin || PARTNER_ORIGINS[0] || deal.landing;
  const href = partnerDestination(destination);
  const label = "Site B · adapted by an opted-in partner";
  const openLabel = "Open opted-in Site B";
  const actions = `
    <div class="bl-actions step-actions">
      ${href ? `<a class="bl-button" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${openLabel}</a>` : ""}
      <button class="bl-button" data-variant="secondary" id="show-source" type="button">Explain partner opt-in</button>
    </div>`;
  const comparison = comparisonMarkup(state.capabilityResolution?.exposed || []);
  const withheld = state.capabilityResolution?.withheld || [];
  const withholding = withheld.length ? `<p class="reason"><strong>Withheld offers</strong><br>${withheld.length} offer${withheld.length === 1 ? " was" : "s were"} withheld: ${escapeHtml(withheld.map((item) => item.reason).join("; "))}</p>` : "";
  renderOfferCard(
    els.nextStep,
    offerMarkup(deal, sourceKind, label, activePreferences) + comparison + withholding + actions + networkMarkup(),
  );
  document.getElementById("show-source")?.addEventListener("click", () => {
    setAgent(
      "The baseline offer did not require merchant participation. This Site B response did: the partner opted in to expose structured offer data and optional collateral through WebMCP.",
    );
  });
  document.getElementById("watch-handoff-offer")?.addEventListener("change", (event) => {
    const next = watchHandoffOffers().find((offer) => offer.resolution.offerId === event.target.value);
    if (!next) return;
    state.selectedWatchOfferId = next.resolution.offerId;
    state.pendingWatch = null;
    setAgent(`Selected ${next.name} from Watch Co for a possible target-price handoff. Nothing was saved, sent, or invoked.`);
    renderJourney();
  });
}

function renderControls() {
  els.controls.querySelectorAll("[data-pref]").forEach((input) => {
    input.checked = state.preferences.formats.includes(input.dataset.pref);
  });
  if (els.demoProfile) els.demoProfile.value = state.profile.personaId;
}

function preferenceFact() {
  const labels = state.preferences.formats
    .map((format) => formatLabels[format])
    .filter(Boolean);
  const facts = labels.length
    ? `show ${labels.join(", ").toLowerCase()}`
    : "use the default offer presentation";
  const price = state.preferences.maxPrice == null
    ? ""
    : ` and keep offers at or below ${money(state.preferences.maxPrice)}`;
  const rememberedOffer = state.pendingRemember
    ? ` Also remember that you chose ${state.sourceA.name}.`
    : "";
  return `Useful fact: ${facts}${price}.${rememberedOffer}`;
}

function preferenceOutcome() {
  const savedRecords = state.pendingRemember
    ? "a local display rule and matching offer note"
    : "a local display rule";
  return `Save ${savedRecords} and apply the rule to Site B; no order, payment, or message is created`;
}

function renderMemoryPreview() {
  els.memoryPreview.textContent = preferenceFact();
  els.memoryOutcome.textContent = preferenceOutcome();
}

function renderRules() {
  const formats = state.preferences.formats.filter((format) => formatLabels[format]);
  const list = document.createElement("ul");
  list.className = "rule-list";
  const rules = formats.length
    ? formats.map((format) => [formatLabels[format], "selected"])
    : [["Default presentation", "selected"]];
  if (state.preferences.maxPrice != null) {
    rules.push(["Price ceiling", money(state.preferences.maxPrice)]);
  }
  for (const [label, value] of rules) {
    const item = document.createElement("li");
    item.className = "rule";
    const name = document.createElement("span");
    const current = document.createElement("span");
    name.textContent = label;
    current.textContent = value;
    item.append(name, current);
    list.append(item);
  }
  els.rules.replaceChildren(list);
}

function renderMemory() {
  const items = state.memory.slice(0, 6);
  els.memoryList.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "empty-memory";
    empty.textContent = state.hasSavedPreferences
      ? "A saved display preference is loaded. Use Forget all to remove it."
      : "Nothing is saved. Apply once to keep this journey temporary.";
    els.memoryList.append(empty);
  } else {
    for (const item of items) {
      const row = document.createElement("li");
      row.className = "memory-item";
      const title = document.createElement("strong");
      const detail = document.createElement("span");
      const time = document.createElement("time");
      const forget = document.createElement("button");
      title.textContent = item.title || item.name || "Offer note";
      detail.textContent = item.detail || item.reason || (state.memorySource === "account" ? "Saved to your hosted account" : "Saved to this browser");
      time.dateTime = item.observedAt || "";
      time.textContent = item.observedAt
        ? `Saved ${absoluteTime(item.observedAt)}`
        : "Saved time unavailable";
      forget.type = "button";
      forget.className = "bl-button";
      forget.dataset.variant = "danger";
      forget.dataset.memoryKey = item.key || "";
      forget.textContent = `Forget ${title.textContent}`;
      row.append(title, detail, time, forget);
      els.memoryList.append(row);
    }
  }
  els.memoryCue.textContent = items.length
    ? `Using ${items.length} saved product note${items.length === 1 ? "" : "s"}.`
    : state.hasSavedPreferences
      ? "Using one saved display preference."
      : "Using no saved product notes.";
  els.forgetAll.hidden = !items.length && !state.hasSavedPreferences;
}

function markDraftEdited({ preferences = false } = {}) {
  state.draftRevision += 1;
  if (preferences) {
    state.preferenceSource = "browser";
    state.productReviewState = "review";
    state.productApplyMode = null;
    state.productDraftDirty = true;
  }
}

function hydrateAccountJourney(account, requestDraftRevision, hasBrowserPersistence) {
  const hydrated = accountJourneyHydration({
    account,
    hasBrowserPersistence,
    requestDraftRevision,
    currentDraftRevision: state.draftRevision,
    preferences: state.preferences,
    memory: state.memory,
  });
  if (!hydrated) return false;
  state.preferences = canvasDraft(hydrated.preferences);
  state.appliedPreferences = normalizePreferencePlane(hydrated.appliedPreferences);
  state.memory = hydrated.memory;
  state.preferenceSource = hydrated.preferenceSource;
  state.memorySource = hydrated.memorySource;
  state.hasSavedPreferences = hydrated.hasSavedPreferences;
  state.savedPreferences = hydrated.hasSavedPreferences
    ? normalizePreferencePlane(hydrated.preferences)
    : null;
  state.productDraftDirty = false;
  if (hydrated.hasSavedPreferences && state.productStage === "empty") {
    state.productStage = "saved";
    state.productReturnStage = "saved";
  }
  state.contextSnapshot = createContextSnapshot({ profile: state.profile, preferences: state.preferences, applied: false, demoContextGranted: state.demoContextGranted });
  renderJourney();
  return true;
}

function renderAccount() {
  const scrollPosition = window.scrollY;
  try {
    const signedIn = state.account.signedIn === true;
    const ready = state.accountAvailability === "ready";
    els.headerAccount.textContent = signedIn ? "Account" : "Sign in";
    els.headerAccount.setAttribute("aria-label", signedIn ? "Account, signed in" : "Sign in");
    els.headerAccount.toggleAttribute("aria-current", state.currentView === "account");
    if (state.currentView === "account") els.headerAccount.setAttribute("aria-current", "page");
    els.accountBadge.textContent = signedIn ? "Signed in" : "Not signed in";
    els.accountBadge.dataset.status = signedIn ? "success" : "info";
    els.accountLogin.hidden = signedIn;
    els.accountLogin.setAttribute("aria-disabled", String(!ready));
    els.accountDetails.hidden = !signedIn;
    els.accountRetry.hidden = ready || state.accountAvailability === "loading";
    els.accountRetry.setAttribute("aria-disabled", String(state.accountAvailability === "loading"));
    els.accountDraftNotice.hidden = signedIn;
    els.accountContinue.textContent = signedIn ? "Return to your workspace" : "Continue without signing in";
    const backView = accountReturnView(state.accountReturnView);
    const backLabel = backView === "product" && state.productStage === "results" ? "your results" : { product: "preferences", network: "your results", demo: "Demo" }[backView];
    els.accountBack.textContent = `Back to ${backLabel}`;
    els.accountBack.href = els.accountContinue.href = backView === "product" ? "#product" : `#${backView}`;
    els.accountGateTitle.textContent = signedIn ? "Choose your account action" : { save: "Sign in to sync", import: "Sign in to import memory", profile: "Sign in to edit your profile" }[accountIntent(state.accountIntent)];
    els.accountGateCopy.textContent = accountGateCopy(state.accountIntent, signedIn);
    for (const button of document.querySelectorAll(".account-view [data-account-intent]")) button.setAttribute("aria-pressed", String(button.dataset.accountIntent === state.accountIntent));
    els.accountStatus.textContent = (!signedIn ? state.account.error : "") || (state.accountAvailability === "loading"
      ? "Checking account access. You can keep using this browser’s workspace."
      : signedIn ? "Signed in. Account data stays separate from your local draft and is never sent to partners."
        : "You’re using this browser without an account. Sign in only when you want account features.");
    for (const button of els.accountDetails.querySelectorAll("button")) button.setAttribute("aria-disabled", String(!ready || state.accountBusy));
    els.accountDetails.setAttribute("aria-busy", String(state.accountBusy));
    if (!signedIn) {
      els.accountDisplayName.value = "";
      els.accountImportConfirm.checked = false;
      els.accountPreferencePreview.replaceChildren();
      els.accountImportPreview.replaceChildren();
      els.accountImportProfile.textContent = "";
      els.accountMemorySummary.textContent = "";
      els.accountActionStatus.textContent = "";
      return;
    }
    for (const intent of ["save", "import", "profile"]) {
      document.getElementById(`account-${intent}-title`).parentElement.hidden = state.accountIntent !== intent;
    }
    document.getElementById("account-draft-review").hidden = state.accountIntent === "profile";
    if (state.account.error) els.accountActionStatus.textContent = state.account.error;
    // Keep a typed nickname through background status refreshes and failures.
    if (!els.accountDisplayName.dataset.edited) els.accountDisplayName.value = accountDisplayName(state.account.profile?.displayName);
    const importName = accountDisplayName(els.accountDisplayName.value);
    els.accountImportProfile.textContent = importName ? `Account display name to import: ${importName}` : "No account display name entered.";
    const count = Array.isArray(state.account.memory) ? state.account.memory.length : 0;
    els.accountMemorySummary.textContent = count ? `Your account has ${count} saved product note${count === 1 ? "" : "s"}.` : "Your account has no saved product notes.";
    els.accountPreferencePreview.replaceChildren();
    const active = normalizePreferencePlane(state.preferences);
    const preview = [`${active.feedStyle} style${active.category ? ` for ${active.category}` : " everywhere"}`, ...(active.maxPrice == null ? [] : [`Price ceiling: ${money(active.maxPrice)}`]), ...active.rules.map((rule) => `${rule.active ? "Active" : "Paused"} · ${rule.scope === "category" ? rule.category : "Everywhere"}: ${rule.text}`)];
    for (const text of preview) {
      const item = document.createElement("li");
      item.textContent = text;
      els.accountPreferencePreview.append(item);
    }
    els.accountImportPreview.replaceChildren();
    const browserNotes = accountBrowserMemory();
    for (const note of browserNotes) {
      const item = document.createElement("li");
      item.textContent = `${note.title || "Product note"}: ${note.detail || ""}`;
      els.accountImportPreview.append(item);
    }
    if (!browserNotes.length) {
      const item = document.createElement("li");
      item.textContent = "No browser product notes to import. Only the rules above and your account display name will be uploaded.";
      els.accountImportPreview.append(item);
    }
  } finally {
    // Account status and retry controls can grow during a request. Keep the
    // current page position; only an explicit navigation changes it.
    window.scrollTo({ top: scrollPosition, behavior: "instant" });
  }
}

function accountBrowserMemory() {
  const notes = readStored(STORAGE.memory, []);
  return Array.isArray(notes) ? notes.filter((note) => note && typeof note === "object").slice(0, 30).map(({ key, title, detail, observedAt }) => ({ key, title, detail, observedAt })) : [];
}

function openAccount(intent = "save", trigger = document.activeElement) {
  const enteringAccount = state.currentView !== "account";
  if (enteringAccount) {
    state.accountReturnView = accountReturnView(state.currentView);
    state.accountReturnFocus = trigger;
    state.accountReturnScroll = window.scrollY;
    state.accountDraftFields = captureAccountDraftFields();
    history.pushState(null, "", `${location.pathname}${location.search}#account`);
  }
  state.accountIntent = accountIntent(intent);
  switchView("account", { focusHeading: true });
  if (enteringAccount) window.scrollTo({ top: 0, behavior: "instant" });
  els.accountGateTitle.focus({ preventScroll: true });
}

function returnFromAccount(event) {
  event?.preventDefault();
  switchView(accountReturnView(state.accountReturnView));
  restoreAccountDraftFields();
  // Explicit Back restores the origin's position and focus, including a draft
  // editor. Background account changes never navigate or move page position.
  window.scrollTo({ top: state.accountReturnScroll, behavior: "instant" });
  if (state.accountReturnFocus?.isConnected) state.accountReturnFocus.focus({ preventScroll: true });
  else els.productTitle?.focus({ preventScroll: true });
}

function restoreAccountDraft() {
  let draft;
  try { draft = readAccountDraft(sessionStorage); } catch { return; }
  if (!draft) return;
  state.preferences = normalizePreferencePlane(draft.preferences);
  state.draftRevision += 1;
  state.preferenceSource = "browser";
  state.accountDraftRestored = true;
  state.accountDraftFields = draft.fields;
  state.accountIntent = draft.intent;
  state.accountReturnView = draft.returnView;
  state.accountReturnScroll = draft.returnScroll;
  state.accountReturnFocus = document.getElementById(draft.returnFocus);
  state.productStage = draft.productStage;
  state.canvasRetention = draft.canvasRetention || "once";
  state.canvasRuleId = draft.canvasRuleId || null;
  state.canvasReturnSelection = draft.resultSelection || null;
  const restoredWords = interpretPreferenceWords(draft.fields["product-prompt-input"]);
  state.canvasClarification = restoredWords.clarification;
  // The restored summary remains authoritative. Unchanged prose must not undo
  // manual corrections after the existing account draft return.
  state.canvasParsedFacts = { category: restoredWords.category, maxPrice: restoredWords.maxPrice, maxPriceInclusive: restoredWords.maxPriceInclusive };
  state.canvasWordsBase = { category: state.preferences.category, maxPrice: state.preferences.maxPrice, maxPriceInclusive: state.preferences.maxPriceInclusive };
  els.canvasClarification.textContent = state.canvasClarification;
  els.canvasClarification.hidden = !state.canvasClarification;
  state.productReturnStage = draft.productReturnStage;
  state.productSetupPath = draft.productSetupPath;
  state.productBuilderVisible = draft.productBuilderVisible;
  state.editingRuleId = draft.editingRuleId;
  state.productReviewState = draft.productStage === "preview" ? "review" : "idle";
  state.productDraftDirty = true;
  renderJourney();
  restoreAccountDraftFields();
}

function captureAccountDraftFields() {
  const fields = Object.fromEntries(["product-category", "product-max-price", "product-style", "product-prompt-input", "product-rule-text", "product-rule-scope", "preview-words-input"].map((id) => [id, document.getElementById(id)?.value || ""]));
  fields["rule-edit-text"] = document.getElementById(`rule-edit-${state.editingRuleId}`)?.value || "";
  fields["rule-edit-scope"] = document.getElementById(`rule-scope-${state.editingRuleId}`)?.value || "everywhere";
  return fields;
}

function restoreAccountDraftFields() {
  for (const [id, value] of Object.entries(state.accountDraftFields || {})) {
    const targetId = id === "rule-edit-text" ? `rule-edit-${state.editingRuleId}` : id === "rule-edit-scope" ? `rule-scope-${state.editingRuleId}` : id;
    const input = document.getElementById(targetId);
    if (input) input.value = value;
  }
}

function accountFailure() {
  state.account.error = "The account action could not be completed. Your local draft is unchanged. Check account access again before retrying; browsing and browser-only actions remain available.";
  state.accountAvailability = "unavailable";
  renderAccount();
}

async function accountRequest(path, payload) {
  // This is only a same-origin account request. WebMCP partner discovery and
  // invocation stay native browser APIs and never receive account credentials.
  if (state.accountBusy || state.accountAvailability !== "ready" || state.account.signedIn !== true || !state.account.csrfToken) throw new Error("account-unavailable");
  state.accountBusy = true;
  els.accountActionStatus.textContent = "Updating your account…";
  renderAccount();
  try {
    const response = await fetch(path, {
      method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(10000),
      headers: { "content-type": "application/json", "x-jb-csrf": state.account.csrfToken },
      body: JSON.stringify(payload),
    });
    const next = await response.json();
    if (!response.ok || typeof next?.signedIn !== "boolean" || (path !== "/api/account/logout" && !next.signedIn)) {
      if (response.status === 401 || response.status === 403 || next?.signedIn === false) state.account = { signedIn: false, csrfToken: null };
      throw new Error("account-request-failed");
    }
    state.account = { ...mergeAccountResponse(state.account, next), error: "" };
    return next;
  } finally {
    state.accountBusy = false;
    renderAccount();
  }
}

async function loadAccount() {
  const requestDraftRevision = state.draftRevision;
  const hasBrowserPersistence = state.accountDraftRestored || hasStored(STORAGE.preferences) || hasStored(STORAGE.memory);
  state.accountAvailability = "loading";
  state.account.error = "";
  els.accountActionStatus.textContent = "";
  renderAccount();
  try {
    const response = await fetch("/api/account", { credentials: "same-origin", signal: AbortSignal.timeout(10000), headers: { accept: "application/json" } });
    const account = await response.json();
    if (!response.ok || typeof account?.signedIn !== "boolean" || (!account.signedIn && account.signInAvailable !== true) || (account.signedIn && !account.csrfToken)) throw new Error("account-unavailable");
    state.account = { ...account, error: "" };
    state.accountAvailability = "ready";
    hydrateAccountJourney(account, requestDraftRevision, hasBrowserPersistence);
  } catch {
    state.account = { signedIn: false, csrfToken: null, error: "Hosted account service is unavailable. Your draft is kept here; you can continue anonymously or check again." };
    state.accountAvailability = "unavailable";
  }
  renderAccount();
}

function addMemory(title, detail, kind) {
  const key = `${kind}:${title}:${detail}`;
  if (state.memory.some((item) => item.key === key)) return true;
  state.memory.unshift({
    key,
    title,
    detail,
    kind,
    scope: "product",
    retention: "until-forgotten",
    observedAt: new Date().toISOString(),
  });
  state.memory = state.memory.slice(0, 30);
  state.memorySource = "browser";
  const saved = writeStored(STORAGE.memory, state.memory);
  renderMemory();
  return saved;
}

function forgetMemory(key) {
  const item = state.memory.find((entry) => entry.key === key);
  state.memory = state.memory.filter((entry) => entry.key !== key);
  state.memorySource = "browser";
  writeStored(STORAGE.memory, state.memory);
  if (item?.kind === "preference") {
    removeStored(STORAGE.preferences);
    state.hasSavedPreferences = false;
    state.savedPreferences = null;
    if (state.productStage === "saved") state.productStage = "empty";
    state.productReturnStage = "empty";
  }
  recordEvent("memory.deleted", {
    capabilityId: "memory.forget",
    capabilityVersion: "1.0.0",
    scope: "Jumping Beans product in this browser",
    keyType: item?.kind || "unknown",
  });
  renderJourney();
  showToast("Saved note forgotten");
}

function forgetAllMemory() {
  state.appliedJourneyRevision += 1;
  markDraftEdited({ preferences: true });
  state.memory = [];
  state.pendingWatch = null;
  state.selectedWatchOfferId = null;
  state.pendingRemember = false;
  state.preferences = {
    ...DEFAULT_PREFERENCES,
    formats: [...DEFAULT_PREFERENCES.formats],
  };
  state.appliedPreferences = {
    ...DEFAULT_PREFERENCES,
    formats: [...DEFAULT_PREFERENCES.formats],
  };
  state.applied = false;
  state.appliedMode = null;
  state.demoContextGranted = false;
  els.demoContext.checked = false;
  state.partnerDeals = [];
  state.rakutenDeals = [];
  state.rakutenStatus = "idle";
  state.rakutenMeta = null;
  state.catalogDeals = [];
  state.catalogStatus = "idle";
  state.catalogMeta = null;
  state.sourceB = null;
  state.originOutcomes = {};
  state.capabilityResolution = null;
  state.decisionReceipt = null;
  state.contextSnapshot = createContextSnapshot({ profile: state.profile, preferences: state.preferences, applied: false, demoContextGranted: false });
  state.hasSavedPreferences = false;
  state.savedPreferences = null;
  state.productStage = "empty";
  state.productReturnStage = "empty";
  state.productSetupPath = null;
  state.productBuilderVisible = false;
  state.productReviewState = "idle";
  state.productDraftDirty = false;
  state.canvasRetention = "once";
  clearCanvasComposer();
  Object.values(STORAGE).forEach(removeStored);
  recordEvent("memory.deleted", {
    capabilityId: "memory.forget",
    capabilityVersion: "1.0.0",
    scope: "Jumping Beans product in this browser",
    all: true,
  });
  setAgent("I forgot the saved display rules and offer notes from this browser.");
  renderJourney();
  showToast("All saved offer memory forgotten");
}

function setAgent(message) {
  els.agent.textContent = message;
}

function renderJourney() {
  renderMemoryStep();
  renderNextStep();
  renderControls();
  renderMemoryPreview();
  renderRules();
  renderMemory();
  els.watchConfirmation.hidden = !state.pendingWatch;
  els.watchButton.hidden = Boolean(state.pendingWatch);
  if (state.pendingWatch) {
    els.watchTitle.textContent = "Review this Watch Co handoff";
    els.watchDetail.textContent = "Review the exact product and target price before opening Watch Co's independent confirmation flow.";
    els.watchFact.textContent = `Useful fact: surface ${state.pendingWatch.name} below ${money(state.pendingWatch.target)}.`;
  } else {
    els.watchTitle.textContent = "Want to share a Watch Co target price?";
    els.watchDetail.textContent = "Stage one Watch Co product and target price for review. Jumping Beans does not save or monitor it.";
    els.watchButton.textContent = "Prepare Watch Co handoff";
  }
  renderProductShell();
  renderProductNetwork();
}

async function applyPreferences({ persist }) {
  if (state.productReviewState === "applying") return;
  markDraftEdited({ preferences: true });
  state.productStage = "results";
  state.canvasSaveFailed = false;
  state.canvasReturnSelection = null;
  state.productReviewState = "applying";
  state.productApplyMode = persist ? "saved" : "once";
  state.applied = true;
  state.appliedMode = persist ? "saved" : "once";
  state.appliedPreferences = {
    ...state.preferences,
    formats: [...state.preferences.formats],
  };
  state.contextSnapshot = createContextSnapshot({
    profile: state.profile,
    preferences: state.appliedPreferences,
    applied: true,
    demoContextGranted: state.demoContextGranted,
  });
  recordEvent("user.intervention", {
    capabilityId: "preferences.apply",
    capabilityVersion: "1.0.0",
    mode: state.appliedMode,
    persisted: Boolean(persist),
  });
  if (persist) {
    const sharingWasPaused = state.networkSharingPaused;
    const preferencesSaved = writeStored(STORAGE.preferences, state.appliedPreferences);
    if (!sharingWasPaused) writeStored(STORAGE.networkSharing, true);
    state.networkSharingPaused = sharingWasPaused;
    state.hasSavedPreferences = preferencesSaved || Boolean(state.savedPreferences);
    if (!preferencesSaved) { state.appliedMode = "once"; state.canvasSaveFailed = true; }
    if (preferencesSaved) {
      state.productReturnStage = "saved";
      state.savedPreferences = normalizePreferencePlane(state.appliedPreferences);
    }
    state.preferenceSource = "browser";
    const labels = state.appliedPreferences.formats
      .map((format) => formatLabels[format] || format)
      .join(" · ") || "Default presentation";
    const memorySaved = preferencesSaved && addMemory("Display preference", labels, "preference");
    if (preferencesSaved && state.pendingRemember) {
      addMemory(
        "Offer remembered",
        `${state.sourceA.name} from ${state.sourceA.sourceLabel}`,
        "impression",
      );
    }
    state.pendingRemember = false;
    setAgent(
      preferencesSaved
        ? "Saved in this browser. Checking member sites with only the approved preference plane."
        : "This browser could not save the preference. Checking member sites for this visit only.",
    );
    showToast(preferencesSaved ? (memorySaved ? "Display rules saved; checking offers" : "Preferences saved; checking offers") : "Checking offers for this visit only");
  } else {
    state.pendingRemember = false;
    setAgent("Checking member sites with this one-time selection. No display preference or offer note was saved.");
    showToast("Checking offers for this visit only");
  }
  state.productDraftDirty = false;
  renderJourney();
  const revision = state.appliedJourneyRevision + 1;
  if (state.currentView === "product") els.canvasResultsTitle.focus({ preventScroll: true });
  try {
    await rerunAppliedJourney();
  } catch {
    state.originOutcomes = Object.fromEntries(PARTNER_ORIGINS.map((origin) => [origin, { status: "failed" }]));
    state.discoveryComplete = true;
  }
  if (state.appliedJourneyRevision !== revision || !state.applied) return;
  if (hasSuccessfulPartnerApplication()) {
    recordEvent("journey.outcome", {
      outcomeType: "preference_applied",
      status: "partner_acknowledged",
      mode: state.appliedMode,
    });
    const appliedTo = Object.values(state.originOutcomes).filter((outcome) => ["ready", "no-match"].includes(outcome?.status)).length;
    setAgent(`Your approved selection was applied to ${appliedTo} member site${appliedTo === 1 ? "" : "s"}. ${state.appliedMode === "saved" ? "Your preference remains saved in this browser." : "Nothing was saved."}`);
    showToast("Member-site preferences applied");
  }
  state.productReviewState = "applied";
  state.productApplyMode = null;
  renderJourney();
}

function invalidateAppliedJourney() {
  state.pendingWatch = null;
  state.selectedWatchOfferId = null;
  state.partnerDeals = [];
  state.rakutenDeals = [];
  state.rakutenStatus = "idle";
  state.rakutenMeta = null;
  state.catalogDeals = [];
  state.catalogStatus = "idle";
  state.catalogMeta = null;
  state.sourceB = null;
  state.discoveryComplete = false;
  state.originOutcomes = {};
  state.capabilityResolution = null;
  state.decisionReceipt = null;
}

async function rerunAppliedJourney() {
  const revision = ++state.appliedJourneyRevision;
  invalidateAppliedJourney();
  state.rakutenStatus = "loading";
  state.catalogStatus = "loading";
  renderJourney();
  const [partnerResult, rakutenResult, catalogResult] = await Promise.allSettled([
    discoverPartnerDeals(state.appliedPreferences),
    fetchRakutenDeals(state.appliedPreferences),
    fetchCatalogDeals(state.appliedPreferences),
  ]);
  if (revision !== state.appliedJourneyRevision) return;
  applyPartnerDiscovery(partnerResult.status === "fulfilled"
    ? partnerResult.value
    : { deals: [], originOutcomes: {} });
  if (rakutenResult.status === "fulfilled") {
    state.rakutenDeals = rakutenResult.value.deals;
    state.rakutenMeta = rakutenResult.value.meta;
    state.rakutenStatus = "ready";
  } else {
    state.rakutenDeals = [];
    state.rakutenMeta = null;
    state.rakutenStatus = "error";
  }
  if (catalogResult.status === "fulfilled") {
    state.catalogDeals = catalogResult.value.deals;
    state.catalogMeta = catalogResult.value.meta;
    state.catalogStatus = "ready";
  } else {
    state.catalogDeals = [];
    state.catalogMeta = null;
    state.catalogStatus = "error";
  }
  renderJourney();
}

function handlePrompt(value) {
  markDraftEdited({ preferences: true });
  const text = value.toLowerCase();
  if (text.includes("proof") || text.includes("testimonial")) {
    state.preferences.formats = [
      ...new Set([...state.preferences.formats, "testimonial", "price-proof"]),
    ];
  }
  if (text.includes("video")) {
    state.preferences.formats = [...new Set([...state.preferences.formats, "video"] )];
  }
  if (text.includes("pressure") || text.includes("urgency")) {
    state.preferences.formats = [
      ...new Set([...state.preferences.formats, "no-urgency"]),
    ];
  }
  if (text.includes("under $30") || text.includes("below $30")) {
    state.preferences.maxPrice = 30;
  }
  if (text.includes("remember")) state.pendingRemember = true;
  const category = currentProductCategory();
  state.preferences = normalizePreferencePlane({
    ...state.preferences,
    category: category || state.preferences.category,
    rules: [...state.preferences.rules, { id: opaqueId("rule"), text: value, scope: "everywhere", category, active: true }],
  });
  setAgent(`I updated the draft choices from “${value}”. Review the exact fact and choose whether to save it or apply it once.`);
  renderJourney();
}

function selectedWatchOffer() {
  return watchHandoffOffers().find((deal) => deal.resolution.offerId === state.selectedWatchOfferId) || null;
}

function prepareDealWatch(targetPrice) {
  const offer = selectedWatchOffer();
  if (!offer) {
    setAgent("A Watch Co offer must be the selected opted-in result before Jumping Beans can prepare a Watch Co handoff. Nothing was saved or sent.");
    return false;
  }
  const defaultTarget = Math.max(1, offer.dealPrice - 5);
  const target = Number(targetPrice ?? defaultTarget);
  const formattedTarget = Number.isFinite(target) ? target.toFixed(2) : "";
  const canonicalTarget = Number(formattedTarget);
  if (!Number.isFinite(target) || target <= 0 || !Number.isSafeInteger(Math.round(target * 100)) || Math.abs(target - canonicalTarget) > 1e-9) {
    setAgent("A target price must be a positive USD amount with no more than two decimal places. Nothing was saved or sent.");
    return false;
  }
  state.pendingWatch = {
    sku: offer.sku,
    name: offer.name,
    target: canonicalTarget,
    stagedAt: new Date().toISOString(),
  };
  recordEvent("capability.invocation.succeeded", {
    capabilityId: "deal_watch.stage",
    capabilityVersion: "1.0.0",
    outcomeType: "watch_handoff_staged",
    persisted: false,
  });
  setAgent(`I staged a Watch Co handoff for ${offer.name} below ${money(target)}. Review the exact terms before opening Watch Co; nothing was saved or sent.`);
  renderJourney();
  els.confirmWatch.focus();
  return true;
}

function watchHandoffUrl(watch) {
  const destination = safeUrl(ORIGINS.watch);
  if (!destination) return null;
  destination.searchParams.set("jb_watch_product", watch.sku);
  destination.searchParams.set("jb_target_price", watch.target.toFixed(2));
  return destination.href;
}

function handoffPendingWatch() {
  if (!state.pendingWatch) return;
  const href = watchHandoffUrl(state.pendingWatch);
  if (!href) {
    setAgent("Watch Co's handoff address is unavailable. Nothing was saved or sent.");
    return;
  }
  recordEvent("journey.outcome", {
    capabilityId: "deal_watch.stage",
    capabilityVersion: "1.0.0",
    outcomeType: "watch_handoff_opened",
    persisted: false,
    scope: "Watch Co handoff URL only",
  });
  location.assign(href);
}

function cancelPendingWatch() {
  state.pendingWatch = null;
  setAgent("The staged Watch Co handoff was discarded. Nothing was saved or sent.");
  renderJourney();
  els.watchButton.focus();
}

function setDealWatch() {
  prepareDealWatch();
  renderJourney();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.dataset.on = "1";
  window.setTimeout(() => {
    els.toast.dataset.on = "0";
  }, 2400);
}

function toggleNetworkSharing() {
  state.networkSharingPaused = !state.networkSharingPaused;
  writeStored(STORAGE.networkSharing, !state.networkSharingPaused);
  if (state.networkSharingPaused) {
    state.appliedJourneyRevision += 1;
    invalidateAppliedJourney();
    setAgent("Network sharing is paused. Your saved preferences remain in Jumping Beans.");
    renderJourney();
    return;
  }
  setAgent("Network sharing resumed. Connected member sites can use your saved preferences.");
  renderJourney();
  if (state.applied) void rerunAppliedJourney();
}

document.querySelectorAll("[data-engine-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    link.closest("details")?.removeAttribute("open");
    switchView(link.dataset.engineLink, { focusHeading: true });
  });
});

document.querySelectorAll("[data-engine-view]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.engineView, { focusHeading: true }));
});

els.productReviewSaved.addEventListener("click", reviewSavedProductPreferences);
els.productStartFresh.addEventListener("click", startFreshProductDraft);
els.productForgetSaved.addEventListener("click", forgetSavedSelection);
document.getElementById("canvas-discard").addEventListener("click", discardCanvasDraft);
els.productKeepEditing.addEventListener("click", returnToProductEntry);
els.canvasBackResults.addEventListener("click", () => {
  state.productStage = "results";
  renderProductShell();
  renderProductNetwork();
  els.canvasResultsTitle.focus({ preventScroll: true });
});
els.productBuilder.addEventListener("toggle", () => { state.productBuilderVisible = els.productBuilder.open; });
els.productForm.addEventListener("submit", (event) => event.preventDefault());
for (const input of [els.productCategory, els.productMaxPrice, els.productStyle]) {
  input.addEventListener(input === els.productStyle ? "change" : "input", () => {
    markDraftEdited({ preferences: true });
    state.preferences = productPreferenceDraft();
    if (input === els.productMaxPrice) delete state.preferences.maxPriceInclusive;
    if (input === els.productStyle) state.preferences = normalizePreferencePlane({ ...state.preferences, ...selectStarterStyle(input.value) });
    renderProductReview();
  });
}
els.canvasWords.addEventListener("input", updateCanvasWords);
document.querySelectorAll("[data-self-serve-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.productReviewState === "applying") return;
    els.canvasWords.value = button.dataset.selfServePrompt;
    updateCanvasWords();
    state.preferences = normalizePreferencePlane({
      ...state.preferences,
      feedStyle: button.dataset.feedStyle,
      formats: button.dataset.formats ? button.dataset.formats.split(",").filter(Boolean) : [],
    });
    state.canvasReviewVisible = true;
    renderProductShell();
    els.productReviewTitle.focus({ preventScroll: true });
  });
});
els.canvasEnterManual.addEventListener("click", () => setCanvasEntryMode("manual"));
els.canvasBackChat.addEventListener("click", () => setCanvasEntryMode("chat"));
els.canvasChatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  reviewCanvasSelection();
});
els.canvasFormats.addEventListener("change", () => {
  markDraftEdited({ preferences: true });
  state.preferences.formats = [...els.canvasFormats.querySelectorAll("input:checked")].map((input) => input.value);
  renderProductReview();
});
els.productReviewRules.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-fact-edit]");
  const remove = event.target.closest("[data-fact-remove]");
  if (edit) editCanvasFact(edit.dataset.factEdit);
  if (remove) removeCanvasFact(remove.dataset.factRemove);
});
for (const input of [els.canvasVisit, els.canvasSave]) input.addEventListener("change", () => {
  state.canvasRetention = input.value;
  renderProductReview();
});
els.canvasShowOffers.addEventListener("click", commitCanvasSelection);
els.canvasRetry.addEventListener("click", retryCanvasResults);

els.productRuleForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (addDraftRule({ text: els.productRuleText.value, scope: els.productRuleScope.value })) {
    els.productRuleText.value = "";
    els.productRuleText.focus();
  }
});

els.productRuleList?.addEventListener("click", (event) => {
  const edit = event.target.closest("button[data-rule-edit]");
  const pause = event.target.closest("button[data-rule-pause]");
  const forget = event.target.closest("button[data-rule-forget]");
  const cancel = event.target.closest("button[data-rule-cancel]");
  if (edit) {
    state.editingRuleId = edit.dataset.ruleEdit;
    renderProductShell();
    document.getElementById(`rule-edit-${state.editingRuleId}`)?.focus();
  } else if (pause) {
    pauseDraftRule(pause.dataset.rulePause);
  } else if (forget) {
    forgetDraftRule(forget.dataset.ruleForget);
  } else if (cancel) {
    state.editingRuleId = null;
    renderProductShell();
  }
});

els.productRuleList?.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-rule-edit]");
  if (!form) return;
  event.preventDefault();
  const text = new FormData(form).get("text");
  if (!String(text || "").trim()) {
    form.querySelector('[name="text"]')?.focus();
    return;
  }
  updateDraftRule(form.dataset.ruleEdit, { text: String(text), scope: new FormData(form).get("scope") });
});

els.pauseSharing?.addEventListener("click", () => { if (state.productReviewState !== "applying") void toggleNetworkSharing(); });

document.querySelectorAll("[data-open-engine-view]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.openEngineView));
});

window.addEventListener("hashchange", () => {
  const view = location.hash.slice(1) || "product";
  if (state.currentView === "account" && view === state.accountReturnView) returnFromAccount();
  else switchView(view);
});

els.controls.addEventListener("change", (event) => {
  const input = event.target.closest("[data-pref]");
  if (!input) return;
  state.preferences.formats = [...els.controls.querySelectorAll("[data-pref]:checked")]
    .map((control) => control.dataset.pref);
  markDraftEdited({ preferences: true });
  renderMemoryPreview();
  renderRules();
});

els.demoContext?.addEventListener("change", async () => {
  state.demoContextGranted = els.demoContext.checked;
  state.contextSnapshot = createContextSnapshot({ profile: state.profile, preferences: state.appliedPreferences, applied: state.applied, demoContextGranted: state.demoContextGranted });
  setAgent(state.demoContextGranted ? (state.applied ? "You approved the clearly labeled applied demo profile for this request. Its categories and budget will be sent only to opted-in sites." : "Demo profile consent is staged. Apply the display choice before any partner discovery can use it.") : "Demo profile context is off. No persona-derived fields are sent to partners.");
  if (state.applied) await rerunAppliedJourney();
  else renderJourney();
});

els.demoProfile?.addEventListener("change", async () => {
  state.profile = PERSONAS.find((profile) => profile.personaId === els.demoProfile.value) || PERSONAS[0];
  state.contextSnapshot = createContextSnapshot({ profile: state.profile, preferences: state.appliedPreferences, applied: state.applied, demoContextGranted: state.demoContextGranted });
  if (!state.applied) {
    setAgent(`Selected ${state.profile.displayName} as a draft demo profile. No profile data will be sent until you enable demo context and apply preferences.`);
    renderJourney();
    return;
  }
  setAgent(`Changed the applied demo profile to ${state.profile.displayName}. The current journey is being rerun with the existing consent choice.`);
  await rerunAppliedJourney();
});

document.getElementById("apply-preferences").addEventListener("click", async () => {
  state.productReviewState = "review";
  state.productStage = "preview";
  state.productSetupPath ||= state.hasSavedPreferences ? "saved" : "manual";
  switchView("product");
  renderProductShell();
});

document.getElementById("apply-once").addEventListener("click", async () => {
  state.productReviewState = "review";
  state.productStage = "preview";
  state.productSetupPath ||= state.hasSavedPreferences ? "saved" : "manual";
  switchView("product");
  renderProductShell();
});

document.getElementById("reset-preferences").addEventListener("click", () => {
  state.appliedJourneyRevision += 1;
  markDraftEdited({ preferences: true });
  state.preferences = {
    ...DEFAULT_PREFERENCES,
    formats: [...DEFAULT_PREFERENCES.formats],
  };
  state.pendingRemember = false;
  state.selectedWatchOfferId = null;
  state.applied = false;
  state.appliedMode = null;
  state.partnerDeals = [];
  state.rakutenDeals = [];
  state.rakutenStatus = "idle";
  state.rakutenMeta = null;
  state.catalogDeals = [];
  state.catalogStatus = "idle";
  state.catalogMeta = null;
  state.sourceB = null;
  state.originOutcomes = {};
  state.capabilityResolution = null;
  state.decisionReceipt = null;
  state.contextSnapshot = createContextSnapshot({ profile: state.profile, preferences: state.preferences, applied: false, demoContextGranted: state.demoContextGranted });
  setAgent("Draft choices reset. Nothing was saved or forgotten.");
  renderJourney();
});

els.watchButton.addEventListener("click", setDealWatch);
els.confirmWatch.addEventListener("click", handoffPendingWatch);
els.cancelWatch.addEventListener("click", cancelPendingWatch);

document.getElementById("preference-prompt-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = els.prompt.value.trim();
  if (!value) {
    els.prompt.focus();
    return;
  }
  handlePrompt(value);
  els.prompt.value = "";
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => handlePrompt(button.dataset.prompt));
});

document.querySelectorAll("[data-action-trigger]").forEach((button) => {
  button.addEventListener("click", () => updateActionChain(button.dataset.actionTrigger));
});
updateActionChain("message");

document.getElementById("edit-preferences").addEventListener("click", () => {
  state.productStage = "preview";
  state.productSetupPath ||= state.hasSavedPreferences ? "saved" : "manual";
  state.productBuilderVisible = true;
  state.productReviewState = "review";
  switchView("product");
});

els.memoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-memory-key]");
  if (button) forgetMemory(button.dataset.memoryKey);
});

els.forgetAll.addEventListener("click", forgetAllMemory);

els.headerAccount.addEventListener("click", (event) => {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openAccount("save", event.currentTarget);
});
els.accountBack.addEventListener("click", returnFromAccount);
els.accountContinue.addEventListener("click", returnFromAccount);
els.accountRetry.addEventListener("click", () => { if (state.accountAvailability !== "loading") void loadAccount(); });
els.accountDisplayName.addEventListener("input", () => { els.accountDisplayName.dataset.edited = "true"; });
document.querySelectorAll("[data-account-intent]").forEach((button) => {
  button.addEventListener("click", () => openAccount(button.dataset.accountIntent, button));
});
els.accountLogin.addEventListener("click", (event) => {
  // Keep redirects in this tab so the temporary draft and return action match.
  if (state.accountAvailability !== "ready" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    event.preventDefault();
    els.accountStatus.textContent = state.accountAvailability === "ready"
      ? "Sign in in this tab to bring your draft back with you."
      : "Sign-in is unavailable while account access is being checked. Your draft stays here; continue anonymously or check again.";
    return;
  }
  try {
    const fields = state.accountDraftFields || captureAccountDraftFields();
    sessionStorage.setItem(ACCOUNT_DRAFT_KEY, JSON.stringify(accountDraftSnapshot(state, fields)));
  } catch {
    event.preventDefault();
    els.accountStatus.textContent = "This browser could not keep your draft for the sign-in return. Stay here and save in this browser before trying again.";
  }
});

els.accountSaveProfile?.addEventListener("click", async () => {
  if (state.accountBusy || state.accountAvailability !== "ready") return;
  const scrollPosition = window.scrollY;
  try {
    await accountRequest("/api/account/profile", { profile: { displayName: accountDisplayName(els.accountDisplayName.value) } });
    delete els.accountDisplayName.dataset.edited;
    renderAccount();
    els.accountActionStatus.textContent = "Account profile saved";
  } catch (error) {
    accountFailure();
  } finally {
    window.scrollTo({ top: scrollPosition, behavior: "instant" });
  }
});

els.accountSavePreferences?.addEventListener("click", async () => {
  if (state.accountBusy || state.accountAvailability !== "ready") return;
  const scrollPosition = window.scrollY;
  try {
    await accountRequest("/api/account/preferences", { preferences: state.preferences });
    els.accountActionStatus.textContent = "Current display rules saved to your account";
  } catch (error) {
    accountFailure();
  } finally {
    window.scrollTo({ top: scrollPosition, behavior: "instant" });
  }
});

els.accountImport?.addEventListener("click", async () => {
  if (state.accountBusy || state.accountAvailability !== "ready") return;
  const scrollPosition = window.scrollY;
  if (!els.accountImportConfirm.checked) {
    els.accountActionStatus.textContent = "Select the import checkbox after reviewing the rules and browser notes. Nothing has been uploaded.";
    els.accountImportConfirm.focus({ preventScroll: true });
    return;
  }
  try {
    await accountRequest("/api/account/import", {
      confirmed: true,
      profile: { displayName: accountDisplayName(els.accountDisplayName.value) },
      preferences: state.preferences,
      memory: accountBrowserMemory(),
    });
    els.accountImportConfirm.checked = false;
    els.accountActionStatus.textContent = "Selected browser memory imported to your account";
  } catch (error) {
    accountFailure();
  } finally {
    window.scrollTo({ top: scrollPosition, behavior: "instant" });
  }
});

els.accountForgetMemory?.addEventListener("click", async () => {
  if (state.accountBusy || state.accountAvailability !== "ready") return;
  const scrollPosition = window.scrollY;
  try {
    await accountRequest("/api/account/memory", { action: "forget-all" });
    if (state.memorySource === "account") {
      state.memory = accountMemoryAfterForget({ memorySource: state.memorySource, memory: state.memory });
      state.memorySource = "browser";
      renderJourney();
    }
    els.accountActionStatus.textContent = "Account product notes forgotten";
  } catch (error) {
    accountFailure();
  } finally {
    window.scrollTo({ top: scrollPosition, behavior: "instant" });
  }
});

els.accountForgetProfile?.addEventListener("click", async () => {
  if (state.accountBusy || state.accountAvailability !== "ready") return;
  const scrollPosition = window.scrollY;
  try {
    await accountRequest("/api/account/profile", { profile: {} });
    delete els.accountDisplayName.dataset.edited;
    renderAccount();
    els.accountActionStatus.textContent = "Account profile cleared";
  } catch (error) {
    accountFailure();
  } finally {
    window.scrollTo({ top: scrollPosition, behavior: "instant" });
  }
});

els.accountLogout?.addEventListener("click", async () => {
  if (state.accountBusy || state.accountAvailability !== "ready") return;
  const scrollPosition = window.scrollY;
  try {
    await accountRequest("/api/account/logout", {});
    const accountOwnedDraft = state.preferenceSource === "account";
    const journeyAfterLogout = accountJourneyAfterLogout({ preferenceSource: state.preferenceSource, memorySource: state.memorySource, preferences: state.preferences, memory: state.memory, anonymousPreferences: DEFAULT_PREFERENCES, hasSavedPreferences: state.hasSavedPreferences });
    state.preferences = journeyAfterLogout.preferences;
    state.appliedPreferences = journeyAfterLogout.appliedPreferences;
    state.memory = journeyAfterLogout.memory;
    state.preferenceSource = journeyAfterLogout.preferenceSource;
    state.memorySource = journeyAfterLogout.memorySource;
    state.hasSavedPreferences = hasStored(STORAGE.preferences);
    state.savedPreferences = hasStored(STORAGE.preferences) ? normalizePreferencePlane(readStored(STORAGE.preferences, DEFAULT_PREFERENCES)) : null;
    if (accountOwnedDraft) {
      state.appliedJourneyRevision += 1;
      state.applied = false;
      state.appliedMode = null;
      state.canvasReturnSelection = null;
      state.productStage = "preview";
      state.accountDraftFields = null;
      clearCanvasComposer();
      invalidateAppliedJourney();
    }
    state.contextSnapshot = createContextSnapshot({ profile: state.profile, preferences: state.preferences, applied: state.applied, demoContextGranted: state.demoContextGranted });
    renderJourney();
    state.account = { signedIn: false, csrfToken: null, profile: {}, preferences: {}, memory: [], error: "" };
    delete els.accountDisplayName.dataset.edited;
    renderAccount();
    showToast("Logged out of hosted account");
  } catch (error) {
    accountFailure();
  } finally {
    window.scrollTo({ top: scrollPosition, behavior: "instant" });
  }
});

function registerEngineTools() {
  if (!SUPPORTED || typeof document.modelContext?.registerTool !== "function") return;
  const register = (tool, capabilityId = "offers.discover") => {
    try {
      const capability = CAPABILITIES.find((item) => item.id === capabilityId);
      document.modelContext.registerTool({ ...tool, execute: async (input) => {
        const grant = createInvocationGrant({ capabilityId, audienceOrigin: location.origin, scopes: [capability.requiredScope], purpose: `engine tool ${tool.name}` });
        const result = await invokeCapability({ capabilityId, grant, callerOrigin: location.origin, expectedOrigin: location.origin, purpose: `engine tool ${tool.name}`, input, validateInput: (value) => Boolean(value && typeof value === "object" && !Array.isArray(value)), validateOutput: (value) => value !== undefined, handler: tool.execute });
        if (!result.ok) return { denied: true, reason: result.authorization?.code || result.code };
        return result.value;
      } });
    } catch {
      // A registration failure leaves the normal page journey usable.
    }
  };
  register({
    name: "get_offer_memory",
    description: "Return the user's visible, browser-scoped offer memory and current draft display rules.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      preferences: state.preferences,
      memory: state.memory,
      scope: "Jumping Beans product in this browser",
      retention: "Until the user chooses Forget",
    }),
  }, "offers.discover");
  register({
    name: "set_display_preferences",
    description: "Stage presentation preferences for the next offer. The user must choose Save and apply or Apply once in the page before the preference affects Site B.",
    inputSchema: {
      type: "object",
      properties: {
        formats: { type: "array", items: { type: "string" } },
        maxPrice: { type: "number", minimum: 0 },
      },
      required: ["formats"],
    },
    annotations: { readOnlyHint: false },
    execute: async ({ formats, maxPrice }) => {
      if (maxPrice != null && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
        return { staged: false, error: "maxPrice must be zero or greater", persisted: false };
      }
      // A native tool can run while the optional account fetch is in flight.
      // Mark it as a browser-owned draft before mutation so a late account
      // response cannot overwrite it or retain account provenance.
      markDraftEdited({ preferences: true });
      state.preferences = {
        ...state.preferences,
        formats,
        maxPrice: maxPrice ?? state.preferences.maxPrice,
      };
      state.contextSnapshot = createContextSnapshot({
        profile: state.profile,
        preferences: state.preferences,
        applied: false,
        demoContextGranted: state.demoContextGranted,
      });
      recordEvent("capability.invocation.succeeded", {
        capabilityId: "preferences.stage",
        capabilityVersion: "1.0.0",
        outcomeType: "preference_staged",
        persisted: false,
      });
      renderJourney();
      setAgent("The agent staged new display rules. Review the exact fact before saving or applying once.");
      return {
        stagedPreferences: state.preferences,
        fact: preferenceFact(),
        scope: "Jumping Beans product in this browser",
        retention: "Until the user chooses Forget if saved; this visit only if applied once",
        outcome: `${preferenceOutcome()}; Apply once creates no persisted preference or offer note`,
        requiresUserConfirmation: true,
        persisted: false,
        availableActions: ["Save and apply to Site B", "Apply once without saving"],
      };
    },
  }, "preferences.stage");
  register({
    name: "build_offer_journey",
    description: "Show the open-inventory offer, the user's preference choice, and either an opted-in Site B offer or an honest no-result outcome as one journey.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      renderJourney();
      return {
        openInventory: state.sourceA.name,
        nextSite: state.sourceB?.partnerName || "no partner result",
        nextSiteSource: state.sourceB ? "opted-in WebMCP partner" : "no opted-in partner result",
        preferences: state.applied ? state.appliedPreferences : null,
      };
    },
  }, "offers.discover");
  register({
    name: "set_deal_watch",
    description: "Stage an exact Watch Co product and target price for review. This tool never persists or invokes Watch Co; the user must explicitly open Watch Co's independent stage-and-confirm flow.",
    inputSchema: {
      type: "object",
      properties: { targetPrice: { type: "number", exclusiveMinimum: 0 } },
      required: ["targetPrice"],
    },
    annotations: { readOnlyHint: false },
    execute: async ({ targetPrice }) => {
      if (!prepareDealWatch(targetPrice)) {
        return { staged: false, error: "a matching Watch Co offer and targetPrice greater than zero are required", persisted: false };
      }
      return {
        staged: true,
        persisted: false,
        fact: `Surface ${state.pendingWatch.name} below ${money(state.pendingWatch.target)}`,
        scope: "Exact product and target price in a one-time navigation to Watch Co",
        retention: "Jumping Beans does not retain this handoff; Watch Co states its own retention before confirmation",
        outcome: "Opening Watch Co only prefills the product and target price. Watch Co owns staging, explicit confirmation, and any server persistence; no notification, order, payment, or message is created by Jumping Beans",
        requiresUserConfirmation: true,
        confirmationAction: "Use the page's Open Watch Co to stage target price button, then complete Watch Co's explicit confirmation",
      };
    },
  }, "deal_watch.stage");
  register({
    name: "get_profile",
    description: "Return the current user-controlled display profile, including whether the draft has been applied.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      draft: state.preferences,
      applied: state.applied ? state.appliedPreferences : null,
    }),
  }, "offers.discover");
  register({
    name: "get_journey_receipt",
    description: "Return the observed offer-discovery journey, current user-approved context snapshot, capability versions, decision receipt, and recent event trail.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      journey: state.journey,
      contextSnapshot: state.contextSnapshot,
      capabilities: CAPABILITIES,
      decisionReceipt: state.decisionReceipt,
      events: state.events.slice(-50),
    }),
  }, "offers.discover");
}

function hydrateEntryPreference() {
  const raw = new URLSearchParams(location.search).get("jb_preference");
  if (typeof raw !== "string" || !els.canvasWords || els.canvasWords.value.trim()) return;
  const value = raw.trim();
  if (!value || value.length > 240) {
    if (value.length > 240) els.canvasClarification.textContent = "The entry preference was too long, so it was not added. Enter a shorter selection below.";
    return;
  }
  els.canvasWords.value = value;
  updateCanvasWords();
  els.productReviewStatus.textContent = "A draft selection arrived with this link. Review or edit it before anything is shared.";
}

async function init() {
  restoreAccountDraft();
  hydrateEntryPreference();
  renderBrowserReadiness();
  switchView(location.hash.slice(1) || "product");
  state.contextSnapshot = createContextSnapshot({
    profile: state.profile,
    preferences: state.preferences,
    applied: state.applied,
    demoContextGranted: state.demoContextGranted,
  });
  recordEvent("journey.started", {
    intentType: state.journey.intentType,
    contextSnapshotId: state.contextSnapshot.contextSnapshotId,
  });
  // Attach before the first partner navigation so registration cannot race the
  // native lifecycle observer. Initial discovery below remains authoritative.
  observeNativeToolChanges();
  await createPartnerFrames();
  renderJourney();
  void loadAccount();
  registerEngineTools();
  updateConnections();
  const result = await discoverPartnerDeals();
  applyPartnerDiscovery(result);
  if (result.deals.length) {
    setAgent("I found Site A in open inventory and received a structured offer from an opted-in Site B. Choose what Site B should show, then apply once or save it in this browser.");
  } else if (SUPPORTED) {
    setAgent("I found Site A in open inventory, but no opted-in tool returned an offer. Site B shows an honest no-result outcome.");
  }
  switchView(location.hash.slice(1) || "product");
}

init();
