# Jumping Beans — next steps

Status: working prototype shipped; P0 hardening is in progress and the full
network product remains in scope.
Last updated: 2026-08-31.

## Current baseline

- The core thesis is demonstrated: a user-owned advertising and offer memory
  layer records offer context, explains provenance, lets the user control
  preferences, and changes which offer collateral is shown and how it is
  presented.
- The engine and three partner surfaces are live on Cloudflare. The current
  release is `jumping-beans v0.2.0`; the shared Bean Labs design system is
  `beanlabs v0.3.0`.
- Offer inventory currently comes from open/public sources and normalized demo
  catalogs. Partner opt-in is demonstrated as an enrichment path, not a
  prerequisite for inventory.
- The Bean Labs UI standard is centrally owned, copied with provenance into
  each static deployment, checked locally and in CI, and deployed through the
  repository-owned GitHub Actions workflow.

## Next phase, in order

The competition is a validation gate, not the product boundary. The immediate
job is to harden the network while expanding the offering and making the
ambitious product legible.

## 2026-08-31 P0 resolver slice completed locally

- Engine and partner resolution now pass through a deny-by-default,
  purpose-bound capability grant check with scope, origin, capability-version,
  and expiry validation. The engine adapts its registered tools into the same
  boundary.
- The WebMCP adapter exact-allowlists origin/tool pairs, applies per-origin
  deadlines, accepts serialized input only after a compatibility-shaped error,
  validates result envelopes and offer records, caps result counts, and emits
  `ready`, `no-match`, `invalid`, `timeout`, or `failed` outcomes used by both
  the network view and the decision receipt.
- Default resolution is anonymous. The seeded Alex persona is no longer sent or
  described as user-approved; a page control explicitly enables that labeled
  demo context for the current request and describes recipient, purpose,
  request-only retention, and fields. Ranking disclosure now matches the
  presentation-format tie-breaker.
- Site B renders the validated exposed set as a comparison, including rank,
  source, verification, and visible withholding/truncation reasons. The local
  deterministic gate covers authorization denial, malformed/timeout/failed
  partial results, anonymous context projection, and multi-offer ordering.

Still required before P0 acceptance: externally verifiable grants or a server
execution gateway (the current grants are browser-local), payload-bound write
confirmation/idempotency conflict hardening, cross-partner canonical product
identity/freshness policy, and two fresh headed-Chrome cross-origin runs with
exported receipts. No deployment was performed for this slice.

## 2026-08-31 P0 Watch write-contract slice completed locally

- Watch interest writes now use a versioned canonical action with minor-unit
  normalization, SHA-256 semantic payload hash, stable action/idempotency IDs,
  self-attested lineage, and a short-lived server-owned pending grant.
- The commit endpoint binds grant, session, audience, action ID, idempotency
  key, and payload hash. Forged or changed actions are rejected; same-payload
  replay returns the original redacted receipt without extending retention;
  changed-payload replay returns `409 idempotency-conflict`.
- The former KV read/modify/write path is no longer a merchant write authority.
  The only in-memory repository is an explicit `local-development` test seam;
  missing production storage fails closed. The Watch page distinguishes staged
  from committed action state and displays receipt authority and terminal state.

The next required server-bound step is an approved D1 migration, using
`partners/watch/migrations/0001_write_actions.sql`. The implemented `WATCH_DB`
repository batch claims the unique idempotency key, consumes the matching
pending grant, inserts one interest, and persists one redacted receipt. The
injected/local repository remains a test seam only. Before deployment, an
operator must provision the approved D1 database, replace the placeholder D1
ID in `partners/watch/wrangler.toml`, apply the migration, and run the D1
concurrency/expiry matrix against that local binding; no KV fallback is valid.

## 2026-08-31 P0 Watch request-boundary slice completed locally

- Production stage and commit now require the exact configured Watch origin,
  a Secure/HttpOnly/SameSite session cookie, and the server-bound CSRF token
  returned during the non-consequential session bootstrap. Local development
  uses a separate explicit mode and local-only host policy.
- JSON content type, body size, and top-level field sets are bounded before
  action processing. D1-backed counters apply independent stage, commit, and
  failed-grant limits; `429` replies include `Retry-After` and occur before
  action/interest mutation.

Still required: a provisioned local/approved D1 run of this boundary, durable
rate-limit policy for privacy-preserving network and deployment-wide buckets,
real HTTPS cookie behavior, and fresh headed-browser/WebMCP evidence.

### 1. Harden the network foundation

- Keep multi-origin discovery, partner opt-in, and broad partner categories in
  the live experience.
- Record journey IDs, context snapshots, capability versions, invocation
  outcomes, decision receipts, and explicit no-match/degraded states.
- Continue compatibility testing for object and serialized WebMCP inputs,
  delayed iframe readiness, origin duplication, and partial partner failure.
- Keep consequential writes staged, human-confirmable, server-validated, and
  idempotent.

### 2. Make the network journey unmistakable

- Tighten the Site A → user preference/memory → Site Y journey so it can be
  completed in one short guided path.
- Show the same offer with a visibly different presentation rule, such as
  testimonials, video, proof, or concise comparison detail.
- Add a repeatable headed-Chrome acceptance script covering partner discovery,
  preference save/apply-once, forget, provenance, and the resulting rendering
  change.

### 3. Strengthen the user-owned memory model

- Define the smallest durable records for an observed offer, user preference,
  presentation rule, scope, source, timestamp, and retention.
- Make every retained fact inspectable, editable, forgettable, and clearly
  distinct from an inferred interest or an unverified claim.
- Keep passive understanding conservative: explain the evidence, avoid
  sensitive-attribute inference, and default to user control.

### 4. Expand open offer inventory and partner resolution

- Add more reliable public/open feeds and normalize them into the existing
  offer structure.
- Preserve explicit source, freshness, verification, and illustrative-fallback
  labels.
- Treat partner catalogs and WebMCP opt-in as a benefit demonstration: richer
  collateral, fresher facts, and better matching for partners that participate.

### 5. Add product-grade persistence and measurement

- Move demo-only browser persistence behind a small user-scoped storage layer
  with clear retention and deletion behavior.
- Define privacy/compliance boundaries before adding account connections or
  identity signals; do not import Meta, Google, TikTok, or other account data
  until the consent and data-use model is explicit.
- Measure whether preference-aware presentation improves useful engagement,
  while keeping user controls and provenance visible.

### 6. Grow the capability network

- Add support and retail intent classes, followed by synthetic travel policy
  fixtures, using the same resolver and outcome contracts.
- Add richer multi-offer comparison, merchant-side demand/outcome views, and
  explicit channel-aware personalization.
- Extract a hosted registry, durable tenant state, graph views, MCP projection,
  and UCP semantic mapping only when real integrations justify each boundary.

### 7. Keep the operating system healthy

- Continue all shared UI work through the central Bean Labs design system and
  its generated, hashed adapters.
- Keep product changes behind the local gate, exact-head CI, gated Agency work,
  and repository-owned Cloudflare deployment.
- Revisit the separate affiliate-account task only when credentials, cost, and
  partner terms are explicitly approved.

## Definition of next-phase done

An evaluator can start with an open-inventory offer on Site A, see the
multi-origin network state, understand and edit what is remembered, carry a
selected preference to Site Y, see the same offer rendered with that preference
applied, inspect why it appeared, and forget the preference—using the live
Cloudflare demo with repeatable evidence. The product is not considered
competition-ready until cross-origin discovery, two fresh end-to-end runs,
multiple partner origins, real tool execution, and the P0 security gate are
all proven.
