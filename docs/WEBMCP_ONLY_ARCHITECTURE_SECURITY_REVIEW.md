# Jumping Beans WebMCP-only architecture and security review

Date: 2026-08-31

Reviewed checkpoint: `b0a3442` / `v0.2.4`

Scope: native cross-origin WebMCP, personalization, authorization, and receipts

Decision: **STOP / NO-GO for the competition network claim**

## Executive decision

Jumping Beans is a native WebMCP product. The competition architecture has one
and only one capability transport:

```text
partner document
  -> document.modelContext.registerTool(..., { exposedTo })
  -> browser frame tree governed by allow="tools" and Permissions-Policy
  -> engine document.modelContext.getTools({ fromOrigins })
  -> engine document.modelContext.executeTool(registeredTool, input)
  -> partner-owned execute callback
  -> validated result, personalization, and receipt
```

The following are explicitly outside the product and competition boundary:

- `MessagePort` or `postMessage` tool discovery or invocation;
- direct HTTPS capability discovery or invocation;
- server-side tool execution gateways;
- substitute registries, manifests, bridges, polyfills, or compatibility
  transports;
- a direct-site demonstration presented as evidence of embedded network
  discovery.

If a supported evaluator runtime cannot complete the native embedded flow,
Jumping Beans stops. It does not silently downgrade and it does not claim that
the network worked.

The application-side prerequisites are present at `v0.2.4`: partner tools use
native `registerTool()` with exact `exposedTo` origins; the engine creates the
partner frames with a `tools` delegation before navigation; the engine Worker
sends an exact top-level `Permissions-Policy: tools=(...)`; and the consumer
uses `getTools({ fromOrigins })` and `executeTool()`. Direct engine and partner
tools have executed in headed Chrome. The unresolved fact is decisive:
embedded discovery in the tested Chrome Stable/Canary environment returned the
top-level engine tools but not the three partner tools.

That result is **not yet sufficient to declare a Chromium defect**. It is a
reproducible runtime/architecture mismatch until a minimal two-origin native
case isolates the browser build, feature flags or origin trial, policy
delegation, frame lifecycle, and discovery behavior. It is nevertheless enough
to make the present competition verdict STOP.

## Binding WebMCP-only contract

### 1. One browser-mediated trust path

The engine and all partner producers must be active documents in the same
browser frame tree. A top-level visit to a partner is useful diagnostics, but
it is not the Jumping Beans network path.

For every partner origin, all of these conditions must hold together:

1. The engine response delegates the `tools` feature to that exact origin with
   `Permissions-Policy`.
2. The partner iframe receives the `tools` feature through its `allow`
   attribute before its navigation begins. `allow="tools"` is the native
   baseline; a stricter origin-qualified form is acceptable only when proven
   in the target runtime.
3. The partner origin is potentially trustworthy and, while the origin trial
   applies, serves its own valid WebMCP token. An iframe does not inherit the
   producer origin's trial enrollment.
4. The partner registers `get_matching_deals` with
   `document.modelContext.registerTool()` and places the engine's exact origin
   in the second argument's `exposedTo` list.
5. The engine requests only the configured exact origins through
   `getTools({ fromOrigins: PARTNER_ORIGINS })`.
6. The engine accepts only the expected tool name, expected exact origin, and
   supported contract version, and deduplicates by origin.
7. The engine invokes the returned `RegisteredTool` only through
   `document.modelContext.executeTool()`.
8. The browser mediates the call and runs `execute` in the partner document's
   realm. No engine-side reimplementation of the partner capability is valid.

`exposedTo` and `fromOrigins` are reciprocal opt-ins, not interchangeable
configuration. `exposedTo` is the producer's cross-origin sharing decision;
`fromOrigins` is the consumer's explicit retrieval request. The browser must
enforce their intersection along with the `tools` Permissions Policy.

No wildcard origin belongs in this system. Origin strings include scheme,
host, and effective port and must be compared as origins, not prefixes or
substrings.

### 2. Registration and lifecycle

`registerTool()` is asynchronous. A producer must treat a resolved registration
promise as the registration checkpoint and surface rejection evidence,
especially `NotAllowedError`/security failures caused by policy or origin
configuration. A console log issued after a failed registration is not proof.

`toolchange` is the native lifecycle signal for additions, removals, and
updates. The engine architecture should use it to trigger reconciliation with
a fresh `getTools({ fromOrigins })` call. It must not treat the event payload as
the tool registry or execute a previously cached tool solely because an event
fired.

