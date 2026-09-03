#!/usr/bin/env node
// Jumping Beans — scaffold a new partner unit from a template.
//
// Generates a complete, deploy-ready partner directory under partners/<id>:
//   index.html   — self-hosted shop page (graceful non-WebMCP UI)
//   tool.js      — imperative WebMCP get_matching_deals tool (signal-guarded)
//   storefront.js— generated copy of the shared semantic renderer
//   storefront.css + design-system/* — generated standard adapters
//   catalog.json — the SKUs you seed (or generated from CLI)
//   img/*.svg    — placeholder product images (COEP-safe, self-hosted)
//   <deploy cfg> — _headers (Netlify) or vercel.json (Vercel) with
//                  COOP/COEP/CORP + the unit's origin-trial token
//
// It also updates shared/config.js ORIGINS + PARTNER_ORIGINS.
//
// Usage:
//   node scripts/scaffold-partner.mjs coffee \
//     --name "Coffee Co" \
//     --host netlify \
//     --origin https://jumping-beans-coffee.netlify.app \
//     --token <REAL_TOKEN_OR_placeholder>
//
// One remaining human step per partner (unavoidable — Chrome has no API for it):
//   register the origin at the Origin Trials UI, then re-run with the real token
//   (or paste the token into the generated deploy config).

import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const configPath = path.join(root, "shared", "config.js");

function fail(msg) {
  console.error("✖ " + msg);
  process.exit(1);
}

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
if (!id) fail("Usage: node scripts/scaffold-partner.mjs <id> --name \"...\" [--host netlify|vercel] [--origin https://...] [--local-port 8087] [--token <token>]");

function flag(name, def = undefined) {
  const i = args.indexOf("--" + name);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
}

const name = flag("name", id.charAt(0).toUpperCase() + id.slice(1));
const host = flag("host", "netlify"); // netlify (_headers) | vercel (vercel.json)
const origin = flag("origin", `https://${id}.example.com`);
const localPort = Number(flag("local-port", "8087"));
const token = flag("token", "");

if (!["netlify", "vercel"].includes(host))
  fail("--host must be 'netlify' or 'vercel'");
if (!Number.isInteger(localPort) || localPort < 1024 || localPort > 65535)
  fail("--local-port must be an integer from 1024 through 65535");

const p = path.join(root, "partners", id);
const img = path.join(p, "img");
if (existsSync(p)) fail(`partner '${id}' already exists at partners/${id}`);
await mkdir(img, { recursive: true });
await mkdir(path.join(p, "design-system"), { recursive: true });

// ---- catalog seed (default: a couple of demo SKUs expiring today) ----
const today = new Date();
const iso = (d) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const defaultSkus = [
  {
    sku: `${id}-a`,
    name: "Featured Item",
    category: "general",
    listPrice: null,
    listPriceSource: null,
    dealPrice: 14.5,
    imageUrl: `/img/${id}-a.svg`,
    expiresAt: `${iso(today)}T23:59:00-04:00`,
  },
  {
    sku: `${id}-b`,
    name: "Second Item",
    category: "general",
    listPrice: null,
    listPriceSource: null,
    dealPrice: 8.0,
    imageUrl: `/img/${id}-b.svg`,
    expiresAt: `${iso(new Date(today.getTime() + 5 * 864e5))}T23:59:00-04:00`,
  },
];
const seedPath = args.find((a) => a.endsWith(".json") && existsSync(a));
const catalog = seedPath
  ? JSON.parse(readFileSync(seedPath, "utf8"))
  : defaultSkus;

