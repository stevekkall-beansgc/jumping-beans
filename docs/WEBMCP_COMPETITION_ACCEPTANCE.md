# Jumping Beans — Native WebMCP Competition Acceptance

> Historical native acceptance plan. The current release receipt is
> [`SELF_SERVE_RELEASE_ACCEPTANCE.md`](SELF_SERVE_RELEASE_ACCEPTANCE.md). This
> document remains **STOP / NO-GO** until that receipt contains a fresh 3/3
> headed Stable production run tied to the deployed commit SHA.

Date: 2026-08-31
Scope: browser/runtime and competition acceptance for the WebMCP Challenge.
Current decision: **STOP / NO-GO**

This is the acceptance record for the cross-origin WebMCP claim. The only
accepted capability path is the browser-native WebMCP surface:
`document.modelContext.registerTool()`, `getTools()`, `executeTool()`, and the
native declarative form surface where applicable. A normal page UI can remain
available, but it is not evidence for the cross-origin WebMCP claim.

## Exact checkpoint

Competition GO requires a fresh, recorded run in a headed Chrome build against
the actual HTTPS origins (with valid origin-trial enrollment) that proves all
of the following in one engine journey:

1. The engine page has `document.modelContext` and is `crossOriginIsolated`.
2. Embedded discovery returns the engine's own tools **and exactly one**
   `get_matching_deals` tool for each of Petsupply, Coffee Co, and Watch Co.
3. The engine calls all three returned partner tools through the caller's
   `document.modelContext.executeTool()`; all three calls complete and return
   parseable, schema-valid native WebMCP results. A 3/3 call count with no
   partner result is not a pass.
4. The journey receipt records the three requested origins, the tool origins,
   each invocation outcome/count, the decision counts, and the active context
   disclosure without raw browser secrets.
5. Personalization is anonymous by default. Only the explicitly approved
   demo context may add categories or price ceilings to partner calls; the
   page shows the scope, purpose, and request-only retention.
6. The evidence names the Chrome channel/version, exact URLs, headers/flags,
   discovery output, three execution outputs or hashes, personalization state,
   and exported receipt.

The minimal two-origin checkpoint now passes in both clean local lanes: Chrome
Canary `151.0.7922.174` and Chrome Stable `152.0.7977.65`. Both captures show
the native surface, exact partner discovery, a `toolchange` event, and
successful native execution. The full embedded 3/3 claim remains NO-GO until
the same evidence is captured for all three partner origins.

## Minimal native cross-origin reproduction

Run the minimal two-origin fixture from the product root in separate terminals:

```bash
cd /Users/stephenkall/beans/products/jumping-beans
python3 spikes/a-cross-origin/serve.py 8182 spikes/a-cross-origin/engine
python3 spikes/a-cross-origin/serve.py 8183 spikes/a-cross-origin/partner
```

Open the consumer at `http://127.0.0.1:8182/` in a headed Chrome session with
the local WebMCP flag enabled. The page records its complete native evidence in
the visible JSON output: consumer/producer origins, isolation and API state,
iframe delegation, `toolchange` event support and lifecycle events, bounded
native discovery attempts, discovered tools, and the execution result. No cross-window message, HTTP capability endpoint, registry, bridge,
or fallback participates in the fixture.

The fixture uses exactly these reciprocal native grants:

- Consumer response: `Permissions-Policy: tools=(self "http://127.0.0.1:8183")`.
- Producer iframe: `allow="tools http://127.0.0.1:8183; cross-origin-isolated http://127.0.0.1:8183"`, before producer navigation.
- Producer registration: `exposedTo: ["http://127.0.0.1:8182"]`.
- Consumer discovery: `getTools({ fromOrigins: ["http://127.0.0.1:8183"] })`.

