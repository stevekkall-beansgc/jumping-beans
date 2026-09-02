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
  productView: document.getElementById("product-view"),
  networkView: document.getElementById("network-view"),
  demoView: document.getElementById("demo-view"),
  productEntry: document.getElementById("product-entry"),
  productEntryLabel: document.getElementById("product-entry-label"),
  productEntryTitle: document.getElementById("product-entry-title"),
  productEntryBadge: document.getElementById("product-entry-badge"),
  productEntryCopy: document.getElementById("product-entry-copy"),
  productSetupPaths: document.getElementById("product-setup-paths"),
  savedPreferenceActions: document.getElementById("saved-preference-actions"),
  savedPreferenceNote: document.getElementById("saved-preference-note"),
  productReviewSaved: document.getElementById("product-review-saved"),
  productStartFresh: document.getElementById("product-start-fresh"),
  productBuilderTitle: document.getElementById("builder-title"),
  productPreview: document.getElementById("product-preview"),
  productPreviewRetention: document.getElementById("product-preview-retention"),
  previewStyleControls: document.getElementById("preview-style-controls"),
  previewWordsChat: document.getElementById("preview-words-chat"),
  previewWordsLog: document.getElementById("preview-words-log"),
  previewWordsForm: document.getElementById("preview-words-form"),
  previewEditActions: document.querySelector(".preview-edit-actions"),
  productFineTune: document.getElementById("product-fine-tune"),
  productBackToPaths: document.getElementById("product-back-to-paths"),
  productStartOver: document.getElementById("product-start-over"),
  productBuilder: document.getElementById("product-builder"),
  productForm: document.getElementById("product-preferences-form"),
  productCategory: document.getElementById("product-category"),
  productMaxPrice: document.getElementById("product-max-price"),
  productStyle: document.getElementById("product-style"),
  productPrompt: document.getElementById("product-prompt"),
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
  productConsent: document.querySelector(".product-consent"),
  productReviewActions: document.getElementById("product-review-actions"),
  productAppliedActions: document.getElementById("product-applied-actions"),
  productUseOnce: document.getElementById("product-use-once"),
  productSave: document.getElementById("product-save"),
  productNetworkLink: document.getElementById("product-network-link"),
  productKeepEditing: document.getElementById("product-keep-editing"),
  productTitle: document.getElementById("product-title"),
  networkFeed: document.getElementById("network-feed"),
  networkStatus: document.getElementById("network-status"),
  networkTitle: document.getElementById("network-title"),
  pauseSharing: document.getElementById("pause-network-sharing"),
  connectionStatus: document.querySelector(".connection-status"),
};

const STORAGE = {
  preferences: "jumping-beans-preferences",
  memory: "jumping-beans-offer-memory",
  networkSharing: "jumping-beans-network-sharing",
};
const DEFAULT_PREFERENCES = normalizePreferencePlane({ formats: ["price-proof"], tone: "calm" });
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
  collateral: [
    {
      type: "price-proof",
      text: "Save $4 versus the merchant comparison price",
      source: "Bundled public catalog compare-at price",
    },
  ],
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
  preferences: { ...initialPreferences, formats: [...initialPreferences.formats] },
  appliedPreferences: { ...initialPreferences, formats: [...initialPreferences.formats] },
  memory: Array.isArray(storedMemory) ? storedMemory : [],
  partnerDeals: [],
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
  productStage: hasStored(STORAGE.preferences) ? "saved" : "empty",
  productReturnStage: hasStored(STORAGE.preferences) ? "saved" : "empty",
  productSetupPath: null,
  productBuilderVisible: false,
  productReviewState: "idle",
  productApplyMode: null,
  productWordTurns: [],
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
  video: "Short video",
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

function hasMerchantListPrice(deal) {
  return deal?.listPriceSource === "merchant"
    && Number.isFinite(deal.listPrice)
    && deal.listPrice > Number(deal.dealPrice);
}

