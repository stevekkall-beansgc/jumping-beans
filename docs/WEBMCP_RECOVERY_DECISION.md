# Jumping Beans native WebMCP recovery decision

Date: 2026-08-31  
Scope: smallest legitimate path to a working native WebMCP prototype  
Decision: **STOP / repair the local acceptance path, then rerun in a clean native runtime**

## Decision

Jumping Beans remains a native WebMCP product. The only accepted capability
path is:

```text
partner registerTool(..., { exposedTo })
  -> browser Permissions Policy and frame tree
  -> engine getTools({ fromOrigins })
  -> engine executeTool(registeredTool, serializedInput)
  -> partner-owned execute callback
```

No bridge, alternate registry, direct capability endpoint, server invocation
gateway, polyfill, or fallback transport is permitted.

The smallest recovery path is two ordered steps:

1. Restore the missing local full-engine `Permissions-Policy` mapping without
   changing the corrected two-origin fixture.
2. Run the fixture and then the full 3/3 engine in a fresh, extension-free,
   headed Chrome profile with the native WebMCP flags.

There is no basis yet for a browser-defect claim. The corrected fixture has not
run in a clean native profile. The local 3/3 serving-path policy regression has
been repaired and is now covered by the product gate.

## Diagnosis

### 1. Remaining application/spec integration defect: confirmed and fixable

The production Worker source in `engine/index.mjs` emits an exact
`Permissions-Policy: tools=(self <three production partner origins>)` header.
The full local instructions, however, serve the engine with:

```text
python3 spikes/a-cross-origin/serve.py 8082 engine
```

The recovery update now emits the exact three-partner `tools` response policy
on port `8082`, while preserving the minimal `8182` to `8183` mapping. Because
an iframe `allow` attribute cannot expand a feature denied by the inherited
top-level policy, this response policy is required for the documented local
full-engine path.

This was a narrow acceptance-harness regression: the prior 8082 mapping was
replaced when the 8182/8183 fixture was corrected. It has been repaired without
changing partner registration, the resolver, personalization, receipts, or
the native-only architecture.

The application lifecycle logic is otherwise aligned with the current native
contract at this checkpoint: the partner tools await `registerTool()` with
exact `exposedTo` origins; the engine installs `toolchange` reconciliation
before partner navigation; the frames receive a `tools` delegation before
`src`; discovery is bounded and uses exact `fromOrigins`; and execution stays
on `document.modelContext.executeTool()`.

### 2. Clean-runtime/evidence problem: confirmed and currently decisive

The installed lanes are Chrome Stable `151.0.7922.174` and Chrome Canary
`154.0.8035.0`. The available browser-managed profile is not admissible native
evidence. A fresh read-only run of the corrected fixture reported:

```text
crossOriginIsolated: true
modelContext: object
nonNativeMembers: [codexExecuteTool, codexGetTools]
nativeSurface: false
error: non-native modelContext adapter detected
```

The fixture correctly stopped before partner navigation, discovery, or
execution. Therefore its empty tool list says nothing about native Chromium
cross-origin behavior. Direct partner success from earlier runs proves only
top-level registration and execution, not embedded network discovery.

Required clean-runtime evidence must record the channel and full version,
exact flags, fresh extension-free profile, response headers, frame policy,
consumer and producer API members, awaited registration result, discovery
attempts, returned tool names/origins, execution output, and console errors.
No evidence may be mixed between profiles or channels.

### 3. Browser implementation limitation: unproven

The current WebMCP draft and Chrome's current imperative API documentation
define native cross-origin iframe discovery through `allow="tools"`, exact
`exposedTo`, exact `fromOrigins`, and caller-side `executeTool()`. Chromium also
has cross-origin `getTools()` and `executeTool()` coverage in its Web Platform
Tests. That makes a clean native reproduction mandatory before blaming the
browser.

Classify a browser implementation limitation only when the minimal all-grants
fixture fails in a clean supported lane after both iframe-policy forms are
tested:

- origin-qualified: `tools http://127.0.0.1:8183`;
- native baseline: `allow="tools"` via `?allow=bare`.

If the baseline passes and the origin-qualified form fails, this is an iframe
policy grammar/implementation integration issue; use the proven native
baseline in the application. If both forms fail in one channel but another
passes, it is a channel/build limitation. If both fail in clean Stable and
Canary with successful embedded registration and correct effective policy,
prepare an upstream browser reproduction and keep the competition STOP.

## Exact Terra implementation requirements

Terra owns one bounded recovery slice. It must not change the capability
transport or broaden product scope.