The default run uses origin-qualified iframe delegation. Run the one permitted
diagnostic control at `http://127.0.0.1:8182/?allow=bare` to use the native
baseline `allow="tools; cross-origin-isolated"` while preserving the same
header, frame timing, producer registration, and `fromOrigins` request. It is
not a fallback: it distinguishes an iframe-policy grammar/implementation
mismatch from absent embedded native discovery. A pass in this control supports
changing the application iframe policy to the proven baseline; failures in both
controls are runtime/spec evidence and remain STOP.

### Current minimal-fixture evidence

On 2026-08-31, the local fixture was served with the correct isolation and
origin policy at `127.0.0.1:8182` and `127.0.0.1:8183`. The Chrome profile
available to this checkpoint must be rejected as native evidence: its
`document.modelContext` included `codexGetTools` and `codexExecuteTool`
members. Those identify an extension-injected adapter rather than an
unmodified browser-native WebMCP surface.

Before the fixture began rejecting that adapter, both origin-qualified and
native-baseline iframe delegation returned an empty embedded discovery list.
That observation is diagnostic only and cannot be attributed to Chromium,
the application, or the WebMCP specification. The fixture now fails closed
when it sees those non-native members, so it cannot accidentally invoke or
present an adapter as WebMCP evidence.

This corrects a defect in the old spike itself: it embedded/discovered a stale
`localhost:8081` producer while the documented product fixtures used different
ports. It does **not** support an engine integration change. The exact blocker
for this minimal fixture is a fresh, headed, extension-free Chrome Stable
profile launched with the documented WebMCP flags, followed by the same fixture
in Canary. Only if both clean runs retain the failure can it be classified as a
browser/runtime or spec/implementation mismatch.

The local full-product origin-policy blocker has been repaired. The documented
four-unit run serves the engine on `8082` and partners on `8084–8086`, and
`spikes/a-cross-origin/serve.py` now emits the exact `tools` `Permissions-Policy`
allowlist for that engine while preserving the separate `8182/8183` minimal
fixture. `scripts/check-product.mjs` gates both mappings. This repair is
distinct from the minimal fixture and does not change the native transport or
product integration.

For an independent console capture, run:

```js
const origins = [
  "http://127.0.0.1:8084",
  "http://127.0.0.1:8085",
  "http://127.0.0.1:8086",
];

const allTools = await document.modelContext.getTools({ fromOrigins: origins });
const partnerTools = allTools.filter(
  (tool) => tool.name === "get_matching_deals" && origins.includes(tool.origin),
);
console.table(allTools.map(({ name, origin }) => ({ name, origin })));
console.log({
  modelContext: typeof document.modelContext,
  crossOriginIsolated,
  partnerTools: partnerTools.map(({ name, origin }) => ({ name, origin })),
});

const executions = await Promise.all(partnerTools.map(async (tool) => {
  const raw = await document.modelContext.executeTool(tool, {
    // Deliberately spans the three partner catalogs so this is an execution
    // probe, not a claim about any one persona's eligibility.
    categories: ["collar", "coffee", "watches"],
  });
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  return { origin: tool.origin, name: tool.name, value };
}));
console.log(executions);
```

Pass conditions:

- `modelContext` is `"object"` and `crossOriginIsolated` is `true`.
- `partnerTools` contains one tool for each exact local origin.
- `executions` contains three successful calls, each with a `deals` array.
- The engine UI reports three connected opted-in sites and labels the returned
  records with their partner origin/provenance.

An empty `partnerTools` array, a result containing only the engine's own tools,
or any missing partner origin is an embedded discovery failure even when the
same partner succeeds when opened directly.

## Chrome Stable / Canary matrix

The channel and complete version must be recorded from `chrome://version` for
every run. “Pass” means the exact checkpoint above, not merely that a partner
page loaded.

