# Jumping Beans — Expanded WebMCP Product Plan

Status: active execution plan
Last updated: 2026-08-31

## 1. Product vision

Jumping Beans is the first live surface of a trusted WebMCP capability
network. It should help a user move from intent to outcome across multiple
participating sites while preserving user control, partner trust, provenance,
personalization, and measurable results.

The core loop is:

    intent
      -> user context
      -> capability discovery
      -> policy and eligibility
      -> relevance and ranking
      -> personalized presentation
      -> confirmed action
      -> measurable outcome

The competition is a validation gate, not the product boundary. The product
should not be reduced to one scripted transaction merely to satisfy a demo
cutline.

The next architecture checkpoint is the native aggregation design in
`docs/WEBMCP_AGGREGATION_ARCHITECTURE.md`: one browser-native aggregator for
default read resolution, with direct partner WebMCP calls retained for detail,
proof, verification, and consequential actions.

## 2. Current baseline

Jumping Beans currently includes:

- an engine and three independently served partner origins;
- open-inventory baseline data and clearly labeled native WebMCP discovery states;
- cross-origin WebMCP discovery and partner opt-in;
- user-controlled browser-local preferences and offer memory;
- save-and-apply versus apply-once behavior;
- deal-watch staging and confirmation;
- Watch Co declarative interest registration and merchant aggregation;
- P0 capability, journey, context, ranking, and decision-receipt primitives;
- network visibility showing connected origins and eligible/exposed counts.

The current product gate is green and includes the minimal native fixture,
full-engine response policy, all three partner contracts, registry bootstrap,
same-revision discovery ownership, and foreground/toolchange interleavings.
The deployed v0.10.6 receipt proves exact 3/3 execution in clean headed Stable
Chrome. Final QA found that its probe order could hide an intermittent cold
start, so v0.10.7 adds repeated user-action-first acceptance before the deeper
native probes.

## 3. Model ownership

The main Codex session owns integration, scope, provenance, and final release
decisions.

| Workstream | OpenAI model owner | Accountability |
|---|---|---|
| Architecture, security, protocol boundaries | GPT-5.6-Sol | Native WebMCP contracts, authorization, threat model, architecture review |
| Core engine and network resolution | GPT-5.6-Terra | WebMCP adapter, resolver, personalization, ranking, receipts, network experience |
| UX and personalization | GPT-5.6-Terra | Multi-offer experience, persona/context flows, comparison, user controls |
| Browser acceptance and adversarial QA | GPT-5.6-Luna | Headed-Chrome runs, protocol variance, failure cases, evidence capture |
| Mechanical validation and documentation | Main Codex session | Product gate, fixtures, generated assets, mechanical checks, plan maintenance |
| Integration and release | Main Codex session | Change integration, regression review, release gate, no premature deployment |

One OpenAI model owns a vertical slice at a time. The review loop is:

1. Sol defines or reviews the contract and security boundary.
2. Terra implements the vertical slice.
3. Luna performs corroborative and adversarial acceptance review.
4. Main Codex integrates findings, runs deterministic gates, and makes the
   stop/go decision.

Overlapping edits to the same core files are avoided; independent
implementation uses isolated worktrees.

## 4. Phase 0 — P0 hardening

### 4.1 Network reliability

- wait for partner iframe readiness;
- retry discovery across normal browser timing variance;
- support object and serialized tool inputs;
- deduplicate partner tools by origin;
- preserve partial partner success;
- record per-origin invocation outcomes;
- show explicit native discovery failure, timeout, and no-match states;
- never synthesize a partner result or label a non-WebMCP result as connected.

### 4.2 Personalization and resolution

- represent explicit user preferences as a context snapshot;
- apply category relevance, profile budgets, and explicit price ceilings;
- rank deterministically using user-selected presentation preferences;
- return a decision receipt explaining eligibility and exposure;
- never reintroduce a filtered offer during ranking or native result rendering.

### 4.3 Safe writes

- stage consequential actions before persistence;
- require page-level human confirmation;
- validate again at the server boundary;
- carry idempotency keys;
- suppress duplicate writes;
- add rate limiting before production scale;
- distinguish demand signals from purchases, notifications, and messages.

### 4.4 Measurement

- journey and request IDs;
- capability IDs and semantic versions;
- context snapshots;
- invocation, intervention, decision, and outcome events;
- redaction and observed-versus-inferred markers;
- baseline comparison fields;
- no raw prompts or sensitive user data in default telemetry.

### 4.5 P0 acceptance

P0 is accepted when the product gate is green and flagged headed Chrome proves:

1. two fresh end-to-end runs;
2. embedded native WebMCP discovery from all three partner origins;
3. real partner tool execution through `executeTool()`;
4. multiple real partner origins with per-origin provenance;
5. preference-aware filtering and ranking;
6. honest partial-failure and no-match behavior;
7. staged confirmation for consequential writes;
8. replay-safe idempotency;
9. provenance and decision-receipt evidence.

## 5. Phase 1 — Expand the network product

### 5.1 Multi-offer network experience

