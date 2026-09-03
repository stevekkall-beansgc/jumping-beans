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
contract are unchanged. Production native acceptance remains pending until the
exact v0.10.7 deployment passes the repeated cold-start gate and deeper native
receipt audit.
