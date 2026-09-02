# Jumping Beans production acceptance addendum — 2026-09-02

This addendum records observed production evidence after the v0.5.3 deployment and the narrow native WebMCP input-compatibility fix. Receipts, action identifiers, grants, session identifiers, and other credentials are intentionally redacted.

## Observed evidence

| Gate | Evidence | Status |
| --- | --- | --- |
| Desktop Chrome Stable native WebMCP | Clean Chrome Stable `151.0.7922.174` (official arm64 build, dedicated profile, no OpenAI extension). `document.modelContext` was present and `crossOriginIsolated` was `true`. Native allowlisted discovery returned exactly one `get_matching_deals` tool from each of Petsupply, Coffee Co, and Watch Co. Direct native execution returned 2 / 9 / 24 offers. After the production fix, the user-visible personalized journey reported Petsupply `ready · 15 eligible · 10 exposed`, Coffee Co `ready · 9 eligible · 2 exposed`, and Watch Co `no-match · 0 eligible · 0 exposed`; the adapted partner offer and comparison rendered. | PASS for observed desktop native journey |
| Same-account hydration | A clean independent Chrome profile showed no saved product notes before sign-in. After signing in as the existing Bean Labs account, it showed two saved product notes and the hosted account panel confirmed two account notes. | PASS for independent-profile hydration; physical cross-device observation remains open |
| Production session expiry / reauthentication | Removed from the strict acceptance list by decision on 2026-09-02. No production session TTL or expiry enforcement was changed. | REMOVED FROM GATE |
| Watch two-session record path | Two independent browser sessions each staged and explicitly confirmed the same approved catalog SKU and target price in production. Both displayed a server-authoritative committed receipt and the non-notification / non-purchase outcome. The merchant view then showed 4 active signals for that SKU, median and range `$123.45`, from deployed D1-backed storage. | PASS for two-session record and receipt observation |
| Watch replay | The deployed production UI's manual replay control returned the original redacted receipt with `replayed: true`; retention was not extended and the aggregate did not gain a duplicate from replay. | PASS |
| Watch cross-session isolation | A production probe with two server-issued sessions rejected session B attempting to commit session A's staged action with HTTP `403 confirmation-binding-mismatch`. Each session then committed its own action with HTTP `201`; a same-payload replay returned HTTP `200` with `replayed: true`. No receipt or credential values were retained in this record. | PASS |

## Implementation note

The engine's existing JSON compatibility retry now recognizes Chromium's observed `UnknownError: Failed to parse input arguments` response. No transport, bridge, registry, endpoint, gateway, polyfill, or fallback transport was added. The corrected engine was deployed to the production Worker and passed the 517-assertion product check before deployment.

## Release decision

Jumping Beans remains an operationally released public demo. Strict competition readiness is not declared: physical cross-device hydration is the remaining acceptance gate and pinned next priority.