function percent(deal) {
  if (!hasMerchantListPrice(deal)) return null;
  return Math.round((1 - Number(deal.dealPrice) / deal.listPrice) * 100);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
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
  const names = origins.map((origin) => PARTNER_NAMES[origin] || safeOrigin(origin));
  const discovered = origins.length;
  if (!SUPPORTED) {
    els.status.textContent = "Open inventory ready. WebMCP is unavailable here; no opted-in partner result is available.";
    els.protocol.textContent = "WebMCP · unavailable in this browser";
    els.sourceCount.textContent = "No tool check available";
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

function createPartnerFrames() {
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
  let raw;
  try {
    raw = await document.modelContext.executeTool(tool, input);
  } catch (error) {
    if (!compatibilityRetry || !isCompatibilityInputError(error)) throw error;
    // Some WebMCP implementations still expect serialized arguments. This
    // retry is limited to partner reads and keeps the product protocol-aware.
    raw = await document.modelContext.executeTool(tool, JSON.stringify(input));
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
    ...preferredFormats.filter((format) => formats.includes(format) && (format !== "price-proof" || hasMerchantListPrice(deal))),
    ...(hasMerchantListPrice(deal) ? ["price-proof"] : []),
  ];
  for (const type of wanted) {
    const item = collateral.find((entry) => entry.type === type);
    if (item) return item;
    if (type === "testimonial" && formats.includes("testimonial")) {
      return {
        type,
        text: "A partner can provide a sourced customer story in this slot.",
        source: "Presentation slot; no story supplied",
      };
    }
    if (type === "video" && formats.includes("video")) {
      return {
        type,
        title: "A partner can provide a short product video in this slot",
        duration: 18,
        source: "Presentation slot; no video supplied",
      };
    }
  }
  return {
    type: "offer-fact",
    text: `Current catalog price ${money(deal.dealPrice)}. No merchant comparison price was supplied.`,
    source: "Offer record",
  };
}

function offerImage(deal) {
  const source = safeUrl(deal.imageUrl);
  return source
    ? `<img src="${escapeHtml(source.href)}" alt="" loading="lazy" crossorigin="anonymous">`
    : '<div class="art-placeholder" aria-hidden="true">Offer image unavailable</div>';
}

function provenanceMarkup(deal, sourceKind) {
  const destination = safeUrl(deal.landing);
  const sourceOrigin = safeUrl(deal.partnerOrigin || deal.origin);
  const isOpen = sourceKind === "open";
  const who = isOpen
    ? `Jumping Beans loaded a public record attributed to ${deal.merchant || deal.vendor || "the catalog merchant"}`
    : `${deal.partnerName || deal.merchant || "The partner"} returned the record through WebMCP`;
  const source = isOpen
    ? "Public product-feed snapshot bundled with this demo"
    : `WebMCP offer tool${sourceOrigin ? ` at ${sourceOrigin.origin}` : ""}`;
  const when = isOpen
    ? `Loaded into this page ${absoluteTime(deal.observedAt)}; the source capture time is unavailable`
    : `Tool response received ${absoluteTime(deal.observedAt)}`;
  const evidence = isOpen
    ? `Catalog record ${deal.sku}; no live price check ran`
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
  const sourceClass = sourceKind === "open" ? "source-open" : "source-optin";
  const sourceLabel = sourceKind === "open" ? "Open inventory" : "Opted-in partner";
  const comparisonPrice = hasMerchantListPrice(deal)
    ? `<del aria-label="Merchant comparison price ${money(deal.listPrice)}">${money(deal.listPrice)}</del><span>${percent(deal)}% below merchant comparison price</span>`
    : "";
  const reason =
    sourceKind === "open"
      ? "Found in a bundled public catalog snapshot. No partner connection was needed."
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
    ${provenanceMarkup(deal, sourceKind)}`;
}

function renderMemoryStep() {
  renderOfferCard(
    els.memoryStep,
    offerMarkup(state.sourceA, "open", "Site A · recorded from open inventory", DEFAULT_PREFERENCES),
  );
}

function switchView(view, { focusHeading = false } = {}) {
  const nextView = ["product", "network", "demo", "account"].includes(view) ? view : "product";
  state.currentView = nextView;
  els.headerAccount.toggleAttribute("aria-current", nextView === "account");
  if (nextView === "account") els.headerAccount.setAttribute("aria-current", "page");
  els.connectionStatus?.toggleAttribute("hidden", ["product", "account"].includes(nextView));
  for (const [name, panel] of Object.entries({ product: els.productView, network: els.networkView, demo: els.demoView, account: els.accountView })) {
    if (!panel) continue;
    panel.hidden = name !== nextView;
  }
  if (nextView === "account") renderAccount();
  if (nextView === "network") renderProductNetwork();
  if (nextView === "product") renderProductShell();
  const hash = nextView === "product" ? "" : `#${nextView}`;
  if (location.hash !== hash) history.replaceState(null, "", `${location.pathname}${location.search}${hash}`);
  if (focusHeading) {
    const heading = nextView === "network"
      ? els.networkTitle
      : nextView === "product"
        ? els.productTitle
        : nextView === "account" ? els.accountTitle : document.getElementById("page-title");
    heading?.focus({ preventScroll: true });
  }
}

function renderProductReview(active = normalizePreferencePlane(state.preferences)) {
  if (!els.productReviewRules) return;
  const reviewState = state.productReviewState;
  const isApplying = reviewState === "applying";
  const isApplied = reviewState === "applied";
  els.productReview.dataset.reviewState = reviewState;
  els.productReview.setAttribute("aria-busy", String(isApplying));
  const labels = {
    idle: ["Draft", "info"],
    review: [state.applied ? "Changes ready" : "Ready to apply", "info"],
    applying: ["Applying", "info"],
    applied: ["Applied", "success"],
  };
  const [stateLabel, stateTone] = labels[reviewState] || labels.idle;
  els.productReviewStateLabel.textContent = stateLabel;
  els.productReviewStateLabel.dataset.status = stateTone;
  els.productReviewTitle.textContent = isApplied
    ? "Preferences applied"
    : isApplying
      ? "Applying your preferences"
      : reviewState === "review"
        ? state.productSetupPath === "saved" ? "Review saved preferences" : "Here’s what we’ll use"
        : "Here’s what we’ll use";
  const statusMessage = isApplied
    ? state.appliedMode === "saved"
      ? "Saved in this browser and applied. You’re still in this workspace; keep editing or see your results when you’re ready."
      : "Applied for this visit only without saving. You’re still in this workspace; keep editing or see your results when you’re ready."
    : isApplying
      ? state.productApplyMode === "saved"
        ? "Saving and applying your approved preferences…"
        : "Applying your approved preferences for this visit…"
      : reviewState === "review"
        ? state.applied
          ? state.productDraftDirty
            ? "Your latest changes are not applied yet. Your results keep using the last preferences you approved."
            : "These are the preferences currently applied. Fine-tune them to create a new draft."
          : "Draft ready. Nothing is saved or shared until you choose an option below."
        : "Draft ready. Nothing is saved or shared until you choose an option below.";
  if (els.productReviewStatus.textContent !== statusMessage) {
    els.productReviewStatus.textContent = statusMessage;
  }
  els.productReviewRules.replaceChildren();
  const review = reviewPreferencePlane(active, { save: false });
  const rules = [
    ["Feed style", STARTER_STYLES[active.feedStyle]?.label || "Balanced"],
    ["Where it applies", active.category ? `For ${active.category}` : "Everywhere"],
    ...(active.maxPrice == null ? [] : [["Budget", `Up to ${money(active.maxPrice)}`]]),
    ...review.activeRules.map((rule) => [rule.scope === "category" ? `For ${rule.category}` : "Everywhere", rule.text]),
  ];
  if (!rules.length) rules.push(["Preferences", "Use the default presentation"]);
  for (const [label, value] of rules) {
    const item = document.createElement("li");
    item.className = "product-review-rule";
    item.innerHTML = `<strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span>`;
    els.productReviewRules.append(item);
  }
  els.productReviewSharing.textContent = isApplied
    ? state.appliedMode === "saved"
      ? `Outcome: applied to your network. Retention: saved in this browser until you use Forget. ${review.sharing}.`
      : `Outcome: applied to your network. Retention: this visit only; nothing was saved. ${review.sharing}.`
    : `Choose how long to use these preferences. ${review.sharing}. “Save and apply” keeps them for next time; “Apply once without saving” lasts only for this visit.`;
  els.productPreviewRetention.textContent = isApplied
    ? state.appliedMode === "saved"
      ? "Saved in this browser until you use Forget."
      : "This visit only. Nothing was saved."
    : state.productSetupPath === "saved"
      ? "Saved in this browser until you use Forget. Any edits remain a draft until you save again."
      : "Draft only. Not saved yet.";
  els.productConsent.hidden = isApplied;
  els.productReviewActions.hidden = isApplied;
  els.productAppliedActions.hidden = !isApplied;
  els.previewEditActions.hidden = isApplied;
  els.productSave.setAttribute("aria-disabled", String(isApplying));
  els.productUseOnce.setAttribute("aria-disabled", String(isApplying));
}

function renderProductShell() {
  if (!els.productReviewRules) return;
  const active = normalizePreferencePlane(state.preferences);
  els.productCategory.value = active.category;
  els.productMaxPrice.value = active.maxPrice == null ? "" : String(active.maxPrice);
  els.productStyle.value = active.feedStyle;
  const savedEntry = state.productStage === "saved" || (state.productStage === "preview" && state.productSetupPath === "saved");
  els.productEntry.hidden = state.productStage === "preview";
  els.productPreview.hidden = state.productStage !== "preview";
  els.productBuilder.hidden = state.productStage !== "preview" || !state.productBuilderVisible;
  els.productFineTune.setAttribute("aria-expanded", String(state.productBuilderVisible));
  els.productFineTune.textContent = state.productBuilderVisible ? "Hide detailed editor" : "Fine-tune preferences";

  els.productEntryLabel.textContent = savedEntry ? "Saved preferences found" : "Set up your preferences";
  els.productEntryTitle.textContent = savedEntry ? "Your preferences are ready to review" : state.hasSavedPreferences ? "Start a fresh draft" : "Choose how to begin";
  els.productEntryBadge.textContent = savedEntry ? "Saved" : state.hasSavedPreferences ? "Saved copy unchanged" : "Not set up";
  if (savedEntry) els.productEntryBadge.dataset.status = "success";
  else delete els.productEntryBadge.dataset.status;
  const saved = state.savedPreferences || active;
  els.productEntryCopy.textContent = savedEntry
    ? `Currently saved: ${saved.feedStyle} style${saved.category ? ` for ${saved.category}` : ""}. Review the exact scope and retention before using or changing it.`
    : state.hasSavedPreferences
      ? "Choose a new starting point. Your saved preferences stay unchanged unless you explicitly save this replacement or use Forget."
      : "Nothing is saved yet. Pick a comfortable starting point; you’ll review the draft before it can be saved or used.";
  els.productSetupPaths.hidden = savedEntry;
  els.savedPreferenceActions.hidden = !state.hasSavedPreferences;
  if (savedEntry) delete els.productReviewSaved.dataset.variant;
  else els.productReviewSaved.dataset.variant = "secondary";
  els.productStartFresh.hidden = !savedEntry;
  els.savedPreferenceNote.hidden = !state.hasSavedPreferences;

  document.querySelectorAll("[data-setup-path]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.setupPath === state.productSetupPath));
  });
  document.querySelectorAll("[data-starter-style]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.starterStyle === active.feedStyle));
  });
  els.previewStyleControls.hidden = state.productSetupPath !== "style";
  els.previewWordsChat.hidden = state.productSetupPath !== "words";
  renderProductWordChat();
  renderProductRules(active);
  renderProductReview(active);
}