The event is not a safe sole readiness primitive:

- the listener can miss registration that completed before attachment;
- the draft does not guarantee timing relative to unrelated task sources;
- the current project history reports that cross-origin `toolchange` did not
  fire in the tested runtime.

Therefore the native-only reconciliation rule is:

```text
attach toolchange listener before partner navigation
  + wait for each iframe load/error/timeout
  + run explicit getTools({ fromOrigins }) discovery
  + rerun discovery on toolchange
  + use bounded native discovery retries for registration timing variance
```

Iframe `load` proves only that navigation completed. `toolchange` proves only
that the browser reported a registry change. Only a fresh `getTools()` result
proves discoverability, and only `executeTool()` proves invocability.

Static competition GO does not require a `toolchange` event if all three tools
are discovered and invoked after load. Any claim of dynamic capability
exposure, however, remains NO-GO until add/remove/update behavior is proven
through native `toolchange` and registry reconciliation.

### 3. Invocation and result boundary

All partner calls must preserve the current fail-closed adapter properties:

- exact origin/tool allowlisting after discovery;
- one tool per expected partner origin;
- bounded input and an explicit schema;
- an independent deadline for every origin;
- bounded output envelope and offer count;
- validation before eligibility, ranking, rendering, or receipt creation;
- normalized `ready`, `no-match`, `invalid`, `timeout`, and `failed` outcomes;
- valid partial success when one partner fails;
- no fallback offer labeled as partner-provided.

The current object-input call with a serialized-input retry remains native
WebMCP because both attempts use `executeTool()`. The retry must occur only for
a recognized argument-shape compatibility error. It must never convert an
authorization denial, timeout, invalid result, or partner exception into a
second execution.

A transport-level success is not a product outcome. The engine must still
validate merchant claims, freshness, identity, price units, eligibility, and
presentation policy.

### 4. Native declarative write path

Watch Co's `register_interest` form is a native declarative WebMCP producer.
An agent-invoked declarative submission may stage the exact action, but it must
not persist merchant-affecting state. The page remains the confirmation
surface. The existing distinction is correct:

```text
agentInvoked submission -> stage only -> page review -> explicit confirmation
  -> partner application commit -> authoritative action receipt
```

The partner page may call its own same-origin application endpoints from its
normal page/tool logic. That endpoint may authorize, validate, persist, rate
limit, and return a receipt. This is not an alternate capability transport as
long as:

- the engine or agent cannot discover or invoke the partner capability through
  that endpoint;
- cross-origin capability selection and invocation occurred only through
  WebMCP;
- the endpoint is implementation detail inside the producer's origin;
- no server endpoint impersonates `getTools()` or `executeTool()`.

Watch's D1 stage/commit APIs are therefore inside the partner application
security boundary, not a permitted direct HTTPS tool transport.

## Security boundary

### What native WebMCP enforces

The browser-level boundary can enforce:

- whether a document is allowed to use the `tools` feature;
- whether a producer explicitly exposes a tool to an in-tree origin;
- whether a consumer explicitly asks for tools from an origin;
- that execution is routed back to the registering document's callback;
- that inactive/disconnected documents do not remain normal live producers.

These controls materially reduce accidental cross-origin exposure. They do not
make partner output true, identify the human, prove user intent, or authorize a
business transaction.

### What native WebMCP does not enforce

`allow="tools"`, `Permissions-Policy`, `exposedTo`, `fromOrigins`, tool names,
schemas, and `readOnlyHint` are not business authorization. In particular:

- `readOnlyHint` is presentation/planning metadata, not a mutation guard;
- a schema bounds shape, not meaning or entitlement;
- an exact origin identifies a web security principal, not a customer, agent,
  employee, or contract;
- the current draft does not provide a generally usable verified agent identity
  to application code;
- a browser-local grant minted by the same caller is policy-test evidence, not
  externally verifiable authorization;
- a successful invocation does not prove that a user approved a consequential
  outcome.

The three `get_matching_deals` producers currently return public-feed/catalog
data and are appropriately modeled as low-risk reads. Their receipts must not
call the result authenticated partner data or independently verified truth.
Any future private inventory, customer-specific price, account data, or
mutation must reauthorize inside the partner-owned `execute`/application
boundary using the partner's existing session and policy.

### Four independent policy layers

