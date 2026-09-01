# Jumping Beans — working-demo execution record

Date: 2026-09-01  
Release lineage: working-demo `v0.4.x` (documentation refresh over the deployed code)
Decision: **CODE/DEPLOY PASS; BROWSER ACCEPTANCE HOLD**

The release is not competition-ready for the expanded product contract until
the hosted login and personal-experience slice is implemented and accepted.

## Review loop

- GPT-5.6-Sol: architecture, native-only aggregation boundary, security
  contract, multi-user/D1 threats, and acceptance gates. Verdict: code
  conditional; competition/release no-go until the Watch journey, Stable
  evidence, and isolation invariants are proven.
- GPT-5.6-Terra: implemented two serial vertical slices in isolated product
  worktrees. The slices harden native partner validation/context projection,
  then hand Watch targets to Watch Co's existing declarative stage/confirm
  flow.
- GPT-5.6-Luna: adversarially reviewed both slices. Deterministic review
  passed after corrections at 472 assertions; native-only transport remained
  intact. The clean headed-browser lane was unavailable because the connected
  Chrome profile is extension-backed and local ports were already owned by the
  primary checkout.

## Current code gates

- `node scripts/check-product.mjs`: **477 assertions passed**.
- JavaScript/JSON syntax, generated UI freshness, engine bundle freshness, and
  `git diff --check`: passed.
- Anonymous discovery remains default; demo context is explicit, labeled,
  profile-selectable, and apply-gated.
- Partner responses are origin-scoped, bounded, validated, and fail closed;
  malformed or stale data never becomes a partner card.
- Watch Co owns the D1-backed stage/confirm/commit boundary. The engine only
  hands off a selected Watch offer and canonical target price by navigation;
  it does not claim a local saved watch or call a Watch API.
- The hosted identity slice is integrated and passes the deterministic account,
  hydration, import, logout, and draft-race contracts. It uses a dedicated
  engine D1, separate from Watch Co's `WATCH_DB`; native WebMCP and Watch
  authority were not changed.

## Production checks

The release-triggered Cloudflare workflow completed successfully from
`51a28f9`. The configured public engine and three partner URLs returned HTTP
200 with the required isolation headers, origin-trial headers, and engine tool
allowlist. The live engine now shows the Alex/Jamie selector, honest no-result
state, and Watch Co handoff; the live Watch page accepts the canonical decimal
handoff and keeps confirmation disabled until the user reviews the exact action.
The Watch D1-backed summary read smoke returned a valid empty cohort.

The dedicated `jumping-beans-engine-identity` D1 was provisioned and migration
`engine/migrations/0001_identity.sql` was applied remotely. Google OIDC Worker
secrets are not configured yet, so hosted login remains intentionally disabled
while anonymous use continues to fail safe.

## Release blockers

1. Configure the exact Google OAuth client/redirect URI and Worker secrets,
   deploy the integrated identity slice, and run the hosted login smoke.
2. Accept the hosted personal experience in clean headed browsers: relogin,
   expiry, reload/cross-device persistence, explicit local-memory import,
   logout, and two-user isolation.
3. Re-run the public journey in clean headed Chrome Stable and Canary without
   an extension. Record discovery, execution, anonymous/approved context,
   apply-once/save/forget, Watch stage/confirmation/replay, provenance, and a
   redacted receipt.
4. Verify production multi-user/D1 write smoke checks, then
   reconcile the acceptance record with the deployed release artifact.

No competition or release success is claimed by this record.
