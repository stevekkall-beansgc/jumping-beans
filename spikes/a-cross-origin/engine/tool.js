const out = document.getElementById("out");
document.querySelector("iframe").addEventListener("load", async () => {
  try {
    // Cross-origin discovery: same-origin + origins in fromOrigins only.
    const tools = await document.modelContext.getTools({
      fromOrigins: ["http://localhost:8081"],
    });
    out.textContent = "discovered: " +
      JSON.stringify(tools.map(t => ({ name: t.name, origin: t.origin })));
    if (tools.length === 0) return;   // ← NO-GO signal
    // ⚠️ executeTool() is on the CALLER's modelContext; in Chrome 151 the 2nd
    // argument is a JSON STRING (not an object), and it resolves to a STRING.
    const raw = await document.modelContext.executeTool(
      tools[0], JSON.stringify({ categories: ["coffee"], maxPrice: 20 }));
    out.textContent += "\nresult: " + raw;
    out.textContent += "\nparsed ok: " + JSON.stringify(JSON.parse(raw));
  } catch (err) {
    out.textContent = "ERROR: " + err.name + " " + err.message;
  }
});