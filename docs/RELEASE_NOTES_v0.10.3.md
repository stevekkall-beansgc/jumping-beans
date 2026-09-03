# Jumping Beans v0.10.3

This patch keeps the applied self-serve category, budget, and presentation
rules when a visitor opens a storefront's read-only action-chain preview. The
storefront now carries its already validated canonical preference fragment on
that same-origin link and scrubs it again before rendering the destination.
Watch Co therefore continues to show watch inventory under the selected price
limit instead of widening back to its full catalog.

The production Chromium gate now verifies the action-preview navigation keeps
the applied banner, comparison layout, watch-only category, and strict price
limit after the navigation while leaving no preference fragment in the visible
URL. The fragment remains visit-only and excludes identity, memory, receipts,
raw prompt text, and authorization data.

Before deployment, this release must pass the complete deterministic product
gate and exact-SHA GitHub checks. The guarded production workflow accepts the
release only after the four-origin production smoke and readiness checks and
the nine-case production Chromium journey matrix pass.
