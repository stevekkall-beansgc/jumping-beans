# Jumping Beans — a user-owned deal engine

**Jumping Beans** is the first live surface of a broader WebMCP capability
network: an in-browser concierge that starts with an offer from open inventory,
checks multiple opted-in partners, lets the shopper control what is
remembered, and carries only the chosen presentation context forward.

It is the entry for *The WebMCP Challenge* (Devpost). Everything runs on free
tiers and plain static files plus a couple of small serverless functions.

## The loop it demonstrates

1. Site A starts from a bundled public-feed snapshot. It is labeled **open
   inventory** because no merchant tool connection was required.
2. The engine opens cross-origin iframes (`allow="tools"`) to three shops and
   calls `getTools({ fromOrigins })` for `get_matching_deals`.
3. Partner responses are deduplicated by origin, retried across normal browser
   timing/protocol variance, and resolved through profile and price eligibility
   before ranking. A Site B offer is labeled **opted-in partner** only after a
   tool responds. If no tool responds, the UI keeps the fallback visibly
   labeled as an illustrative, unverified preview.
4. The shopper chooses presentation rules. The exact useful fact, product
   scope, and browser retention appear before “Save and apply”; “Apply once
   without saving” remains available.
5. Site B receives only the selected display context. Product facts keep their
   own source and verification disclosure.
6. A shopper can save a deal watch and receive a proactive in-page update when the
   demo monitor finds a qualifying price (the browser-open monitor is explicit;
   outbound email/SMS delivery is roadmap).
7. On the watch shop, visitors — or their agent — fill a declarative
   `register_interest` form.
8. The shop's `/merchant` view polls an aggregate of that interest
   (`/api/interest-summary`): the shop asked, the engine answered.

The engine also exposes a journey receipt to an agent: capability IDs and
versions, connected origins, user-approved context, eligibility counts,
decision reasons, and redacted invocation/outcome events. The UI shows the
same network state in human-readable form. Declarative Watch Co writes are
staged for page confirmation and confirmed requests carry an idempotency key.

Non-WebMCP browsers still get the normal UI (the deal grid, the form, the
merchant readout) — the agent surfaces are additive.

## Repo layout (4 deployable units + shared)

| Path | Unit | Host |
|---|---|---|
| `engine/` | Concierge app (Worker) | Cloudflare Worker |
| `partners/petsupply/` | Demo shop A (static) | Cloudflare Pages |
| `partners/coffee/` | Demo shop B (static) | Cloudflare Pages |
| `partners/watch/` | Demo shop C (storefront + `/api` + `/merchant`) | Cloudflare Pages |
| `shared/` | Schemas + personas | — |
| `scripts/scaffold-partner.mjs` | Generate a partner unit from a seed catalog | — |

Each partner registers a `get_matching_deals` WebMCP tool and exposes it to the
engine origin. Partner responses may include merchant-provided collateral such
as testimonials and price proof. The engine additionally exposes user-owned
profile, offer-memory, presentation-preference, offer-journey, and deal-watch
tools. Watch has a declarative `register_interest` form (SPEC §4b), an interest
store behind `/api/register-interest` and `/api/interest-summary`, and a
`/merchant/` demand-signal view.

## Requirements

- **Chrome 149+** (tested on 151) with WebMCP enabled. Local dev uses the flag
  `--enable-features=WebMCP,WebMCPTesting` in **headed** mode (headless has
  `document.modelContext === undefined`).
- On production HTTPS origins, WebMCP requires an **origin-trial token** on
  every origin that runs it (iframes don't inherit). See
  [`docs/origin-trial.md`](docs/origin-trial.md).
- No application framework or third-party runtime dependencies. Plain static
  HTML and ES modules are prepared with the included Node scripts.

Repository operating rules and test commands live in [AGENTS.md](AGENTS.md).

## Bean Labs UI standard

The central source is `../../labs/beanlabs/shared/design-system` from this repo
(`tokens.json` is canonical; `tokens.css` is the zero-build distribution). The
engine and partner storefronts use its semantic `--bl-*` tokens and component/
pattern contracts.

Because the four sites deploy from independent static roots,
`scripts/sync-static-ui.mjs` writes traceable generated copies into each deploy
root and distributes this repo's shared partner storefront layer. Never edit a
generated `design-system/tokens.css`, partner `storefront.css`, or partner
`storefront.js` directly. Change the central tokens or the repo-owned source,
then refresh the generated copies.

```bash
node scripts/sync-static-ui.mjs          # refresh generated static UI assets
node scripts/sync-static-ui.mjs --check  # verify without writing
node engine/bundle-static.mjs            # refresh the Worker bundle
node engine/bundle-static.mjs --check    # verify without writing
node scripts/check-product.mjs           # run the complete read-only product gate
```

See [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) for source paths, the
standalone-repo behavior, adapter rationale, and the required pre-ship review.

Before any new or materially refreshed surface ships, refresh generated assets,
refresh the engine bundle when applicable, and run `node
scripts/check-product.mjs`. Then complete the manual keyboard, reflow, light/
dark, reduced-motion, and real cross-origin WebMCP checks in
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md). A passing local gate is
required but does not prove production origins, headers, or origin-trial tokens.

