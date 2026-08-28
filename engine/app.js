// Jumping Beans Engine — the Concierge app.
// Cross-origin discovery + aggregation across partner shops, a ranked feed,
// channel preview, and the engine's own agent tools (F3).

import {
  ORIGINS,
  PARTNER_ORIGINS,
  PARTNER_NAMES,
  TOOL_NAMES,
  PERSONAS,
  SUPPORTED,
} from "./config.js";

const els = {
  status: document.getElementById("status"),
  statusDot: document.getElementById("status-dot"),
  grid: document.getElementById("feed"),
  persona: document.getElementById("persona"),
  tabs: document.getElementById("tabs"),
  preview: document.getElementById("preview"),
  previewTitle: document.getElementById("preview-title"),
  mode: document.getElementById("mode"),
  lastRun: document.getElementById("last-run"),
};

let state = {
  profile: PERSONAS[0],
  allDeals: [],
  tools: [],
  saved: [], // prior saved_interest records (per session)
};

// ---------------------------------------------------------------- partners
const iframes = PARTNER_ORIGINS.map((origin) => {
  const f = document.createElement("iframe");
  f.src = origin + "/";
  f.setAttribute("allow", "tools");
  f.className = "partner-frame";
  f.dataset.origin = origin;
  f.dataset.online = "0";
  f.addEventListener("load", () => {
    f.dataset.online = "1";
    updateStatus();
  });
  document.body.appendChild(f);
  return { origin, el: f };
});

let observed = new Set();
function partnerName(origin) {
  return PARTNER_NAMES[origin] || new URL(origin).hostname;
}

// ontoolchange: cross-origin signal that a partner's tool set changed.
function onToolChange(ev) {
  const origin = ev.origin || ev.tool?.origin;
  observed.add(origin);
  updateStatus();
}
if (SUPPORTED && "ontoolchange" in document.modelContext) {
  document.modelContext.ontoolchange = onToolChange;
}

function updateStatus() {
  const online = iframes.filter((i) => i.el.dataset.online === "1").length;
  const status =
    online === 0
      ? "Connecting partners…"
      : online < PARTNER_ORIGINS.length
        ? `Online ${online}/${PARTNER_ORIGINS.length}`
        : `${PARTNER_ORIGINS.length}/${PARTNER_ORIGINS.length} partners online`;
  els.status.textContent = status;
  els.statusDot.dataset.on = online >= PARTNER_ORIGINS.length ? "1" : "0";
}

// ------------------------------------------------------------ feed building
async function discoverTools() {
  if (!SUPPORTED) return [];
  const tools = await document.modelContext.getTools({ fromOrigins: PARTNER_ORIGINS });
  return tools.filter((t) => t.name === TOOL_NAMES.matchingDeals);
}

// Chrome 151: executeTool(tool, jsonString) → resolves to a STRING.
async function execTool(tool, input) {
  const raw = await document.modelContext.executeTool(tool, JSON.stringify(input));
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function buildFeed(profile) {
  if (!SUPPORTED) return [];
  const tools = await discoverTools();
  state.tools = tools;

  const results = await Promise.allSettled(
    tools.map((t) => execTool(t, { categories: profile.recurringCategories }))
  );

  const allDeals = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value?.deals ?? []);

  return allDeals
    .filter((d) => {
      const c = profile.budgetCeilings?.[d.category];
      return c == null || d.dealPrice <= c;
    })
    .map((d) => ({
      ...d,
      savedPct: Math.round((1 - d.dealPrice / d.listPrice) * 100),
    }))
    .sort((a, b) => b.savedPct - a.savedPct);
}

// ---------------------------------------------------------------- rendering
const CARD = (d) => `
  <div class="card">
    <div class="card-top">
      <span class="chip">${d.partnerName}</span>
      <span class="origin">${safeOrigin(d.origin)}</span>
    </div>
    <div class="thumb-row">
      ${
        d.imageUrl.startsWith("http")
          ? `<img class="thumb" src="${d.imageUrl}" alt="" crossorigin="anonymous">`
          : `<div class="thumb">🛍️</div>`
      }
      <div class="desc">
        <h3>${d.name}</h3>
        <div class="cat">${d.category}</div>
      </div>
    </div>
    <div class="price">
      <span class="list">$${d.listPrice.toFixed(2)}</span>
      <span class="deal">$${d.dealPrice.toFixed(2)}</span>
      <span class="save">${d.savedPct}% off</span>
    </div>
    <div class="expiry">${priceDate(d.expiresAt)}</div>
  </div>`;

function safeOrigin(o) {
  try {
    return new URL(o).hostname;
  } catch {
    return o || "";
  }
}
function priceDate(s) {
  const d = new Date(s);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return "⚡ Expires today";
  const days = Math.round((d - today) / 864e5);
  return days <= 1 ? "Ends soon" : `${days} days left`;
}

function renderFeed(deals) {
  state.allDeals = deals;
  els.grid.innerHTML = deals.length
    ? deals.map(CARD).join("")
    : `<div class="empty">No matching deals yet — change persona or come back later.</div>`;
  els.lastRun.textContent = new Date().toLocaleTimeString();
  renderPreview();

  // prove cross-origin in UI: count distinct origins feeding the rail
  const origins = new Set(deals.map((d) => safeOrigin(d.origin)).filter(Boolean));
  if (origins.size) {
    els.status.textContent += ` · ${origins.size} source${origins.size > 1 ? "s" : ""}`;
  }
}

