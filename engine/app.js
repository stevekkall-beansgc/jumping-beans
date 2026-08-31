// Jumping Beans — agent-led offer memory journey.
// Open/public inventory is the baseline. Opted-in partner tools demonstrate
// the richer offer structure and presentation control WebMCP makes possible.

import {
  PARTNER_ORIGINS,
  PARTNER_NAMES,
  TOOL_NAMES,
  PERSONAS,
  SUPPORTED,
} from "./config.js";

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
  toast: document.getElementById("toast"),
};

const STORAGE = {
  preferences: "jumping-beans-preferences",
  memory: "jumping-beans-offer-memory",
  watches: "jumping-beans-deal-watches",
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
const storedWatches = readStored(STORAGE.watches, []);
const state = {
  profile: PERSONAS[0],
  preferences: { ...initialPreferences, formats: [...initialPreferences.formats] },
  appliedPreferences: { ...initialPreferences, formats: [...initialPreferences.formats] },
  memory: Array.isArray(storedMemory) ? storedMemory : [],
  watches: Array.isArray(storedWatches) ? storedWatches : [],
  partnerDeals: [],
  connectedTools: [],
  sourceA: OPEN_INVENTORY,
  sourceB: null,
  applied: false,
  appliedMode: null,
  simulatedUpdate: false,
  pendingWatch: null,
  pendingRemember: false,
  discoveryComplete: false,
  hasSavedPreferences: hasStored(STORAGE.preferences),
};

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
  const discovered = state.connectedTools.length;
  if (!SUPPORTED) {
    els.status.textContent = "Open inventory ready. WebMCP is unavailable here; Site B is an illustrative preview.";
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
    ? `Open inventory ready. ${discovered} opted-in site${discovered === 1 ? "" : "s"} connected.`
    : "Open inventory ready. No opted-in offer tools responded.";
  els.protocol.textContent = discovered
    ? `WebMCP · ${discovered} opted-in site${discovered === 1 ? "" : "s"}`
    : "WebMCP · no opted-in tools found";
  els.sourceCount.textContent = discovered
    ? `${discovered} connected`
    : "0 connected";
  els.statusDot.dataset.on = discovered ? "1" : "0";
}

function createPartnerFrames() {
  PARTNER_ORIGINS.forEach((origin, index) => {
    const frame = document.createElement("iframe");
    frame.src = `${origin}/`;
    frame.allow = "tools";
    frame.className = "partner-frame";
    frame.dataset.origin = origin;
    frame.title = `WebMCP discovery frame for ${PARTNER_NAMES[origin] || `partner ${index + 1}`}`;
    frame.setAttribute("aria-hidden", "true");
    document.body.appendChild(frame);
  });
}

async function executeTool(tool, input) {
  const raw = await document.modelContext.executeTool(tool, JSON.stringify(input));
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function discoverPartnerDeals() {
  if (!SUPPORTED || typeof document.modelContext.getTools !== "function") return [];
  try {
    const tools = await document.modelContext.getTools({ fromOrigins: PARTNER_ORIGINS });
    const matching = tools.filter((tool) => tool.name === TOOL_NAMES.matchingDeals);
    state.connectedTools = matching;
    const results = await Promise.allSettled(
      matching.map((tool) =>
        executeTool(tool, {
          categories: state.profile.recurringCategories,
          presentation: state.appliedPreferences,
        }),
      ),
    );
    return results.flatMap((result, index) => {
      if (result.status !== "fulfilled") return [];
      const tool = matching[index];
      const observedAt = new Date().toISOString();
      return (result.value?.deals || []).map((deal) => ({
        ...deal,
        origin: deal.origin || tool.origin,
        partnerOrigin: tool.origin,
        partnerName:
          deal.partnerName || PARTNER_NAMES[tool.origin] || safeOrigin(tool.origin),
        sourceType: "opted-in partner",
        sourceLabel: "WebMCP offer tool",
        sourceDescription: "The partner opted in to return structured offer data and optional presentation collateral.",
        observedAt,
        verificationLabel: "Partner-provided through WebMCP; not independently verified by Jumping Beans",
      }));
    });
  } catch {
    state.connectedTools = [];
    return [];
  }
}

function fallbackPartnerOffer() {
  return {
    ...OPEN_INVENTORY,
    sku: "preview-walk-kit",
    merchant: "Petsupply",
    partnerName: "Petsupply",
    sourceType: "illustrative preview",
    sourceLabel: "Preview data",
    sourceDescription: "Illustrative fallback shown because no opted-in WebMCP offer response is available in this browser.",
    verificationLabel: "Unverified example; not a live partner-tool response",
    observedAt: loadedAt,
    collateral: [
      {
        type: "testimonial",
        text: "A merchant could put a verified customer story here.",
        source: "Illustrative collateral slot",
      },
      {
        type: "price-proof",
        text: "Save $18 versus the listed price",
        source: "Illustrative catalog comparison",
      },
      {
        type: "video",
        title: "A merchant could add a short product video",
        duration: 18,
        source: "Illustrative collateral slot",
      },
    ],
  };
}

function choosePartnerOffer(deals) {
  const candidate =
    deals.find((deal) =>
      deal.collateral?.some((item) => preferredFormats.includes(item.type)),
    ) || deals[0];
  return candidate
    ? { ...candidate, merchant: candidate.partnerName || candidate.vendor || "Opted-in merchant" }
    : null;
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
  const isPreview = sourceKind === "preview";
  const who = isOpen
    ? `Jumping Beans loaded a public record attributed to ${deal.merchant || deal.vendor || "the catalog merchant"}`
    : isPreview
      ? "Jumping Beans rendered an illustrative fallback; no partner tool returned it"
      : `${deal.partnerName || deal.merchant || "The partner"} returned the record through WebMCP`;
  const source = isOpen
    ? "Public product-feed snapshot bundled with this demo"
    : isPreview
      ? "Illustrative fallback bundled with this demo"
      : `WebMCP offer tool${sourceOrigin ? ` at ${sourceOrigin.hostname}` : ""}`;
  const when = isOpen
    ? `Loaded into this page ${absoluteTime(deal.observedAt)}; the source capture time is unavailable`
    : isPreview
      ? `Preview loaded ${absoluteTime(deal.observedAt)}`
      : `Tool response received ${absoluteTime(deal.observedAt)}`;
  const evidence = isOpen
    ? `Catalog record ${deal.sku}; no live price check ran`
    : isPreview
      ? "No tool receipt is available"
      : `Tool response from ${sourceOrigin?.hostname || "the opted-in origin"}; catalog record ${deal.sku || "without a supplied SKU"}`;
  const sourceLink = destination
    ? `<a href="${escapeHtml(destination.href)}" target="_blank" rel="noopener noreferrer">Merchant product page</a>`
    : escapeHtml(source);
  return `
    <details class="provenance">
      <summary>Source and verification</summary>
      <dl>
        <div><dt>What</dt><dd>${escapeHtml(deal.name)} offer record</dd></div>
        <div><dt>Who</dt><dd>${escapeHtml(who)}</dd></div>
        <div><dt>Source</dt><dd>${sourceLink}<br>${escapeHtml(source)}</dd></div>
        <div><dt>When</dt><dd>${escapeHtml(when)}</dd></div>
        <div><dt>Verification</dt><dd>${escapeHtml(deal.verificationLabel || "Unverified")}</dd></div>
        <div><dt>Evidence</dt><dd>${escapeHtml(evidence)}</dd></div>
      </dl>
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
  const sourceClass =
    sourceKind === "open"
      ? "source-open"
      : sourceKind === "preview"
        ? "source-preview"
        : "source-optin";
  const sourceLabel =
    sourceKind === "open"
      ? "Open inventory"
      : sourceKind === "preview"
        ? "Illustrative preview"
        : "Opted-in partner";
  const reason =
    sourceKind === "open"
      ? "Found in a bundled public catalog snapshot. No partner connection was needed."
      : sourceKind === "preview"
        ? "Shown to demonstrate the preference handoff because no opted-in tool response is available."
        : "Matched through an opted-in WebMCP offer tool and rendered using your applied display rules.";
  return `
    <header class="step-card-head">
      <div><p class="step-kicker">${escapeHtml(label)}</p><h3>${escapeHtml(deal.name)}</h3></div>
      <span class="source-pill ${sourceClass}">${sourceLabel}</span>
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
        <div class="collateral">
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

function renderNextStep() {
  const deal = state.sourceB || fallbackPartnerOffer();
  const sourceKind = state.sourceB ? "optin" : "preview";
  const activePreferences = state.applied ? state.appliedPreferences : DEFAULT_PREFERENCES;
  const destination =
    deal.partnerOrigin || PARTNER_ORIGINS[0] || deal.landing;
  const href = withPreferenceQuery(destination, activePreferences);
  const label = state.applied
    ? state.sourceB
      ? "Site B · adapted by an opted-in partner"
      : "Site B · adapted illustrative preview"
    : state.sourceB
      ? "Site B · opted-in offer ready"
      : "Site B · illustrative preview ready";
  const openLabel = state.sourceB ? "Open opted-in Site B" : "Open illustrative Site B";
  const actions = `
    <div class="step-actions">
      ${href ? `<a class="button-primary" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${openLabel}</a>` : ""}
      <button class="button-secondary" id="show-source" type="button">Explain partner opt-in</button>
    </div>`;
  renderOfferCard(
    els.nextStep,
    offerMarkup(deal, sourceKind, label, activePreferences) + actions,
  );
  document.getElementById("show-source")?.addEventListener("click", () => {
    setAgent(
      state.sourceB
        ? "The baseline offer did not require merchant participation. This Site B response did: the partner opted in to expose structured offer data and optional collateral through WebMCP."
        : "This is only an illustrative Site B treatment. No opted-in tool response is available in this browser, so the preview is labeled unverified and does not imply a connection.",
    );
  });
}

function renderControls() {
  els.controls.querySelectorAll("[data-pref]").forEach((input) => {
    input.checked = state.preferences.formats.includes(input.dataset.pref);
  });
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
      detail.textContent = item.detail || item.reason || "Saved to this browser";
      time.dateTime = item.observedAt || "";
      time.textContent = item.observedAt
        ? `Saved ${absoluteTime(item.observedAt)}`
        : "Saved time unavailable";
      forget.type = "button";
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
  els.forgetAll.hidden = !items.length && !state.watches.length && !state.hasSavedPreferences;
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
  const saved = writeStored(STORAGE.memory, state.memory);
  renderMemory();
  return saved;
}

function forgetMemory(key) {
  const item = state.memory.find((entry) => entry.key === key);
  state.memory = state.memory.filter((entry) => entry.key !== key);
  writeStored(STORAGE.memory, state.memory);
  if (item?.kind === "preference") {
    removeStored(STORAGE.preferences);
    state.hasSavedPreferences = false;
  }
  if (item?.kind === "watch") {
    state.watches = [];
    writeStored(STORAGE.watches, state.watches);
  }
  renderJourney();
  showToast("Saved note forgotten");
}

function forgetAllMemory() {
  state.memory = [];
  state.watches = [];
  state.simulatedUpdate = false;
  state.pendingWatch = null;
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
  state.hasSavedPreferences = false;
  Object.values(STORAGE).forEach(removeStored);
  setAgent("I forgot the saved display rules, offer notes, and deal watch from this browser.");
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
  els.watchConfirmation.hidden = !state.pendingWatch || Boolean(state.watches.length);
  els.watchButton.hidden = Boolean(state.pendingWatch) && !state.watches.length;
  if (state.watches.length) {
    els.watchTitle.textContent = "Deal watch is saved";
    els.watchDetail.textContent = state.simulatedUpdate
      ? "An illustrative qualifying change is shown for this visit only; it was not added to browser memory."
      : `Watching ${state.sourceA.name} below ${money(state.watches[0].target)} in this browser.`;
    els.watchButton.textContent = state.simulatedUpdate
      ? "Clear simulated price change"
      : "Simulate a price change";
  } else if (state.pendingWatch) {
    els.watchTitle.textContent = "Confirm this deal watch";
    els.watchDetail.textContent = "Review the exact fact, scope, retention, and outcome below.";
    els.watchFact.textContent = `Useful fact: surface ${state.pendingWatch.name} below ${money(state.pendingWatch.target)}.`;
  } else {
    els.watchTitle.textContent = "Want a price change remembered?";
    els.watchDetail.textContent = "Prepare one product-scoped deal point, then review it before anything is saved.";
    els.watchButton.textContent = "Prepare deal watch";
  }
}

function applyPreferences({ persist }) {
  state.applied = true;
  state.appliedMode = persist ? "saved" : "once";
  state.appliedPreferences = {
    ...state.preferences,
    formats: [...state.preferences.formats],
  };
  if (persist) {
    const preferencesSaved = writeStored(STORAGE.preferences, state.appliedPreferences);
    state.hasSavedPreferences = preferencesSaved;
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
  renderJourney();
}

function handlePrompt(value) {
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

function prepareDealWatch(targetPrice = Math.max(1, state.sourceA.dealPrice - 5)) {
  const target = Number(targetPrice);
  if (!Number.isFinite(target) || target <= 0) {
    setAgent("A deal-watch target must be greater than zero. Nothing was saved.");
    return false;
  }
  state.pendingWatch = {
    sku: state.sourceA.sku,
    name: state.sourceA.name,
    target,
    stagedAt: new Date().toISOString(),
  };
  setAgent(`I staged a watch for ${state.sourceA.name} below ${money(target)}. Review the exact terms and confirm in the page before anything is saved.`);
  renderJourney();
  els.confirmWatch.focus();
  return true;
}

function persistPendingWatch() {
  if (!state.pendingWatch) return;
  const previousMemory = [...state.memory];
  const watch = {
    sku: state.pendingWatch.sku,
    name: state.pendingWatch.name,
    target: state.pendingWatch.target,
    createdAt: new Date().toISOString(),
  };
  state.watches = [watch];
  state.pendingWatch = null;
  const saved = writeStored(STORAGE.watches, state.watches);
  const memorySaved = saved && addMemory(
    "Deal watch",
    `Watch ${watch.name} below ${money(watch.target)}`,
    "watch",
  );
  if (!saved || !memorySaved) {
    state.watches = [];
    state.memory = previousMemory;
    removeStored(STORAGE.watches);
    writeStored(STORAGE.memory, state.memory);
  }
  setAgent(
    saved && memorySaved
      ? `Confirmed and saved in this browser: surface ${watch.name} below ${money(watch.target)}. No notification, order, payment, or message was created.`
      : "The confirmed watch could not be saved because browser storage is unavailable.",
  );
  showToast(saved && memorySaved ? "Deal watch confirmed and saved" : "Deal watch was not saved");
  renderJourney();
}

function cancelPendingWatch() {
  state.pendingWatch = null;
  setAgent("The staged deal watch was discarded. Nothing was saved.");
  renderJourney();
  els.watchButton.focus();
}

function setDealWatch() {
  if (state.watches.length) {
    state.simulatedUpdate = !state.simulatedUpdate;
    setAgent(state.simulatedUpdate
      ? "The demo shows a qualifying price change for this visit only. It was not added to browser memory and no notification was sent."
      : "The visit-only simulated price change was cleared. The confirmed deal watch remains saved.");
    showToast(state.simulatedUpdate ? "Visit-only price change shown" : "Simulation cleared");
  } else {
    prepareDealWatch();
  }
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
  renderMemoryPreview();
  renderRules();
});

document.getElementById("apply-preferences").addEventListener("click", () => {
  applyPreferences({ persist: true });
});

document.getElementById("apply-once").addEventListener("click", () => {
  applyPreferences({ persist: false });
});

document.getElementById("reset-preferences").addEventListener("click", () => {
  state.preferences = {
    ...DEFAULT_PREFERENCES,
    formats: [...DEFAULT_PREFERENCES.formats],
  };
  state.pendingRemember = false;
  state.applied = false;
  state.appliedMode = null;
  setAgent("Draft choices reset. Nothing was saved or forgotten.");
  renderJourney();
});

els.watchButton.addEventListener("click", setDealWatch);
els.confirmWatch.addEventListener("click", persistPendingWatch);
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

function registerEngineTools() {
  if (!SUPPORTED || typeof document.modelContext?.registerTool !== "function") return;
  const register = (tool) => {
    try {
      document.modelContext.registerTool(tool);
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
  });
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
      state.preferences = {
        ...state.preferences,
        formats,
        maxPrice: maxPrice ?? state.preferences.maxPrice,
      };
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
  });
  register({
    name: "build_offer_journey",
    description: "Show the open-inventory offer, the user's preference choice, and the opted-in or clearly labeled illustrative Site B offer as one journey.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      renderJourney();
      return {
        openInventory: state.sourceA.name,
        nextSite: state.sourceB?.partnerName || "illustrative preview",
        nextSiteSource: state.sourceB ? "opted-in WebMCP partner" : "illustrative fallback",
        preferences: state.applied ? state.appliedPreferences : null,
      };
    },
  });
  register({
    name: "set_deal_watch",
    description: "Stage a browser-scoped deal point for review. This tool never persists it; the user must confirm the exact fact, scope, retention, and outcome in the page.",
    inputSchema: {
      type: "object",
      properties: { targetPrice: { type: "number", exclusiveMinimum: 0 } },
      required: ["targetPrice"],
    },
    annotations: { readOnlyHint: false },
    execute: async ({ targetPrice }) => {
      if (!prepareDealWatch(targetPrice)) {
        return { staged: false, error: "targetPrice must be greater than zero", persisted: false };
      }
      return {
        staged: true,
        persisted: false,
        fact: `Surface ${state.pendingWatch.name} below ${money(state.pendingWatch.target)}`,
        scope: "Jumping Beans product in this browser",
        retention: "Until the user chooses Forget",
        outcome: "Confirmation saves a local watch and offer note; it does not create a notification, order, payment, or message",
        requiresUserConfirmation: true,
        confirmationAction: "Use the page's Confirm and save deal watch button",
      };
    },
  });
  register({
    name: "get_profile",
    description: "Return the current user-controlled display profile, including whether the draft has been applied.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      draft: state.preferences,
      applied: state.applied ? state.appliedPreferences : null,
    }),
  });
}

async function init() {
  createPartnerFrames();
  renderJourney();
  registerEngineTools();
  updateConnections();
  const deals = await discoverPartnerDeals();
  state.partnerDeals = deals;
  state.sourceB = choosePartnerOffer(deals);
  state.discoveryComplete = true;
  updateConnections();
  renderJourney();
  if (deals.length) {
    setAgent("I found Site A in open inventory and received a structured offer from an opted-in Site B. Choose what Site B should show, then apply once or save it in this browser.");
  } else if (SUPPORTED) {
    setAgent("I found Site A in open inventory, but no opted-in tool returned an offer. Site B remains an explicitly labeled illustrative preview.");
  }
}

init();