| Lane | Enablement | Required proof | Current result | Disposition |
|---|---|---|---|---|
| Chrome Stable, local | Headed; `--enable-features=WebMCP,WebMCPTesting`; local COOP/COEP/CORP and engine policy | Direct partner registration/execution, then embedded 3/3 discovery/execution | Minimal 8182/8183 fixture passes natively; full 3/3 still open | **OPEN / full-network run required** |
| Chrome Stable, deployed HTTPS | Headed; valid WebMCP origin-trial token on engine and every partner | Header check, direct checks, embedded 3/3, personalization, receipt | Production behavior is older and has no current 3/3 proof | **NOT PROVEN** |
| Chrome Canary, local | Headed; same WebMCP testing flag and local headers | Reproduce the minimal test and record API/policy differences | Minimal 8182/8183 fixture passes natively; full 3/3 still open | **OPEN / full-network run required** |
| Chrome Canary, deployed HTTPS | Headed; valid origin-trial enrollment | Reproduce the production checkpoint if Canary is used for the demo or video | Not yet recorded | **OPEN** |

The competition minimum is a fresh Stable production pass. Canary is required
before making a broad “Chrome-compatible” statement; a Canary regression in the
build selected for judging is a NO-GO for that build. A local pass alone does
not promote the production deployment to GO.

## Required browser and origin policy

### Local flagged run

- Use a headed Chrome window. Headless Chrome currently leaves
  `document.modelContext` undefined.
- Enable `--enable-features=WebMCP,WebMCPTesting` and relaunch Chrome.
- Use `http://localhost` or `http://127.0.0.1`; do not use `file://`.
- Every served unit must return:

  ```text
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Resource-Policy: cross-origin
  ```

- The engine's top-level response must also grant the three exact partner
  origins with `Permissions-Policy: tools=(...)`.
- Each engine iframe must delegate the feature to its target, currently:

  ```text
  allow="tools <partner-origin>; cross-origin-isolated <partner-origin>"
  ```

  `allow="tools"` without the top-level allowlist is insufficient when the
  inherited policy does not include the partner origin.

### Production HTTPS run

The engine and all three partners must each serve their own WebMCP
`Origin-Trial` token. Tokens do not transfer from the top-level document to an
iframe. The production response requirements are:

- every unit: COOP `same-origin`, COEP `require-corp`, CORP `cross-origin`, and
  a token for that exact origin;
- engine: an exact `Permissions-Policy` allowlist covering `self` and the
  three deployed partner origins;
- engine iframe: explicit `tools` and `cross-origin-isolated` delegation for
  the target partner origin;
- partner registration: `exposedTo` contains the exact engine origin in the
  second/options argument to `registerTool()`;
- engine discovery: `getTools({ fromOrigins: PARTNER_ORIGINS })` uses the same
  exact production origins as the policy and partner registration.

Verify headers before browser execution:

```bash
curl -sI https://jumping-beans-engine.steve-k-kall.workers.dev/
curl -sI https://petsupply.pages.dev/
curl -sI https://coffee-amk.pages.dev/
curl -sI https://watch-ce8.pages.dev/
```

Do not claim a production pass while the deployed HTML/JS or policy headers
are the older baseline, even if the local source contains the fix.

## Direct versus embedded discovery

### Direct partner acceptance

Open each partner as a top-level page in the same fresh Chrome profile:

```text
http://127.0.0.1:8084/
http://127.0.0.1:8085/
http://127.0.0.1:8086/
```

For each page, capture:

```js
typeof document.modelContext;
crossOriginIsolated;
(await document.modelContext.getTools()).map(({ name, origin }) => ({ name, origin }));
```

The expected direct result is a native registered
`get_matching_deals` tool on each partner origin, followed by a successful
native `executeTool()` call. This proves partner registration and direct
execution only. It does not prove that the engine can see the tool.

### Embedded engine acceptance

Open the engine after the partner frames have loaded and run the minimal
reproduction above. The returned tool list must be partitionable into:

- the engine's own top-level tools, such as `get_journey_receipt` and
  `set_display_preferences`; and