## Local development

WebMCP needs cross-origin isolation, so serve each unit with the included
`serve.py` (adds `COOP`, `COEP`, `CORP`). Four terminals:

```bash
python3 spikes/a-cross-origin/serve.py 8082 engine            # Concierge
python3 spikes/a-cross-origin/serve.py 8084 partners/petsupply
python3 spikes/a-cross-origin/serve.py 8085 partners/coffee
python3 spikes/a-cross-origin/serve.py 8086 partners/watch
```

Then open `http://localhost:8082` in the flagged Chrome. After discovery, the
engine status should report **3 opted-in sites connected**.

> The `/api/*` endpoints and `/merchant` loop are backed by Cloudflare Pages
> Functions. Locally (plain `serve.py`) they're not served, so the storefront
> and merchant fall back to a same-origin `localStorage` demo store to keep the
> loop demonstrable on localhost. The deployed version uses the real `/api`.

## Deploy (Cloudflare — all four units)

Production deployment is repository-owned. The
[Deploy Cloudflare workflow](.github/workflows/deploy-cloudflare.yml) runs
from a published versioned release, or from a manually confirmed GitHub
Actions dispatch. It uses a pinned Wrangler CLI and deploys the engine Worker
plus all three Pages projects from their own directories, preserving Watch's
Pages Functions.

Configure these GitHub **production environment** secrets once:

- `CLOUDFLARE_API_TOKEN` — scoped Cloudflare API token with Workers and Pages
  edit access for this account.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID.

The secrets are credentials only; they are never committed or printed. To
manually publish the current `main` branch after review:

```bash
gh workflow run deploy-cloudflare.yml \
  --repo stevekkall-beansgc/jumping-beans \
  --ref main -f confirm=DEPLOY
```

Publishing a GitHub release triggers the same workflow automatically. Local
Wrangler deployment is intentionally not the production path.

> Watch ships Cloudflare Pages Functions in `partners/watch/functions/`
> (routes `/api/register-interest`, `/api/interest-summary`) and persists its
> interest store to Cloudflare KV (`WATCH_INTEREST` binding in
> `partners/watch/wrangler.toml`) so the storefront → `/merchant` loop survives
> across Worker isolates.

### Before deploying

1. **Re-issue the origin-trial tokens** for the real production origins
   (`<name>.<account>.workers.dev` for the engine, `<id>.<account>.pages.dev`
   for the partners), then paste each into its unit's header config —
   `engine/index.mjs` (`TRIAL`) and `partners/<id>/_headers`. See
   [`docs/CLOUDFLARE_DEPLOY.md`](docs/CLOUDFLARE_DEPLOY.md).
2. **Point the origins at production.** In `engine/config.js` set `ORIGINS` to
   the real partner URLs, and in each `partners/<id>/tool.js` set
   `CONCIERGE_ORIGIN` to the engine URL.
3. Verify headers on each live URL:
   `curl -sI https://<origin>/ | grep -iE "cross-origin|origin-trial"` — expect
   `COOP: same-origin`, `COEP: require-corp`, `CORP: cross-origin`, and an
   `Origin-Trial` header.

## Verify the WebMCP surface

In the flagged Chrome, open the engine and the watch shop, then in the DevTools
console:

```js
// Engine: discover partner tools cross-origin
const tools = await document.modelContext.getTools({
  fromOrigins: ["http://localhost:8084", "http://localhost:8085", "http://localhost:8086"],
});
tools.map((t) => t.name); // → 3× "get_matching_deals" + the engine's own tools

// Engine: execute a partner tool (arg is a JSON string, resolves to a string)
const raw = await document.modelContext.executeTool(
  tools.find((t) => t.name === "get_matching_deals"),
  JSON.stringify({ categories: ["watches"] })
);
JSON.parse(raw); // → { deals: [...] }
```

Watch's `register_interest` form is a valid declarative WebMCP tool
(`toolname`, `tooldescription`, `toolautosubmit`); an agent filling it triggers
`event.agentInvoked` and answers through `event.respondWith`.

## Origin-trial note

WebMCP ships as a Chrome origin trial (trial id `4163014905550602241`, Chrome
149–156, ends **17 Nov 2026**). Each origin actually running WebMCP must serve
its own token. Local `localhost` works with the flag only.

## License

[MIT](LICENSE)