function renderProductWordChat() {
  if (!els.previewWordsLog) return;
  els.previewWordsLog.replaceChildren();
  const messages = [
    { speaker: "Jumping Beans", text: "Tell us what should stand out or what you want to avoid. We’ll show the exact rule in the preview." },
    ...state.productWordTurns.flatMap((turn) => [
      { speaker: "You", text: turn.input },
      { speaker: "Jumping Beans", text: turn.response },
    ]),
  ];
  for (const message of messages) {
    const item = document.createElement("li");
    item.dataset.speaker = message.speaker === "You" ? "user" : "product";
    const speaker = document.createElement("strong");
    const text = document.createElement("p");
    speaker.textContent = message.speaker;
    text.textContent = message.text;
    item.append(speaker, text);
    els.previewWordsLog.append(item);
  }
}

function addWordsPreference(value) {
  const input = value.trim().slice(0, 240);
  if (!input) return false;
  const text = input.toLowerCase();
  const draft = productPreferenceDraft();
  const formats = [...draft.formats];
  if (text.includes("proof") || text.includes("testimonial")) formats.push("testimonial", "price-proof");
  if (text.includes("video")) formats.push("video");
  if (text.includes("pressure") || text.includes("urgency")) formats.push("no-urgency");
  const budgetMatch = text.match(/(?:under|below|up to)\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/);
  const maxPrice = budgetMatch ? Number(budgetMatch[1]) : draft.maxPrice;
  markDraftEdited({ preferences: true });
  state.preferences = normalizePreferencePlane({
    ...draft,
    formats: [...new Set(formats)],
    maxPrice,
    rules: [...draft.rules, { id: opaqueId("rule"), text: input, scope: "everywhere", category: "", active: true }],
  });
  const recognized = [
    ...(budgetMatch ? [`a ${money(maxPrice)} price ceiling`] : []),
    ...(text.includes("proof") || text.includes("testimonial") ? ["proof and testimonials"] : []),
    ...(text.includes("video") ? ["short video"] : []),
    ...(text.includes("pressure") || text.includes("urgency") ? ["no urgency"] : []),
  ];
  state.productWordTurns.push({
    input,
    response: recognized.length
      ? `Added an everywhere rule and updated ${recognized.join(", ")}. Review the draft below before applying it.`
      : "Added that sentence as an everywhere rule. Review the exact draft below before applying it.",
  });
  setAgent("Your words are in the draft. Nothing is saved or shared yet.");
  renderProductShell();
  return true;
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
    setAgent("Name a category above before adding a rule for this category.");
    els.productCategory?.focus();
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
    setAgent("Name a category above before using “For this category.”");
    els.productCategory?.focus();
    return;
  }
  markDraftEdited({ preferences: true });
  state.preferences = normalizePreferencePlane({
    ...current,
    rules: current.rules.map((rule) => rule.id === id ? { ...rule, ...changes, scope, category } : rule),
  });
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
  state.editingRuleId = null;
  setAgent(`Forgot “${existing.text}” from this draft.`);
  renderProductShell();
}

