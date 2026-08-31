// Jumping Beans Engine — Cloudflare Worker.
// Serves the engine app (index.html, app.js, config.js [+ assets]) with the
// cross-origin-isolation + origin-trial headers WebMCP requires.
import assets from "./static.js"; // generated: { "index.html": "...", ... }

const TRIAL =
  "Agi8UYnlGG38Bx/n9WLYXzqTEW2xnHv6SMR0ANCNg8i/SS15D+xcmLNqkoVtqrfQM2JHkr7DC0mTY2ZJpj+MkQgAAACAeyJvcmlnaW4iOiJodHRwczovL2p1bXBpbmctYmVhbnMtZW5naW5lLnN0ZXZlLWsta2FsbC53b3JrZXJzLmRldjo0NDMiLCJmZWF0dXJlIjoiV2ViTUNQIiwiZXhwaXJ5IjoxNzk0ODczNjAwLCJpc1N1YmRvbWFpbiI6dHJ1ZX0=";

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
