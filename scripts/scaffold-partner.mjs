#!/usr/bin/env node
// Jumping Beans — scaffold a new partner unit from a template.
//
// Generates a complete, deploy-ready partner directory under partners/<id>:
//   index.html   — self-hosted shop page (graceful non-WebMCP UI)
//   tool.js      — imperative WebMCP get_matching_deals tool (signal-guarded)
//   storefront.js— renders catalog cards
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
if (!id) fail("Usage: node scripts/scaffold-partner.mjs <id> --name \"...\" [--host netlify|vercel] [--origin https://...] [--token <token>]");

function flag(name, def = undefined) {
  const i = args.indexOf("--" + name);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
}

const name = flag("name", id.charAt(0).toUpperCase() + id.slice(1));
const host = flag("host", "netlify"); // netlify (_headers) | vercel (vercel.json)
const origin = flag("origin", `https://${id}.example.com`);
const token = flag("token", "");

if (!["netlify", "vercel"].includes(host))
  fail("--host must be 'netlify' or 'vercel'");

const p = path.join(root, "partners", id);
const img = path.join(p, "img");
if (existsSync(p)) fail(`partner '${id}' already exists at partners/${id}`);
await mkdir(img, { recursive: true });

// ---- catalog seed (default: a couple of demo SKUs expiring today) ----
const today = new Date();
const iso = (d) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const defaultSkus = [
  {
    sku: `${id}-a`,
    name: "Featured Item",
    category: "general",
    listPrice: 20.0,
    dealPrice: 14.5,
    imageUrl: `/img/${id}-a.svg`,
    expiresAt: `${iso(today)}T23:59:00-04:00`,
  },
  {
    sku: `${id}-b`,
    name: "Second Item",
    category: "general",
    listPrice: 12.0,
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
// Build constant, per unit: the engine origin this shop exposes its tool to.
const CONCIERGE_ORIGIN = "http://localhost:8082"; // prod: ${origin}
const PARTNER_NAME = ${JSON.stringify(name)};
const PARTNER_ID = ${JSON.stringify(id)};
const TOOL_NAME = "get_matching_deals";

const catalog = await fetch("/catalog.json").then((r) => r.json());

await document.modelContext.registerTool(
  {
    name: TOOL_NAME,
    title: "Get matching deals",
    description:
      "Return current deals from ${name} in the given categories, optionally under a max price. Deals are live and verified by the shop.",
    inputSchema: {
      type: "object",
      properties: {
        categories: { type: "array", items: { type: "string" }, description: "e.g. ['general']" },
        maxPrice: { type: "number", description: "Optional ceiling on dealPrice" },
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
          .map((d) => ({ ...d, partnerId: PARTNER_ID, partnerName: PARTNER_NAME })),
      };
    },
  },
  { exposedTo: [CONCIERGE_ORIGIN] }
);

console.log(\`[\${PARTNER_ID}] registered:\`, TOOL_NAME);
`;

// ---- storefront.js ----
const storefrontJs = `const GRID = document.getElementById("grid");
const BANNER = document.getElementById("banner");

const priceDate = (s) => {
  const d = new Date(s);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return "⚡ Expires today";
  const days = Math.round((d - today) / 864e5);
  return days === 1 ? "Expires tomorrow" : \`Expires in \${days} days\`;
};

function card(d) {
  const pct = Math.round((1 - d.dealPrice / d.listPrice) * 100);
  return \`
    <div class="card">
      <img class="thumb" src="\${d.imageUrl}" alt="\${d.name}" loading="lazy">
      <div class="cat">\${d.category.replace("-", " ")}</div>
      <h3>\${d.name}</h3>
      <div class="price">
        <span class="list">\$\${d.listPrice.toFixed(2)}</span>
        <span class="deal">\$\${d.dealPrice.toFixed(2)}</span>
        <span class="save">\${pct}% off</span>
      </div>
      <div class="expiry">\${priceDate(d.expiresAt)}</div>
    </div>\`;
}

const catalog = await fetch("/catalog.json").then((r) => r.json());
BANNER.textContent = \`\${${JSON.stringify(name)}} — today's specials\`;
GRID.innerHTML = catalog.map(card).join("");
`;

// ---- index.html ----
const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta http-equiv="Origin-Trial" content="${token}">
  <title>${name} — Jumping Beans</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; background: #faf9f6; color: #222; }
    header { background: #222; color: #fff; padding: 18px 24px; }
    header h1 { margin: 0; font-size: 1.2rem; }
    main { max-width: 880px; margin: 0 auto; padding: 24px; }
    #banner { font-weight: 600; margin-bottom: 18px; color: #444; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px,1fr)); gap: 16px; }
    .card { background: #fff; border: 1px solid #e5e2dc; border-radius: 12px; padding: 14px; }
    .card .thumb { width: 64px; height: 64px; border-radius: 10px; background:#eef1ec;
      object-fit: cover; margin-bottom: 10px; display:block; }
    .card .cat { font-size: 0.75rem; text-transform: uppercase; letter-spacing: .04em; color: #8a887f; }
    .card h3 { font-size: 1rem; margin: 4px 0 8px; }
    .price { display: flex; gap: 8px; align-items: baseline; }
    .list { text-decoration: line-through; color: #999; font-size: 0.85rem; }
    .deal { font-weight: 700; color: #0a7d33; }
    .save { background: #e7f5ec; color: #0a7d33; padding: 2px 8px; border-radius: 999px; font-size: 0.78rem; }
    .expiry { margin-top: 8px; font-size: 0.82rem; color: #b45309; }
  </style>
</head>
<body>
  <header><h1>${name}</h1></header>
  <main>
    <p id="banner">Today's specials</p>
    <div class="grid" id="grid"></div>
  </main>
  <script type="module" src="./tool.js"></script>
  <script type="module" src="./storefront.js"></script>
</body>
</html>
`;

// ---- write everything ----
await writeFile(path.join(p, "index.html"), indexHtml);
await writeFile(path.join(p, "tool.js"), toolJs);
await writeFile(path.join(p, "storefront.js"), storefrontJs);
await writeFile(path.join(p, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
await writeFile(
  path.join(p, host === "netlify" ? "_headers" : "vercel.json"),
  deployCfg
);
for (const sku of catalog) {
  await writeFile(
    path.join(img, path.basename(sku.imageUrl)),
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="16" fill="#eef1ec"/><text x="64" y="74" font-size="52" text-anchor="middle">🛍️</text></svg>\n`
  );
}

// ---- update shared/config.js ORIGINS + PARTNER_ORIGINS ----
const config = readFileSync(configPath, "utf8");

// 1) ORIGINS: replace the existing `${id}: "…"` line (placeholder) in place,
//    else insert a fresh line after `export const ORIGINS = {`.
const origLine = new RegExp(`^(\\s*)(${id}: )(.*?)(,?\\s*//.*)?$`, "m");
const line = `  ${id}: "${origin}",        // ${name}`;
let updated = origLine.test(config)
  ? config.replace(origLine, line)
  : config.replace(/(export const ORIGINS = \{)/, "$1\n" + line);

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
