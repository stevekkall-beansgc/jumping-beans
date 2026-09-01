const CONSUMER_ORIGIN = "http://127.0.0.1:8182";
const status = document.getElementById("registration");
const registrationEvidence = {
  producerOrigin: location.origin,
  crossOriginIsolated,
  modelContext: typeof document.modelContext,
  registration: null,
};

function reportRegistration() {
  status.textContent = JSON.stringify(registrationEvidence, null, 2);
}

const tool = {
  name: "get_items",
  title: "Get bounded test items",
  description: "Return a fixed, bounded native WebMCP result for the cross-origin reproduction.",
  inputSchema: {
    type: "object",
    properties: {
      categories: { type: "array", items: { type: "string" } },
      maxPrice: { type: "number" },
    },
    required: ["categories"],
  },
  execute: async () => ({
    items: [{ sku: "beans-1lb", category: "coffee", price: 12 }],
  }),
};

if (!document.modelContext?.registerTool) {
  registrationEvidence.registration = "document.modelContext is unavailable on the producer";
  reportRegistration();
} else {
  try {
    await document.modelContext.registerTool(tool, { exposedTo: [CONSUMER_ORIGIN] });
    registrationEvidence.registration = `registered ${tool.name} for ${CONSUMER_ORIGIN}`;
  } catch (error) {
    registrationEvidence.registration = `registration failed: ${error?.name || "Error"} ${error?.message || String(error)}`;
  }
  reportRegistration();
}
