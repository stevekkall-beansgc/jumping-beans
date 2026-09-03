# Jumping Beans v0.10.5

This patch keeps native WebMCP readiness visible after a shopper applies a
selection and enters the result view.

v0.10.4 restored schema-valid partner execution across all three sites, but
the exact green three-site status still lived inside the setup panel. That
panel is intentionally hidden once results appear, so a successful native run
could not show or capture its own final readiness message.

The live readiness callout now sits at the stable product-card level. It
remains visible during setup, application, success, partial results, retries,
and ordinary-browser use while preserving the existing status semantics and
screen-reader announcement role. Every product-state render now refreshes the
verdict, so pausing or retrying cannot leave a stale green result. Product-gate
and real-browser regressions prevent the status from moving back inside the
hidden setup container or disappearing after results render.

The production native receipt remains a post-deploy gate and will be attached
to the GitHub Release only after the exact v0.10.5 deployment shows the green
three-site state in a fresh, extension-free headed Chrome Stable profile.
