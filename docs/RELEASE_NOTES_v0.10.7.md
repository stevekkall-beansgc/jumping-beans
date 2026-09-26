# Jumping Beans v0.10.7

This patch makes the first self-serve native WebMCP journey reliable when a
shopper acts before all three member-site tools have appeared in Chrome's
registry.

Final QA on v0.10.6 performed the Coffee selection immediately after page load,
before any direct registry probe. Two of five fresh sessions settled at a
partial native result and never recovered. The prior receipt polled the registry
before the shopper action, which warmed the path and masked this startup race.

The Engine now waits for the partner-frame bootstrap, retries a partial registry
until every allowlisted origin appears or the bounded deadline expires, and
keeps discovery results isolated until the current request owns the UI update.
Foreground shopper journeys take priority over queued or active `toolchange`
reconciliation, and one final coalesced reconciliation runs afterward. This
prevents older same-revision results from replacing a complete three-site
decision or suppressing the acknowledged journey outcome.

New deterministic regressions cover partial-to-complete registration, approval
during frame bootstrap, stale same-revision results, queued reconciliation, and
active reconciliation with a newer foreground journey. The headed browser gate
uses fresh persistent Stable profiles and performs the shopper action before
any `getTools()` probe; every run must show exact 3/3 readiness, three terminal
receipt origins, one acknowledged preference outcome, and no page errors.

The separately labeled ordinary storefront handoff and its visit-only privacy
contract are unchanged. The exact v0.10.7 production deployment passed all 768
product assertions, 72/72 public asset checks, and all nine ordinary browser
journeys. Native acceptance then passed 10/10 fresh Stable 152.0.7977.76
profiles with the shopper action before any registry probe, followed by a
separate 38/38 deep native receipt audit.

The redacted evidence archive is
`jumping-beans-v0.10.7-self-serve-receipt.zip`, SHA-256
`8de04b5864d36adeac96333a30db5cac9f3f46763863282281cb2f999dc2e339`.
It binds deployment run `33811064006`, the four production deployment IDs,
the ordinary 9/9 receipt, and both native receipts. The GitHub Release asset
list is authoritative for its current attachment status.
