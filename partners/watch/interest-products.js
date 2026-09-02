// Shared contract for the Watch demand loop. Keep this deliberately small;
// scripts/check-product.mjs verifies every record against catalog.json.
export const INTEREST_RETENTION_DAYS = 30;
export const INTEREST_RETENTION_MS = INTEREST_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const INTEREST_RETENTION_SECONDS = INTEREST_RETENTION_DAYS * 24 * 60 * 60;
export const LOCAL_INTEREST_KEY = "watch-interest-v2";

export const INTEREST_PRODUCTS = Object.freeze([
  Object.freeze({
    sku: "NIV-77007Q45",
    name: "Nivada Grenchen Autochron Reverse Panda - Bracelet",
    currentPrice: 1083,
  }),
  Object.freeze({
    sku: "NIV-77006Q45",
    name: "Nivada Grenchen Autochron Panda - Bracelet",
    currentPrice: 1083,
  }),
  Object.freeze({
    sku: "NIV-77005Q45",
    name: "Nivada Grenchen Autochron Blue - Bracelet",
    currentPrice: 1083,
  }),
  Object.freeze({
    sku: "NIV-77004Q45",
    name: "Nivada Grenchen Autochron Orange - Bracelet",
    currentPrice: 1083,
  }),
]);

export const INTEREST_PRODUCT_SKUS = new Set(INTEREST_PRODUCTS.map(({ sku }) => sku));

export function activeInterestRecords(value, now = Date.now()) {
  if (!Array.isArray(value)) return [];
  return value.filter((record) =>
    record &&
    INTEREST_PRODUCT_SKUS.has(record.product) &&
    Number.isFinite(record.pricePoint) &&
    record.pricePoint > 0 &&
    Number.isFinite(Date.parse(record.expiresAt)) &&
    Date.parse(record.expiresAt) > now
  );
}
