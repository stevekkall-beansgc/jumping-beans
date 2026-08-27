const tool = {
  name: "get_items",
  title: "Get matching items",
  description: "Return catalog items matching the given categories and an optional max price.",
  inputSchema: {
    type: "object",
    properties: {
      categories: { type: "array", items: { type: "string" } },
      maxPrice: { type: "number" },
    },
    required: ["categories"],
  },
  execute: async ({ categories, maxPrice }) => {
    const items = [
      { sku: "kibble-12", name: "Kibble 12kg", category: "dog-food", price: 31.5 },
      { sku: "treats-2pk", name: "Treats (2 pack)", category: "dog-food", price: 11.0 },
      { sku: "beans-1lb", name: "Whole beans 1lb", category: "coffee", price: 12.0 },
    ];
    return { items: items.filter(i =>
      categories.includes(i.category) &&
      (maxPrice == null || i.price <= maxPrice)) };
  },
};
await document.modelContext.registerTool(tool, {
  // ⚠️ exposedTo goes in the OPTIONS (2nd) argument — NOT inside the tool dict.
  exposedTo: ["http://localhost:8082"],
});
console.log("[partner] registered:", tool.name);