function productPreferenceDraft() {
  const current = normalizePreferencePlane(state.preferences);
  const category = els.productCategory.value.trim();
  const maxPrice = els.productMaxPrice.value === "" ? null : Number(els.productMaxPrice.value);
  return normalizePreferencePlane({
    ...current,
    category,
    maxPrice: Number.isFinite(maxPrice) && maxPrice >= 0 ? maxPrice : null,
    feedStyle: els.productStyle.value,
  });
}

function stageProductPreferences() {
  const next = productPreferenceDraft();
  markDraftEdited({ preferences: true });
  state.preferences = next;
  state.productStage = "preview";
  setAgent("Your draft is ready to review. Nothing has been saved or shared.");
  renderProductShell();
}

function applyStarterStyle(style) {
  const selected = selectStarterStyle(style);
  markDraftEdited({ preferences: true });
  state.preferences = normalizePreferencePlane({ ...state.preferences, ...selected });
  state.productStage = "preview";
  state.productSetupPath = "style";
  setAgent("Your style is ready. Review what we’ll use before you choose this time only or save for next time.");
  renderProductShell();
}

function chooseProductSetupPath(path) {
  if (!["style", "words", "manual"].includes(path)) return;
  state.productSetupPath = path;
  state.productReturnStage = "empty";
  state.productStage = "preview";
  state.productBuilderVisible = false;
  state.productReviewState = "review";
  if (path === "words") state.productWordTurns = [];
  if (path === "style") {
    const selected = selectStarterStyle("balanced");
    markDraftEdited({ preferences: true });
    state.preferences = normalizePreferencePlane({ ...state.preferences, ...selected });
  }
  setAgent("Your preference preview is ready. Nothing is saved or shared yet.");
  renderProductShell();
  els.productReviewTitle.focus({ preventScroll: true });
}

