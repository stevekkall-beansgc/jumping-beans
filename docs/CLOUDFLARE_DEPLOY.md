# Deploy — Cloudflare

All four units deploy through the repository's GitHub Actions workflow:
`.github/workflows/deploy-cloudflare.yml`. A maintainer runs it only after
release approval, with the exact confirmation `DEPLOY` and the full
40-character commit SHA plus its published annotated release tag. Publishing a
GitHub Release does not deploy by itself.
Production credentials stay in the GitHub `production` environment and never
enter the repository.

Required environment secrets:

- `CLOUDFLARE_API_TOKEN` — an account-scoped token with Workers and Pages edit
  access.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID.

For an approved clean release commit on `main`:

```bash
gh workflow run deploy-cloudflare.yml \
  --repo stevekkall-beansgc/jumping-beans \
  --ref main -f confirm=DEPLOY \
  -f release_sha="$(git rev-parse HEAD)" -f release_tag="$(git describe --tags --exact-match)"
```

## Tokens: keep the real-origin registrations current
The four checked-in origin-trial tokens are registered to the production
origins below and currently expire on **17 November 2026**. Before that date,
or before changing any origin, register the replacement at
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

The workflow builds the ignored public catalog asset, then performs this
preflight from the immutable release checkout:

```bash
node scripts/build-inventory-index.mjs
node scripts/check-product.mjs
```

The preflight also rebuilds the generated public catalog index before checking
the release. It is uploaded as the engine Worker's Static Asset binding, not
embedded in the Worker script.

Before any repository code runs with production access, a secretless job proves
that the SHA is on `main`, the named tag is annotated and points to that SHA,
the tag has a published, non-prerelease GitHub Release with nonempty notes, and
both repository CI workflows passed for that exact SHA. Cloudflare credentials
are scoped only to the snapshot, deploy, identity, and cleanup steps.

If it reports stale generated UI or bundle output, run the named refresh
command and repeat the preflight before any deploy.

`node scripts/check-product.mjs`, `node scripts/sync-static-ui.mjs --check`,
and `node engine/bundle-static.mjs --check` must all pass. It then runs the
pinned Wrangler CLI from each partner directory and finally from `engine/`.
Running Watch from inside its directory is required so Cloudflare includes its
Pages Functions. Partners go first because their new handoff modules remain
compatible with the previous Engine; the Engine goes last so it cannot send a
new handoff to an old storefront.

> Watch's consequential interest store requires the provisioned `WATCH_DB` D1
> binding in `partners/watch/wrangler.toml`. The approved
> `watch-write-actions` database is already migrated with
> `partners/watch/migrations/0001_write_actions.sql`. Before any approved
> deploy, verify the binding and migration state. Stage, commit, and
> summary fail closed without that binding; KV is not a fallback authority.
> `WATCH_PUBLIC_ORIGIN` must be the exact deployed Watch HTTPS origin. The
> write APIs issue a Secure, HttpOnly, SameSite session cookie and require its
> server-bound CSRF token; do not proxy, wildcard, or relax this boundary.

## Optional engine identity

The engine's hosted profile/preferences/memory service needs a distinct
`ENGINE_DB` D1 binding and the migration in `engine/migrations/`; it must never
share Watch Co's write database. Configure the exact HTTPS
`ENGINE_PUBLIC_ORIGIN`, then add Google OAuth secrets
`GOOGLE_OIDC_CLIENT_ID` and `GOOGLE_OIDC_CLIENT_SECRET` through Wrangler or
the deployment environment (not `wrangler.toml`). Register the exact callback
`https://<engine-origin>/auth/callback` with Google. Full setup and the
security boundary are in [`IDENTITY_SETUP.md`](IDENTITY_SETUP.md).

## After deployment

The workflow runs `node scripts/production-smoke.mjs` after every unit and
again across the complete array, followed by the read-only runway check. It
confirms that every stable origin serves the exact checkout assets, correct
JavaScript module MIME types, nonempty in-stock catalogs, matching nonexpired
WebMCP registration, isolation headers, the exact Engine permissions allowlist,
a healthy bounded catalog API response, 30 days of token runway, and 14 days of
inventory runway for every canonical recipe. It then runs the three canonical
journeys in Chromium at 1280×900, 390×844, and 320×568 and uploads the
screenshots and JSON receipt.

Before changing production, the workflow persists the three canonical Pages
deployment IDs and the exact 100%-traffic Worker version. If a post-deploy
check fails or times out, a separate cleanup job waits for deployments from
that workflow attempt to settle, restores only units still carrying its unique
release marker, and verifies the saved deployment IDs and Worker version. It
refuses to overwrite a unit that changed outside the run and reports a failed
cleanup for operator action.
Normal workflow failure, timeout, and cancellation reach cleanup. A GitHub
force-cancel or a GitHub/Cloudflare outage can prevent automation; use the
saved rollback artifact after service recovers.
After the workflow succeeds, complete the headed Chrome native receipt in
`SELF_SERVE_RELEASE_ACCEPTANCE.md`; the native competition claim remains
NO-GO until that separate 3/3 run passes.

The smoke is read-only. A successful HTTP status alone is insufficient because
Cloudflare Pages can return an HTML fallback for a missing module; the smoke
also checks content hashes and MIME types.

## Self-serve acceptance matrix

| Lane | Required user-visible result | Release gate |
|---|---|---|
| Tested Chromium browser | Apply Coffee, Dog gear, or Watches; open the labeled storefront preview; see category and budget filter inventory, Visual rank available stories, Compare put facts before imagery, and No urgency remove expiry copy | deterministic renderer plus the nine-case production browser matrix |
| Supported headed Chrome | Readiness says native WebMCP is ready; all three partner tools respond independently; a matched card opens the same adapted storefront | clean production Chrome run plus journey receipt |
| Unsupported or partially failing native lane | Native status names the limitation; no offer is mislabeled as a WebMCP match; the separate storefront preview remains usable | unsupported and mixed-outcome tests |

No deployment can guarantee an experimental browser API on every visitor's
device. The ordinary-browser lane guarantees the visible preference-handoff
demo; the supported-Chrome lane is the separately evidenced competition claim.

## Ongoing readiness

After a release succeeds, create a dedicated detached worktree at its exact
published SHA and build the ignored deterministic catalog index there once.
The existing BeanSched `jumping-beans-merchant-refresh` entry then runs this
release-pinned monitor every six hours:

```bash
node scripts/monitor-production.mjs \
  --release-sha <full-release-sha> \
  --release-tag <annotated-release-tag>
```

The monitor fails unless the worktree is clean, `HEAD` matches the supplied
SHA, the tag is annotated and resolves to it, and the prebuilt index stays
unchanged. It runs the full product gate, exact public-asset smoke, and a runway
check requiring 30 token days plus one matching offer for every canonical
recipe with 14 inventory days. It does not refresh, commit, or deploy.

Cutover is complete only after this release worktree is provisioned, the
BeanSched entry is updated, and one disabled manual dry cycle succeeds. The
job remains disabled until then, so ongoing monitoring must not yet be claimed.
