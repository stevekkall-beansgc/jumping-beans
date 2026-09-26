# Jumping Beans v0.10.1

This patch fixes the production acceptance check used by the v0.10 self-serve
release. Cloudflare Pages canonicalizes `/index.html` to `/` and nested index
paths such as `/merchant/index.html` to `/merchant/`. The check now compares
those canonical responses with the release's exact `index.html` bytes instead
of treating the expected redirects as failures.

Fetch failures now name the requested URL and underlying network or redirect
cause so a failed deployment can be diagnosed from its workflow log. The
ordinary-browser demo behavior and deployed product assets are unchanged from
v0.10.0.

Before deployment, this release must pass the complete deterministic product
gate and exact-SHA GitHub checks. The gated production workflow accepts the
release only after the four-origin production smoke and readiness checks and
the nine-case production Chromium journey matrix pass.
