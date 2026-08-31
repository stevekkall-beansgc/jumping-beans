# Jumping Beans — Session Handoff

State as of 2026-08-31. WebMCP Challenge (bet C1), deadline **Sep 3 2026 15:00 PT**, $0 budget.
Authoritative design docs live in `~/beans/labs/beanlabs/ventures/05-concierge-webmcp/`
(SESSION-BRIEF.md = start here; SPEC.md; RESEARCH.md). This repo is the public submission.

## What exists (all in this public repo at github.com/stevekkall-beansgc/jumping-beans)
- `engine/` — the Concierge app (Worker). `index.html` + `app.js` (app), `config.js`
  (origins+personas), `index.mjs` (CF Worker serving bundled static), `bundle-static.mjs`
  (build script → `static.js`), `wrangler.toml`.
- `partners/` — petsupply (A), coffee (B), watch (C). Each: `index.html`, `tool.js`
  (imperative `get_matching_deals`), `storefront.js`, `catalog.json`, `img/*.svg`,
  `_headers` (COOP/COEP/CORP + Origin-Trial), `wrangler.toml`.
- `shared/` — `config.js`, `personas.json`, `schemas/deal.schema.json`,
  `schemas/profile.schema.json`.
- `scripts/scaffold-partner.mjs` — generates a full partner unit from a seed catalog.
- `docs/` — `origin-trial.md`, `CLOUDFLARE_DEPLOY.md`.

## Current headed-Chrome evidence
- The engine and each partner execute their native WebMCP tools directly in Chrome 151.
- The engine delegates `allow="tools; cross-origin-isolated"` to all partner frames
  and now sends a top-level `Permissions-Policy` allowlist for the three partner
  origins. The fix is staged locally; production must be deployed before claiming
  the embedded 3/3 network pass.
- The pre-fix headed run exposed no effective `tools` permission-policy feature to
  the cross-origin child frames, so their `document.modelContext` was unavailable.
  Do not claim the historical 3/3 iframe result until a fresh production run
  passes.
- Local fleet currently serving: engine **8082**, petsupply **8084**, coffee **8085**, watch **8086**
  (each via `spikes/a-cross-origin/serve.py <port> <dir>`; sends COOP/COEP/CORP; no token on localhost).

## Key gotchas (do not re-derive)
1. Chrome 151's live producer API accepted object inputs in this run; the engine
   keeps a serialized-input retry for older WebMCP implementations.
2. CORP `cross-origin` header required on EVERY unit, or cross-origin partner iframe fails under COEP.
3. WebMCP is **headed-Chrome only** (headless → `modelContext` undefined); enable via the flag.
4. Tool `execute()` gets **no 2nd `{signal}` arg** — guard: `execute: async (input, {signal}={})=>…` + `(!signal||!signal.aborted)`.
5. `ontoolchange` does **NOT** fire cross-origin — drive the engine status rail from iframe `load`, not ontoolchange.
6. Partner scripts MUST be `<script type="module">` (they use top-level `await`).
7. Partners can't import shared cross-origin — each unit keeps its own inlined origins constant.

## Decided
- Hosting: **consolidate on Cloudflare** — engine = Worker; partners = CF Pages.
- Per-site origin-trial tokens stay (kept Netlify/Vercel origins originally; see deploy note below).
- Scaffold + engine + watch catalog shipped; commit `ec1201c` pushed.

## NEXT SESSION — what to do
1. **Steve part (must happen with CF login):** re-issue the 4 origin-trial tokens for the NEW
   CF origins (`<name>.<account>.workers.dev` and `<id>.<account>.pages.dev`) at the Origin
   Trials UI, paste into each `_headers` / `engine/index.mjs` `TRIAL`. Then deploy per
   `docs/CLOUDFLARE_DEPLOY.md`.
2. **Flip to prod:** after Steve sends real URLs, update `engine/config.js` `ORIGINS` and each
   partner's `exposedTo`/`CONCIERGE_ORIGIN` from localhost → prod; re-verify cross-origin over HTTPS.
3. **Product:** (a) confirm watch tool/catalog renders in Chrome (8086) — was in progress,
   (b) Partner C declarative `register_interest` + `/merchant` + `/api/register-interest` (SPEC §5e),
   (c) README (setup + deploy for all 4 units).
4. **Demo/video:** record in ChatGPT built-in browser (only env with real agent + declarative +
   in-page JS), confirm agent sees engine tools + descends into partner iframes; submit Devpost before deadline.

## Deploy commands (see docs/CLOUDFLARE_DEPLOY.md for full)
```bash
npm i -g wrangler && wrangler login
cd engine && node bundle-static.mjs && npx wrangler deploy
npx wrangler pages deploy partners/petsupply --project-name petsupply
npx wrangler pages deploy partners/coffee   --project-name coffee
npx wrangler pages deploy partners/watch    --project-name watch
```
Verify after: `curl -sI https://<origin>/ | grep -iE "cross-origin|origin-trial"`.