Move beyond a single selected partner offer:

- show multiple eligible offers;
- compare partners and offer facts;
- show provenance and freshness per offer;
- explain ranking and withholding;
- expose partner health and degraded states;
- keep open inventory available as a baseline.

### 5.2 Deeper personalization

Add explicit, inspectable context for category, budget, size/fit, delivery
speed, gift recipient, preferred channel, presentation style, and retention.
Personalization must affect resolution and clarification avoidance, not only
copy or styling.

### 5.3 Merchant outcomes

Expand the merchant surface with demand by product, target-price distribution,
expiry, duplicate suppression, partner response health, and outcome summaries.
Every view must distinguish a demand signal from purchase intent.

### 5.4 Additional intent classes

Add, in order:

1. retail matching;
2. support resolution;
3. synthetic airline policy and authorization fixtures.

Each intent class gets its own baseline, terminal outcome, quality dimensions,
and security tests.

## 6. Phase 2 — WebMCP platform expansion

Only after real integrations justify the boundary:

- durable user and tenant storage;
- WebMCP-native partner onboarding and lifecycle management;
- network analytics and path views;
- experimentation;
- graph views and durable outcome measurement.

These are staged expansion tracks, not rejected product directions.

## 7. Development operating loop

1. Sol defines or reviews the contract and security boundary.
2. Terra implements one vertical slice.
3. Luna tests the slice through browser and failure-case paths.
4. Bean local session runs deterministic gates and updates supporting artifacts.
5. Main Codex integrates, reviews provenance, and decides whether the slice is
   accepted.

No production deployment occurs until the relevant gate, live evidence, and
asset/rights review are complete.

## 8. Immediate execution queue

| Priority | Deliverable | Owner | Status |
|---|---|---|---|
| P0.1 | WebMCP-only architecture/security contract | GPT-5.6-Sol | Complete; native-only boundary retained; see `docs/WEBMCP_ONLY_ARCHITECTURE_SECURITY_REVIEW.md` |
| P0.2 | Core resolver and multi-offer network slice | GPT-5.6-Terra | Complete locally; current gate green |
| P0.3 | Native WebMCP runtime and competition acceptance | GPT-5.6-Luna | v0.10.6 receipt complete; v0.10.7 cold-start receipt pending; see `docs/WEBMCP_COMPETITION_ACCEPTANCE.md` |
| P0.4 | Mechanical gate, fixtures, and provenance maintenance | Main Codex session | Completed locally |
| P0.5 | Main-session integration and release decision | Main Codex session | Native 3/3 integrated; v0.10.7 release held for exact production cold-start evidence |
| P0.6 | Consequential-write contract, D1 repository, and request boundary | GPT-5.6-Terra | Code complete; approved D1 provisioned/migrated; local Pages+D1 HTTP matrix green |
| P0.7 | Write-boundary adversarial acceptance | GPT-5.6-Luna | Complete; STOP/NO-GO; see `docs/P0_WRITE_ACCEPTANCE_REVIEW.md` |

## 9. Execution notes

The first ad hoc parallel dispatch used the saved Bean Labs project root, which
is not itself a Git repository; those tasks therefore shared the product
working directory rather than receiving isolated product worktrees. It was
stopped before release use. The later Agency local-model tasks 169–171 were
created in error after the model preference was clarified; they were not
approved or executed and are superseded by the OpenAI review loop above.

The corrected OpenAI loop ran serially in the shared product directory:
GPT-5.6-Sol produced the architecture review, GPT-5.6-Terra implemented the
resolver hardening and multi-offer slice, and GPT-5.6-Luna produced the
acceptance report. The generated bundle was refreshed and the 413-assertion
product gate passed. The next write-hardening loop added the canonical action
contract, server-owned pending-action seam, payload-bound replay semantics,
and redacted action receipts; the gate passed at 340 assertions. Luna found
same-key concurrent duplication in the non-atomic local seam. The next
checkpoint added the `WATCH_DB` D1 batch authority and a D1-compatible
concurrency double (354 assertions). The approved `watch-write-actions` D1 was
then provisioned, migrated remotely, and exercised through local Pages
Functions against SQLite D1: session bootstrap, stage, commit, replay,
changed-payload conflict, same-key concurrency, and summary all passed. The
request-boundary checkpoint added exact origin policy, cookie/CSRF session
binding, bounded JSON, and D1-backed stage/commit/failed-grant limiters. The
v0.10.6 production native receipt passed; v0.10.7 must repeat that evidence with
the cold-start action ordered before any direct registry polling. Future
parallel implementation tasks must use actual isolated product worktrees or
run serially through the main session.

## 10. Release principles

- Ambition stays broad; release gates control risk.
- User context can influence relevance and presentation, never authorization.
- Exposure is not authorization.
- Invocation success is not intent resolution.
- Required confirmation is not counted as avoidable friction.
- Protocols are projections; the semantic capability layer is canonical.
- Tool count and protocol count are not product success metrics.
- No competition claim is made until the acceptance evidence is repeatable.
