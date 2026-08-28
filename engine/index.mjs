// Jumping Beans Engine — Cloudflare Worker.
// Serves the engine app (index.html, app.js, config.js [+ assets]) with the
// cross-origin-isolation + origin-trial headers WebMCP requires.
import assets from "./static.js"; // generated: { "index.html": "...", ... }

const TRIAL =
  "Ascygt4b5yEkD+QNPGIKxZcPw1XSlZc89jsqQynpM2rK4aaiRnnABVokA84+byAu668NW7f60E30dEUJqIarswUAAABqeyJvcmlnaW4iOiJodHRwczovL3lvdXItZW5naW5lLndvcmtlcnMuZGV2OjQ0MyIsImZlYXR1cmUiOiJXZWJNQ1AiLCJleHBpcnkiOjE3OTQ4NzM2MDAsImlzU3ViZG9tYWluIjp0cnVlfQ==";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
};

const base = { COOP: "same-origin", COEP: "require-corp", CORP: "cross-origin", TRIAL };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = decodeURIComponent(url.pathname);
    if (path === "/") path = "/index.html";

    const body = assets[path];
    if (body == null) {
      return new Response("Not found", { status: 404 });
    }

    const ext = path.slice(path.lastIndexOf("."));
    return new Response(body, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cross-Origin-Opener-Policy": base.COOP,
        "Cross-Origin-Embedder-Policy": base.COEP,
        "Cross-Origin-Resource-Policy": base.CORP,
        "Origin-Trial": base.TRIAL,
      },
    });
  },
};