- exactly three partner tools named `get_matching_deals`, with one exact tool
  origin for each configured partner.

The current observation is that the first group is present but the second
group is empty. Record this as “embedded discovery: top-level tools only,” not
as a partner outage and not as a 0/3 execution result. It is a policy/runtime
acceptance failure that blocks the network claim.

## 3/3 execution contract

Once embedded discovery returns all three tools, execute through the engine's
caller context, not through a method on the returned tool object:

```js
const results = await Promise.all(partnerTools.map(async (tool) => {
  const raw = await document.modelContext.executeTool(tool, {
    categories: ["collar", "coffee", "watches"],
  });
  return { tool, value: JSON.parse(raw) };
}));
```

The acceptance record must show for every origin:

- one invocation started and one terminal outcome;
- a JSON-serializable response string (or a documented native object result
  from the tested Chrome build) parsed into `{ deals: [...] }`;
- a validated envelope and valid deal records; and
- a visible origin/provenance label in the engine result.

The resolver may independently classify a partner as `ready`, `no-match`,
`invalid`, `timeout`, or `failed`. For the dedicated 3/3 execution probe,
each partner must be `ready` with at least one returned deal. A mixed failure
run is a separate negative test and must retain the failed origin in the
receipt.

## Personalization acceptance

Run personalization only after the raw cross-origin probe is recorded:

1. Start fresh with no saved memory and confirm the engine describes the
   request as anonymous. Partner calls must not contain persona categories or
   budget ceilings.
2. Enable the clearly labeled demo context through the page control. Capture
   the approval state, recipient, purpose, fields, and request-only retention.
3. Re-run the feed. The projected partner input may contain only the approved
   categories and price ceiling for the exact opted-in origin.
4. Apply a presentation choice either with “Save and apply to Site B” or with
   “Apply once without saving.” The latter must remain non-persistent.
5. Confirm that personalization changes eligibility/ranking or presentation,
   never the source facts, partner authorization, or provenance labels.

| State | Partner projection | Acceptance meaning |
|---|---|---|
| Anonymous/default | Empty persona-derived categories and ceilings | Passes privacy default |
| Explicit demo approval | Approved categories/ceiling, exact opted-in recipient, request-only retention | Passes consented personalization |
| Draft preference before apply | Not transmitted as an applied preference | Passes staged-control semantics |
| Apply once | Used for this journey, not saved | Passes non-persistent option |

Do not count a personalized fallback card as WebMCP evidence. It is only a
network acceptance pass when the approved context reaches successfully
discovered native partner tools.

## Receipt acceptance

After discovery, execution, and ranking, call the engine's native read-only
`get_journey_receipt` tool and save the returned JSON as evidence. The receipt
must include, directly or through its event trail:

- journey, request, and context snapshot identifiers;
- capability/version (`offers.discover@1.0.0`);
- exact connected partner origins;
- each origin's status, reason, returned count, considered count, eligible
  count, and exposed count;
- the anonymous or explicitly approved context source and disclosure;
- invocation, exposure, success/failure, and decision events; and
- the final decision counts and reason.

The evidence must not contain raw confirmation grants, session values, raw
idempotency keys, credentials, or unnecessary personal data. A receipt that
only says “three sites connected” without per-origin outcomes is insufficient.

For the Watch declarative surface, separately capture the native form metadata
(`toolname`, `tooldescription`, `toolautosubmit`, and parameter descriptions),
the `agentInvoked` submission event, the native `respondWith()` result, and the
redacted Watch action receipt if that write path is part of the submitted
demo. The checkbox must still require explicit page confirmation; a form being
discoverable is not proof that a consequential write was authorized.

## Failure-mode matrix

