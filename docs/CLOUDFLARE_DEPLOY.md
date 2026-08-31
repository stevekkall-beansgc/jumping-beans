# Deploy — Cloudflare

All four units deploy through the repository's GitHub Actions workflow:
`.github/workflows/deploy-cloudflare.yml`. It runs automatically when a
versioned GitHub release is published, or manually when a maintainer dispatches
it with the exact confirmation `DEPLOY`. Production credentials stay in the
GitHub `production` environment and never enter the repository.

Required environment secrets:

- `CLOUDFLARE_API_TOKEN` — an account-scoped token with Workers and Pages edit
  access.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID.

For a manual deployment of `main`:

```bash
gh workflow run deploy-cloudflare.yml \
  --repo stevekkall-beansgc/jumping-beans \
  --ref main -f confirm=DEPLOY
```

## Tokens: re-issue for the real origins first
The current origin-trial tokens are pinned to the OLD Netlify/Vercel origins and
will be **invalid** on CF. For each deployed origin below, register it at
<https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241>
(**match all subdomains**, third-party OFF), then paste the new token into that
unit's header config — the token lives next to each unit:

- engine → `engine/index.mjs` (`TRIAL` const)
- petsupply/coffee/watch → `partners/<id>/_headers`

> Register the *actual* directory name you deploy. Actual deployed origins
> (2026-08-28):
> - engine → `https://jumping-beans-engine.steve-k-kall.workers.dev`
> - petsupply → `https://petsupply.pages.dev`
> - coffee → `https://coffee-amk.pages.dev`   (bare `coffee.pages.dev` was taken → CF appends a suffix)
> - watch → `https://watch-ce8.pages.dev`     (bare `watch.pages.dev` was taken → CF appends a suffix)
>
> If you use custom domains instead, just re-register that origin and update
> `engine/config.js` `ORIGINS` + each partner `exposedTo`/`CONCIERGE_ORIGIN`.

## Workflow deployment

The workflow performs this read-only preflight from the release checkout:

```bash
node scripts/check-product.mjs
```

If it reports stale generated UI or bundle output, run the named refresh
command and repeat the preflight before any deploy.

`node scripts/check-product.mjs`, `node scripts/sync-static-ui.mjs --check`,
and `node engine/bundle-static.mjs --check` must all pass. It then runs the
pinned Wrangler CLI from `engine/` and from each partner directory. Running
Watch from inside its directory is required so Cloudflare includes its Pages
Functions.

> Watch's consequential interest store requires the provisioned `WATCH_DB` D1
> binding in `partners/watch/wrangler.toml`. The approved
> `watch-write-actions` database is already migrated with
> `partners/watch/migrations/0001_write_actions.sql`. Before any approved
> deploy, verify the binding and migration state. Stage, commit, and
> summary fail closed without that binding; KV is not a fallback authority.
> `WATCH_PUBLIC_ORIGIN` must be the exact deployed Watch HTTPS origin. The
> write APIs issue a Secure, HttpOnly, SameSite session cookie and require its
> server-bound CSRF token; do not proxy, wildcard, or relax this boundary.

## After deployment
1. Confirm headers on each live URL:
   `curl -sI https://<origin>/ | grep -iE "cross-origin|origin-trial"`
   Expect COOP `same-origin`, COEP `require-corp`, CORP `cross-origin`,
   `Permissions-Policy: tools=(self <the three partner origins>)`, and an
   `Origin-Trial` header.
2. Verify the deployed URLs remain the configured production origins in
   `engine/config.js` and each partner's `CONCIERGE_ORIGIN`/`exposedTo`.
