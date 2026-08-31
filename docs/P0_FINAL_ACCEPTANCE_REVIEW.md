# P0 final acceptance review

Date: 2026-08-31  
Scope: Final four-item checkpoint after the D1 authority, request-boundary,
and headed-WebMCP changes. No production deployment was performed.

## Verdict: STOP / NO-GO

The local deterministic gate, real local Pages+D1 integration, and modeled
request-boundary suite are green.
The Watch UI correctly stages before confirmation, and the boundary rejects
invalid origins, sessions, CSRF, malformed/oversized requests, and rate-limit
overages before merchant mutation.

P0 hardening is accepted locally, but the production/network acceptance gate
remains open. The approved D1 is provisioned and the local Pages+D1 path proves
atomic replay/concurrency behavior. The current headed Chrome can execute the
engine and each partner directly, but its cross-origin iframe policy surface
does not expose the `tools` permission, so a 3/3 embedded-network pass cannot
be claimed from this browser build. Production remains the older deployed
implementation.

## Requirement-by-requirement result

| Requirement | Result | Exact evidence |
|---|---|---|
| Deterministic product gate | PASS | `node scripts/check-product.mjs`: 368 assertions |
| `git diff --check` | PASS | Exit 0 |
| Same-key concurrent D1 commits | PASS in D1 double; NOT PROVEN in real D1 | Concurrent results were `200,201`; one interest record remained |
| Distinct concurrent D1 writes | PASS in D1 double; NOT PROVEN in real D1 | Two distinct commits returned `201`; both records survived |
| Changed-payload replay | PASS in D1 double/local seam | Same idempotency key with changed semantic hash returned HTTP `409 idempotency-conflict` |
| Transaction rollback | PASS in D1 double | Injected interest-insert failure returned `503`; no action claim or interest remained |
| Expiry | PASS in D1 double | Expired pending grant returned `410 expired-grant`; expired summary rows were excluded |
| Missing-binding fail closed | PASS | Missing `WATCH_DB` returned `503 storage-unavailable` for stage, commit, and summary |
| Exact origin policy | PASS | Wrong `Origin` returned `403 origin-policy-rejected`; configured origin accepted |
| Session cookie | PASS in modeled production boundary | Bootstrap returned `401 session-initialized` and `Set-Cookie: __Host-watch-session=...; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800; Secure` |
| CSRF binding | PASS in modeled production boundary | Missing/invalid CSRF did not commit; missing CSRF triggered `401` re-bootstrap, wrong cookie/session returned `403` |
| Content type and body size | PASS | Non-JSON returned `415`; oversized body returned `413 request-body-too-large` |
| Stage rate limit | PASS in D1 double | Limit exceeded returned `429 rate-limit-exceeded` with `Retry-After`; pending-action count did not increase |
| Commit rate limit | PASS in focused local probe | Nine commits: first eight `201`, ninth `429` with `Retry-After: 48`; summary count remained 8 |
| Failed-grant rate limit | PASS in D1 double | Repeated forged grants reached `429` with `Retry-After`; interest count stayed 0 |
| No-mutation guarantees | PASS in modeled suite | Invalid boundary, limiter, forged-grant, and injected-failure paths created no merchant interest; rollback removed the claim as well |
| Receipt redaction | PASS | Returned receipt contained no raw confirmation grant, raw idempotency key, or session value |
| Local stage/commit persistence | PASS only within one process | Separate stage then commit API calls succeeded through the shared local-development seam; no cross-isolate/restart durability proven |
| Fresh local Watch staging UI | PASS | Engine opened exact product/price, scope, retention, and non-outcomes before confirmation; no commit was clicked |
| WebMCP registration/discovery | PARTIAL / EMBEDDED NETWORK OPEN | Fresh headed Chrome executed the engine tools and all three partner `get_matching_deals` tools directly. The engine receipt was captured with anonymous context and explicit origin outcomes. Cross-origin iframe discovery remained unavailable because Chrome reported no effective `tools` permission-policy feature for the child frames; this is not a 3/3 network acceptance pass. |
| Production updated behavior | NOT PROVEN / FAIL for checkpoint | Production still showed the old “Record target price” page with no action/receipt elements |
| Production untouched | PASS | No deployment or cloud mutation was performed; repository changes are the pre-existing checkpoint plus this report |

## Detailed evidence

### D1-compatible authority

The product gate's D1-shaped double exercises the production
`WATCH_DB` repository path with serialized batches and checks:

- same-key concurrent commit resolves to one commit plus one replay;
- distinct concurrent actions both commit;
- changed payload returns `409`;
- injected batch failure rolls back action and interest state;
- expired rows are not summarized;
- no `WATCH_DB` binding fails closed;
- D1 migration contains unique action/idempotency constraints and the
  session/rate/receipt/interest tables.

This is not a live D1 proof. `partners/watch/wrangler.toml` still contains
`database_id = "REPLACE_WITH_APPROVED_D1_DATABASE_ID"`; no D1 resource was
provisioned, migrated, or bound.

### Request boundary

The boundary probe and gate covered:

- exact `Origin` plus configured public origin;
- server-created session and CSRF bootstrap;
- Secure/HttpOnly/SameSite cookie attributes;
- missing and invalid session/CSRF rejection;
- strict JSON content type, top-level envelope, and body-size limits;
- independent stage, commit, and failed-grant rate buckets;
- `429` plus `Retry-After`;
- no action/interest mutation when validation, authorization, rate, or storage
  fails.

The focused commit-rate probe used the explicit
`WATCH_WRITE_MODE=local-development` seam. It committed eight distinct
actions, rejected the ninth with `429` and a `Retry-After` header, and
reported exactly eight active records.

