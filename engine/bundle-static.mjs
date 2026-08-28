#!/usr/bin/env node
// Bundle the engine's static files into engine/static.js so the CF Worker
// (index.mjs) can serve them. Run after editing any engine/*.{html,js,json,svg,config}.
// Usage: node engine/bundle-static.mjs

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const exts = new Set([".html", ".js", ".json", ".svg", ".css"]);
// Files that must NOT be bundled into static.js (the worker/bundler/source itself).
const exclude = new Set(["index.mjs", "bundle-static.mjs", "static.js", "wrangler.toml"]);
const assets = {};

function walk(d, prefix) {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (f === "node_modules" || f === ".git") continue;
      walk(p, prefix + "/" + f);
    } else if (exts.has(path.extname(f)) && !exclude.has(f)) {
      assets[(prefix + "/" + f).replace(/\/\//g, "/")] = readFileSync(p, "utf8");
    }
  }
}

walk(dir, "");
// normalize /index.html to / so the Worker's "/" route matches
if (assets["/index.html"] != null) assets["/"] = assets["/index.html"];

const js = "export default " + JSON.stringify(assets, null, 2) + ";\n";
writeFileSync(path.join(dir, "static.js"), js);
console.log(
  "bundled " + Object.keys(assets).length + " assets -> engine/static.js (" + js.length + " bytes)"
);
