# P0 consequential-write architecture review

Date: 2026-08-31  
Checkpoint: `f28091f` (`feat: harden WebMCP network resolution`)  
Scope: browser-local deal watches and Watch Co `register_interest` writes only  
Verdict: **do not accept the P0 write gate yet.** The current pages provide a
good review-and-confirm UX, but merchant-affecting writes do not have a trusted
confirmation grant, payload-bound replay protection, atomic storage, an abuse
boundary, or an authoritative action receipt.

## Current boundary

There are two materially different write classes:

1. **Browser-owned state:** saved preferences, offer memory, and the engine deal
   watch live in same-origin browser storage. They can be staged, inspected,
   forgotten, and evidenced locally. The browser is the authority, so receipts
   must be labeled self-attested and browser-local.
2. **Merchant-affecting state:** Watch Co interest changes a deployed aggregate.
   This requires a server authority. A client checkbox, client-minted grant, or
   local-storage record cannot prove authorization, uniqueness, durability, or
   rate enforcement.

The browser-local `createInvocationGrant()` added for the resolver is useful
for exercising capability policy, but the caller can mint it itself. It must
not be treated as authorization evidence for an external write.

## Prioritized P0 contract

### P0.1 — Canonical action envelope and state machine

Every persisted write should use a normalized action envelope before staging:

- `schemaVersion`, `actionType`, `actionId`, and authority (`browser` or
  `watch-server`);
- semantic payload: canonical SKU, integer target price in minor currency units,
  currency, purpose, retention, and explicit non-outcomes;
- stable `idempotencyKey`, created once at staging and retained across retries;
- lineage: `journeyId`, `requestId`, `stageInvocationId`, and stage event ID;
- `stagedAt`, `expiresAt`, and `semanticPayloadHash`.

Hash only the normalized semantic payload, using a documented canonical JSON
encoding and SHA-256. Reject unknown fields and non-canonical amounts rather
than hashing attacker-controlled alternate representations. The lifecycle is:

`draft → staged → confirmed → committing → committed | deduplicated | rejected`

with terminal `cancelled` and `expired` states. Staging is non-consequential;
the capability catalog should split `deal_watch.stage` from
`deal_watch.commit`, and define Watch's merchant write as
`interest.record@1.0.0` with `interest:write` scope.

### P0.2 — Payload-bound confirmation grant

For merchant writes, the Watch server should create a short-lived, one-time
grant bound to:

- grant ID, action ID, semantic payload hash, capability ID/version and scope;
- exact audience origin/endpoint and purpose;
- pseudonymous browser session;
- journey/request/stage-invocation lineage when supplied through a verified
  engine handoff;
- issue/expiry time and the stable idempotency-key digest.

Prefer an opaque pending-action record over a bearer object the browser can
mint. The reviewed Confirm action should advance that exact pending record; a
modified SKU, price, purpose, retention, action ID, or idempotency key must be
rejected. The server should store only a grant ID/hash in the final receipt,
never the reusable grant value.

A normal button click proves that the page dispatched a confirmation event; it
does **not** cryptographically prove a human. If the product later needs strong
user-presence evidence, use authenticated step-up or WebAuthn. Do not label an
anonymous checkbox, CAPTCHA, or client event as human identity proof.

### P0.3 — Stable idempotency and conflict semantics

Require the idempotency key on every commit. Define these responses:

- first valid key/hash: commit once and return `201` with the action receipt;
- same key and same hash/session: return `200` with the exact original receipt
  and `replayed: true`; do not extend retention;
- same key and different hash/action/session: return `409` with
  `idempotency-conflict` and write nothing;
- expired/forged/wrong-audience grant: return a stable `401`, `403`, or `410`
  error code and write nothing;
- rate limit: return `429` with `Retry-After` and write nothing.

The key must be generated at staging, not inside the final `action()` call.
Button disabling remains useful UX but is not a concurrency control.

### P0.4 — Atomic authoritative storage

The current KV per-product array is not a safe commit authority. Its
read/modify/write sequence loses concurrent records, read failures become empty
state and can overwrite prior data, and idempotency checking is not atomic.

