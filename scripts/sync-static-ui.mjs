#!/usr/bin/env node
// Prepare traceable, self-contained UI assets for each static deployment.
// The central JSON and CSS stay authoritative; generated deployment copies
// carry an exact JSON copy plus hashes and the explicit source reference.

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const checkOnly = argv.includes("--check");

function option(name) {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

const sourceConfig = JSON.parse(await readFile(path.join(root, "design-system.source.json"), "utf8"));
const sourceDirInput = option("--source-dir")
  || process.env.BEANLABS_DESIGN_SYSTEM_DIR
  || sourceConfig.sourceDir;
const sourceRef = option("--source-ref")
  || process.env.BEANLABS_DESIGN_SYSTEM_REF
  || sourceConfig.sourceRef;
if (!sourceDirInput || !sourceRef) {
  throw new Error("A design-system source directory and source ref are required");
}

const centralDir = path.isAbsolute(sourceDirInput)
  ? sourceDirInput
  : path.resolve(root, sourceDirInput);
const [tokenCss, tokenJsonText, primitivesCss, storefrontCss, storefrontJs] = await Promise.all([
  readFile(path.join(centralDir, "tokens.css"), "utf8"),
  readFile(path.join(centralDir, "tokens.json"), "utf8"),
  readFile(path.join(centralDir, "primitives.css"), "utf8"),
  readFile(path.join(root, "shared", "storefront.css"), "utf8"),
  readFile(path.join(root, "shared", "storefront.js"), "utf8"),
]);

const tokenJson = JSON.parse(tokenJsonText);
const version = tokenJson?.meta?.version;
if (!version) throw new Error("Central tokens.json is missing meta.version");
if (sourceRef.startsWith("tokens-version:") && sourceRef !== `tokens-version:${version}`) {
  throw new Error(`Configured source ref ${sourceRef} does not match central token version ${version}`);
}

const missingTokenNames = Object.keys(tokenJson.tokens || {})
  .map((name) => `--bl-${name.replaceAll(".", "-")}`)
  .filter((name) => !tokenCss.includes(`${name}:`));
if (missingTokenNames.length) {
  throw new Error(`Central tokens.css is missing: ${missingTokenNames.join(", ")}`);
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const jsonHash = sha256(tokenJsonText);
const cssHash = sha256(tokenCss);
const primitivesHash = sha256(primitivesCss);
const sourcePath = sourceDirInput.replaceAll(path.sep, "/");
const tokenHeader =
  `/* GENERATED from ${sourcePath}/tokens.css; ref=${sourceRef}; version=${version}; ` +
  `tokens.json sha256=${jsonHash}; tokens.css sha256=${cssHash}. ` +
  "Run node scripts/sync-static-ui.mjs; do not edit. */\n";
const primitivesHeader =
  `/* GENERATED from ${sourcePath}/primitives.css; ref=${sourceRef}; version=${version}; ` +
  `primitives.css sha256=${primitivesHash}. ` +
  "Run node scripts/sync-static-ui.mjs; do not edit. */\n";
const sourceManifest = `${JSON.stringify({
  schemaVersion: 1,
  source: {
    path: sourcePath,
    ref: sourceRef,
    version,
  },
  artifacts: {
    "tokens.json": { sha256: jsonHash },
    "tokens.css": { sha256: cssHash },
    "primitives.css": { sha256: primitivesHash },
  },
  generatedBy: "node scripts/sync-static-ui.mjs",
}, null, 2)}\n`;
const sharedCssHeader =
  "/* GENERATED from shared/storefront.css. Run node scripts/sync-static-ui.mjs; do not edit. */\n";
const sharedJsHeader =
  "// GENERATED from shared/storefront.js. Run node scripts/sync-static-ui.mjs; do not edit.\n";

const partnerNames = (await readdir(path.join(root, "partners"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const deployRoots = ["engine", ...partnerNames.map((name) => `partners/${name}`)];
const outputs = new Map();
for (const deployRoot of deployRoots) {
  const designRoot = path.join(root, deployRoot, "design-system");
  outputs.set(path.join(designRoot, "tokens.css"), tokenHeader + tokenCss);
  outputs.set(path.join(designRoot, "tokens.json"), tokenJsonText);
  outputs.set(path.join(designRoot, "primitives.css"), primitivesHeader + primitivesCss);
  outputs.set(path.join(designRoot, "source.json"), sourceManifest);
}
for (const partner of partnerNames) {
  const partnerRoot = path.join(root, "partners", partner);
  outputs.set(path.join(partnerRoot, "storefront.css"), sharedCssHeader + storefrontCss);
  outputs.set(path.join(partnerRoot, "storefront.js"), sharedJsHeader + storefrontJs);
  for (const module of ["preference-handoff.mjs", "preference-plane.mjs", "shopping-intent.mjs"]) {
    outputs.set(path.join(partnerRoot, module), await readFile(path.join(root, "engine", module), "utf8"));
  }
}

let stale = 0;
for (const [outputPath, expected] of outputs) {
  if (checkOnly) {
    const actual = await readFile(outputPath, "utf8").catch(() => "");
    if (actual !== expected) {
      stale += 1;
      console.error(`stale generated UI asset: ${path.relative(root, outputPath)}`);
    }
    continue;
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, expected);
  console.log(`synced ${path.relative(root, outputPath)}`);
}

if (stale) process.exitCode = 1;
else if (checkOnly) {
  console.log(
    `generated UI assets are current (${sourceRef}; JSON ${jsonHash.slice(0, 12)}; ` +
    `tokens ${cssHash.slice(0, 12)}; primitives ${primitivesHash.slice(0, 12)})`,
  );
}