| Layer | Question | Authority | Fail-closed result |
|---|---|---|---|
| Browser feature policy | May this document use WebMCP tools? | Browser, response header, iframe `allow` | No registration/discovery/execution |
| Cross-origin exposure | May engine origin see this producer's tool? | Partner `exposedTo` plus engine `fromOrigins` | Tool absent or invocation denied |
| Business authorization | May this subject perform this capability for this purpose now? | Partner application/session/policy | Tool returns denial; no side effect |
| Product resolution | Is a valid result eligible, relevant, and exposed? | Jumping Beans resolver and user-approved context | Result withheld with reason |

These layers must never be collapsed. Personalization can affect the last
layer and the minimized partner input. It can never grant the first three.

### Threats and required controls

| Threat | Required disposition |
|---|---|
| Malicious sibling frame injects a look-alike tool | Exact `fromOrigins`, exact returned `tool.origin`, exact tool name/version, no wildcard, deduplicate by expected origin |
| Partner exposes a tool too broadly | Exact production `exposedTo`; negative test from an unlisted origin |
| Engine header or iframe policy drifts | Capture effective policy and registration rejection; fail the partner closed |
| Tool description or partner output contains prompt injection | Treat all partner metadata/collateral as untrusted data; never turn it into instructions; validate and visibly attribute it |
| Partner hangs or returns oversized/malformed data | Per-origin deadline, envelope/schema/count/size limits, normalized failure, healthy-partner preservation |
| Stale `RegisteredTool` survives navigation or re-registration | Reconcile on navigation/`toolchange`; rediscover before use; do not persist browser tool objects |
| Seeded persona is silently sent to every partner | Anonymous default; explicit request-scoped grant; exact origin-specific projection |
| Personalization becomes authorization | Separate inputs and policy functions; authorization outcome must not depend on ranking preferences |
| Agent submits a consequential declarative form | `event.agentInvoked` stages only; exact page confirmation; server-bound grant and idempotent commit |
| Receipt overclaims trust | Label browser decisions self-attested and server action receipts authoritative only for the persisted action |
| Runtime lacks embedded discovery | STOP; no direct-site or alternate-transport substitution |

## Personalization contract

Jumping Beans should begin anonymous. A demo persona or retained preference is
not user-approved merely because it exists in code or browser storage.

Before any persona-derived field is sent to a partner, the user-facing state
must identify:

- the exact fields;
- the purpose;
- the recipient origin;
- whether each value is user-entered, observed, defaulted, or inferred;
- whether use is request-only or retained;
- how to apply once, save, edit, and forget it.

The origin-specific projection is created before the native `executeTool()`
call and should contain only what that partner needs for the approved purpose.
The current partner contract needs categories and an optional maximum price;
it does not need the full persona, raw prompt, journey history, other partner
results, or saved memory record.

The resolver may use approved category, budget, and presentation preferences to
determine eligibility, relevance, ranking, and display. It must retain a
non-personalized baseline, explain why offers were shown or withheld, and never
reintroduce a filtered offer through illustrative fallback rendering.

Partner A must not learn what Partner B returned. A receipt can record that
both were contacted without becoming input to either partner's tool.

## Receipt contract

Receipts are evidence produced after the native path; they are not a second
transport or an authorization credential.

### Decision receipt

The engine's exportable browser receipt should include:

- receipt, journey, request, and context-snapshot identifiers;
- WebMCP capability ID/version and expected tool name;
- configured, discovered, invoked, and failed origins;
- per-origin status, timing, result count, and normalized reason;
- context projection manifest or redacted field list per origin;
- considered, eligible, relevant, exposed, and withheld counts;
- ranking/withholding policy version and human-readable reasons;
- user interventions: apply once, save, edit, forget, confirm, or cancel;
- terminal outcome and explicit non-outcomes;
- runtime/build evidence sufficient to correlate the acceptance run.

It must not include raw prompts, raw profile values not needed for the audit,
cookies, CSRF tokens, confirmation grants, raw idempotency keys, or other
partners' private results.

This receipt is browser-local/self-attested unless a separate authority signs
or stores it. The competition can use it as inspectable execution evidence but
must not describe it as tamper-proof.

### Action receipt

A Watch action receipt is authoritative only for the partner application state
that Watch committed. It should bind the normalized action and payload hash,
confirmation grant digest, pseudonymous session, idempotency result, storage
authority, timestamps, retention, and explicit non-outcomes without exposing
reusable secrets.

