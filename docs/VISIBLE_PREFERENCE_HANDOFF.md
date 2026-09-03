# Visible preference handoff — 2026-09-03

The Engine now gives self-serve users three one-click recipes for Dog gear,
Coffee stories, and Watches. After the user reviews and applies a selection, a
clearly labeled storefront-preview link is available immediately, including
while optional inventory sources are still loading. The link carries only the
canonical visit-only presentation plane in a URL fragment.

Each matching member storefront consumes and scrubs the fragment before its
first render, enforces category, exclusive budget, availability, and expiry,
then ranks available source-backed collateral. It never invents a story, video,
or percentage discount. A first render contains at most 24 offers; stalled
catalog loads stop after 10 seconds and offer a retry.

The ordinary-browser handoff stays visibly separate from native WebMCP. Native
readiness turns green only when the exact three partner origins have both been
discovered and returned a successful `ready` or honest `no-match` outcome for
the current selection. Unsupported and partial states say so.

Privacy boundaries are enforced at both ends: incoming queries, identity,
memory, receipts, raw prompts, and tracking paths are excluded; malformed or
noncanonical fragments are rejected and scrubbed; the fragment is not saved or
automatically propagated. A copied fragment can replay the same nonsensitive
display settings and is not an authorization token.

Current deterministic, local-browser, production, rollback, and native-release
evidence is tracked in
[`SELF_SERVE_RELEASE_ACCEPTANCE.md`](SELF_SERVE_RELEASE_ACCEPTANCE.md).
