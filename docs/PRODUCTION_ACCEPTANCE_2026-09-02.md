# Jumping Beans production acceptance addendum — 2026-09-02

This addendum records observed production evidence after the v0.5.3 deployment and the narrow native WebMCP input-compatibility fix. Receipts, action identifiers, grants, session identifiers, and other credentials are intentionally redacted.

## Observed evidence

| Gate | Evidence | Status |
| --- | --- | --- |
| Desktop Chrome Stable native WebMCP | Clean Chrome Stable `151.0.7922.174` (official arm64 build, dedicated profile, no OpenAI extension). `document.modelContext` was present and `crossOriginIsolated` was `true`. Native allowlisted discovery returned exactly one `get_matching_deals` tool from each of Petsupply, Coffee Co, and Watch Co. Direct native execution returned 2 / 9 / 24 offers. After the production fix, the user-visible personalized journey reported Petsupply `ready · 15 eligible · 10 exposed`, Coffee Co `ready · 9 eligible · 2 exposed`, and Watch Co `no-match · 0 eligible · 0 exposed`; the adapted partner offer and comparison rendered. | PASS for observed desktop native journey |
| Same-account hydration | A clean independent Chrome profile showed no saved product notes before sign-in. After signing in as the existing Bean Labs account, it showed two saved product notes and the hosted account panel confirmed two account notes. | PASS for independent-profile hydration; physical cross-device observation remains open |
| Production session expiry / reauthentication | Not observed. The requested seven-day wait was declined; no shortened TTL or synthetic success was substituted. | OPEN / intentionally unobserved |
| Watch two-session record path | Two independent browser sessions each staged and explicitly confirmed the same approved catalog SKU and target price in production. Both displayed a server-authoritative committed receipt and the non-notification / non-purchase outcome. The merchant view then showed 4 active signals for that SKU, median and range `$123.45`, from deployed D1-backed storage. | PASS for two-session record and receipt observation |
| Watch replay | The production UI has no replay control. A fresh replay candidate was staged, but the final replay write was blocked by the browser action-time confirmation boundary before execution. | OPEN |
| Watch cross-session isolation | The two sessions committed independently, but an adversarial attempt to use one session's staged action in the other was not observed in this run. | OPEN |

## Implementation note

The engine's existing JSON compatibility retry now recognizes Chromium's observed `UnknownError: Failed to parse input arguments` response. No transport, bridge, registry, endpoint, gateway, polyfill, or fallback transport was added. The corrected engine was deployed to the production Worker and passed the 517-assertion product check before deployment.

## Release decision

Jumping Beans remains an operationally released public demo. Strict competition readiness is not declared: production expiry/reauthentication, physical cross-device hydration, Watch replay, and adversarial Watch session isolation still require real evidence.