The engine may link an opaque Watch receipt into the journey after a native
WebMCP-mediated flow. Without a verified handoff, engine lineage remains
self-attested and must be labeled that way. No server-side invocation gateway
is required or permitted to improve that label for the competition.

## Browser/runtime P0

### Evidence already established

- The deterministic product gate has passed at the current checkpoint.
- Engine tools are discoverable and executable when the engine is top-level.
- Each partner's `get_matching_deals` tool is discoverable/executable when the
  partner is tested directly in headed Chrome.
- Partner pages are cross-origin isolated in the tested environment.
- The engine currently sets its top-level `Permissions-Policy` allowlist.
- The engine currently applies the iframe delegation before setting `src`.
- Chrome Stable/Canary testing still returned only top-level engine tools from
  embedded engine discovery; the partner tools were absent.

Direct partner success narrows the problem to the embedded native path. It is
not partial competition acceptance.

### Minimal native reproduction

The next implementation checkpoint should use the existing
`spikes/a-cross-origin` material to produce the smallest two-origin proof:

1. one top-level consumer origin;
2. one cross-origin producer iframe;
3. top-level `Permissions-Policy` permitting only the producer;
4. iframe `allow="tools"` set before navigation;
5. producer `registerTool(..., { exposedTo: [consumerOrigin] })`, awaited with
   visible success/failure evidence;
6. consumer listener for `toolchange` attached before navigation;
7. consumer `getTools({ fromOrigins: [producerOrigin] })` after frame load;
8. consumer `executeTool()` with a constant, bounded result;
9. no application resolver, personalization, D1, UI framework, service worker,
   or generated bundle in the test;
10. captured browser version/channel, flags, origin-trial state, response
    headers, iframe policy, registration result, tool list, execution result,
    console errors, and frame tree.

The fixture now uses dedicated `127.0.0.1:8182` consumer and `:8183` producer
origins, avoiding the stale `localhost:8081` reference that made the prior
spike non-representative. The available Chrome profile exposed
`codexGetTools`/`codexExecuteTool` on `document.modelContext`, so its empty
embedded result is rejected as extension-adapter evidence rather than a native
runtime verdict. The fixture now fails closed on those members; it neither
calls nor presents an adapter as WebMCP. This is not a basis for adding a
bridge or changing the product transport. Repeat the fixture in a freshly
recorded, extension-free flagged Stable profile and Canary before attributing
any failure to Chromium.

Run the same artifact in the competition evaluator runtime, current Stable,
and current Canary. Run local trustworthy origins with the documented feature
flags and production HTTPS origins with valid per-origin trial tokens. Do not
mix evidence between builds or use a browser extension's inability to issue a
WebMCP inspection command as evidence that the page API itself failed.

### Diagnostic matrix

| Case | Expected | Meaning |
|---|---|---|
| Consumer top-level self tool | Discovered and invoked | Consumer API baseline |
| Producer top-level self tool | Discovered and invoked | Producer registration baseline |
| Producer embedded, no `allow` | Registration/discovery denied | Negative feature-policy control |
| Producer embedded, wrong `exposedTo` | Absent to consumer | Negative producer-origin control |
| Producer embedded, omitted from `fromOrigins` | Absent to consumer | Negative consumer-origin control |
| Producer embedded, all three exact grants | Discovered and invoked | Minimal native cross-origin pass |
| Three real partners embedded | Exactly 3 expected partner tools invoked | Jumping Beans network pass |
| One partner no-match | Healthy peers preserved, `no-match` receipt | Degraded-path pass |
| One partner malformed/timeout | Healthy peers preserved, failure receipt | Adversarial boundary pass |
| Tool add/remove/update | Registry reconciled via `toolchange` | Dynamic-exposure pass |

If the minimal all-grants case fails in every supported evaluator build, file
an upstream-ready reproduction and maintain STOP. Do not spend competition time
building a non-WebMCP route around the failure.

## Competition stop/go criteria

### Current verdict

**STOP / NO-GO.** `v0.2.4` contains the intended native configuration, but the
required embedded cross-origin partner discovery and execution has not passed.

### GO requires all of the following

1. A named, supported competition runtime exposes `document.modelContext` to
   the engine and authorized partner child documents.
2. Live response evidence confirms valid origin-trial enrollment where needed,
   exact top-level `Permissions-Policy`, and per-frame `allow` delegation.
3. Each partner's awaited `registerTool()` resolves without policy/security
   rejection in the embedded document.
