export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    return new Response(render(url), {
      headers: {
        "Content-Type": "text/html",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Origin-Trial":
          "Ascygt4b5yEkD+QNPGIKxZcPw1XSlZc89jsqQynpM2rK4aaiRnnABVokA84+byAu668NW7f60E30dEUJqIarswUAAABqeyJvcmlnaW4iOiJodHRwczovL3lvdXItZW5naW5lLndvcmtlcnMuZGV2OjQ0MyIsImZlYXR1cmUiOiJXZWJNQ1AiLCJleHBpcnkiOjE3OTQ4NzM2MDAsImlzU3ViZG9tYWluIjp0cnVlfQ==",
      },
    });
  },
};

function render(url) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jumping Beans Engine</title>
<style>body{font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px;color:#222}
h1{font-size:1.4rem}code{background:#f1f1f1;padding:2px 6px;border-radius:4px}</style>
</head><body>
<h1>Jumping Beans Engine</h1>
<p>WebMCP discovery + deal aggregation hub for Jumping Beans.</p>
<p>This unit, once built, hosts the <code>engine</code> that cross-origin discovers
partner tools (petsupply, coffee, watch) via <code>document.modelContext.getTools()</code>
in <code>allow="tools"</code> iframes and fulfils the agent's deal request.</p>
<pre id="status">engine scaffold — deploy workers, then wire ORIGINS</pre>
</body></html>`;
}
