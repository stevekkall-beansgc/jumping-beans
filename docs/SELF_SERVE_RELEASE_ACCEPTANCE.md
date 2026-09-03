# Self-serve release acceptance

Recorded: 2026-09-03
Current verdict: **v0.10.7 PRODUCTION PASS**

v0.10.7 fixes the intermittent native cold-start race found after v0.10.6. The
exact deployed release passed ten fresh-profile action-before-probe runs and a
separate deep native receipt, alongside the ordinary-browser matrix and exact
public-byte checks.

This is the current release receipt for the Jumping Beans Engine and its three
member storefronts. Historical acceptance notes remain useful background, but
they do not prove a future deployment.

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

## Release evidence

| Gate | Current result |
|---|---|
| Deterministic product gate | PASS at the exact release: 768 assertions, including partial-registry, frame-bootstrap, same-revision ownership, and foreground/toolchange interleaving regressions |
| Native response-contract regression | PASS: all three checked-in partner catalogs produce schema-valid bounded envelopes and strip catalog-only fields |
| Native production cold start | PASS 10/10 in fresh persistent headed Chrome Stable 152.0.7977.76 profiles: user action preceded every registry probe; all runs completed in 1,388–1,982 ms with exact 3/3 discovery, three terminal origins, one acknowledged journey outcome, and no page errors |
| Deep native production receipt | GO, 38/38 assertions: exact native registration/execution, visible UI, coherent anonymous receipt, production headers, public bytes, diagnostics, and screenshots |
| Native readiness visibility | PASS in production: the live native status remains visible after results replace the setup panel |
| Generated UI, Engine bundle, and inventory index | PASS and exact at the immutable release checkout |
| Chromium production journey | PASS in Chromium `151.0.7922.34`: all 9 product/viewport cases; strict prices, category and presentation behavior, fragments, responsive images, hidden actions, page errors, and overflow checked |
| Partner paging and keyboard focus | PASS: Watch 24 → 48 cards and focus moved to the first new heading |
| Current public runway preflight | PASS read-only on 2026-09-03: all four tokens valid through 2026-11-17; Petsupply 12, Coffee 16, and Watch 11 qualifying scenario offers |
| Exact production bytes and headers | v0.10.7 PASS: 72/72 assets, four exact deployment identities, isolation headers, origin-trial enrollment, and the exact three-origin Engine policy |
| Production ordinary-browser matrix | v0.10.7 PASS: all 9 recipe/viewport cases, Watch paging/focus, and the visit-only handoff |
| Production native WebMCP | v0.10.7 PASS: repeated 10/10 cold starts followed by a separate 38/38 deep native audit |
| BeanSched read-only monitor | v0.10.7 active on the single six-hour clock; canonical manual cycle PASS on 2026-09-03 at the exact tag/SHA |

## Immutable release identity

The current production baseline is v0.10.7. A branch name or a dirty checkout
is not release identity.

| Field | Value |
|---|---|
| Commit SHA | `01574ec1b14011e3593db4cdf0c8b8cdb52d9355` |
| Annotated tag | `v0.10.7` |
| GitHub Release | `https://github.com/stevekkall-beansgc/jumping-beans/releases/tag/v0.10.7` |
| Deploy workflow run | `33811064006`, attempt 1, success |
| Engine Worker version | `3220117d-1ffc-4481-bab3-db4b1d016e64` |
| Petsupply deployment ID | `ecd83663-0da8-4f50-951d-6372822e4bc9` |
| Coffee deployment ID | `3027a885-72fa-4d9a-a665-88a7d0730af7` |
| Watch deployment ID | `96bed779-3c62-4aa1-a8be-349ff89886bd` |
| Receipt bundle | `jumping-beans-v0.10.7-self-serve-receipt.zip`, SHA-256 `8de04b5864d36adeac96333a30db5cac9f3f46763863282281cb2f999dc2e339`; the GitHub Release asset list is authoritative for current attachment status |

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

The v0.10.6 production receipt proved one complete native run, including the
native surface, exact three-origin execution, visible green state, and coherent
decision receipt. Later cold-start QA showed why the receipt protocol must
perform the shopper action before any direct `getTools()` polling: polling can
warm the registry and hide a startup race. v0.10.7 therefore adds a repeated
cold-start-first acceptance before the deeper protocol probe.

Run this immediately after the workflow succeeds, using a clean Stable profile
against the exact production URLs. Record:

| Native field | Required value | Recorded value |
|---|---|---|
| Chrome channel and full version | Stable, full version | v0.10.7 PASS: Stable `152.0.7977.76` |
| Engine URL | `https://jumping-beans-engine.steve-k-kall.workers.dev/` | v0.10.7 PASS |
| Isolation | `crossOriginIsolated === true` | v0.10.7 PASS |
| Native surface | `getTools`, `executeTool`, `registerTool`; no `codex*` adapter members | v0.10.7 PASS |
| Partner discovery | exactly Petsupply, Coffee Co, and Watch Co | v0.10.7 PASS, 10/10 repeated and deep audit |
| Partner execution | 3/3 successful JSON-string-input calls with schema-valid bounded results | v0.10.7 PASS |
| Engine readiness | “Native WebMCP verified with all 3 member sites” | v0.10.7 PASS in all 10 cold starts and the deep audit |
| Journey receipt | three requested origins and three ready/no-match outcomes; no sensitive fields | v0.10.7 PASS |
| Raw-output hashes / screenshots | included in the release receipt | v0.10.7 PASS in the hash-verified receipt bundle |

For v0.10.7, ten fresh persistent Stable profiles chose and approved the Coffee
recipe before any direct registry call. All ten reached the exact green state
within 15 seconds, exposed the exact three partner origins, recorded three
terminal receipt outcomes and exactly one acknowledged preference outcome, and
reported no page errors. The deeper native surface and raw-output audit ran in
a separate fresh profile afterward and passed all 38 assertions.

Any missing origin, adapter-injected browser surface, parse failure, stale asset,
or incomplete receipt keeps the native claim at **NO-GO**. It does not invalidate
the separately tested ordinary-browser storefront handoff.

## Ongoing readiness

The existing BeanSched `jumping-beans-merchant-refresh` job remains the single
clock and is pinned to the detached exact v0.10.7 tag/SHA. Its canonical manual
cycle proved the checkout and ignored index unchanged while the product gate,
exact four-origin smoke, and token/scenario runway checks passed. BeanSched PR
`#3` moved the existing job without creating a second schedule.
Catalog refresh remains a separate manual candidate-preparation step whose
tracked changes require a reviewed immutable release.
