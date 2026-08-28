# Deploy — Cloudflare

All four units consolidate on Cloudflare (your choice). You'll need
`wrangler` + a CF login on **your** machine (this repo's machine has no CF auth).
One-time: `npm i -g wrangler && wrangler login`.

## Tokens: re-issue for the real origins first
The current origin-trial tokens are pinned to the OLD Netlify/Vercel origins and
will be **invalid** on CF. For each deployed origin below, register it at
<https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241>
(**match all subdomains**, third-party OFF), then paste the new token into that
unit's header config — the token lives next to each unit:

- engine → `engine/index.mjs` (`TRIAL` const)
- petsupply/coffee/watch → `partners/<id>/_headers`

> Register the *actual* directory name you deploy. Defaults:
> - engine → `<name>.<account>.workers.dev`
> - partner → `<id>.<account>.pages.dev`
> You may use custom domains instead if you have them — just re-register that
> origin and update `engine/config.js` `ORIGINS` + each partner `exposedTo`.

## Deploy

Engine (Worker) — from `engine/`:
```bash
cd engine
node bundle-static.mjs          # regenerate static.js from app.js/config.js/index.html
npx wrangler deploy
```

Partners (Pages) — from repo root:
```bash
npx wrangler pages deploy partners/petsupply --project-name petsupply
npx wrangler pages deploy partners/coffee   --project-name coffee
npx wrangler pages deploy partners/watch    --project-name watch
```

## After deploy
1. Confirm headers on each live URL:
   `curl -sI https://<origin>/ | grep -iE "cross-origin|origin-trial"`
   Expect COOP `same-origin`, COEP `require-corp`, CORP `cross-origin`,
   and an `Origin-Trial` header.
2. Tell me the 4 real URLs. I flip `engine/config.js` `ORIGINS` (and each
   partner's `CONCIERGE_ORIGIN`/`exposedTo`) from localhost → prod, then re-verify
   cross-origin discovery over HTTPS.
