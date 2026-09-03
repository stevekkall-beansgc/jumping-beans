#!/usr/bin/env node
// Manual catalog-candidate refresh entry point. It prepares and validates
// catalog changes but never publishes from a mutable checkout. Production
// publishing belongs to the immutable release workflow in
// .github/workflows/deploy-cloudflare.yml; BeanSched uses monitor-production.mjs.

import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function runNode(relative, args = []) {
  const result = await execFileAsync(process.execPath, [path.join(ROOT, relative), ...args], {
    cwd: ROOT,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.stdout?.trim()) process.stdout.write(result.stdout);
  if (result.stderr?.trim()) process.stderr.write(result.stderr);
}

export async function main() {
  await runNode("scripts/production-smoke.mjs", ["--readiness-only"]);
  await runNode("scripts/refresh-merchants.mjs");
  await runNode("scripts/build-inventory-index.mjs");
  await runNode("scripts/check-product.mjs");
  console.log("Production readiness was checked; the catalog candidate was refreshed and validated locally. Production was not changed; publish it through an approved immutable release.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(String(error.stderr || error.stdout || error.message || error).trim());
    process.exitCode = 1;
  });
}