### Browser evidence

Fresh local Watch page:

```text
http://127.0.0.1:8086/
```

Observed:

- server-owned pending-action copy;
- `toolname="register_interest"`;
- disabled confirmation checkbox before staging;
- “Stage target price” primary action;
- receipt/action regions present but hidden before a server response.

Fresh local engine page:

```text
http://127.0.0.1:8082/
```

Observed “Confirm this deal watch” with:

- exact fact: “surface Everyday Walk Kit below $49.00”;
- scope: Jumping Beans product, in this browser;
- retention: Until you use Forget;
- non-outcomes: no notification, order, payment, or message;
- no saved-memory note before confirmation.

Fresh headed-Chrome WebMCP run on 2026-08-31 (before the top-level policy fix):

- Engine `document.modelContext.getTools()` exposed six tools, including
  `set_display_preferences`, `set_deal_watch`, and `get_journey_receipt`.
- `set_display_preferences` returned a staged, non-persisted preference with
  `requiresUserConfirmation: true`, request-only context disclosure, and an
  explicit no-order/no-message outcome.
- `set_deal_watch` returned a staged, non-persisted `$49.00` product-scoped
  action requiring the page confirmation control.
- `get_journey_receipt` returned a fresh journey ID, context snapshot, event
  trail, and redacted decision receipt. The receipt recorded all three local
  partner origins and their failed embedded invocation outcomes.
- Direct top-level partner runs executed successfully in headed Chrome:
  Petsupply returned three matching offers, Coffee Co returned matching coffee
  offers, and Watch Co returned matching watch offers. Each page reported
  `crossOriginIsolated: true` and exposed `get_matching_deals`.
- The engine delegated both `tools` and `cross-origin-isolated` on every
  partner iframe. The frame tree confirmed the child documents became isolated,
  but the engine response omitted the top-level `Permissions-Policy` allowlist.
  Chrome therefore inherited the default `tools=(self)` policy and the child
  pages had no `document.modelContext`.

WebMCP was not executable through the current in-app browser. Direct page
inspection returned `typeof document.modelContext === "undefined"`, and the
browser adapter reported:

```text
gpt-5.6-luna does not support command "webmcp_list_tools"
```

A Watch partner script did log `[watch] registered: get_matching_deals`; this
was not sufficient to claim discoverable or executable WebMCP acceptance.

Production checks:

```text
https://watch-ce8.pages.dev/
https://jumping-beans-engine.steve-k-kall.workers.dev/
```

The deployed Watch page still used “Record target price,” old KV/local-fallback
copy, and lacked `interest-action`/`interest-receipt`. The deployed engine
lacked the new demo-context control and reported no opted-in tools. This is
consistent with no deployment being performed for the checkpoint.

## Exact reproductions

Run from the product root:

```bash
cd /Users/stephenkall/beans/products/jumping-beans
node scripts/check-product.mjs
git diff --check
```

Start local surfaces in separate terminals:

```bash
python3 spikes/a-cross-origin/serve.py 8082 engine
python3 spikes/a-cross-origin/serve.py 8084 partners/petsupply
python3 spikes/a-cross-origin/serve.py 8085 partners/coffee
python3 spikes/a-cross-origin/serve.py 8086 partners/watch
```

Open the local Watch/engine checks:

```text
http://127.0.0.1:8086/
http://127.0.0.1:8086/?watch-local-development=1
http://127.0.0.1:8082/
```

The behavioral authority and request-boundary assertions are in
`scripts/check-product.mjs` beginning at the action-contract imports and
continuing through the D1 double, rollback, expiry, origin/session/CSRF,
body-limit, and rate-limit checks. The focused commit-rate probe was run in a
fresh Node process with nine distinct staged actions against
`{ WATCH_WRITE_MODE: "local-development" }`; observed statuses were eight
`201` responses followed by `429` with `Retry-After`, and summary count
8.

Inspect the unprovisioned production binding:

```bash
sed -n '1,120p' partners/watch/wrangler.toml
sed -n '1,160p' partners/watch/migrations/0001_write_actions.sql
```

## Remaining blockers before GO

1. Provision the approved D1 database, replace the placeholder ID, apply the
   migration, and run the same-key/distinct/rollback/expiry matrix against the
   real binding and multiple isolates.
2. Add durable rate-limit policy beyond the modeled per-session buckets,
   including privacy-preserving network/deployment ceilings.
3. Complete production HTTPS cookie/origin/CSRF verification without claiming
   that the header/session model authenticates an anonymous user.
4. Publish the engine's explicit `Permissions-Policy: tools=(self <partner origins>)`
   fix, then capture a fresh 3/3 journey through partner tools and receipt evidence.
5. Link the Watch action receipt into the engine journey receipt, then rerun the
   full final matrix before any deployment decision.

## Post-review D1 provisioning addendum

After this review was written, the approved `watch-write-actions` D1 database
was provisioned as `d81b9098-03d9-4655-9032-b464109e9020` and migration
`0001_write_actions.sql` was applied remotely. A local Wrangler Pages Functions
run using the checked-in D1 binding and SQLite D1 then passed the real HTTP
stage/commit path: session bootstrap (`401` plus cookie/CSRF), stage (`201`),
commit (`201`), same-payload replay (`200`), changed-payload conflict (`409`),
same-key concurrency (one `201` and one `200` replay), and summary (`200`, one
record per committed action). This upgrades the storage evidence from a test
double to a local Pages+D1 integration result, but it is not production HTTPS
evidence. No application deployment was performed.