4. Engine `getTools({ fromOrigins: PARTNER_ORIGINS })` returns exactly one
   expected `get_matching_deals` tool from each of the three exact origins.
5. The engine invokes all three returned tools through native `executeTool()`;
   validated partner results reach the shared resolver.
6. Anonymous mode transmits no persona fields. Explicit request-scoped
   personalization visibly changes matching, eligibility, ranking, or
   presentation through the same native path.
7. A no-match and a malformed/timeout partner run preserve healthy origins and
   generate honest origin outcomes; no preview is labeled as partner data.
8. Engine decision receipts accurately link context, three native invocations,
   resolution, intervention, and terminal outcome without secrets.
9. A consequential Watch action is agent-staged, page-confirmed, committed once
   with replay/conflict protection, and represented by a redacted authoritative
   action receipt. The agent cannot auto-commit it.
10. Apply-once, save, edit, forget/revoke, and fresh-state behavior match the
    disclosures and receipts.
11. Two fresh end-to-end 3/3 runs pass in the evaluator runtime with evidence
    captured from clean browser state.
12. Documentation and demo narration state exactly what passed. No direct-site
    result, local deterministic test, or alternative browser transport is
    described as embedded WebMCP evidence.

### Claims that remain separately gated

- **Static native network:** criteria 1-12 above.
- **Dynamic capability exposure:** additionally requires native `toolchange`
  add/remove/update evidence.
- **Externally verifiable user/business authorization:** not supplied by the
  current browser-local grant model and not required for public read tools.
- **Tamper-evident journey receipts:** not supplied by the current browser-local
  receipt and must not be claimed.
- **Cross-browser support:** not established by a Chrome origin-trial pass.

## Recommended next checkpoint

Do not expand the capability catalog or implement another transport. The next
checkpoint is **Native WebMCP Runtime Verdict**:

1. freeze this WebMCP-only contract;
2. reduce the existing cross-origin spike to the minimal two-origin matrix;
3. run it in the exact evaluator, Stable, and Canary builds with complete
   policy/registration/discovery/execution evidence;
4. if minimal native discovery passes, run the same evidence capture against
   all three real partners, then personalization and receipt cases;
5. if minimal native discovery fails, prepare the upstream reproduction and
   keep the competition status STOP.

Only after a 3/3 native pass should the next implementation checkpoint link the
personalized decision receipt to the confirmed Watch action receipt and run the
two fresh competition rehearsals.

## Evidence reviewed

Repository and operating context:

- `AGENTS.md`
- `/Users/stephenkall/beans/mind/beanmind/MEMORY.md`
- `README.md`
- `docs/PROJECT_PLAN.md`
- `docs/NEXT_STEPS.md`
- `docs/HANDOFF.md`
- `docs/P0_ARCHITECTURE_REVIEW.md`
- `docs/P0_ACCEPTANCE_REVIEW.md`
- `docs/P0_WRITE_ARCHITECTURE_REVIEW.md`
- `docs/P0_WRITE_ACCEPTANCE_REVIEW.md`
- `docs/P0_FINAL_ACCEPTANCE_REVIEW.md`
- `docs/CLOUDFLARE_DEPLOY.md`
- source-task browser/Canary evidence and the user's explicit withdrawal of all
  non-WebMCP fallback proposals.

Current implementation:

- `engine/index.mjs`, `engine/app.js`, `engine/p0.js`, `engine/config.js`
- `partners/petsupply/tool.js`, `partners/coffee/tool.js`,
  `partners/watch/tool.js`
- `partners/watch/index.html`, `partners/watch/interest.js`,
  `partners/watch/action-contract.js`
- `partners/watch/functions/api/stage-interest.js`,
  `partners/watch/functions/api/register-interest.js`
- all partner `_headers` files and `spikes/a-cross-origin/*`

Primary standards references:

- [WebMCP repository explainer](https://github.com/webmachinelearning/webmcp/blob/main/README.md)
- [WebMCP draft specification](https://github.com/webmachinelearning/webmcp/blob/main/index.bs)
- [WebMCP security and privacy questionnaire](https://github.com/webmachinelearning/webmcp/blob/main/security-privacy-questionnaire.md)
- [W3C Permissions Policy explainer](https://github.com/w3c/webappsec-permissions-policy/blob/main/permissions-policy-explainer.md)

No application code, deployment, cloud resource, or production data was
modified for this review.
