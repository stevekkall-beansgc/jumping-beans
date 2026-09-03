# Jumping Beans v0.10.2

This patch makes Watch Co's read-only demand-summary response identify the
validated product that was requested. The production acceptance check can now
prove that the response belongs to the intended Watch SKU instead of accepting
an unlabeled aggregate.

The response change does not alter Watch Co's staged confirmation, write,
retention, or authorization behavior. This release also includes v0.10.1's
canonical Cloudflare Pages index-route verification fix.

Before deployment, this release must pass the complete deterministic product
gate and exact-SHA GitHub checks. The gated production workflow accepts the
release only after the four-origin production smoke and readiness checks and
the nine-case production Chromium journey matrix pass.