Use a transactional store with uniqueness constraints. On the current
Cloudflare stack, the smallest fit is D1 with:

- an action table keyed uniquely by idempotency key and action ID, containing
  semantic payload hash, session subject, status, receipt, and timestamps;
- an interest table with a unique action reference and integer price;
- a pending-grant table with expiry and consumption state;
- transactional/serialized commit of grant consumption, idempotency claim,
  interest insert, and receipt persistence.

A Durable Object partition is an acceptable alternative if strict serialized
per-session/product writes are preferred. KV may remain a cache or disposable
projection, but not the source of truth for idempotency or receipts.

### P0.5 — Rate-limit and abuse boundary

Enforce limits before storage mutation and apply them separately to staging,
confirmation/commit, and failed-grant attempts. At minimum:

- exact production `Origin`/host checks plus an HttpOnly, Secure,
  SameSite session cookie and CSRF binding for browser requests;
- strict method/content type, body-size, field-count, SKU, currency, amount,
  grant-expiry, and retention limits;
- atomic counters by pseudonymous session, privacy-preserving network bucket,
  product, and deployment-wide emergency ceiling;
- deterministic `429` behavior, no mutation on limiter failure, and redacted
  security events without raw IPs or grant values.

Origin and CSRF checks stop accidental cross-site browser submission; they do
not authenticate an API client. Rate limiting therefore remains mandatory for
this anonymous endpoint. Add Turnstile or authenticated accounts only if the
threat model or observed abuse justifies the additional friction.

Production network failure must fail closed. `partners/watch/interest.js`
currently falls back to local storage when `fetch()` throws, even outside the
known local development mode. A deployed outage must produce `not-committed`,
not a successful local substitute for intended merchant state.

### P0.6 — Action receipt and evidence linkage

Persist and return a versioned receipt containing:

- `receiptId`, `actionId`, action/capability type and version;
- authority and lineage trust (`browser-self-attested`, `engine-signed`, or
  `watch-server-authoritative`);
- `journeyId`, `requestId`, `stageInvocationId`, confirmation event ID, and
  commit invocation ID where available;
- semantic payload hash, redacted idempotency-key digest, grant ID, policy
  version, and rate-limit decision ID;
- status (`committed`, `deduplicated`, `rejected`, or `failed`), record ID,
  storage authority, timestamps, expiry, and whether the result was replayed;
- the normalized user-visible fact, retention, and explicit non-outcomes.

Never include raw prompts, IP addresses, session cookies, confirmation grants,
or raw idempotency keys. The engine's `get_journey_receipt` should include its
browser action receipts. A Watch receipt may accept opaque browser lineage as
`browser-self-attested`; to claim verified cross-origin linkage, the engine
Worker must mint a short-lived signed handoff bound to action ID and payload
hash, and Watch must verify it at commit.

## Threat cases and required outcomes

| Priority | Threat/current failure | Required control and proof |
|---|---|---|
| 0 | Agent or API client posts `confirmed: true` directly; current API returns 200. | Server-owned pending grant bound to session/action/hash; missing or forged grant writes nothing. |
| 0 | Same request ID is reused with a changed price; current API returns the first record with 200. | Unique idempotency claim plus payload hash; changed payload returns 409. |
| 0 | Two concurrent records read the same KV array; a local probe retained only one of two writes. | Transactional insert/unique constraints; both distinct actions survive, same action commits once. |
| 0 | Transient KV read error is treated as an empty store and overwrites history. | Storage errors fail closed; no empty-state recovery on authoritative writes. |
| 1 | User confirms, then script changes SKU/price/retention before commit. | Grant binds normalized payload hash; mismatch is rejected and evidenced. |
| 1 | Double click, retry, timeout, or response loss repeats a valid commit. | Stable key returns the exact original receipt without extending retention. |
| 1 | Stolen, expired, cross-session, or wrong-origin grant is replayed. | Audience/session/expiry/single-use checks; no data or receipt disclosure to another session. |
| 1 | Bot floods anonymous signals or grant issuance to bias merchant analytics. | Atomic layered rate limits, bounded input, abuse events, and optional step-up. |
| 1 | Production API outage silently becomes a browser-local success. | Local fallback only in explicit local mode; production returns `not-committed`. |
| 2 | Client supplies fake journey/invocation IDs. | Mark lineage self-attested or require an engine-signed handoff for verified linkage. |
| 2 | Receipt is edited or omits the non-outcomes the user reviewed. | Server-stored immutable receipt derived from the granted normalized payload. |
| 2 | Multiple tabs race browser-local watches. | IndexedDB transaction or explicit last-write-wins receipt; never claim cross-device atomicity. |

