# Jumping Beans v0.10.0

Jumping Beans now gives self-serve visitors a complete ordinary-browser demo
across Petsupply, Coffee Co, and Watch Co. A visitor can choose one of the three
canonical recipes in the Engine, approve a visit-only preference handoff, and
open a storefront that applies the same category, strict price ceiling, and
presentation rules without carrying prompt text, identity, or stored memory.

## What changed

- Added one-click Dog gear under $50, Coffee stories under $15, and Watches
  under $500 recipes, with an immediate storefront preview when native WebMCP
  is unavailable or incomplete.
- Added bounded storefront rendering, strict exclusive-price filtering,
  responsive product images, 24-item paging with keyboard focus, stalled-load
  retry, fragment scrubbing, and hidden inactive action controls across all
  three member sites.
- Added fail-closed native WebMCP discovery and execution. Native readiness is
  green only after all three exact partner origins complete the current
  read-only offer call.
- Added normalized public and merchant-feed inventory, provenance checks, and a
  read-only production readiness monitor for token and inventory runway.
- Replaced ad hoc production publishing with an immutable, manually dispatched
  Cloudflare release workflow. It requires an exact clean SHA on `main`, green
  CI for that SHA, an annotated tag, and a published GitHub Release; verifies
  exact public assets and all nine product/viewport journeys; records deployment
  IDs; and conditionally restores the previous Worker and Pages deployments on
  failure or cancellation.

## Validation

- Product gate: 740 assertions passed.
- Ordinary-browser acceptance: 9/9 recipe and viewport journeys passed locally
  in Chrome 152.0.7977.65, plus Watch paging from 24 to 48 cards and keyboard
  focus transfer.
- Worker package: Wrangler 4.125.0 dry-run passed.
- Public runway preflight on 2026-09-03: all four WebMCP tokens valid through
  2026-11-17, with 12 Petsupply, 16 Coffee, and 11 Watch qualifying offers.

The production ordinary-browser receipt is produced by the release workflow.
The native WebMCP claim remains pending until a separate headed Chrome Stable
3/3 production receipt is attached after deployment.
