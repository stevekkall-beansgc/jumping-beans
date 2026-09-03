# Jumping Beans defect-resolution QA note — 2026-09-03

Current release line: `v0.9.0`.

This note records the fixes completed after the 2026-09-02 acceptance packet.
`HANDOFF_2026-09-02_V0.5.4.md` and `PRODUCTION_ACCEPTANCE_2026-09-02.md`
remain historical evidence: their `v0.5.3` / `v0.5.4` references describe the
release observed on that date and have not been rewritten as current-release
claims.

## Resolved product defects

- Petsupply maps the engine's canonical `dog gear` request only to bounded,
  locally dog-signaled Petsupply categories. The request keeps its strict price
  ceiling and does not widen into cat, coffee, watch, or ambiguous inventory.
- Watch Co marks target-price-handoff-eligible offers in its native read result.
  The engine presents a target-price handoff only for that marker, while Watch
  Co's existing server-side SKU allowlist remains authoritative.
- The three FORZO records were observed out of stock. Their stale comparison
  values were removed and the records are excluded from storefront and WebMCP
  offer results. Therefore the UI and tool emit neither a percentage nor a
  merchant-comparison claim for them. A merchant compare-at value is retained
  only as a price fact; percentage copy now requires the separate
  `merchant-page-displayed-percent` evidence marker from an explicit page
  capture. No current catalog record invents that marker.
- Network UI distinguishes not requested, paused, ready, and no-match states.
  It does not claim a member-site application until a native partner response
  acknowledges the applied selection.
- Product imagery now names the product for assistive technology and skips an
  image element when a catalog record has no safe image URL.

## Verification scope

Local regression tests cover the Petsupply category adapter, the Watch Co
availability/handoff marker, the preference-canvas paused state, and existing
native WebMCP boundaries. Generated static assets must be refreshed before a
release. No deployment or production observation was performed as part of this
implementation note.
