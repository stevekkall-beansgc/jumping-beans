# P0 architecture review

Date: 2026-08-31  
Scope: current P0 foundation and the next multi-offer network slice  
Verdict: **No-go for P0 acceptance or a competition-readiness claim yet.** The
prototype has a credible base, but the highest-risk properties are not enforced
end to end. The local deterministic gate is green; that is necessary, not
sufficient evidence for the P0 acceptance criteria.

## What is already sound

- Partner read tools are restricted to the configured engine origin, discovery
  is allowlisted, tools are deduplicated by origin, and partner calls preserve
  partial successes.
- Eligibility is applied before deterministic ranking, filtered offers are not
  reintroduced, and open inventory/partner/preview states are visibly distinct.
- Preference and browser-watch writes are staged behind page controls. Watch Co
  revalidates confirmation, SKU, price, and request-ID shape at its server
  boundary; records expire and duplicate request IDs are suppressed.
- Journey, context, invocation, decision, and outcome primitives exist, with
  explicit provenance and observed-versus-inferred fields. Browser-local memory
  is inspectable and forgettable.

## Must-fix blockers, in priority order

### 1. Capability scopes are metadata, not an authorization boundary

`engine/p0.js` declares `requiredScope` and read/write mode, but no invocation
path evaluates a grant, caller, or scope. Engine tools are registered directly
in `engine/app.js`; they do not pass through the capability catalog and have no
deny-by-default policy. Partner `exposedTo` protects the three read tools by
origin, but it is not a substitute for capability authorization.

**Required:** introduce one canonical invocation gate that resolves
`capability-id@version`, authenticates the calling surface/origin, checks a
purpose-bound grant and required scope, validates input and output, and records
allow/deny evidence. Protocol names (`get_matching_deals`, declarative forms,
future MCP/UCP projections) should adapt to this semantic gate rather than
becoming separate policy implementations. Add negative tests for missing,
wrong-origin, expired, and insufficient grants.

### 2. Context provenance and privacy claims currently overstate consent

The engine starts with the hard-coded Alex persona, labels its context
`explicit-or-user-approved`, and automatically sends recurring categories plus
price/presentation context to every discovered partner during `init()`, before
the shopper makes a choice. The page also says display choices do not affect
ranking, while `rankDeals()` explicitly boosts preferred collateral formats.
This is both a minimization problem and an inaccurate disclosure.

**Required:** begin with empty/anonymous context or obtain an explicit,
inspectable grant before partner transmission. Derive a minimized,
origin-specific projection listing purpose, fields, recipient, retention, and
whether each value is observed, user-entered, defaulted, or inferred. Correct
the ranking disclosure and never label seeded/demo values as user-approved.
Keep authorization outside personalization inputs.

### 3. The partner/resolver boundary is not fail-closed or bounded

`executeTool()` has no invocation timeout or cancellation policy. Responses are
not validated against `shared/schemas/deal.schema.json` (the schemas are not
used at runtime), payload size/count is unbounded, and a non-array `deals`
value can break result normalization after `Promise.allSettled`. Discovered
tools are trusted from `tool.origin` without a second exact-allowlist check.
Operational failures are recorded as events, but `originOutcomes` is never
passed to `decisionReceipt()`, so a discovered origin whose call failed is
reported as merely connected with zero offers. A hung tool can stall initial
resolution indefinitely.

**Required:** put WebMCP behind a small adapter with per-origin deadlines,
abort handling, exact origin/capability/version matching, response-envelope and
offer-schema validation, limits, and normalized statuses (`ready`, `timeout`,
`invalid`, `failed`, `no-match`). Preserve valid partial results and make the UI
and receipt use the same per-origin outcome map. Retry serialized input only
for a recognized compatibility error, not every execution failure.

### 4. Consequential writes are staged, but not yet replay-safe or auditable

Watch Co's confirmation is a client-supplied boolean. Its request ID is created
at submission rather than at staging and is not bound to the reviewed payload.
Reusing a request ID with a different price silently returns the first record
instead of raising an idempotency conflict. Repeating the same human action
creates a new ID, so logical duplicates remain possible. KV read-then-write is
not atomic, there is no rate limit or abuse boundary, and the engine's local
deal-watch write has no action ID or write receipt.

**Required:** mint a short-lived confirmation grant at staging, bind it to the
exact normalized payload and purpose, and consume it server-side. Use a stable
idempotency key plus payload hash, return a conflict on key/payload mismatch,
and make the claim/store operation atomic enough for the chosen backend. Add
rate limiting before treating the public endpoint as production-safe. Return a
write receipt with action ID, actor/surface, confirmation evidence, storage
result, retention/expiry, deduplication status, and explicit non-outcomes.

### 5. Receipts cannot yet support the P0 audit claim

The decision receipt has no receipt ID, request/invocation linkage, policy or
resolver version beyond a hard-coded capability string, full origin outcomes,
context hash/redaction manifest, or outcome closure. Events are volatile,
limited to one browser session, and universally default to `observed`; prompt
parsing and defaulted persona context are not marked as inferred/defaulted.
The current receipt can explain counts, but it cannot reconstruct or verify the
decision.

