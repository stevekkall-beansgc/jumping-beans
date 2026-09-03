// Refresh every attached merchant in inventory/merchant-registry.json.
// Candidates are never fetched. Failed refreshes preserve the last good catalog.
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const REGISTRY_PATH = path.join(ROOT, "inventory", "merchant-registry.json");
const INGESTER = path.join(ROOT, "scripts", "ingest-feed.mjs");

function safeCatalogPath(relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error("catalogPath must be a relative project path");
  const resolved = path.resolve(ROOT, relativePath);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error("catalogPath escapes project root");
  return resolved;
}

function safeProjectDirectory(relativePath) {
  return safeCatalogPath(relativePath || ".");
}

async function saveRegistry(registry) {
  const tmp = `${REGISTRY_PATH}.tmp`;
  await writeFile(tmp, `${JSON.stringify(registry, null, 2)}\n`);
  await rename(tmp, REGISTRY_PATH);
}

async function publishMerchant() {
  throw new Error("direct catalog publication is disabled; publish an immutable release through deploy-cloudflare.yml");
}

async function refreshMerchant(merchant) {
  const catalogPath = safeCatalogPath(merchant.catalogPath);
  const argv = [INGESTER, merchant.platform, "--host", merchant.host, "--out", catalogPath, "--max", String(merchant.maxItems || 1000)];
  const checkedAt = new Date().toISOString();
  try {
    const result = await execFileAsync(process.execPath, argv, { cwd: ROOT, maxBuffer: 1024 * 1024 });
    const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
    return {
      ...merchant,
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      lastItemCount: Array.isArray(catalog) ? catalog.length : 0,
      lastError: null,
      lastOutput: result.stdout.trim().split("\n").slice(-1)[0] || "refresh complete",
      lastPublishedAt: merchant.lastPublishedAt || null,
      lastPublishError: null,
    };
  } catch (error) {
    return {
      ...merchant,
      lastCheckedAt: checkedAt,
      lastError: String(error.stderr || error.message || error).trim().slice(0, 500),
    };
  }
}

async function main() {
  const registry = JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
  const attached = (registry.merchants || []).filter((merchant) => merchant.status === "attached" && merchant.enabled !== false);
  const updated = [];
  for (const merchant of attached) updated.push(await refreshMerchant(merchant));
  const byId = new Map(updated.map((merchant) => [merchant.id, merchant]));
  registry.merchants = (registry.merchants || []).map((merchant) => byId.get(merchant.id) || merchant);
  registry.lastRefreshAt = new Date().toISOString();
  await saveRegistry(registry);
  const failures = updated.filter((merchant) => merchant.lastError);
  for (const merchant of updated) {
    const state = merchant.lastError ? `FAILED: ${merchant.lastError}` : `${merchant.lastItemCount} products`;
    console.log(`${merchant.id} — ${state}`);
  }
  if (failures.length) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export { publishMerchant, refreshMerchant, safeCatalogPath };
