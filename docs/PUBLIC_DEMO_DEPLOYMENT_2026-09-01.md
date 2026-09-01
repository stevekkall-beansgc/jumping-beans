# Jumping Beans — Public Demo Deployment

Date: 2026-09-01  
Deployment decision: **PUBLIC / serving traffic**

## Public URLs

- Engine: <https://jumping-beans-engine.steve-k-kall.workers.dev/>
- Petsupply: <https://petsupply.pages.dev/>
- Coffee Co: <https://coffee-amk.pages.dev/>
- Watch Co: <https://watch-ce8.pages.dev/>

The four units retain their stable public origins. The partner deployments used
the validated source checkpoint `5988e0f`; the engine was then redeployed from
the final bundle-refresh checkpoint `d332ad6`. All three Pages projects,
including Watch Pages Functions, were published successfully.

## Smoke-check result

On 2026-09-01, each stable URL returned HTTP 200. The engine and all partners
returned the required native WebMCP prerequisites:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Resource-Policy: cross-origin`
- a WebMCP `Origin-Trial` header on every origin
- the engine `Permissions-Policy` allowlist for all three partner origins

The stable aliases serve the current source markers, including native
`toolchange` reconciliation, the journey-receipt tool, and the partner
response ceiling. Watch's valid public read request
`/api/interest-summary?product=NIV-77007Q45` returned HTTP 200 from the
production D1-backed Pages Function.

## Traffic posture

- Public page traffic is served by Cloudflare Worker/Pages edge infrastructure.
- Watch writes use the provisioned D1 database and fail closed when the
  production binding is unavailable.
- Watch stage/commit paths retain session, CSRF, origin, body-size, and rate
  controls.
- The public deployment does not use a WebMCP substitute transport, registry,
  bridge, or server-side capability gateway.

This confirms public serving and the production request path. It is not a
formal capacity or stress test; account quotas and high-volume load behavior
remain operational follow-up items if the submission is expected to attract
more than ordinary demo traffic.

## Remaining acceptance boundary

The public deployment is live, but the competition packet should still include
a clean extension-free headed Chrome run against these HTTPS origins proving
embedded native discovery and execution for all three partners, plus the
exported journey receipt. Public availability and native WebMCP acceptance are
separate gates.
