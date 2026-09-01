# Jumping Beans — Native WebMCP aggregation architecture

Status: proposed architecture for the next product phase  
Date: 2026-09-01  
Constraint: native WebMCP only

## Decision

Jumping Beans should add a two-tier capability model:

```text
Main engine
  -> one native Network Aggregator tool
       -> native partner tool A
       -> native partner tool B
       -> native partner tool C

Main engine
  -> direct native partner tool
       for detail, proof, verification, or an explicitly demonstrated action
```

The main engine should not create and orchestrate every partner frame on every
journey as the default product path. It should discover one allowlisted native
aggregation origin and ask it for a bounded network result.

The aggregator is a browser page and a native WebMCP producer/orchestrator. It
is not a server-side capability gateway. Its fan-out must still use the native
browser path—partner `registerTool()`, exact Permissions Policy, exact iframe
delegation, `getTools({ fromOrigins })`, and `executeTool()`.

This means aggregation reduces the main engine's integration surface and page
startup work; it does not make the underlying partner calls disappear. A system
that returns partner capabilities without native partner calls would require a
different data or invocation transport and is outside the competition
constraint.

## Why the current shape will not scale

The current engine creates one iframe per partner and fans out from
`discoverPartnerDeals()`. As the number of partners grows, the main page pays
for every partner's:

- frame creation and cross-origin policy delegation;
- native registration timing and `toolchange` reconciliation;
- discovery and execution deadline;
- failure, validation, and provenance state; and
- browser memory and startup cost.

The current pattern remains valuable as a direct WebMCP inspection mode. It is
the right proof that Jumping Beans can work across independent origins, but it
should not be the only production topology.

## Aggregator contract

The aggregator should expose one read-oriented native tool such as
`resolve_network_offers`. Its result must retain network visibility rather than
flattening the partner graph:

- normalized offers with the exact partner origin and tool name;
- per-origin status: ready, no-match, timeout, invalid, or failed;
- returned, considered, eligible, and exposed counts;
- partner-provided provenance and verification language;
- request and context-snapshot identifiers without raw secrets; and
- the aggregator origin as orchestration provenance.

The main engine continues to own authorization, ranking, presentation, user
confirmation, and the final decision receipt. The aggregator owns bounded
parallel fan-out and per-origin isolation. A partner remains the authority for
its own catalog and consequential actions.

## Personalization and privacy

Aggregation must not become a new unrestricted recipient of user context.

- Anonymous discovery sends no persona categories or budget.
- Explicit demo context may be projected only to the approved partner origins.
- The aggregator may receive only the minimum normalized request fields needed
  to orchestrate that approved query; it must not receive an identity or an
  entire persona object by default.
- The receipt must show the aggregator and each partner as separate recipients,
  with the fields, purpose, and request-only retention.
- Direct detail or action calls require their own partner-specific scope and
  confirmation; an aggregate read grant must not authorize a write.

## Scaling controls

The first aggregator should make the following controls explicit:

1. Lazy-load the aggregator only when a network resolution is requested.
2. Load partner frames only for relevant category or vertical shards.
3. Bound partner concurrency and enforce an independent deadline per origin.
4. Coalesce `toolchange` events into one fresh native reconciliation.
5. Keep cache lifetime to the current journey unless the user explicitly saves
   something; never treat a cache as a capability registry.
6. Preserve direct partner inspection as an opt-in diagnostic/demo mode.

At larger scale, use multiple native aggregators by vertical or geography, with
the main engine calling the smallest allowlisted set for the user's intent. A
static policy allowlist may choose which aggregator origin is trusted; it must
not substitute for browser-native capability discovery.

## Migration plan

### Phase 0 — nested WebMCP spike

Build a two-partner aggregator fixture. The aggregator page should embed two
partners, grant exact `tools` and `cross-origin-isolated` permissions before
navigation, discover each partner natively, execute both reads, and return a
per-origin result to the main engine through one native aggregator tool.

This phase must answer the browser question first: whether the chosen Chrome
Stable and Canary builds expose native tools across the nested frame tree with
the required inherited Permissions Policy. If nested discovery is not supported,
stop and retain the current engine-side fan-out rather than adding a non-native
bridge.

### Phase 1 — parallel shadow path

Keep the current direct engine fan-out and add the aggregator behind an explicit
diagnostic switch. Compare tool names, origins, counts, outcomes, provenance,
personalization projections, and receipts. No production default changes yet.

### Phase 2 — aggregated read default

Make the aggregator the default path for read-only offer discovery after Stable
and Canary acceptance. Retain direct partner calls for selected capability
demonstrations and partner detail views.

### Phase 3 — direct action boundaries

Keep consequential actions partner-specific. The aggregator may coordinate an
action journey, but it must not silently convert an aggregate read into a write.
Each action remains a native WebMCP call with its own exact origin, scope,
confirmation, replay protection, and receipt.

## Acceptance gates

The aggregation design is accepted only when:

- the main engine makes one native aggregator discovery call;
- the aggregator makes only native partner discovery/execution calls;
- no bridge, direct capability endpoint, server invocation gateway, substitute
  registry, polyfill, or fallback transport appears anywhere in the path;
- one partner timeout or malformed response does not erase other results;
- all partner origins, tool names, counts, statuses, and provenance survive the
  aggregation boundary;
- anonymous and explicitly approved context remain distinguishable; and
- direct partner inspection still demonstrates what an independent WebMCP site
  can expose and execute.

## Recommendation for Jumping Beans

Do not rewrite the current working prototype yet. Freeze it as the direct
inspection baseline, then build the nested two-partner aggregator spike as the
next architecture checkpoint. If it passes in both clean browser channels,
promote it to the default read path. If it fails because nested native
discovery is not supported, keep the engine-side fan-out and scale it with lazy
shards, bounded concurrency, and strong per-origin receipts.