## What can be proven where

### Browser-only/local proof

The repository can prove canonical normalization/hash vectors, stable IDs
across retries, stage/cancel UI, exact reviewed copy, no persistence during an
agent-invoked stage, local receipt shape, and deterministic state-machine
transitions. IndexedDB can improve same-browser atomicity. None of this proves
that a grant is unforgeable or that a merchant write is globally unique.

### Local server-boundary proof

With Pages/Worker code and a local D1 database, automated tests can prove grant
expiry/audience/hash checks, API status semantics, SQL uniqueness, concurrent
same-key and distinct-key behavior, limiter counters, retention, and receipt
replay. This is strong implementation evidence without touching production.

### Deployed-boundary proof

Acceptance still requires the actual production bindings and secrets, HTTPS
cookie/origin behavior, migration state, multi-request/multi-isolate races,
edge-derived abuse dimensions, fail-closed dependency behavior, and a headed
WebMCP journey whose signed handoff and Watch action receipt resolve to the
same journey/request/invocation chain. A browser click alone cannot prove human
identity; that claim requires a separate user-presence mechanism.

## Recommended implementation order

1. Freeze normalization vectors, action/grant/receipt schemas, state machine,
   status codes, and trust labels in pure dependency-free modules and tests.
2. Generate action ID, idempotency key, stage invocation/event IDs, normalized
   payload, and hash once at staging in both engine and Watch pages. Keep agent
   invocation non-persistent.
3. Add the Watch server stage/confirm boundary with exact origin/session/CSRF,
   grant binding, expiry, and fail-closed production behavior.
4. Replace authoritative KV arrays with D1 transactional tables and uniqueness
   constraints; migrate merchant summary reads to committed, unexpired rows.
5. Add layered atomic rate limits and stable rejection codes before enabling
   the durable endpoint.
6. Persist and return action receipts; add them to engine journey export and
   implement an engine-signed handoff only for claims of verified lineage.
7. Run unit, API, concurrency, local D1/Pages, and browser staging tests; then
   perform two fresh headed cross-origin runs. Only after that evidence should
   the main session reconsider the P0 write gate.

## Exact files and tests to change

### Existing files

- `engine/p0.js`: split stage/commit capabilities; add normalized action,
  lineage, and receipt contracts.
- `engine/app.js`: create stable IDs/hash at stage, retain stage event IDs,
  invoke the commit boundary, store browser receipts, and link them into the
  journey receipt.
- `engine/index.html`: show/export the resulting local or server receipt and
  its authority label.
- `engine/index.mjs`: only if verified cross-origin lineage is claimed, add the
  server-minted signed handoff endpoint; keep secrets in runtime bindings.
- `partners/watch/interest-products.js`: move currency/minor-unit, retention,
  normalization, and validation constants into the shared Watch contract.
- `partners/watch/interest.js`: stage once, retain the stable key/action/hash,
  use server stage/confirm, reject mutation, and restrict local fallback to
  explicit local mode.
- `partners/watch/index.html`: display action fact, action ID, expiry, authority,
  and terminal receipt without exposing grants or keys.
- `partners/watch/functions/api/register-interest.js`: make this a grant-
  consuming commit endpoint (or compatibility wrapper); require the envelope,
  grant, key, and hash and return the defined statuses/receipt.
- `partners/watch/functions/api/_store.js`: replace KV array read/modify/write
  with the transactional pending-action, idempotency, record, rate, and receipt
  repository.
