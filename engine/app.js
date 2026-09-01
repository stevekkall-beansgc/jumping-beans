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
import { accountJourneyAfterLogout, accountJourneyHydration, accountMemoryAfterForget } from "./personal-experience.js";

const els = {
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
};

const STORAGE = {
  preferences: "jumping-beans-preferences",
  memory: "jumping-beans-offer-memory",
};
const DEFAULT_PREFERENCES = { formats: ["price-proof"], tone: "calm", maxPrice: null };
const loadedAt = new Date().toISOString();
const OPEN_INVENTORY = {
  sku: "open-wildone-walk-kit",
  merchant: "Wild One",
  name: "Everyday Walk Kit",
  category: "dog gear",
  listPrice: 72,
  dealPrice: 54,
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
      text: "Save $18 versus the listed price",
      source: "Bundled public catalog prices",
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
const initialPreferences = {
  formats:
    Array.isArray(storedPreferences.formats) && storedPreferences.formats.length
      ? storedPreferences.formats
      : [...DEFAULT_PREFERENCES.formats],
  tone: storedPreferences.tone || DEFAULT_PREFERENCES.tone,
  maxPrice: storedPreferences.maxPrice ?? null,
};
const storedMemory = readStored(STORAGE.memory, []);
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
  draftRevision: 0,
  preferenceSource: "browser",
  memorySource: "browser",
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

function percent(deal) {
  const listPrice = Number(deal.listPrice || 0);
  if (listPrice <= 0) return 0;
  return Math.max(0, Math.round((1 - Number(deal.dealPrice || 0) / listPrice) * 100));
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
  return safeUrl(value)?.hostname || value || "unknown origin";
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
        return { categories: projection.fields.categories, maxPrice: projection.fields.maxPrice };
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
    ...preferredFormats.filter((format) => formats.includes(format)),
    "price-proof",
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
    type: "price-proof",
    text: `${percent(deal)}% below list price at ${money(deal.dealPrice)}`,
    source: "Offer record arithmetic",
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
    : `WebMCP offer tool${sourceOrigin ? ` at ${sourceOrigin.hostname}` : ""}`;
  const when = isOpen
    ? `Loaded into this page ${absoluteTime(deal.observedAt)}; the source capture time is unavailable`
    : `Tool response received ${absoluteTime(deal.observedAt)}`;
  const evidence = isOpen
    ? `Catalog record ${deal.sku}; no live price check ran`
    : `Tool response from ${sourceOrigin?.hostname || "the opted-in origin"}; catalog record ${deal.sku || "without a supplied SKU"}`;
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
          <del aria-label="Listed price ${money(deal.listPrice)}">${money(deal.listPrice)}</del>
          <span>${percent(deal)}% below list</span>
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

function renderOfferCard(container, markup) {
  container.innerHTML = markup;
}

function withPreferenceQuery(destination, preferences) {
  const url = safeUrl(destination);
  if (!url) return null;
  url.searchParams.set("jb_presentation", (preferences.formats || []).join(","));
  url.searchParams.set("jb_memory", state.appliedMode === "saved" ? "saved" : "once");
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
    return `<li><strong>${escapeHtml(PARTNER_NAMES[origin] || safeOrigin(origin))}</strong><span>${escapeHtml(outcome.status)} · ${eligible} eligible · ${partnerDeals.length} exposed</span></li>`;
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
  const href = withPreferenceQuery(destination, activePreferences);
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
  if (preferences) state.preferenceSource = "browser";
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
  state.preferences = hydrated.preferences;
  state.appliedPreferences = hydrated.appliedPreferences;
  state.memory = hydrated.memory;
  state.preferenceSource = hydrated.preferenceSource;
  state.memorySource = hydrated.memorySource;
  state.hasSavedPreferences = hydrated.hasSavedPreferences;
  state.contextSnapshot = createContextSnapshot({ profile: state.profile, preferences: state.preferences, applied: false, demoContextGranted: state.demoContextGranted });
  renderJourney();
  return true;
}

function renderAccount() {
  const account = state.account;
  const signedIn = Boolean(account.signedIn);
  els.accountLogin.hidden = signedIn;
  els.accountDetails.hidden = !signedIn;
  if (!signedIn) {
    els.accountStatus.textContent = account.error || "Continue anonymously, or sign in to keep a separate account-owned copy of choices you explicitly save.";
    return;
  }
  const name = account.profile?.displayName || account.user?.displayName || account.user?.email || "your account";
  els.accountStatus.textContent = `Signed in as ${name}. Hosted account data is separate from this browser’s local draft and is never sent to partners.`;
  els.accountDisplayName.value = account.profile?.displayName || "";
  const count = Array.isArray(account.memory) ? account.memory.length : 0;
  els.accountMemorySummary.textContent = count
    ? `Your account has ${count} saved product note${count === 1 ? "" : "s"}.`
    : "Your account has no saved product notes.";
}

async function accountRequest(path, payload) {
  // This is only a same-origin account request. WebMCP partner discovery and
  // invocation stay native browser APIs and never receive account credentials.
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-jb-csrf": state.account.csrfToken || "" },
    body: JSON.stringify(payload),
  });
  const next = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(next.error || "account-request-failed");
  state.account = { ...state.account, ...next, error: "" };
  renderAccount();
  return next;
}

