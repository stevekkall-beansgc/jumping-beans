# Versioned taxonomy foundation

`v1/catalog-classifications.json` is an additive, non-runtime classification
registry. Phase 0 deliberately contains three representative fixtures (one per
current partner), not a claim of complete catalog coverage. It does not alter
matching, ranking, WebMCP, identity, account, or write behavior.

The canonical target is intentionally designed for **GS1 GPC**, but this
repository does not include an authoritative GPC release. Each current
canonical key is therefore a clearly namespaced temporary key and every GPC,
Google Product Taxonomy, and UNSPSC code is `null` with an explicit unmapped
status. Those fields may be populated only after the source taxonomy version
and code are verified from their authority.

Every classification preserves a partner SKU, optional GTIN, source taxonomy
and version, relation, confidence, method, provenance, effective dates,
canonical attributes, and bundle/component state. An empty component list with
`componentStatus: "not-provided"` means the partner catalog identifies a
bundle but does not identify component SKUs; it is not evidence of an empty
bundle.

Run `node shared/taxonomy/taxonomy.test.mjs` to validate the fixture and its
links to the current public partner-catalog snapshots.