function reviewSavedProductPreferences() {
  if (state.savedPreferences) {
    state.preferences = normalizePreferencePlane(state.savedPreferences);
  }
  state.productSetupPath = "saved";
  state.productReturnStage = "saved";
  state.productStage = "preview";
  state.productBuilderVisible = false;
  state.productReviewState = "review";
  state.productDraftDirty = false;
  setAgent("Reviewing your saved preferences. Changes remain a draft until you explicitly save again.");
  renderProductShell();
  els.productReviewTitle.focus({ preventScroll: true });
}

function startFreshProductDraft() {
  markDraftEdited({ preferences: true });
  state.preferences = normalizePreferencePlane({ ...DEFAULT_PREFERENCES, formats: [...DEFAULT_PREFERENCES.formats] });
  state.productSetupPath = null;
  state.productReturnStage = "empty";
  state.productStage = "empty";
  state.productBuilderVisible = false;
  state.productReviewState = "idle";
  state.productWordTurns = [];
  state.productDraftDirty = true;
  state.editingRuleId = null;
  setAgent(state.hasSavedPreferences
    ? "Started a blank draft. Your saved preferences are unchanged."
    : "Started a blank draft. Nothing is saved or shared.");
  renderProductShell();
  els.productEntryTitle.focus({ preventScroll: true });
}

