# Self-serve release acceptance

Prepared: 2026-09-03
Current verdict: **v0.10.7 CANDIDATE / PRODUCTION HOLD**

The deployed v0.10.6 ordinary-browser and recorded native receipts are valid.
Final QA subsequently reproduced an intermittent native cold-start race when a
shopper approved a selection before the three partner registrations settled.
v0.10.7 is held until the fix passes the cold-start-first production receipt.

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
| Deterministic product gate | PASS locally, including partial-registry, frame-bootstrap, same-revision ownership, and foreground/toolchange interleaving regressions |
| Native response-contract regression | PASS locally: all three checked-in partner catalogs produce schema-valid bounded envelopes and strip catalog-only fields |
| Native local four-origin cold start | PASS 10/10 in fresh persistent headed Chrome Stable 152.0.7977.76 profiles: user action preceded every registry probe; each run had exact 3/3 discovery, receipt outcomes, and one acknowledged journey outcome |
| Native readiness visibility | PASS locally: the live native status remains outside the setup panel and visible after results replace that panel |
| Generated UI, Engine bundle, and inventory index | PASS locally; current in the isolated worktree |
| Chromium local journey | PASS in Chrome 152.0.7977.65: all 9 product/viewport cases; strict prices, category and presentation behavior, fragments, responsive images, hidden actions, page errors, and overflow checked |
| Partner paging and keyboard focus | PASS locally: Watch 24 → 48 cards; focus moved to the first new heading; action forward/back/approval focused the active heading |
| Current public runway preflight | PASS read-only on 2026-09-03: all four tokens valid through 2026-11-17; Petsupply 12, Coffee 16, and Watch 11 qualifying scenario offers |
| Exact production bytes and headers | v0.10.6 PASS: 72 exact assets; v0.10.7 PENDING deployment |
| Production ordinary-browser matrix | v0.10.6 PASS: all 9 recipe/viewport cases, Watch paging/focus, and visit-only storage boundary; v0.10.7 PENDING deployment |
| Production native WebMCP | v0.10.6 recorded receipt PASS, but final QA found 2/5 un-warmed starts could remain partial; v0.10.7 PENDING a cold-start-first repeated run |
| BeanSched read-only monitor | v0.10.6 active on the single six-hour clock; canonical manual cycle PASS on 2026-09-03 at the exact tag/SHA |

## Immutable release identity

The current production baseline is v0.10.6. The v0.10.7 candidate receives a
new immutable identity only after its approved release run. A branch name or a
dirty checkout is not release identity.

| Field | Value |
|---|---|
| Commit SHA | `dadb62c1fbe2944057ba6eb5ca787556216f6cc7` |
| Annotated tag | `v0.10.6` |
| GitHub Release | `https://github.com/stevekkall-beansgc/jumping-beans/releases/tag/v0.10.6` |
| Deploy workflow run | `33806782935`, attempt 1, success |
| Engine Worker version | `dab0b155-0cc9-4a69-852d-b92ccd4a96e4` |
| Petsupply deployment ID | `37ae05e5-4b46-4aca-a78e-619dfa379228` |
| Coffee deployment ID | `a3ae017f-cbbd-4072-87f1-ef9c7e709464` |
| Watch deployment ID | `8c3feb38-1cdf-4f2b-8e27-e4af651bba74` |
| Public receipt bundle | `jumping-beans-v0.10.6-self-serve-receipt.zip`, SHA-256 `ac3c592a2daeed7e626c4023599fe85b02500ea916da5618e071165992f1cf15` |

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

The v0.10.6 production receipt proves one complete native run, including the
native surface, exact three-origin execution, visible green state, and coherent
decision receipt. The later cold-start QA showed why the receipt protocol must
perform the shopper action before any direct `getTools()` polling: polling can
warm the registry and hide a startup race. v0.10.7 therefore adds a repeated
cold-start-first acceptance before the deeper protocol probe.

Run this immediately after the workflow succeeds, using a clean Stable profile
against the exact production URLs. Record:

| Native field | Required value | Recorded value |
|---|---|---|
| Chrome channel and full version | Stable, full version | v0.10.6 PASS: Stable `152.0.7977.65` |
| Engine URL | `https://jumping-beans-engine.steve-k-kall.workers.dev/` | v0.10.6 PASS |
| Isolation | `crossOriginIsolated === true` | v0.10.6 PASS |
| Native surface | `getTools`, `executeTool`, `registerTool`; no `codex*` adapter members | v0.10.6 PASS |
| Partner discovery | exactly Petsupply, Coffee Co, and Watch Co | v0.10.6 PASS |
| Partner execution | 3/3 successful JSON-string-input calls with schema-valid bounded results | v0.10.6 PASS: 2 / 24 / 24 raw offers |
| Engine readiness | “Native WebMCP verified with all 3 member sites” | v0.10.6 PASS |
| Journey receipt | three requested origins and three ready/no-match outcomes; no sensitive fields | v0.10.6 PASS |
| Raw-output hashes / screenshots | attached to the release receipt | v0.10.6 PASS in the public receipt bundle |

For v0.10.7, run at least ten fresh persistent Stable profiles. In every run,
choose and approve the Coffee recipe immediately after `DOMContentLoaded`,
before any direct registry call. All ten must reach the exact green state within
15 seconds, expose the exact three partner origins, record three terminal
receipt outcomes and exactly one acknowledged preference outcome, and report no
page errors. Run the deeper native surface and raw-output probes only afterward.

Any missing origin, adapter-injected browser surface, parse failure, stale asset,
or incomplete receipt keeps the native claim at **NO-GO**. It does not invalidate
the separately tested ordinary-browser storefront handoff.

## Ongoing readiness

The existing BeanSched `jumping-beans-merchant-refresh` job is the single clock
and is pinned to the detached exact v0.10.6 tag/SHA. Its canonical manual cycle
proved the checkout and ignored index unchanged while the product gate, exact
four-origin smoke, and token/scenario runway checks passed. After v0.10.7 is
released and its receipts pass, move this same job atomically to the new exact
tag/SHA and repeat the dry cycle before claiming ongoing v0.10.7 monitoring.
Catalog refresh remains a separate manual candidate-preparation step whose
tracked changes require a reviewed immutable release.
