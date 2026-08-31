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

## 2. Current baseline

Jumping Beans currently includes:

- an engine and three independently served partner origins;
- open-inventory baseline data and clearly labeled partner/fallback states;
- cross-origin WebMCP discovery and partner opt-in;
- user-controlled browser-local preferences and offer memory;
- save-and-apply versus apply-once behavior;
- deal-watch staging and confirmation;
- Watch Co declarative interest registration and merchant aggregation;
- P0 capability, journey, context, ranking, and decision-receipt primitives;
- network visibility showing connected origins and eligible/exposed counts.

The local product gate is green at 336 assertions after the resolver hardening
slice. The available browser session confirms the local UI controls, but does
not expose executable WebMCP partner tools, so flagged headed-Chrome
cross-origin execution remains an acceptance gate.

## 3. Model ownership

The main Codex session owns integration, scope, provenance, and final release
decisions.

| Workstream | OpenAI model owner | Accountability |
|---|---|---|
| Architecture, security, protocol boundaries | GPT-5.6-Sol | Capability contracts, authorization, threat model, MCP/UCP boundary, architecture review |
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
- show explicit degraded and no-match states.

### 4.2 Personalization and resolution

- represent explicit user preferences as a context snapshot;
- apply category relevance, profile budgets, and explicit price ceilings;
- rank deterministically using user-selected presentation preferences;
- return a decision receipt explaining eligibility and exposure;
- never reintroduce a filtered offer during ranking or fallback rendering.

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
2. multiple real partner origins;
3. real partner tool execution;
4. preference-aware filtering and ranking;
5. honest partial-failure and no-match behavior;
6. staged confirmation for consequential writes;
7. replay-safe idempotency;
8. provenance and decision-receipt evidence.

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

## 6. Phase 2 — Platform expansion

Only after real integrations justify the boundary:

- durable user and tenant storage;
- hosted capability registry and lifecycle management;
- server execution gateway;
- network analytics and path views;
- experimentation;
- MCP projection;
- UCP semantic mapping;
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
| P0.1 | Final architecture/security checklist | GPT-5.6-Sol | Complete; see `docs/P0_ARCHITECTURE_REVIEW.md` |
| P0.2 | Core resolver and multi-offer network slice | GPT-5.6-Terra | Complete locally; gate green at 336 assertions |
| P0.3 | Headed-Chrome acceptance matrix and blocker report | GPT-5.6-Luna | Complete; STOP/NO-GO; see `docs/P0_ACCEPTANCE_REVIEW.md` |
| P0.4 | Mechanical gate, fixtures, and provenance maintenance | Main Codex session | Completed locally |
| P0.5 | Main-session integration and release decision | Main Codex session | In progress; local checkpoint only, no deployment |
| P0.6 | Consequential-write contract and local server seam | GPT-5.6-Terra | Complete locally; gate green at 340 assertions |
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
acceptance report. The generated bundle was refreshed and the 336-assertion
product gate passed. The next write-hardening loop added the canonical action
contract, server-owned pending-action seam, payload-bound replay semantics,
and redacted action receipts; the gate passed at 340 assertions. Luna found
same-key concurrent duplication in the non-atomic local seam, so the product
remains STOP/NO-GO until D1 or Durable Object authority is bound. Future
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