function returnToProductEntry() {
  state.productStage = state.productReturnStage;
  state.productBuilderVisible = false;
  state.productReviewState = "idle";
  setAgent(state.productReturnStage === "saved"
    ? "Back at your saved-preference entry point. Your current draft has been kept."
    : "Back at the setup options. Your current draft has been kept.");
  renderProductShell();
  els.productEntryTitle.focus({ preventScroll: true });
}

function renderProductNetwork() {
  if (!els.networkFeed) return;
  els.networkStatus.textContent = state.networkSharingPaused
    ? "Network sharing is paused. Your preferences are still saved here; connected member sites are using their standard experiences."
    : state.applied
      ? state.appliedMode === "once"
        ? "Your network is using these preferences for this visit only."
        : "Your network is using the preferences you approved."
      : "Use your preferences to see a network shaped around them.";
  els.pauseSharing.textContent = state.networkSharingPaused ? "Resume network sharing" : "Pause network sharing";
  els.pauseSharing.dataset.variant = state.networkSharingPaused ? "secondary" : "quiet";
  const openCard = `<article class="product-offer-card">${offerMarkup(state.sourceA, "open", "Open selection", state.applied ? state.appliedPreferences : state.preferences)}</article>`;
  const partnerDeals = state.capabilityResolution?.exposed || [];
  const partnerCards = partnerDeals.slice(0, 6).map((deal) => `<article class="product-offer-card">${offerMarkup(deal, "optin", `${deal.partnerName || "Member experience"} · matched to your preferences`, state.appliedPreferences)}</article>`);
  els.networkFeed.innerHTML = partnerCards.length
    ? `${openCard}${partnerCards.join("")}`
    : `${openCard}<section class="bl-callout network-empty" data-tone="info"><h3>No connected member selections yet</h3><p>${state.networkSharingPaused ? "Resume network sharing when you want connected member sites to use your preferences." : "Use these preferences to check the opted-in member experiences in your network."}</p><button class="bl-button" id="network-use-preferences" type="button">Use these preferences</button></section>`;
  document.getElementById("network-use-preferences")?.addEventListener("click", () => {
    state.productReviewState = "review";
    state.productStage = "preview";
    state.productSetupPath ||= state.hasSavedPreferences ? "saved" : "manual";
    switchView("product", { focusHeading: true });
    renderProductShell();
  });
}