- `partners/watch/functions/api/interest-summary.js`: read only committed,
  unexpired records from the authoritative store.
- `partners/watch/wrangler.toml`: add the D1 and runtime-secret/binding contract;
  stop describing KV as the write authority.
- `scripts/check-product.mjs`: remove source-string safety as the primary proof,
  run the behavioral write suite, and require conflict/rate/receipt assertions.
- `README.md`, `docs/CLOUDFLARE_DEPLOY.md`, `docs/PROJECT_PLAN.md`, and
  `docs/NEXT_STEPS.md`: document trust levels, migration/preflight, and the
  evidence actually achieved.
- `.github/workflows/deploy-cloudflare.yml`: add a gated migration/preflight
  step and verify the configured server bindings before Watch deployment.
- `engine/static.js`: regenerate after reviewed engine changes; never edit it
  directly.

### New files

- `partners/watch/action-contract.js`: canonical action/hash/grant/receipt
  validation shared by page and functions without DOM dependencies.
- `partners/watch/functions/api/stage-interest.js`: create the server-owned
  pending action/confirmation grant without recording merchant interest.
- `partners/watch/migrations/0001_write_actions.sql`: pending grants, unique
  idempotency claims, committed interests, receipts, and rate buckets.
- `tests/write-contract.test.mjs`: canonicalization/hash vectors, unknown
  fields, minor units, grant binding, expiry, and receipt redaction.
- `tests/write-store.test.mjs`: same-key replay, changed-payload 409,
  concurrent same/different actions, rollback, retention, and read failure.
- `tests/write-api.test.mjs`: missing/forged/expired grant, wrong origin/session,
  stable status codes, body limits, rate limits, and exact receipt replay.
- `tests/write-browser.md` or an equivalent headed-browser matrix: agent stage
  does not persist, user confirmation does, mutation is rejected, retry returns
  the same receipt, production failure does not fall back locally, and the
  receipt lineage matches the journey export.

Use a local D1/Pages integration check in addition to in-memory repository
tests; otherwise SQL uniqueness and transaction behavior remain unproven.

## Evidence examined and checks run

Files examined:

- `AGENTS.md`, `/Users/stephenkall/beans/mind/beanmind/MEMORY.md`,
  `docs/PROJECT_PLAN.md`, `docs/NEXT_STEPS.md`,
  `docs/P0_ARCHITECTURE_REVIEW.md`, `docs/P0_ACCEPTANCE_REVIEW.md`, `README.md`
- `engine/p0.js`, `engine/app.js`, `engine/index.html`, `engine/index.mjs`,
  `engine/bundle-static.mjs`
- `partners/watch/index.html`, `partners/watch/interest.js`,
  `partners/watch/interest-products.js`, `partners/watch/wrangler.toml`
- `partners/watch/functions/api/register-interest.js`,
  `partners/watch/functions/api/_store.js`,
  `partners/watch/functions/api/interest-summary.js`
- `scripts/check-product.mjs`, `.github/workflows/deploy-cloudflare.yml`,
  `docs/CLOUDFLARE_DEPLOY.md`

Read-only results:

- `node scripts/check-product.mjs` passed **336 assertions**.
- Direct API submission with only `confirmed: true` returned HTTP 200 and wrote
  a record in the isolated in-memory harness.
- Reusing `write-review-001` with a changed price returned HTTP 200 and the
  original record rather than a 409 conflict.
- Two concurrent valid writes against a synchronized KV harness submitted two
  distinct request IDs but left only one stored record, demonstrating the lost-
  update race.
- The checkpoint was clean before this review. No production code, deployed
  data, cloud binding, or deployment was changed.

## Concise recommendation

Implement the canonical action contract and tests first, then move Watch commit
authority from KV to a transactional server store with one-time payload-bound
grants, stable idempotency conflicts, layered rate limits, and persisted action
receipts. Keep browser-local writes explicitly self-attested. Do not claim P0
write acceptance until the local server concurrency suite and two fresh headed
cross-origin receipt runs both pass.