async function loadAccount() {
  const requestDraftRevision = state.draftRevision;
  const hasBrowserPersistence = hasStored(STORAGE.preferences) || hasStored(STORAGE.memory);
  try {
    const response = await fetch("/api/account", { credentials: "same-origin", headers: { accept: "application/json" } });
    const account = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(account.error || "Hosted account service is unavailable");
    state.account = { ...state.account, ...account, error: "" };
    hydrateAccountJourney(account, requestDraftRevision, hasBrowserPersistence);
  } catch {
    // The public offer journey remains fully anonymous if the optional service
    // is not provisioned or the browser is offline.
    state.account = { ...state.account, signedIn: false, csrfToken: null, error: "Hosted account service is unavailable; you can continue anonymously." };
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
}

async function applyPreferences({ persist }) {
  markDraftEdited({ preferences: true });
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
    const preferencesSaved = writeStored(STORAGE.preferences, state.appliedPreferences);
    state.hasSavedPreferences = preferencesSaved;
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
        ? "Saved in this browser and applied to Site B. Only the selected display rules travel in the preview URL."
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
  renderJourney();
  await rerunAppliedJourney();
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
  await applyPreferences({ persist: true });
});

document.getElementById("apply-once").addEventListener("click", async () => {
  await applyPreferences({ persist: false });
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
  document.querySelector("[data-pref]")?.focus();
});

els.memoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-memory-key]");
  if (button) forgetMemory(button.dataset.memoryKey);
});

els.forgetAll.addEventListener("click", forgetAllMemory);

els.accountSaveProfile?.addEventListener("click", async () => {
  try {
    await accountRequest("/api/account/profile", { profile: { displayName: els.accountDisplayName.value } });
    showToast("Account profile saved");
  } catch (error) {
    setAgent(`Account profile was not saved: ${error.message}.`);
  }
});

els.accountSavePreferences?.addEventListener("click", async () => {
  try {
    await accountRequest("/api/account/preferences", { preferences: state.preferences });
    showToast("Current display rules saved to your account");
  } catch (error) {
    setAgent(`Account display rules were not saved: ${error.message}.`);
  }
});

els.accountImport?.addEventListener("click", async () => {
  if (!els.accountImportConfirm.checked) {
    setAgent("Select the explicit browser-memory import checkbox before anything is uploaded.");
    els.accountImportConfirm.focus();
    return;
  }
  try {
    await accountRequest("/api/account/import", {
      confirmed: true,
      profile: { displayName: els.accountDisplayName.value },
      preferences: state.preferences,
      memory: state.memory,
    });
    els.accountImportConfirm.checked = false;
    showToast("Selected browser memory imported to your account");
  } catch (error) {
    setAgent(`Browser memory was not imported: ${error.message}.`);
  }
});

els.accountForgetMemory?.addEventListener("click", async () => {
  try {
    await accountRequest("/api/account/memory", { action: "forget-all" });
    if (state.memorySource === "account") {
      state.memory = accountMemoryAfterForget({ memorySource: state.memorySource, memory: state.memory });
      state.memorySource = "browser";
      renderJourney();
    }
    showToast("Account product notes forgotten");
  } catch (error) {
    setAgent(`Account product notes were not forgotten: ${error.message}.`);
  }
});

els.accountForgetProfile?.addEventListener("click", async () => {
  try {
    await accountRequest("/api/account/profile", { profile: {} });
    showToast("Account profile cleared");
  } catch (error) {
    setAgent(`Account profile was not cleared: ${error.message}.`);
  }
});

els.accountLogout?.addEventListener("click", async () => {
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
    renderAccount();
    showToast("Logged out of hosted account");
  } catch (error) {
    setAgent(`Logout did not complete: ${error.message}.`);
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
}

init();