// ---------------------------------------------------------- channel preview
function renderPreview() {
  const chan = els.tabs.dataset.channel || "email";
  const deals = state.allDeals;
  els.previewTitle.textContent = chan.toUpperCase() + " preview";

  if (!deals.length) {
    els.preview.innerHTML = `<div class="empty">Build a feed first to preview.</div>`;
    return;
  }

  if (chan === "sms") {
    els.preview.innerHTML = deals
      .slice(0, 3)
      .map(
        (d) =>
          `📱 <b>${d.partnerName}</b>: ${d.name} — $${d.dealPrice.toFixed(2)} (reg $${d.listPrice.toFixed(2)}). ${d.savedPct}% off. Reply STOP to opt out.`
      )
      .join("<br><br>");
    return;
  }
  if (chan === "app") {
    els.preview.innerHTML = deals
      .slice(0, 4)
      .map((d) => `<div class="notif">🔔 ${d.name} now $${d.dealPrice.toFixed(2)} at ${d.partnerName}</div>`)
      .join("");
    return;
  }
  // email
  els.preview.innerHTML =
    `<div class="email-head">${state.profile.displayName.split(" — ")[0]} — your weekly deals</div>` +
    deals
      .slice(0, 4)
      .map(
        (d) => `
      <div class="email-row">
        <div><b>${d.name}</b><br><span class="muted">${safeOrigin(d.origin)}</span></div>
        <div class="email-price">
          <span class="deal">$${d.dealPrice.toFixed(2)}</span>
          <span class="list">$${d.listPrice.toFixed(2)}</span>
          <button class="cta">Shop at ${d.partnerName}</button>
        </div>
      </div>`
      )
      .join("");
}

// ------------------------------------------------------------ persona picker
els.persona.innerHTML = PERSONAS.map(
  (p) => `<option value="${p.personaId}">${p.displayName}</option>`
).join("");
els.persona.addEventListener("change", () => {
  const p = PERSONAS.find((x) => x.personaId === els.persona.value) || PERSONAS[0];
  state.profile = p;
  refreshFeed(p);
});

async function refreshFeed(profile) {
  if (!SUPPORTED) {
    els.mode.textContent = "Agent tools: OFF — manual mode";
    return;
  }
  const feed = await buildFeed(profile);
  renderFeed(feed);
}

// On tool-ready (iframes loaded) build the first feed for the default persona.
Promise.all(
  iframes.map(
    (i) =>
      new Promise((res) => {
        if (i.el.dataset.online === "1") return res();
        i.el.addEventListener("load", () => res(), { once: true });
      })
  )
).then(async () => {
  updateStatus();
  if (SUPPORTED) {
    await refreshFeed(state.profile);
    els.mode.textContent = `Agent tools: ON (${state.tools.length} partner tools)`;
  }
});

// ------------------------------------------------------------ engine tools
if (SUPPORTED && typeof document.modelContext.registerTool === "function") {
  document.modelContext.registerTool({
    name: "build_feed",
    description:
      "Build the personalized deal feed for a saved persona profile across all connected partner shops. Returns the ranked deals.",
    inputSchema: {
      type: "object",
      properties: { personaId: { type: "string", description: "e.g. 'alex-budget-parent'" } },
      required: ["personaId"],
    },
    annotations: { readOnlyHint: true },
    execute: async ({ personaId }) => {
      const p = PERSONAS.find((x) => x.personaId === personaId) || state.profile;
      state.profile = p;
      els.persona.value = p.personaId;
      const deals = await buildFeed(p);
      renderFeed(deals);
      return {
        persona: p.displayName,
        n: deals.length,
        top3: deals.slice(0, 3).map((d) => `${d.name} → $${d.dealPrice}`),
      };
    },
  });

  document.modelContext.registerTool({
    name: "preview_channel",
    description:
      "Re-render the deal feed as an email, SMS, or app notification preview. Returns a short summary.",
    inputSchema: {
      type: "object",
      properties: { channel: { type: "string", enum: ["email", "sms", "app"], description: "Which channel to preview" } },
      required: ["channel"],
    },
    annotations: { readOnlyHint: true },
    execute: async ({ channel }) => {
      if (!["email", "sms", "app"].includes(channel)) throw new Error("channel must be email|sms|app");
      els.tabs.dataset.channel = channel;
      setTab(channel);
      renderPreview();
      return { channel, n: state.allDeals.length };
    },
  });

  document.modelContext.registerTool({
    name: "get_profile",
    description:
      "Return the current standing preference profile the engine is shopping against. The agent quotes it back to the user.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => state.profile,
  });

  document.modelContext.registerTool({
    name: "save_interest",
    description:
      "Log the user's interest in a product so the merchant's view updates. Records it in the engine and returns a confirmation.",
    inputSchema: {
      type: "object",
      properties: {
        partnerId: { type: "string", description: "e.g. 'petsupply'" },
        product: { type: "string" },
        pricePoint: { type: "number" },
      },
      required: ["partnerId", "product"],
    },
    annotations: { readOnlyHint: false },
    execute: async ({ partnerId, product, pricePoint }) => {
      const rec = {
        partnerId,
        product,
        pricePoint,
        at: new Date().toISOString(),
        channel: els.tabs.dataset.channel || "email",
      };
      state.saved.push(rec);
      flash(`Logged interest: ${product} at ${partnerId}`);
      return { saved: rec, logged: true };
    },
  });
}

function setTab(name) {
  [...els.tabs.children].forEach((b) => (b.dataset.on = b.dataset.channel === name ? "1" : "0"));
}
[...els.tabs.children].forEach((b) =>
  b.addEventListener("click", () => {
    els.tabs.dataset.channel = b.dataset.channel;
    setTab(b.dataset.channel);
    renderPreview();
  })
);
setTab((els.tabs.dataset.channel = "email"));

function flash(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.opacity = "1";
  setTimeout(() => (t.style.opacity = "0"), 2500);
}
