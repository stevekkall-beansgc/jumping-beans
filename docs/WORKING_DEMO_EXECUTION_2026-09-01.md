# Jumping Beans — working-demo execution record

Date: 2026-09-01  
Release candidate: `v0.4.1` (documentation refresh over the deployed `v0.4.0` code)
Decision: **CODE/DEPLOY PASS; BROWSER ACCEPTANCE HOLD**

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

## Production checks

The release-triggered Cloudflare workflow completed successfully from
`51a28f9`. The configured public engine and three partner URLs returned HTTP
200 with the required isolation headers, origin-trial headers, and engine tool
allowlist. The live engine now shows the Alex/Jamie selector, honest no-result
state, and Watch Co handoff; the live Watch page accepts the canonical decimal
handoff and keeps confirmation disabled until the user reviews the exact action.
The Watch D1-backed summary read smoke returned a valid empty cohort.

## Release blockers

1. Re-run the public journey in clean headed Chrome Stable and Canary without
   an extension. Record discovery, execution, anonymous/approved context,
   apply-once/save/forget, Watch stage/confirmation/replay, provenance, and a
   redacted receipt.
2. Verify multiple-user isolation and production write smoke checks, then
   reconcile the acceptance record with the deployed `v0.4.0` artifact.

No competition or release success is claimed by this record.