function renderOfferCard(container, markup) {
  container.innerHTML = markup;
}

function partnerDestination(destination) {
  const url = safeUrl(destination);
  if (!url) return null;
  return url.href;
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
  return `<section class="bl-callout network-summary" data-tone="info"><h4 class="bl-callout__title">Network view</h4><p>Each opted-in origin is bounded and reported independently. Ranking uses approved context, price, and selected presentation formats.</p><ul class="network-list">${rows.join("")}</ul></section>`;
}

function isWatchHandoffOffer(deal) {
  return deal?.partnerOrigin === ORIGINS.watch
    && typeof deal.sku === "string"
    && typeof deal.name === "string"
    && Number.isFinite(deal.dealPrice)
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
      `<header class="step-card-head"><div><p class="step-kicker">Site B · no relevant match</p><h3>No opted-in offer matches this context</h3></div><span class="bl-badge source-pill source-optin" data-status="info">Filtered</span></header><p class="offer-copy">The connected partners returned offers, but none met the current profile, category, or price rules. Adjust the draft choices to widen the result set.</p><p class="reason"><strong>Decision receipt</strong><br>${escapeHtml(state.capabilityResolution?.reason || "Eligibility rules")}; ${state.capabilityResolution?.relevant.length || 0} relevant offer${state.capabilityResolution?.relevant.length === 1 ? "" : "s"}.</p>${networkMarkup()}`,
    );
    return;
  }
  if (!state.sourceB) {
    renderOfferCard(
      els.nextStep,
      `<header class="step-card-head"><div><p class="step-kicker">Site B · no partner result</p><h3>No opted-in partner offer is available</h3></div><span class="bl-badge source-pill source-open" data-status="neutral">No result</span></header><p class="offer-copy">No partner offer was returned for this request. Jumping Beans will not create a substitute partner result.</p>${networkMarkup()}`,
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
  state.preferences = normalizePreferencePlane(hydrated.preferences);
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
    const backLabel = { product: "preferences", network: "your results", demo: "Demo" }[backView];
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
  state.productStage = "preview";
  state.productReviewState = "applying";
  state.productApplyMode = persist ? "saved" : "once";
  renderProductReview();
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
    state.hasSavedPreferences = preferencesSaved;
    if (preferencesSaved) {
      state.productReturnStage = "saved";
      state.savedPreferences = normalizePreferencePlane(state.appliedPreferences);
    }
    state.preferenceSource = "browser";
    const labels = state.appliedPreferences.formats
      .map((format) => formatLabels[format] || format)
      .join(" · ") || "Default presentation";
    const memorySaved = addMemory("Display preference", labels, "preference");
    if (state.pendingRemember) {
      addMemory(
        "Offer remembered",
        `${state.sourceA.name} from ${state.sourceA.sourceLabel}`,
        "impression",
      );
    }
    state.pendingRemember = false;
    setAgent(
      preferencesSaved && memorySaved
        ? "Saved in this browser and applied to Site B. Only the approved preference plane travels in the native WebMCP request."
        : "Applied to Site B for this visit, but this browser did not allow the preference to be saved.",
    );
    showToast(preferencesSaved && memorySaved ? "Display rules saved and applied" : "Applied once; browser storage unavailable");
  } else {
    state.pendingRemember = false;
    setAgent("Applied once to Site B without saving a display preference or offer note.");
    showToast("Display rules applied once without saving");
  }
  recordEvent("journey.outcome", {
    outcomeType: "preference_applied",
    status: "user_confirmed",
    mode: state.appliedMode,
  });
  state.productDraftDirty = false;
  renderJourney();
  await rerunAppliedJourney();
  state.productReviewState = "applied";
  state.productApplyMode = null;
  renderJourney();
  els.productReviewTitle.focus({ preventScroll: true });
}

