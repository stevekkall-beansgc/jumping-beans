#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
const schema = JSON.parse(await readFile(path.join(root, "shared/schemas/taxonomy-classification.schema.json"), "utf8"));
const catalog = JSON.parse(await readFile(path.join(directory, "v1/catalog-classifications.json"), "utf8"));
const adapterIds = ["partner-native", "gs1-gpc", "google-product-taxonomy", "unspsc"];

assert.equal(schema.properties.schemaVersion.const, "1.0.0");
assert.equal(catalog.schemaVersion, "1.0.0");
assert.equal(catalog.taxonomyRegistry.canonical.id, "gs1-gpc");
assert.equal(catalog.taxonomyRegistry.canonical.intendedBackbone, true);
assert.equal(catalog.taxonomyRegistry.canonical.codeStatus, "not-loaded");
assert.deepEqual(catalog.taxonomyRegistry.adapters.map(({ id }) => id).sort(), adapterIds.slice().sort());

const ids = new Set();
for (const record of catalog.classifications) {
  assert(!ids.has(record.id), `duplicate classification id: ${record.id}`);
  ids.add(record.id);
  assert(record.partnerSku, `${record.id} requires a partner SKU`);
  assert.equal(record.gtin, null, `${record.id} must not invent a GTIN`);
  assert.match(record.canonical.key, /^jb:temporary:/, `${record.id} requires a temporary canonical key`);
  assert.equal(record.canonical.keyStatus, "temporary");
  assert.equal(record.canonical.taxonomy, "gs1-gpc");
  assert.equal(record.canonical.officialCode, null, `${record.id} must not invent a GPC code`);
  assert.equal(record.canonical.officialCodeStatus, "unmapped");
  assert.deepEqual(record.mappings.map(({ adapterId }) => adapterId).sort(), adapterIds.slice().sort());
  for (const mapping of record.mappings) {
    assert(mapping.provenance.source, `${record.id}/${mapping.adapterId} needs provenance`);
    assert(mapping.provenance.observedAt, `${record.id}/${mapping.adapterId} needs an observation date`);
    assert(mapping.effective.from, `${record.id}/${mapping.adapterId} needs an effective date`);
    if (mapping.source.code === null) {
      assert.equal(mapping.source.codeStatus, "unmapped");
      assert.equal(mapping.relation, "unmapped");
      assert.equal(mapping.method, "not-mapped");
      assert.equal(mapping.confidence, 0);
    }
  }
  assert(record.canonicalAttributes.every((attribute) => attribute.provenance.source && attribute.status === "observed"));
  if (record.bundle.kind === "single") assert.equal(record.bundle.componentStatus, "not-applicable");
  if (record.bundle.kind === "bundle") assert.equal(record.bundle.componentStatus, "not-provided");

  const partnerCatalog = JSON.parse(await readFile(path.join(root, "partners", record.partnerId, "catalog.json"), "utf8"));
  assert(partnerCatalog.some((item) => item.sku === record.partnerSku), `${record.id} SKU is absent from its partner catalog`);
}

assert(catalog.classifications.some((record) => record.bundle.kind === "bundle"), "fixture must cover a bundle with absent component detail");
console.log(`taxonomy foundation: ${catalog.classifications.length} classifications, ${adapterIds.length} adapter slots`);