1. Preserve the 8182 minimal mapping exactly:

   ```text
   8182 -> tools=(self "http://127.0.0.1:8183")
   ```

2. Add a separate 8082 full-engine mapping using only the exact local partner
   origins:

   ```text
   8082 -> tools=(self
     "http://127.0.0.1:8084"
     "http://127.0.0.1:8085"
     "http://127.0.0.1:8086")
   ```

   Standardize the recovery run on `127.0.0.1` end to end. Do not add a
   wildcard. Do not remove COOP, COEP, or CORP.

3. Extend the deterministic gate so it independently asserts both port-policy
   mappings. A check that only proves the 8182 fixture is insufficient.

4. Preserve all current native invariants: exact `exposedTo` and
   `fromOrigins`, policy before navigation, awaited registration, bounded
   discovery retries, `toolchange` as a reconciliation trigger rather than a
   registry, exact returned tool name/origin checks, and caller-side
   `executeTool()` with serialized input.

5. Make no partner/resolver/receipt change based on the contaminated-profile
   result. Make no iframe-policy change unless clean evidence shows that
   `?allow=bare` passes while the origin-qualified form fails. In that one
   case, change only the iframe delegation to the proven native baseline while
   retaining the exact top-level response allowlist.

6. Keep the fixture's `codex*` rejection. Do not call, wrap, rename, hide, or
   accept extension-added methods as native evidence.

7. Run the product gate and `git diff --check`. Refresh the generated engine
   bundle only if an engine source file changes. Do not deploy, commit, tag, or
   release.

## Recovery acceptance checkpoint

### Checkpoint A: minimal native proof

In a fresh extension-free headed Stable profile with the recorded WebMCP
flags, the 8182 consumer must show all of the following in one run:

- `crossOriginIsolated === true`;
- no `codex*` member on `document.modelContext`;
- the 8183 producer visibly reports successful awaited registration;
- `getTools({ fromOrigins: ["http://127.0.0.1:8183"] })` returns exactly one
  `get_items` tool whose origin is `http://127.0.0.1:8183`;
- `executeTool()` returns the expected bounded item result;
- the no-`allow`, wrong-`exposedTo`, and omitted-`fromOrigins` controls fail
  closed.

Run both the origin-qualified and `?allow=bare` forms and record which policy
form passes. Repeat in Canary before making a cross-channel claim.

### Checkpoint B: local Jumping Beans 3/3 proof

Only after Checkpoint A passes, serve the full engine on 8082 and partners on
8084, 8085, and 8086 using `127.0.0.1`. Capture the 8082 response header before
opening the engine. Acceptance requires:

- exactly one `get_matching_deals` tool from each exact partner origin;
- three calls through the engine's native `executeTool()` path;
- three parseable and schema-valid partner results with per-origin provenance;
- the engine status rail reports three connected sites;
- anonymous context sends no persona-derived fields;
- explicitly approved request-scoped context changes the native partner input
  and resulting resolution without changing authorization or provenance;
- one no-match and one malformed/timeout run preserve healthy origins and
  produce honest per-origin receipts;
- the deterministic gate remains green at the 394-assertion baseline or higher,
  and `git diff --check` passes.

Passing Checkpoints A and B restores a working local native WebMCP prototype.
It does not grant competition GO.

### Competition GO remains separate

Competition GO still requires the existing production checkpoint: a fresh
headed Stable HTTPS run on the four actual origins, valid per-origin trial
enrollment and headers, exactly 3/3 embedded discovery and validated execution,
personalization evidence, a redacted per-origin journey receipt, and two fresh
end-to-end runs from clean browser state. No deployment is authorized by this
decision.

## Evidence reviewed

- `docs/PROJECT_PLAN.md`
- `docs/WEBMCP_ONLY_ARCHITECTURE_SECURITY_REVIEW.md`
- `docs/WEBMCP_COMPETITION_ACCEPTANCE.md`
- `docs/P0_FINAL_ACCEPTANCE_REVIEW.md`
- `README.md`
- `docs/HANDOFF.md`
- `engine/index.mjs`, `engine/app.js`, `engine/config.js`
- all three partner `tool.js` producers
- `spikes/a-cross-origin/`
- `scripts/check-product.mjs`
- WebMCP draft and explainer
- Chrome WebMCP imperative API documentation and Blink trial record
- Chromium cross-origin WebMCP Web Platform Test records

Read-only verification completed with `node scripts/check-product.mjs`. The
user-provided baseline was 394 assertions; the recovered current working-state
run passes 407 assertions, including independent checks for both local policy
paths. `git diff --check` also passes. No deployment, cloud resource, commit,
tag, or release was created by this decision.
