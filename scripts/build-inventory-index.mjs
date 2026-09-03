#!/usr/bin/env node
// Build the bounded, public out-of-network catalog index consumed by the
// engine Worker. Raw catalogs remain the source of truth; this file is only a
// deployment artifact and is regenerated after merchant refreshes.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REGISTRY_PATH = path.join(ROOT, "inventory", "merchant-registry.json");
const OUTPUT_DIR = path.join(ROOT, "engine", "inventory-assets");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "catalog-index.json");
const MEMBER_PERMISSIONS = new Set(["member-site-authorized"]);
const MAX_ITEM_TEXT = 240;

function validDate(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function safeText(value, max = MAX_ITEM_TEXT) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function safeError(value) {
  return safeText(value, 240).replace(/[\r\n]+/g, " ");
}

function catalogRelativePath(value) {
  const relative = String(value || "");
  if (!relative.startsWith("inventory/catalogs/") || !relative.endsWith(".json")) return null;
  const resolved = path.resolve(ROOT, relative);
  if (!resolved.startsWith(`${path.join(ROOT, "inventory", "catalogs")}${path.sep}`)) return null;
  return resolved;
}

function sourceStatus(merchant, items) {
  if (merchant.lastError && items.length === 0) return "unavailable";
  if (merchant.lastError) return "stale";
  if (!items.length) return "empty";
  return "ready";
}

function normalizeItem(item, merchant, observedAt) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const dealPrice = Number(item.dealPrice);
  const expiresAt = validDate(item.expiresAt);
  if (!safeText(item.sku, 160) || !safeText(item.name) || !Number.isFinite(dealPrice) || dealPrice < 0 || !expiresAt) return null;
  const listPrice = Number(item.listPrice);
  const hasListPrice = item.listPriceSource === "merchant" && Number.isFinite(listPrice) && listPrice > dealPrice;
  const landing = safeHttpUrl(item.landing);
  return {
    sku: safeText(item.sku, 160),
    name: safeText(item.name),
    category: safeText(item.category, 100).toLocaleLowerCase() || "general",
    listPrice: hasListPrice ? listPrice : null,
    listPriceSource: hasListPrice ? "merchant" : null,
    merchantPageDiscountPercent: null,
    merchantPageDiscountEvidence: null,
    dealPrice,
    imageUrl: safeHttpUrl(item.imageUrl),
    expiresAt,
    landing,
    vendor: safeText(item.vendor, 160) || merchant.name,
    merchant: merchant.name,
    partnerId: merchant.id,
    partnerName: merchant.name,
    source: "merchant-catalog",
    sourceType: "out-of-network public catalog",
    sourceLabel: "Public merchant catalog",
    sourceDescription: "Public merchant catalog snapshot. Jumping Beans links directly to the merchant and does not claim an affiliate relationship for this feed.",
    observedAt,
    verificationLabel: merchant.lastError
      ? "Last successful catalog snapshot; the merchant feed needs refresh"
      : "Catalog snapshot; price and availability may have changed on the merchant site",
    availability: item.availability === "out-of-stock" ? "out-of-stock" : "in-stock",
    currency: "USD",
    collateral: [],
  };
}

function compactItem(item) {
  return {
    sku: item.sku,
    name: item.name,
    category: item.category,
    ...(item.listPrice == null ? {} : { listPrice: item.listPrice, listPriceSource: "merchant" }),
    dealPrice: item.dealPrice,
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    expiresAt: item.expiresAt,
    ...(item.landing ? { landing: item.landing } : {}),
    ...(item.vendor ? { vendor: item.vendor } : {}),
    partnerId: item.partnerId,
    observedAt: item.observedAt,
  };
}

async function buildIndex() {
  const registry = JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
  const merchants = [];
  const items = [];
  for (const merchant of registry.merchants || []) {
    if (merchant.status !== "attached" || merchant.enabled === false || MEMBER_PERMISSIONS.has(merchant.permission)) continue;
    const file = catalogRelativePath(merchant.catalogPath);
    if (!file) continue;
    let rawItems = [];
    try {
      const payload = JSON.parse(await readFile(file, "utf8"));
      rawItems = Array.isArray(payload) ? payload : [];
    } catch (error) {
      merchant.lastError ||= `catalog read failed: ${error.message}`;
    }
    const observedAt = validDate(merchant.lastSuccessAt)
      || rawItems.map((item) => validDate(item?.observedAt)).find(Boolean)
      || null;
    const normalized = rawItems.map((item) => normalizeItem(item, merchant, observedAt)).filter((item) => item && item.availability !== "out-of-stock");
    const expiresAt = normalized.map((item) => item.expiresAt).sort()[0] || null;
    const status = sourceStatus(merchant, normalized);
    merchants.push({
      id: safeText(merchant.id, 160),
      name: safeText(merchant.name, 160),
      platform: safeText(merchant.platform, 40),
      host: safeText(merchant.host, 160),
      permission: safeText(merchant.permission, 80),
      sourceUrl: safeHttpUrl(merchant.sourceUrl),
      status,
      itemCount: normalized.length,
      lastCheckedAt: validDate(merchant.lastCheckedAt),
      lastSuccessAt: observedAt,
      expiresAt,
      lastError: safeError(merchant.lastError) || null,
    });
    items.push(...normalized.map(compactItem));
  }
  const generatedAt = merchants.map((merchant) => merchant.lastCheckedAt || merchant.lastSuccessAt).filter(Boolean).sort().at(-1) || null;
  return {
    version: 1,
    generatedAt,
    sourcePolicy: "Only attached public-feed or approved out-of-network merchant catalogs are included. Member-site catalogs remain on the native WebMCP path.",
    sources: merchants,
    items,
  };
}

// Keep directory creation and the write separate so --check never mutates the
// workspace. The generated directory is ignored and is rebuilt in deployment.
async function run() {
  const checkOnly = process.argv.includes("--check");
  const index = await buildIndex();
  const expected = JSON.stringify(index);
  let actual = "";
  try { actual = await readFile(OUTPUT_PATH, "utf8"); } catch { /* missing */ }
  if (checkOnly) {
    if (actual !== expected) {
      console.error("stale engine/inventory-assets/catalog-index.json; run node scripts/build-inventory-index.mjs");
      process.exitCode = 1;
    } else {
      console.log(`catalog index is current (${index.items.length} items, ${index.sources.length} sources)`);
    }
    return;
  }
  const { mkdir } = await import("node:fs/promises");
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, expected);
  console.log(`built ${index.items.length} catalog items from ${index.sources.length} sources -> engine/inventory-assets/catalog-index.json`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export { buildIndex, normalizeItem, sourceStatus };
