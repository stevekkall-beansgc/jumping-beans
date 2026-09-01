const PRODUCER_ORIGIN = "http://127.0.0.1:8183";
const TOOL_NAME = "get_items";
const out = document.getElementById("out");
const frame = document.getElementById("producer-frame");
const pause = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const DISCOVERY_ATTEMPTS = 3;
const DISCOVERY_RETRY_MS = 250;
const useBareAllow = new URL(location.href).searchParams.get("allow") === "bare";
const iframeAllow = useBareAllow
  ? "tools; cross-origin-isolated"
  : `tools ${PRODUCER_ORIGIN}; cross-origin-isolated ${PRODUCER_ORIGIN}`;
const modelContextMembers = document.modelContext
  ? [...new Set([
    ...Object.getOwnPropertyNames(document.modelContext),
    ...Object.getOwnPropertyNames(Object.getPrototypeOf(document.modelContext)),
  ])].sort()
  : [];
const nonNativeMembers = modelContextMembers.filter((member) => member.startsWith("codex"));

function report(value) {
  out.textContent = JSON.stringify(value, null, 2);
}

async function discoverPartnerTool(evidence) {
  let matching = [];
  for (let attempt = 0; attempt < DISCOVERY_ATTEMPTS; attempt += 1) {
    try {
      const tools = await document.modelContext.getTools({ fromOrigins: [PRODUCER_ORIGIN] });
      const listed = tools.map(({ name, origin }) => ({ name, origin }));
      evidence.discoveryAttempts.push({ attempt: attempt + 1, tools: listed });
      evidence.tools = listed;
      matching = tools.filter((tool) => tool.name === TOOL_NAME && tool.origin === PRODUCER_ORIGIN);
      evidence.partnerTools = matching.map(({ name, origin }) => ({ name, origin }));
      if (matching.length === 1 || attempt === DISCOVERY_ATTEMPTS - 1) return matching;
    } catch (error) {
      evidence.discoveryAttempts.push({
        attempt: attempt + 1,
        error: { name: error?.name || "Error", message: error?.message || String(error) },
      });
      if (attempt === DISCOVERY_ATTEMPTS - 1) throw error;
    }
    await pause(DISCOVERY_RETRY_MS * (attempt + 1));
  }
  return matching;
}

async function run() {
  const evidence = {
    consumerOrigin: location.origin,
    producerOrigin: PRODUCER_ORIGIN,
    allowMode: useBareAllow ? "bare" : "origin-qualified",
    crossOriginIsolated,
    modelContext: typeof document.modelContext,
    modelContextMembers,
    nativeSurface: nonNativeMembers.length === 0,
    nonNativeMembers,
    iframeAllow,
    toolchangeSupported: typeof document.modelContext?.addEventListener === "function",
    toolchangeEvents: [],
    discoveryAttempts: [],
    tools: [],
    partnerTools: [],
    execution: null,
    error: null,
  };

  if (!document.modelContext?.getTools || !document.modelContext?.executeTool) {
    evidence.error = "document.modelContext is unavailable on the consumer";
    report(evidence);
    return;
  }
  if (!evidence.nativeSurface) {
    evidence.error = "non-native modelContext adapter detected; native WebMCP evidence is invalid in this profile";
    report(evidence);
    return;
  }

  // Attach this native lifecycle observer before the producer's first navigation.
  // Discovery below remains authoritative: a toolchange event alone is not a tool.
  let toolchangeDiscoveryScheduled = false;
  if (evidence.toolchangeSupported) {
    document.modelContext.addEventListener("toolchange", () => {
      evidence.toolchangeEvents.push(new Date().toISOString());
      if (toolchangeDiscoveryScheduled) return;
      toolchangeDiscoveryScheduled = true;
      window.setTimeout(() => {
        toolchangeDiscoveryScheduled = false;
        // This is a diagnostic reconciliation only. The post-load discovery
        // below remains the evidence-bearing result and is still native-only.
        void discoverPartnerTool(evidence).then(() => report(evidence)).catch((error) => {
          evidence.error = { name: error?.name || "Error", message: error?.message || String(error) };
          report(evidence);
        });
      }, 0);
    });
  }

  const loaded = new Promise((resolve) => {
    frame.addEventListener("load", resolve, { once: true });
    frame.addEventListener("error", resolve, { once: true });
  });
  // Set the selected policy while the frame is still about:blank and before its
  // first producer navigation. The bare mode isolates the iframe-policy syntax
  // as a diagnostic control; the response policy still permits only the producer.
  frame.allow = iframeAllow;
  frame.src = `${PRODUCER_ORIGIN}/`;
  await loaded;
  // Registration is asynchronous; bounded native discovery below separates
  // registration timing from a permanent embedded-discovery failure.

  try {
    const partnerTools = await discoverPartnerTool(evidence);
    if (partnerTools.length !== 1) {
      evidence.error = `expected exactly one ${TOOL_NAME} tool from ${PRODUCER_ORIGIN}`;
      report(evidence);
      return;
    }

    const raw = await document.modelContext.executeTool(
      partnerTools[0],
      JSON.stringify({ categories: ["coffee"], maxPrice: 20 }),
    );
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    evidence.execution = { rawType: typeof raw, value };
  } catch (error) {
    evidence.error = { name: error?.name || "Error", message: error?.message || String(error) };
  }
  report(evidence);
}

void run();
