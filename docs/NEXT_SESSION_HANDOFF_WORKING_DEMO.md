# Jumping Beans — Next Session Handoff: Working Product Demo

Status: ready for execution  
Created: 2026-09-01  
Primary goal: deliver a public, user-ready Jumping Beans demo with complete,
honest, repeatable flows—not merely a protocol proof.

## Copy/paste opening prompt for the next Codex session

You are the execution lead for Jumping Beans. Build and verify a working public
demo for the WebMCP competition and for real demo users.

The goal is a complete product journey: a user can arrive at the public site,
discover open and opted-in inventory, explicitly authorize labeled demo
personalization, compare and understand partner offers, apply preferences once
or save them, forget saved memory, stage and confirm a deal watch, inspect
provenance and decision evidence, and recover honestly from no-match, timeout,
invalid, or partial-partner states.

Use only native browser WebMCP for browser capability discovery and invocation.
Do not add a bridge, `postMessage`/MessagePort transport, direct capability
endpoint, server-side tool gateway, substitute registry, polyfill, or fallback
transport. Open inventory may remain the explicitly labeled baseline; it must
never be presented as a WebMCP partner result.

Use OpenAI Codex models and the Bean Labs review loop: GPT-5.6-Sol reviews the
architecture and security boundary, GPT-5.6-Terra owns implementation of one
vertical slice at a time, GPT-5.6-Luna performs headed-browser and adversarial
acceptance, and the main Codex session integrates, runs gates, maintains
provenance, and makes release decisions. Keep implementation work isolated or
serial; do not overlap edits to the same core files.

Do not declare completion from a green unit/product gate alone. Finish with a
clean public-browser run, evidence, a clean Git tree, and a released commit.

## Starting state

- Repository: `/Users/stephenkall/beans/products/jumping-beans`
- Current source release: `v0.3.0` at `48782ae`
- Latest provenance commit: `7b2b65e`
- `main` is synced with GitHub and clean at handoff.
- Public engine: `https://jumping-beans-engine.steve-k-kall.workers.dev/`
- Public partners:
  - `https://petsupply.pages.dev/`
  - `https://coffee-amk.pages.dev/`
  - `https://watch-ce8.pages.dev/`
- Approved Cloudflare D1 write authority is already provisioned and migrated.
  Do not recreate it; inspect the existing binding and migrations first.
- The current public clean Canary run passed native discovery and personalized
  execution for Petsupply and Coffee Co, with a valid Watch Co no-match.
- The current evidence and architecture records are:
  - `docs/WEBMCP_NATIVE_RUN_EVIDENCE_2026-09-01.md`
  - `docs/WEBMCP_COMPETITION_ACCEPTANCE.md`
  - `docs/WEBMCP_AGGREGATION_ARCHITECTURE.md`
  - `docs/PROJECT_PLAN.md`

Some older sections of the acceptance documents describe historical pre-fix
states. Treat the final dated public-run section and this handoff as the
current baseline, then reconcile stale status tables as part of the work.

## Product outcome to build

The demo should feel like a real user-controlled product, with the following
flows fully functional end to end.

### 0. Hosted identity and personal experience

- Keep the public journey usable anonymously; login is optional, not a gate for
  discovery.
- Provide a real hosted login service with an established identity provider
  (recommended: Google OIDC), validated state/nonce, safe redirects, revocable
  server-side sessions, Secure/HttpOnly/SameSite cookies, CSRF protection, and
  abuse limits.
- Store only hashed session tokens and user-scoped records in an authoritative
  Jumping Beans D1 database. Do not use WebMCP as an authentication channel.
- Give signed-in users a durable, inspectable, editable, and forgettable
  personal profile and offer memory across browsers/devices.
- Never silently upload browser-local memory during first login; require an
  explicit import decision.
- Ensure two users cannot read or mutate one another's profile, memory,
  watches, or receipts. Partner WebMCP calls receive only the explicitly
  approved personalization projection, never account credentials or session
  material.
- Keep Watch Co's partner-owned write authority separate. Any account linkage
  must use explicit normal web authentication and must not trust an engine-side
  identity claim.

### 1. Anonymous discovery

- Load the public engine without an extension or account dependency.
- Show open inventory immediately.
- Discover opted-in partner tools through native WebMCP.
- Send no persona-derived categories or budget before explicit approval.
- Show connected origins and honest no-match/failed/timeout states.

### 2. Explicit personalization

- Clearly label the Alex context as a demo profile.
- Explain recipient, purpose, fields, and request-only retention before use.
- Send only the approved categories and budget to the exact opted-in partner
  origins that need them.
- Apply relevance, budget, and presentation rules without changing source facts,
  authorization, or provenance.
- Keep user choices inspectable and deterministic.

### 3. Apply once versus save

- `Apply once without saving` changes the current journey only.
- `Save and apply` persists only the explicitly described browser-scoped rule.
- Saved memory is visible, explainable, and removable with Forget.
- Reload behavior is correct for both saved and non-persistent paths.
- No order, payment, message, or notification is implied by these controls.

### 4. Network results and partner handoff

- Show multiple eligible partner offers where available.
- Preserve partner name, origin, source, freshness, verification, and
  collateral labels.
- Explain why an offer appeared and why others were withheld.
- Keep direct partner WebMCP calls available for detail, proof, verification,
  and consequential actions.
- Open partner landing pages with the correct scoped presentation state.

### 5. Deal-watch flow

