// Jumping Beans Engine — Cloudflare Worker.
// Serves the engine app (index.html, app.js, config.js [+ assets]) with the
// cross-origin-isolation + origin-trial headers WebMCP requires.
import assets from "./static.js"; // generated: { "index.html": "...", ... }
import { handleIdentity } from "./identity.mjs";

const TRIAL =
  "Agi8UYnlGG38Bx/n9WLYXzqTEW2xnHv6SMR0ANCNg8i/SS15D+xcmLNqkoVtqrfQM2JHkr7DC0mTY2ZJpj+MkQgAAACAeyJvcmlnaW4iOiJodHRwczovL2p1bXBpbmctYmVhbnMtZW5naW5lLnN0ZXZlLWsta2FsbC53b3JrZXJzLmRldjo0NDMiLCJmZWF0dXJlIjoiV2ViTUNQIiwiZXhwaXJ5IjoxNzk0ODczNjAwLCJpc1N1YmRvbWFpbiI6dHJ1ZX0=";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
};

// Cross-origin WebMCP needs two explicit grants: the iframe's `allow`
// attribute and the embedder's top-level Permissions Policy. Keep this list
// exact so the engine can inspect only the three opted-in partner origins.
const permissionsPolicy = [
  "self",
  '"https://petsupply.pages.dev"',
  '"https://coffee-amk.pages.dev"',
  '"https://watch-ce8.pages.dev"',
].join(" ");
const base = {
  COOP: "same-origin",
  COEP: "require-corp",
  CORP: "cross-origin",
  TRIAL,
  PERMISSIONS: `tools=(${permissionsPolicy})`,
};

function withEngineHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", base.COOP);
  headers.set("Cross-Origin-Embedder-Policy", base.COEP);
  headers.set("Cross-Origin-Resource-Policy", base.CORP);
  headers.set("Permissions-Policy", base.PERMISSIONS);
  headers.set("Origin-Trial", base.TRIAL);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    // Account routes are same-origin engine endpoints. They never bridge to a
    // partner tool, alter WebMCP discovery, or expose session material there.
    const identityResponse = await handleIdentity(request, env);
    if (identityResponse) return withEngineHeaders(identityResponse);
    const url = new URL(request.url);
    let path = decodeURIComponent(url.pathname);
    if (path === "/") path = "/index.html";

    const body = assets[path];
    if (body == null) {
      return new Response("Not found", { status: 404 });
    }

    const ext = path.slice(path.lastIndexOf("."));
    return withEngineHeaders(new Response(body, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
      },
    }));
  },
};