| Failure | Required classification | Competition effect |
|---|---|---|
| `document.modelContext` undefined | Runtime not enabled, not origin-isolated, headless, or unsupported build | NO-GO for that lane |
| `SecurityError` or frame load failure | COOP/COEP/CORP or embedding problem | NO-GO for embedded claim |
| `NotAllowedError` | Missing/incorrect `tools` policy or iframe delegation | NO-GO |
| Full local engine on `8082` has no top-level `tools` policy | Repaired; both local policy mappings are now deterministic-gate assertions | Re-run the full local 3/3 native journey |
| Direct partner passes, embedded list contains only engine tools | Embedded discovery/policy failure | Current **NO-GO**; do not call it 3/3 |
| Empty partner discovery | No native partner capability observed | NO-GO for network claim |
| Duplicate or unexpected origin/tool name | Allowlist or registration mismatch | NO-GO; do not invoke it |
| `executeTool()` rejects or returns malformed JSON/envelope | Native invocation/result failure | That origin fails; 3/3 fails |
| Partner returns no deals | Valid `no-match` outcome | Negative-test pass; not a 3/3 ready execution |
| Partner exceeds deadline | Valid `timeout` outcome | Negative-test pass; 3/3 fails |
| One partner fails while others succeed | Partial network result | Degraded receipt may pass negative test; competition 3/3 fails |
| Missing/invalid origin-trial token in production | WebMCP unavailable on that origin | Production NO-GO |
| Production page is stale | Deployed artifact does not represent accepted source | Production NO-GO |
| Receipt omits origin/outcome or leaks secrets | Evidence/audit failure | NO-GO until recaptured |
| Persona data appears before approval | Consent boundary failure | NO-GO |

## Evidence capture checklist

For every acceptance run, retain a folder or bundle containing:

- date/time, Chrome channel and full version, OS, headed/headless state, and
  the exact feature flag;
- fresh-profile note and the four URLs used;
- response headers for every origin, including the engine's
  `Permissions-Policy` and each origin's `Origin-Trial` presence;
- direct partner `modelContext`/isolation/tool-registration output;
- embedded `allTools` and `partnerTools` output with names and origins;
- one execution record per partner, including parsed result or failure;
- screenshots of the engine status rail, origin/provenance labels, and
  personalization disclosure;
- the exported journey receipt and any Watch receipt, redacted for secrets;
- the negative-case output for at least one missing/failed partner; and
- the final operator decision tied to the exact checkpoint in this document.

The deterministic product gate remains useful corroborating evidence:

```bash
cd /Users/stephenkall/beans/products/jumping-beans
node scripts/check-product.mjs
git diff --check
```

It cannot substitute for the headed browser's native cross-origin discovery
and execution evidence.

## Final go/no-go rule

**GO** only after a fresh production HTTPS run shows, in the engine's native
WebMCP result, one partner tool for each of the three exact origins, three
successful validated executions, explicit personalization behavior, and a
redacted per-origin journey receipt. Stable is the minimum competition lane;
Canary must be separately recorded before claiming cross-channel Chrome
compatibility.

**NO-GO** if direct tools work but the embedded engine returns only its
top-level tools, if any required production origin lacks the correct policy or
trial token, if fewer than three partner executions complete, or if the
receipt/personalization evidence is missing. This is the current state.

## Source records

- [`docs/P0_FINAL_ACCEPTANCE_REVIEW.md`](P0_FINAL_ACCEPTANCE_REVIEW.md) —
  current headed-Chrome finding, production staleness, and prior evidence.
- [`docs/HANDOFF.md`](HANDOFF.md) — current local ports, policy fix status,
  Chrome gotchas, and remaining production verification.
- [`docs/origin-trial.md`](origin-trial.md) — trial enrollment and per-origin
  token requirements.
- [`docs/CLOUDFLARE_DEPLOY.md`](CLOUDFLARE_DEPLOY.md) — deployment and header
  verification requirements.
- [`engine/app.js`](../engine/app.js) and [`engine/index.mjs`](../engine/index.mjs)
  — native discovery, execution, receipt, iframe delegation, and engine policy
  implementation.