// ---- deploy config (COOP/COEP/CORP + the unit's origin-trial token) ----
const deployCfg =
  host === "netlify"
    ? `/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Resource-Policy: cross-origin
  Origin-Trial: ${token}
`
    : JSON.stringify(
        {
          headers: [
            {
              source: "/(.*)",
              headers: [
                { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
                { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
                { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
                { key: "Origin-Trial", value: token },
              ],
            },
          ],
        },
        null,
        2
      ) + "\n";

// ---- tool.js (pattern from petsupply, signal-guarded) ----
const toolJs = `// Jumping Beans partner: ${name} (${id}). Imperative WebMCP tool.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const RUNTIME_MODE = LOCAL_HOSTS.has(location.hostname) ? "local" : "production";
const ENGINE_ORIGINS = Object.freeze({
  local: \`${location.protocol}//${location.hostname}:8082\`,
  production: "https://jumping-beans-engine.steve-k-kall.workers.dev",
});
const CONCIERGE_ORIGIN = ENGINE_ORIGINS[RUNTIME_MODE];
const PARTNER_NAME = ${JSON.stringify(name)};
const PARTNER_ID = ${JSON.stringify(id)};
const TOOL_NAME = "get_matching_deals";
const MAX_RESPONSE_DEALS = 24;
const OUTPUT_DEAL_KEYS = new Set(["sku", "name", "category", "listPrice", "listPriceSource", "dealPrice", "imageUrl", "expiresAt", "landing", "vendor", "source", "partnerId", "partnerName", "interestEligible", "merchantPageDiscountPercent", "merchantPageDiscountEvidence", "collateral", "provenance"]);

const catalog = await fetch("/catalog.json").then((r) => r.json());

function outputDeal(value) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => OUTPUT_DEAL_KEYS.has(key)));
}

await document.modelContext.registerTool(
  {
    name: TOOL_NAME,
    title: "Get matching deals",
    description:
      "Return ${name} catalog records in the given categories, optionally under a max price. The opted-in shop supplies the records; Jumping Beans has not independently verified them.",
    inputSchema: {
      type: "object",
      properties: {
        categories: { type: "array", items: { type: "string" }, description: "e.g. ['general']" },
        maxPrice: { type: "number", minimum: 0, description: "Optional ceiling on dealPrice" },
      },
      required: ["categories"],
    },
    annotations: { readOnlyHint: true },
    execute: async ({ categories, maxPrice }, { signal } = {}) => {
      return {
        deals: catalog
          .filter(
            (d) =>
              categories.includes(d.category) &&
              (maxPrice == null || d.dealPrice <= maxPrice) &&
              (!signal || !signal.aborted)
          )
          .slice(0, MAX_RESPONSE_DEALS)
          .map((d) => ({
            ...outputDeal(d),
            partnerId: PARTNER_ID,
            partnerName: PARTNER_NAME,
            provenance: {
              actor: PARTNER_NAME,
              source: d.source || "partner catalog",
              verification: "partner-provided; not independently verified by Jumping Beans",
              expiresAt: d.expiresAt,
            },
          })),
      };
    },
  },
  { exposedTo: [CONCIERGE_ORIGIN] }
);

console.log(\`[\${PARTNER_ID}] registered:\`, TOOL_NAME);
`;

// Generated adapter sources are copied so a newly scaffolded deployment starts
// on the same renderer and token contract as the existing partners.
const storefrontJs =
  "// GENERATED from shared/storefront.js. Run node scripts/sync-static-ui.mjs; do not edit.\n" +
  readFileSync(path.join(root, "shared", "storefront.js"), "utf8");
const storefrontCss =
  "/* GENERATED from shared/storefront.css. Run node scripts/sync-static-ui.mjs; do not edit. */\n" +
  readFileSync(path.join(root, "shared", "storefront.css"), "utf8");

// ---- index.html ----
const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <meta http-equiv="Origin-Trial" content="${token}">
  <title>${name} — Jumping Beans</title>
  <link rel="stylesheet" href="./design-system/tokens.css">
  <link rel="stylesheet" href="./design-system/primitives.css">
  <link rel="stylesheet" href="./storefront.css">
</head>
<body class="bl-page" data-product-theme="cobalt" data-partner-name=${JSON.stringify(name)}>
  <a class="bl-skip-link" href="#main">Skip to current offers</a>
  <header class="bl-header">
    <div class="bl-shell bl-header__inner">
      <div><a class="bl-brand" href="./">${name}</a><p class="bl-muted tagline">Current catalog snapshot</p></div>
      <span class="bl-badge" data-status="success">Opted-in WebMCP partner</span>
    </div>
  </header>
  <main class="bl-shell bl-main bl-stack" id="main" tabindex="-1">
    <section class="bl-stack bl-measure page-intro" data-space="compact" aria-labelledby="offers-title">
      <p class="eyebrow">Partner storefront</p>
      <h1 id="offers-title">Current offers from ${name}</h1>
      <p>This regular storefront may adapt presentation when Jumping Beans supplies scoped display rules.</p>
    </section>
    <aside class="bl-provenance bl-stack bl-measure provenance-banner" data-space="compact" id="banner" aria-label="Catalog provenance">
      <strong class="bl-provenance__title">Opted-in partner, partner-provided inventory</strong>
      <span>${name} exposes structured offers through WebMCP. Jumping Beans has not independently verified the catalog records.</span>
    </aside>
    <ul class="bl-grid offer-grid" id="grid" aria-live="polite" aria-busy="true">
      <li class="bl-callout offer-grid__state">Loading the catalog…</li>
    </ul>
  </main>
  <footer class="bl-shell site-footer">Check the merchant destination for current price, availability, terms, and shipping.</footer>
  <script type="module" src="./tool.js"></script>
  <script type="module" src="./storefront.js"></script>
</body>
</html>
`;

// ---- write everything ----
await writeFile(path.join(p, "index.html"), indexHtml);
await writeFile(path.join(p, "tool.js"), toolJs);
await writeFile(path.join(p, "storefront.js"), storefrontJs);
for (const module of ["preference-handoff.mjs", "preference-plane.mjs", "shopping-intent.mjs"]) {
  await writeFile(path.join(p, module), readFileSync(path.join(root, "engine", module), "utf8"));
}
await writeFile(path.join(p, "storefront.css"), storefrontCss);
for (const file of ["tokens.css", "tokens.json", "source.json"]) {
  await writeFile(
    path.join(p, "design-system", file),
    readFileSync(path.join(root, "engine", "design-system", file), "utf8"),
  );
}
await writeFile(path.join(p, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
await writeFile(
  path.join(p, host === "netlify" ? "_headers" : "vercel.json"),
  deployCfg
);
for (const sku of catalog) {
  await writeFile(
    path.join(img, path.basename(sku.imageUrl)),
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect x="1" y="1" width="126" height="126" rx="16" fill="none" stroke="currentColor"/><text x="64" y="74" font-size="52" text-anchor="middle">🛍️</text></svg>\n`
  );
}

// ---- update shared/config.js ORIGINS + PARTNER_ORIGINS ----
const config = readFileSync(configPath, "utf8");

// 1) Add the partner to both explicit runtime sets in the shared reference.
function upsertOrigin(source, mode, value) {
  const block = new RegExp(`(${mode}: Object\\.freeze\\(\\{\\n)([\\s\\S]*?)(\\n  \\}\\),)`);
  const match = block.exec(source);
  if (!match) fail(`could not find ${mode} origin block in shared/config.js`);
  const line = `    ${id}: ${JSON.stringify(value)},`;
  const existing = new RegExp(`^\\s*${id}:.*$`, "m");
  const body = existing.test(match[2])
    ? match[2].replace(existing, line)
    : `${match[2]}\n${line}`;
  return source.replace(block, `$1${body}$3`);
}

let updated = upsertOrigin(config, "local", `http://localhost:${localPort}`);
updated = upsertOrigin(updated, "production", origin);

// 2) PARTNER_ORIGINS: ensure `ORIGINS.${id}` appears exactly once, no dup commas,
//    no trailing `,` before `]`. Parse the array body and rebuild it cleanly.
const partnerBlockRe = /export const PARTNER_ORIGINS = \[([\s\S]*?)\];/;
const pm = partnerBlockRe.exec(updated);
if (pm) {
  const target = "ORIGINS." + id;
  const rawEntries = pm[1].split(",").map((s) => s.trim()).filter(Boolean);
  const seen = new Set();
  const entries = [];
  for (const e of rawEntries) {
    const kept = e === target || !seen.has(e);
    if (kept) {
      entries.push(e);
      seen.add(e);
    }
  }
  if (!seen.has(target)) entries.push(target);
  const body = entries.join(",\n  ").replace(/^\s+/, "");
  updated = updated.replace(
    partnerBlockRe,
    `export const PARTNER_ORIGINS = [${body}];`
  );
}

if (updated === config)
  fail(`could not auto-update shared/config.js — patch manually`);
await writeFile(configPath, updated);

console.log(`
✔ Scaffolded partner '${id}' at partners/${id} (host: ${host})
  origin: ${origin}
  local:  http://localhost:${localPort}
  token:  ${token ? "wired into deploy config" : "EMPTY — see next step"}
  shared/config.js ORIGINS.PARTNER_ORIGINS: updated

Remaining human step (Chrome has no API for this — one-time per origin):
  1. Register ${origin} at
     https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241
     (Google sign-in required; check "match all subdomains"; third-party OFF)
  2. Paste the token into:
     partners/${id}/${host === "netlify" ? "_headers" : "vercel.json"}
     and into the <meta http-equiv="Origin-Trial"> in partners/${id}/index.html
  3. Add real SKUs to partners/${id}/catalog.json (imageUrl → /img/<sku>.svg)
`);