**Required:** define versioned decision and action receipt schemas. Link
journey → request → invocation → context → policy → candidate decision → user
intervention → terminal outcome; include per-origin timings/statuses and
withheld reasons without raw prompts or sensitive values. For the competition,
an exportable in-browser receipt is sufficient; durable hosted telemetry can
remain later work.

### 6. The multi-offer slice and acceptance proof are incomplete

The resolver computes up to 12 exposed offers, but `choosePartnerOffer()` drops
all except `ranked[0]`; the UI therefore cannot compare partners, provenance,
freshness, or degraded states per offer. Cross-partner duplicate identity is
not normalized, expired/stale inventory is not excluded, and truncation beyond
the exposure limit is not represented as withholding. The only automated gate
is primarily syntax, asset-consistency, and source-string assertions; it does
not behaviorally test scope denial, malformed partner data, timeouts, partial
failure receipts, ranking invariants, or browser confirmation. The required
two fresh headed-Chrome cross-origin runs remain unproven in the current plan.

**Required for the next slice:** render `resolution.exposed` as a comparison
set; normalize offer identity and units; expose provenance, freshness, health,
rank reason, and withheld/truncated reason per offer; preserve open inventory as
the baseline. Add unit/contract tests for resolver and receipt invariants, API
conflict/replay/concurrency cases, and a repeatable headed-Chrome matrix with
real partner tool execution, partial failure, no-match, staged writes, and
replay evidence. Do not make a competition-ready claim until those runs pass.

## Follow-on enhancements (not P0 blockers)

- Add diversity/fairness constraints and configurable ranking policy once the
  comparison set is trustworthy; keep commercial preference separate from
  eligibility and authorization.
- Add user-selectable persona, category, fit, delivery, gift-recipient, and
  channel context with per-field retention and deletion controls.
- Protect merchant analytics with merchant authentication and a minimum cohort
  threshold before showing min/max/median values; add privacy review before
  accepting real-user signals.
- Move receipts and telemetry to durable user/tenant storage, add signing or
  tamper evidence, experimentation, hosted registry, MCP/UCP projections, and
  graph views only after real integrations justify those boundaries.

## Recommended implementation order

1. Define the canonical capability, grant, context-projection, partner-result,
   decision-receipt, and action-receipt contracts, including versioning and
   negative authorization cases.
2. Put every engine and partner invocation behind the scope gate and bounded
   WebMCP adapter; validate inputs/outputs and produce one per-origin outcome
   map used by both UI and receipts.
3. Change context collection to explicit, minimal, origin-specific consent and
   correct the ranking disclosure before sending any persona-derived fields.
4. Harden writes with payload-bound confirmation grants, stable idempotency,
   conflict detection, atomic storage behavior, rate limits, and action
   receipts.
5. Add behavioral unit/contract tests for authorization, resolver invariants,
   failures, receipts, and write replay before expanding presentation.
6. Build the multi-offer comparison from validated `resolution.exposed` data,
   including freshness, health, provenance, ranking, and withholding.
7. Run the headed-Chrome adversarial matrix twice on fresh state, preserve the
   exported evidence, and only then make the P0/competition stop-go decision.

## Evidence examined

Planning and operating context:

- `AGENTS.md`
- `/Users/stephenkall/beans/mind/beanmind/MEMORY.md`
- `docs/PROJECT_PLAN.md`
- `docs/HANDOFF.md`
- `docs/NEXT_STEPS.md`
- `README.md`

Engine and shared contracts:

- `engine/app.js`, `engine/p0.js`, `engine/config.js`, `engine/index.html`,
  `engine/index.mjs`
- `shared/config.js`, `shared/personas.json`,
  `shared/schemas/deal.schema.json`, `shared/schemas/profile.schema.json`,
  `shared/storefront.js`

Partner and write paths:

- `partners/petsupply/tool.js`, `partners/coffee/tool.js`,
  `partners/watch/tool.js`
- `partners/petsupply/_headers`, `partners/coffee/_headers`,
  `partners/watch/_headers`
- `partners/watch/index.html`, `partners/watch/interest.js`,
  `partners/watch/interest-products.js`, `partners/watch/wrangler.toml`
- `partners/watch/functions/api/register-interest.js`,
  `partners/watch/functions/api/_store.js`,
  `partners/watch/functions/api/interest-summary.js`
- `partners/watch/merchant/index.html`, `partners/watch/merchant/merchant.js`

Checks and tests:

- Inspected and ran `node scripts/check-product.mjs`: **passed, 317
  assertions**; generated UI and engine bundle freshness, 24 JavaScript files,
  and 17 JSON files all passed.
- Ran a direct resolver probe: two considered/eligible offers produced one
  relevant exposed offer and one relevance-withheld offer as expected.
- Ran a direct Watch API replay probe: the same request ID with prices 100 and
  999 returned the original 100 record with one write and no conflict,
  confirming blocker 4.
- Searched for dedicated test/spec files; none exist beyond the product gate.
- No deployment, production mutation, or headed-browser acceptance run was
  performed.
