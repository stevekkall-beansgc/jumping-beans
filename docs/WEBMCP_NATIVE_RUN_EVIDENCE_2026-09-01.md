# Jumping Beans — Native WebMCP Run Evidence

Date: 2026-09-01  
Scope: local native WebMCP acceptance after the 8082 policy recovery  
Decision: **LOCAL CONNECTED-PROFILE LANE STOP; PUBLIC CLEAN-PROFILE ACCEPTANCE PASS**

## What was run

The local servers were refreshed from the current working tree:

- Minimal consumer: `http://127.0.0.1:8182/`
- Minimal producer: `http://127.0.0.1:8183/`
- Full engine: `http://127.0.0.1:8082/`
- Full partners: `http://127.0.0.1:8084/`, `:8085/`, and `:8086/`

The deterministic product gate passed **407 assertions** and `git diff --check`
passed before the browser runs.

## Minimal two-origin fixture

Both permitted iframe-policy modes were run in the connected external Chrome
profile:

| Mode | Isolation | API state | Native admissibility | Discovery/execution |
|---|---:|---|---:|---|
| Origin-qualified | `true` | `modelContext: object` | **false** | Not attempted; fixture failed closed |
| Bare diagnostic control | `true` | `modelContext: object` | **false** | Not attempted; fixture failed closed |

Both runs reported these non-native members:

```text
codexExecuteTool
codexGetTools
```

The fixture therefore correctly reported:

```text
native WebMCP evidence is invalid in this profile
```

This is not a WebMCP pass or fail. It is an invalid evidence lane: the
connected browser injects the ChatGPT adapter, so an empty discovery result
cannot be attributed to Chromium or the application.

## Full local engine

The full engine page loaded at `http://127.0.0.1:8082/` and rendered the normal
personalized offer journey. The native network result was:

- 0 connected partner tools;
- Petsupply, Coffee Co, and Watch Co each reported `failed · 0 eligible · 0 exposed`;
- each partner frame logged `document.modelContext` as undefined before
  `registerTool()` could run.

This is the same contaminated-browser condition, not evidence against the
repaired 8082 response policy. The local server now has separate deterministic
policy checks for the full `8082 -> 8084/8085/8086` path and the minimal
`8182 -> 8183` path.

## Channel/evidence status

The user supplied valid native captures from both isolated profiles. The
captures used the default origin-qualified iframe policy and show:

| Lane | Version | Native surface | Discovery | Execution | Result |
|---|---|---:|---|---|---|
| Chrome Canary | `151.0.7922.174` | `true` | One `get_items` tool from `127.0.0.1:8183` | Coffee item returned at `$12` | **PASS** |
| Chrome Stable | `152.0.7977.65` | `true` | One `get_items` tool from `127.0.0.1:8183` | Coffee item returned at `$12` | **PASS** |

Both captures show `crossOriginIsolated: true`, only the native
`constructor/executeTool/getTools/ontoolchange/registerTool` surface, no
`codex*` members, a native `toolchange` event, and `error: null`. This is valid
minimal native WebMCP evidence. No bridge, direct capability endpoint, server
gateway, registry, polyfill, or fallback transport participated.

The remaining acceptance sequence is:

1. Run the full 8082 engine with all three partner origins in clean Stable.
2. Repeat the full three-partner journey in clean Canary.
3. Capture the personalized journey, per-origin outcomes, and decision receipt.

## Full-engine discovery evidence

The user supplied a clean local full-engine capture from `http://127.0.0.1:8082/`.
It shows:

- `Open inventory ready. 3 opted-in sites connected: Petsupply, Coffee Co, Watch Co.`
- `WebMCP · 3 opted-in sites`
- the three partner origins discovered through the native engine path;
- no adapter members or fallback capability transport in the capture.

The Concierge card still shows the illustrative preview because the default
journey is anonymous. With the demo profile unchecked, the engine intentionally
sends no categories to partner tools, so valid partner calls can return empty
deal sets. This is an expected privacy state, not a discovery failure.

Full execution/personalization evidence remains one user-controlled action
short: enable the clearly labeled Alex demo profile, choose `Apply once without
saving`, and capture the resulting per-origin statuses and decision receipt.
That action is the approved test context; it does not save a profile.

## Personalized execution evidence

The user supplied a follow-up clean-browser capture after enabling the labeled
Alex demo profile. It shows:

- the profile checkbox enabled;
- the user-controlled presentation rule `Price proof` selected;
- a Site B card labeled `Site B · adapted by an opted-in partner`;
- Coffee Co as the partner;
- the offer `Caramel Cold Brew Latte` at `$39.99`, listed at `$47.99`;
- the explanation `Matched through an opted-in WebMCP offer tool and rendered
  using your applied display rules.`

This is valid evidence of native partner execution plus scoped personalization
for at least one partner origin. The capture does not include the lower Network
view or the exported journey receipt, so it does not yet prove the complete
three-origin execution record. Those must show each of Petsupply, Coffee Co, and
Watch Co's invocation outcome and the corresponding decision counts.

The lower Network view subsequently captured from the same pre-fix run reported
`Petsupply: invalid · 0 eligible · 0 exposed`, `Coffee Co: ready · 9 eligible ·
9 exposed`, and `Watch Co: no-match · 0 eligible · 0 exposed`. Investigation
found that Alex's categories matched 25 Petsupply records while the engine
contract permits at most 24; the invalid classification was therefore correct.

Terra repaired this P0 producer-contract issue by enforcing the 24-record cap
in all three native partner producers and adding deterministic gate assertions.
The product gate now passes **413 assertions**. The refreshed post-fix capture
is the authoritative network result; the pre-fix screenshot is retained as
diagnostic evidence only.

The user supplied post-fix evidence showing the full engine's two successful
partner executions and one valid no-match result:

| Partner | Status | Eligible | Exposed |
|---|---|---:|---:|
| Petsupply | `ready` | 15 | 10 |
| Coffee Co | `ready` | 9 | 2 |
| Watch Co | `no-match` | 0 | 0 |

This confirms that the Petsupply response now validates and that native partner
execution succeeds for both relevant partner catalogs. Watch Co's `no-match`
is valid for Alex's approved categories; it is not a failed WebMCP invocation.

## Conclusion

The application recovery is complete and mechanically gated. Clean minimal
discovery passes in Stable and Canary, plus the post-fix full-engine network
capture, are recorded above. The final public clean-profile run below closes
the full personalized journey acceptance sequence.

## Clean-profile preparation

On 2026-09-01, two isolated, temporary browser profiles were created without
removing or changing the ChatGPT extension in the user's normal profile:

- Stable profile: `/private/tmp/jb-webmcp-stable-profile`, launched with
  `--enable-features=WebMCP,WebMCPTesting`; reported Chrome `152.0.7977.65`.
- Canary profile: `/private/tmp/jb-webmcp-canary-profile`, launched with the
  same WebMCP flags; reported Chrome `151.0.7922.174`.

The Codex browser connector is not attached to these isolated profiles because
they intentionally do not contain the connector extension. The user captured
the visible fixture JSON directly, which is sufficient for this minimal-lane
acceptance record.

## Final public clean-profile acceptance run

On 2026-09-01, the deployed engine was tested at:

`https://jumping-beans-engine.steve-k-kall.workers.dev/`

The run used a Chrome Canary incognito window with no ChatGPT extension
sidepanel. The public page reported native WebMCP discovery of all three
opted-in partner origins:

- Petsupply
- Coffee Co
- Watch Co

The anonymous default first returned no persona-derived partner matches, as
required by the privacy contract. The labeled Alex demo profile was then
explicitly enabled for this request, and the user-controlled `Price proof`
presentation was applied with `Apply once without saving`.

The resulting public journey showed:

- Site B labeled `adapted by an opted-in partner`;
- Petsupply's `Cushioned Dog Harness` at `$48.00`, with partner provenance;
- native WebMCP explanation for the matched offer;
- `Petsupply ready · 15 eligible · 10 exposed`;
- `Coffee Co ready · 9 eligible · 2 exposed`;
- `Watch Co no-match · 0 eligible · 0 exposed`;
- `Nothing is saved` in browser memory.

The engine's read-only `get_journey_receipt` was also discovered through the
native `getTools()` surface and invoked with the browser's serialized native
`executeTool()` form. The returned receipt included a journey identifier,
request/context identifiers, `explicit-demo-context`, and the decision/event
record for the completed run. No raw grants, credentials, or user profile data
were retained in this packet.

The final source gate passed **414 assertions** and `git diff --check` passed.
The released tree remains clean at `v0.3.0` / `48782ae`.
