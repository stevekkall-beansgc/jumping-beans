// Interest store for the /api handlers (SPEC §4c). Every record carries an
// explicit expiry. KV keys also receive a TTL, while reads filter individual
// records so a newer write never extends an older signal's 30-day lifetime.
import {
  INTEREST_RETENTION_DAYS,
  INTEREST_RETENTION_MS,
  INTEREST_RETENTION_SECONDS,
  activeInterestRecords,
} from "../../interest-products.js";

const local = new Map();
const key = (product) => `interest:${product}`;

async function read(env, product) {
  const kv = env?.WATCH_INTEREST;
  if (kv) {
    try {
      return activeInterestRecords(await kv.get(key(product), "json"));
    } catch {
      return [];
    }
  }
  return activeInterestRecords(local.get(product));
}

async function write(env, product, records) {
  const kv = env?.WATCH_INTEREST;
  if (kv) {
    await kv.put(key(product), JSON.stringify(records), {
      expirationTtl: INTEREST_RETENTION_SECONDS,
    });
    return "cloudflare-kv";
  }
  local.set(product, records);
  return "worker-isolate";
}

export async function addInterest(env, product, pricePoint) {
  const createdAt = new Date();
  const record = {
    product,
    pricePoint,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + INTEREST_RETENTION_MS).toISOString(),
  };
  const records = [...await read(env, product), record];
  const storage = await write(env, product, records);
  return { record, storage, retentionDays: INTEREST_RETENTION_DAYS };
}

export async function summary(env, product) {
  const records = await read(env, product);
  const prices = records.map(({ pricePoint }) => pricePoint).sort((a, b) => a - b);
  const base = {
    count: prices.length,
    medianPrice: null,
    minPrice: null,
    maxPrice: null,
    window: `last-${INTEREST_RETENTION_DAYS}-days`,
    retentionDays: INTEREST_RETENTION_DAYS,
  };
  if (!prices.length) return base;
  const mid = Math.floor(prices.length / 2);
  return {
    ...base,
    medianPrice: prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2,
    minPrice: prices[0],
    maxPrice: prices.at(-1),
  };
}
