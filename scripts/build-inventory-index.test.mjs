import assert from "node:assert/strict";
import test from "node:test";
import { buildIndex } from "./build-inventory-index.mjs";

test("build index excludes member catalogs and keeps merchant/feed health honest", async () => {
  const index = await buildIndex();
  assert.ok(index.items.length > 0);
  assert.equal(index.sources.some((source) => source.permission === "member-site-authorized"), false);
  assert.ok(index.sources.some((source) => source.name === "Tilta" && source.status === "unavailable"));
  assert.ok(index.sources.some((source) => source.name === "TruFru" && source.status === "empty"));
  assert.ok(index.items.every((item) => item.partnerId && /^https?:\/\//.test(item.landing)));
  assert.ok(index.items.every((item) => item.expiresAt && item.observedAt));
});
