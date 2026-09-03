# Self-serve release acceptance

Prepared: 2026-09-03
Current verdict: **v0.10.5 PREPARED LOCALLY / PRODUCTION HOLD**

This is the current release receipt for the Jumping Beans Engine and its three
member storefronts. Historical acceptance notes remain useful background, but
they do not prove this candidate or a future deployment.

## Promise being gated

The release supports two separately labeled lanes:

1. In a tested Chromium browser, a self-serve user can choose a tested recipe
   in the Engine, approve it for this visit, and open the matching member storefront.
   The storefront applies the same category, exclusive budget, and presentation
   rules without saving identity, memory, prompt text, or receipts.
2. In a supported native WebMCP Chrome build, the Engine turns green only after
   all three exact partner origins are discovered and each completes the current
   read-only offer call. Partial or unsupported native state stays explicit and
   the ordinary storefront handoff remains available.

Native WebMCP is an experimental browser capability, so the release cannot
promise that it exists on every visitor device. The supported claim is tied to
the exact headed Chrome version and production evidence recorded below.

## Canonical self-serve recipes

| Engine choice | Member destination | Required visible result |
|---|---|---|
| Dog gear · under $50 | Petsupply | Dog inventory only, every price strictly below $50, no urgency copy |
| Coffee stories · under $15 | Coffee Co | Coffee inventory only, every price strictly below $15, available customer story ranked first, no urgency copy |
| Watches · under $500 | Watch Co | Watch inventory only, every price strictly below $500, comparison layout |

Each first render is capped at 24 cards. Catalog requests abort after 10 seconds
and expose a visible retry. Expired and unavailable records are rejected in the
catalog, preference-handoff, tool, and action-link paths.

## Candidate evidence

| Gate | Current result |
|---|---|
| Deterministic product gate | PASS locally: 747 assertions |
| Native response-contract regression | PASS locally: all three checked-in partner catalogs produce schema-valid bounded envelopes and strip catalog-only fields |
| Native local four-origin journey | PASS in headed Chrome Stable 152.0.7977.65: exact 3/3 discovery, JSON-string execution, green readiness, and three terminal receipt outcomes |
| Native readiness visibility | PASS locally: the live native status remains outside the setup panel and visible after results replace that panel |
| Generated UI, Engine bundle, and inventory index | PASS locally; current in the isolated worktree |
| Chromium local journey | PASS in Chrome 152.0.7977.65: all 9 product/viewport cases; strict prices, category and presentation behavior, fragments, responsive images, hidden actions, page errors, and overflow checked |
| Partner paging and keyboard focus | PASS locally: Watch 24 → 48 cards; focus moved to the first new heading; action forward/back/approval focused the active heading |
| Current public runway preflight | PASS read-only on 2026-09-03: all four tokens valid through 2026-11-17; Petsupply 12, Coffee 16, and Watch 11 qualifying scenario offers |
| Exact production bytes and headers | PENDING until the approved SHA is deployed |
| Production ordinary-browser matrix | PENDING; the workflow runs all three recipes at 1280×900, 390×844, and 320×568 and uploads its JSON receipt |
| Production native WebMCP | PENDING; current competition verdict remains NO-GO until the 3/3 headed Stable run below passes |
| BeanSched read-only monitor cutover | v0.10.3 remains active; v0.10.5 cutover is PENDING its exact tag, isolated worktree, and successful manual dry cycle |

## Immutable release identity

Complete these fields from the successful release run. A branch name or a dirty
checkout is not release identity.

| Field | Value |
|---|---|
| Commit SHA | PENDING |
| Annotated tag | PENDING |
| GitHub Release | PENDING |
| Deploy workflow run | PENDING |
| Engine Worker version | PENDING |
| Petsupply deployment ID | PENDING |
| Coffee deployment ID | PENDING |
| Watch deployment ID | PENDING |
| Ordinary-browser artifact | PENDING |

## Required post-deploy evidence

The workflow must pass all of these before the ordinary-browser release is
accepted:

- exact byte hashes and JavaScript/CSS/JSON MIME types for every critical Engine
  and partner asset;
- exact COOP, COEP, CORP, Origin-Trial registration, and Engine
  `Permissions-Policy` containing only `self` and the three production partner
  origins;
- at least 30 days of origin-trial-token runway and one offer per canonical
  recipe with at least 14 days of inventory runway;
- Engine catalog API source manifest matching the immutable checkout and a
  healthy Watch read-only demand summary;
- all nine ordinary-browser recipe/viewport journeys, with bounded prices,
  fragment scrubbing, hidden inactive actions, no uncaught page errors, and no
  horizontal overflow; the Watch action-preview navigation must also retain
  the applied watch category, comparison layout, and strict price ceiling.

The workflow snapshots the previous Pages deployments before it changes
production. On a failed post-deploy gate, cleanup attempts to restore each unit
that still carries that workflow attempt's unique release marker. It refuses to
overwrite a unit changed by another actor, and reports any refused or failed
restore so an operator can resolve it from the saved rollback artifact.
Normal workflow failure, timeout, and cancellation reach this cleanup job.
GitHub force-cancel or a GitHub/Cloudflare outage can prevent automated cleanup;
those cases require an operator to use the saved deployment IDs once the
platform is available.

## Required headed Chrome native receipt

The v0.10.3 production diagnostic found the native surface, isolation, and all
three exact partner tools, then exposed a producer-boundary defect: matched
catalog records retained the internal `availability` field and the Engine
correctly classified the non-contract envelope as invalid. v0.10.4 projects an
explicit public offer allowlist at every producer and adds an actual-catalog
regression for all three sites. Its production protocol probe reached 3/3, but
the exact green readiness message remained nested in the setup panel that the
result view hides. v0.10.5 keeps that live status visible through the result
state. The table below remains pending until the exact v0.10.5 production
deployment is captured.

Run this immediately after the workflow succeeds, using a clean Stable profile
against the exact production URLs. Record:

| Native field | Required value | Recorded value |
|---|---|---|
| Chrome channel and full version | Stable, full version | PENDING |
| Engine URL | `https://jumping-beans-engine.steve-k-kall.workers.dev/` | PENDING |
| Isolation | `crossOriginIsolated === true` | PENDING |
| Native surface | `getTools`, `executeTool`, `registerTool`; no `codex*` adapter members | PENDING |
| Partner discovery | exactly Petsupply, Coffee Co, and Watch Co | PENDING |
| Partner execution | 3/3 successful JSON-string-input calls with schema-valid bounded results | PENDING |
| Engine readiness | “Native WebMCP verified with all 3 member sites” | PENDING |
| Journey receipt | three requested origins and three ready/no-match outcomes; no sensitive fields | PENDING |
| Raw-output hashes / screenshots | attached to the release receipt | PENDING |

Any missing origin, adapter-injected browser surface, parse failure, stale asset,
or incomplete receipt keeps the native claim at **NO-GO**. It does not invalidate
the separately tested ordinary-browser storefront handoff.

## Ongoing readiness

The existing BeanSched `jumping-beans-merchant-refresh` job remains the single
clock and stays active on v0.10.3 while this candidate is reviewed. After
deployment, provision a detached worktree at the exact v0.10.5 tag, build its
ignored deterministic index once, and pin a disabled candidate run to that
worktree, SHA, and annotated tag. The manual run must prove the checkout and
index stay unchanged while the product gate, exact four-origin smoke, and
token/scenario runway checks pass. Only then may the live job move atomically
from v0.10.3 to v0.10.5 and retain the six-hour monitoring claim.
Catalog refresh remains a separate manual candidate-preparation step whose
tracked changes require a reviewed immutable release.