- Stage a product-scoped target price before persistence.
- Show fact, scope, retention, and outcome in the confirmation surface.
- Require explicit page confirmation.
- Persist through the existing D1-backed write boundary.
- Verify replay safety, changed-payload conflicts, same-key concurrency,
  session binding, rate limits, and a truthful summary.
- Make clear that a watch is not a purchase or notification unless a later
  product explicitly adds that capability.

### 6. Evidence and recovery

- Expose a native read-only journey receipt with journey/request/context IDs,
  capability versions, per-origin outcomes, counts, decision reasons, and
  redacted event history.
- Handle one bad partner without erasing successful partner results.
- Validate and bound every partner response.
- Never label illustrative or open-inventory data as a WebMCP result.
- Capture both success and negative-path evidence.

## Architecture direction

The direct three-partner implementation is the current inspection baseline.
The next product architecture should add a native aggregation layer for the
default read path so the engine does not scale linearly by loading and
invoking every partner independently for every page view.

The intended shape is:

```text
user intent
  -> one browser-native Jumping Beans aggregation capability
  -> bounded, lazy partner resolution
  -> per-origin validation, provenance, and health outcomes
  -> ranked network result
  -> direct partner WebMCP call only for detail, proof, verification, or action
```

The aggregator must not become a non-native transport or hide origin-level
truth. It should preserve per-origin receipts, partial success, authorization
boundaries, and direct WebMCP inspection. Read
`docs/WEBMCP_AGGREGATION_ARCHITECTURE.md` before changing this boundary.

## Execution order and model ownership

### Checkpoint A — contract and acceptance plan

Owner: GPT-5.6-Sol  
Reviewer: main Codex session

Define the working-demo contract, aggregation boundary, multi-user isolation
requirements, threat model, and exact acceptance matrix. Resolve whether the
competition packet requires Stable as well as Canary production evidence.

Deliverable: a short architecture/security review with explicit stop/go gates.

### Checkpoint B — implementation vertical slices

Owner: GPT-5.6-Terra  
Reviewer: GPT-5.6-Sol before integration

Implement the smallest complete slices in this order:

1. hosted identity, login/logout/session lifecycle, and account-scoped data;
2. demo shell, public loading, native discovery, and anonymous state;
3. personalization, ranking, comparison, provenance, and one-time apply;
4. save/forget memory and reload behavior, including explicit local-memory
   import;
5. deal-watch stage/confirm/replay/concurrency behavior and account isolation;
6. native aggregation spike with direct partner detail/action paths;
7. production resilience, bounded concurrency, rate limits, and observability.

Each slice must include its tests and user-visible failure states before the
next slice begins.

### Checkpoint C — browser and adversarial acceptance

Owner: GPT-5.6-Luna  
Inputs: Terra implementation plus Sol contract

Run clean headed Chrome acceptance without the ChatGPT extension in the
evidence lane. Test both normal and degraded conditions:

- anonymous and explicitly approved context;
- login, logout, session expiry, relogin, and hosted personal persistence;
- two isolated accounts plus anonymous-to-account separation;
- apply once, save, forget, and reload;
- all partner combinations and partial failures;
- native tool discovery and execution;
- receipt completeness and redaction;
- multiple concurrent users and repeated write keys;
- public production URLs and origin-policy headers.

Do not use an extension-injected browser result as native WebMCP evidence.

### Checkpoint D — integration and release

Owner: main Codex session

Run the product gate, security review, browser evidence review, `git diff
--check`, and deployment smoke tests. Reconcile the documentation status
tables, attach evidence, release only after all required checks are green, and
leave the repository clean and synced.

## Definition of done

The next session is complete only when all of the following are true:

- A new user can complete the primary journey from the public URL without
  manual developer intervention.
- The product works for anonymous users and explicitly approved demo context.
- A real hosted login service provides an optional personal experience with
  durable user-scoped data and no cross-user leakage.
- All visible flows above work, including save/forget and the deal-watch write
  boundary.
- Native WebMCP is the only partner capability transport.
- At least two real partner origins return valid offers in the primary demo;
  remaining origins have honest, explainable outcomes.
- Per-origin provenance, eligibility, exposure, withholding, and failure state
  survive aggregation and rendering.
- The receipt is captured as redacted evidence, not merely asserted in prose.
- The public deployment serves multiple users without shared browser state or
  cross-user D1 contamination.
- Clean Stable/Canary evidence is recorded to the level required by the
  competition packet.
- The product gate and adversarial review pass.
- Documentation, GitHub, and the deployed URLs agree on the current release.

## What not to do

- Do not narrow the product to one scripted competition transaction.
- Do not add auth, payments, notifications, or partner APIs unless the slice
  requires them and the contract is explicitly reviewed.
- Do not replace native WebMCP with a convenient transport for reliability.
- Do not treat a browser-extension result as clean native evidence.
- Do not silently convert a timeout, invalid response, or no-match into a
  fallback partner card.
- Do not deploy an architectural change without the full review loop.

## Expected final handoff

Return to the main session with:

1. a working public demo URL and the exact user journey to run;
2. the model/session results and any rejected risks;
3. clean-browser screenshots or structured evidence;
4. the redacted journey receipt artifact;
5. test/gate results and production smoke checks;
6. the final Git commit, tag, and release URL;
7. a short list of intentionally deferred work, especially later network
   aggregation scale-out beyond the demonstrated bounded design.
