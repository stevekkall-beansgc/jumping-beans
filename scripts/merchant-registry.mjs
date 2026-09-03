// Discover and attach merchant-owned Shopify/WooCommerce feeds.
// Discovery records a candidate; attachment is an explicit approval boundary.
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const REGISTRY_PATH = path.join(ROOT, "inventory", "merchant-registry.json");
const PLATFORMS = new Set(["shopify", "woocommerce"]);

function argsFor(argv = process.argv.slice(2)) {
  const values = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      values._.push(token);
      continue;
    }
    const [key, inline] = token.slice(2).split("=", 2);
    values[key] = inline ?? argv[i + 1];
    if (inline === undefined && argv[i + 1] && !argv[i + 1].startsWith("--")) i += 1;
  }
  return values;
}

function normalizedHost(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("--host is required");
  const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  if (url.protocol !== "https:") throw new Error("merchant host must use HTTPS");
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function merchantId(platform, host) {
  return `${platform}:${host}`;
}

function catalogPathFor(platform, host) {
  return `inventory/catalogs/${platform}-${host.replace(/[^a-z0-9]+/g, "-")}.json`;
}

async function loadRegistry() {
  return JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
}

async function saveRegistry(registry) {
  const tmp = `${REGISTRY_PATH}.tmp`;
  await writeFile(tmp, `${JSON.stringify(registry, null, 2)}\n`);
  await rename(tmp, REGISTRY_PATH);
}

async function inspectHost(host, requestedPlatform = "auto") {
  const checks = requestedPlatform === "auto"
    ? ["shopify", "woocommerce"]
    : [requestedPlatform];
  const errors = [];
  for (const platform of checks) {
    const endpoint = platform === "shopify"
      ? `https://${host}/products.json?limit=1&page=1`
      : `https://${host}/wp-json/wc/store/v1/products?per_page=1&page=1`;
    try {
      const response = await fetch(endpoint, { headers: { accept: "application/json" } });
      if (!response.ok) {
        errors.push(`${platform} HTTP ${response.status}`);
        continue;
      }
      const payload = await response.json();
      const valid = platform === "shopify"
        ? Array.isArray(payload?.products)
        : Array.isArray(payload);
      if (valid) return { platform, endpoint };
      errors.push(`${platform} returned an unexpected feed shape`);
    } catch (error) {
      errors.push(`${platform} ${error.message}`);
    }
  }
  throw new Error(`no supported public feed found for ${host}: ${errors.join("; ")}`);
}

async function discover(options) {
  const host = normalizedHost(options.host);
  const requestedPlatform = options.platform || "auto";
  if (requestedPlatform !== "auto" && !PLATFORMS.has(requestedPlatform)) {
    throw new Error(`unsupported platform: ${requestedPlatform}`);
  }
  const detected = await inspectHost(host, requestedPlatform);
  const registry = await loadRegistry();
  const id = merchantId(detected.platform, host);
  const candidate = {
    id,
    name: options.name || host,
    platform: detected.platform,
    host,
    status: "candidate",
    permission: options.permission || "unconfirmed",
    discoveredVia: options.source || "merchant-supplied",
    sourceUrl: `https://${host}`,
    catalogPath: options.out || catalogPathFor(detected.platform, host),
    maxItems: Number(options.max || 1000),
    enabled: false,
    affiliateNetworks: [],
    discoveredAt: new Date().toISOString(),
    feedEndpoint: detected.endpoint,
  };
  registry.candidates = (registry.candidates || []).filter((item) => item.id !== id);
  registry.candidates.push(candidate);
  await saveRegistry(registry);
  console.log(`Discovered ${detected.platform} merchant candidate: ${id}`);
  console.log("Review permission, then attach it with: node scripts/merchant-registry.mjs attach --id " + id);
}

async function attach(options) {
  if (!options.id) throw new Error("--id is required");
  const registry = await loadRegistry();
  const index = (registry.candidates || []).findIndex((item) => item.id === options.id);
  if (index === -1) throw new Error(`candidate not found: ${options.id}`);
  const candidate = registry.candidates[index];
  const permission = options.permission || candidate.permission;
  if (!new Set(["public-feed", "merchant-authorized", "network-approved"]).has(permission)) {
    throw new Error("attachment requires --permission public-feed, merchant-authorized, or network-approved");
  }
  const attached = {
    ...candidate,
    status: "attached",
    permission,
    enabled: true,
    attachedAt: new Date().toISOString(),
  };
  registry.merchants = (registry.merchants || []).filter((item) => item.id !== attached.id);
  registry.merchants.push(attached);
  registry.candidates.splice(index, 1);
  await saveRegistry(registry);
  console.log(`Attached ${attached.id}; refresh job will include it.`);
}

async function main() {
  const options = argsFor();
  const command = options._[0];
  if (command === "discover") return discover(options);
  if (command === "attach") return attach(options);
  throw new Error("usage: merchant-registry.mjs discover --host store.example [--platform shopify|woocommerce] | attach --id platform:host --permission merchant-authorized");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export { argsFor, catalogPathFor, inspectHost, merchantId, normalizedHost };
