# Jumping Beans — Session Memory

Date: 2026-09-04

## Demo goal

The competition demo should show that options selected in the Engine change the
experience on the partner pages: offer eligibility/order, formatting, and
supporting presentation.

## What is already built

- The Engine creates an approved, redacted preference plane after the user
  applies preferences.
- Native partner matching receives that plane and uses category, budget, rules,
  feed style, and requested formats to filter and rank offers.
- The partner storefront already contains adaptation behavior for the plane,
  including presentation summaries and format-sensitive ordering.
- The Engine displays matching offers, partner provenance, comparison details,
  and network state.

## Remaining feature gap

The adaptation is proven inside the Engine's hidden partner frame, but the
visible partner page opened by the "Open opted-in Site B" link does not yet
receive the preference plane. A competition judge who follows the link will
therefore see the ordinary partner page rather than a visibly adapted page.

The next implementation must carry only the canonical redacted preference
plane, validate it on the partner page, and prove with an end-to-end test that
offers and presentation change after navigation. Identity, saved memory, raw
prompts, receipts, and sensitive data must not cross the handoff.

## Session and release state

- Clean release baseline: `v0.9.1` at commit `de08505`.
- The primary working tree contains substantial pre-existing user changes and
  must not be reset or broadly cleaned up.
- Last audit found the clean baseline's product gate and generated assets
  healthy, while the current dirty tree's product check fails at parse time due
  duplicate `engineWorker` / `engineWrangler` declarations in
  `scripts/check-product.mjs`.
- The fast Sol task dispatched for the visible handoff did not produce relevant
  feature work; its completion report concerned unrelated BeanMind release
  memory. Do not treat that task as implementation evidence.

## Recommended wrap-up decision

Do not call the competition feature complete yet. Keep the scope to the visible
preference handoff, add the focused end-to-end proof, then rerun the product
gate and static bundle checks before choosing a submission commit.