function invalidateAppliedJourney() {
  state.pendingWatch = null;
  state.selectedWatchOfferId = null;
  state.partnerDeals = [];
  state.sourceB = null;
  state.originOutcomes = {};
  state.capabilityResolution = null;
  state.decisionReceipt = null;
}

async function rerunAppliedJourney() {
  const revision = ++state.appliedJourneyRevision;
  invalidateAppliedJourney();
  renderJourney();
  const result = await discoverPartnerDeals(state.appliedPreferences);
  if (revision !== state.appliedJourneyRevision) return;
  applyPartnerDiscovery(result);
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

document.querySelectorAll("[data-starter-style]").forEach((button) => {
  button.addEventListener("click", () => applyStarterStyle(button.dataset.starterStyle));
});

document.querySelectorAll("[data-setup-path]").forEach((button) => {
  button.addEventListener("click", () => chooseProductSetupPath(button.dataset.setupPath));
});

els.productReviewSaved?.addEventListener("click", reviewSavedProductPreferences);
els.productStartFresh?.addEventListener("click", startFreshProductDraft);
els.productBackToPaths?.addEventListener("click", returnToProductEntry);
els.productStartOver?.addEventListener("click", startFreshProductDraft);
els.productFineTune?.addEventListener("click", () => {
  state.productBuilderVisible = !state.productBuilderVisible;
  renderProductShell();
});

els.previewWordsForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.prompt;
  if (!input.value.trim()) return;
  if (addWordsPreference(input.value)) input.value = "";
});

els.productForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  stageProductPreferences();
});

for (const input of [els.productCategory, els.productMaxPrice, els.productStyle]) {
  input?.addEventListener(input === els.productStyle ? "change" : "input", () => {
    markDraftEdited({ preferences: true });
    state.preferences = productPreferenceDraft();
    renderProductReview(state.preferences);
  });
}

els.productPrompt?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = els.productPrompt.querySelector("input")?.value.trim();
  if (!value) return;
  handlePrompt(value);
  els.productPrompt.reset();
});

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

els.productUseOnce?.addEventListener("click", async () => {
  if (state.productReviewState === "applying") return;
  await applyPreferences({ persist: false });
});

els.productSave?.addEventListener("click", async () => {
  if (state.productReviewState === "applying") return;
  await applyPreferences({ persist: true });
});

els.productNetworkLink?.addEventListener("click", () => switchView("network", { focusHeading: true }));
els.productKeepEditing?.addEventListener("click", () => {
  state.productReviewState = "review";
  state.productBuilderVisible = true;
  renderProductShell();
  els.productBuilderTitle.focus({ preventScroll: true });
});
els.pauseSharing?.addEventListener("click", toggleNetworkSharing);

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
    const journeyAfterLogout = accountJourneyAfterLogout({ preferenceSource: state.preferenceSource, memorySource: state.memorySource, preferences: state.preferences, memory: state.memory, anonymousPreferences: DEFAULT_PREFERENCES, hasSavedPreferences: state.hasSavedPreferences });
    state.preferences = journeyAfterLogout.preferences;
    state.appliedPreferences = journeyAfterLogout.appliedPreferences;
    state.memory = journeyAfterLogout.memory;
    state.preferenceSource = journeyAfterLogout.preferenceSource;
    state.memorySource = journeyAfterLogout.memorySource;
    state.hasSavedPreferences = journeyAfterLogout.hasSavedPreferences;
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

async function init() {
  restoreAccountDraft();
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
