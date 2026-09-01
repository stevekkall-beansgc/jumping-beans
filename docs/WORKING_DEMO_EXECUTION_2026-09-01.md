# Jumping Beans — working-demo execution record

Date: 2026-09-01  
Source checkpoint: `c46d9d7` (local `main`)  
Decision: **CODE PASS; PUBLIC/BROWSER RELEASE HOLD**

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

The configured public engine and three partner URLs returned HTTP 200 with the
required isolation headers, origin-trial headers, and engine tool allowlist.
The live pages still serve the pre-`c46d9d7` artifact: the in-app browser showed
the old Alex-only control, illustrative fallback, and local “Confirm and save”
watch flow. This is stale-deployment evidence, not a WebMCP acceptance pass.

## Release blockers

1. Push the reviewed source and obtain successful CI on the exact candidate
   commit.
2. Publish the versioned release so the repository-owned Cloudflare workflow
   deploys all four units, including Watch Pages Functions and its existing D1
   binding.
3. Re-run the public journey in clean headed Chrome Stable and Canary without
   an extension. Record discovery, execution, anonymous/approved context,
   apply-once/save/forget, Watch stage/confirmation/replay, provenance, and a
   redacted receipt.
4. Verify multiple-user isolation and production write smoke checks, then
   reconcile the acceptance and deployment records before tagging the release.

No competition or release success is claimed by this record.
