# ADR 0001: Versioned taxonomy foundation

Date: 2026-09-02
Status: accepted for Phase 0 foundation

## Decision

Jumping Beans will model product classifications in a versioned, additive
registry with GS1 GPC as the intended canonical backbone. Partner-native,
Google Product Taxonomy, and UNSPSC are separate adapter slots rather than
interchangeable codes. A mapping records its source taxonomy and version,
relation, confidence, method, provenance, and effective dates.

## Consequences

No official taxonomy code is assumed from a title, category label, SKU, or
model inference. Until an authoritative release and code are verified, the
registry uses a `jb:temporary:` canonical key and an explicit `unmapped` or
`not-loaded` status. GTINs and bundle components remain `null` or
`not-provided` when absent from the source catalog.

This Phase 0 registry is data-only and contains representative fixtures, not a
complete catalog classification. It is not consumed by the existing matcher and
does not change WebMCP, identity, accounts, Watch writes, or deployment. Future
implementation must pin the authoritative taxonomy version, preserve the prior
mapping's effective end date, and add an evidence-backed migration before it
can use an official code in matching or reporting.
