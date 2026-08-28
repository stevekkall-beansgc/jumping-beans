# WebMCP Origin Trial — setup

WebMCP runs as a Chrome origin trial in production (a flag only covers local
dev). Each of the four deployed origins must be enrolled and serve its own
token, because **iframes do not inherit origin-trial access from their parent**
— every origin that actually runs WebMCP needs the token.

## Trial
- Trial id: `4163014905550602241`
- Registration: <https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241>
  (requires sign-in)
- Runs Chrome 149 → 156, hard end **17 Nov 2026**.

## Register each origin (4×)
1. Open the registration link, verify you're signed in to a Google account.
2. Web origin — enter the origin **without a trailing slash**, e.g. `https://jumping-beans-petsupply.netlify.app`
   and check **"Match all subdomains of the origin"** so a single token covers the whole origin.
3. Leave third-party matching off (first-party use).
4. Set usage restriction = Standard Limit, expected usage = a small estimate.
5. Accept terms → Register. Token is generated immediately.
6. Paste each token into its unit's config (below).

## Tokens land in (registration COMPLETE 08-27 — all four wired)
| Unit | Origin | Token located at |
|---|---|---|
| engine | `https://your-engine.workers.dev` | `engine/index.mjs` Worker `Origin-Trial` header |
| petsupply | `https://jumping-beans-petsupply.netlify.app` | `partners/petsupply/_headers` |
| coffee | `https://jumping-beans-coffee.vercel.app` | `partners/coffee/vercel.json` headers |
| watch | `https://jumping-beans-watch.vercel.app` | `partners/watch/vercel.json` headers + `/merchant` |

Each token decodes to the origin shown (verified: payload `origin` = the unit's
origin). Engine/coffee/watch deployed URLs are the registered placeholders — if a
unit is deployed to a different URL, its token must be re-issued for the real origin.

The `Origin-Trial` header value (or `<meta http-equiv="origin-trial" …>`)
carries the token. Local dev on `localhost` uses the flag
(`--enable-features=WebMCP,WebMCPTesting`) and needs no token.

## Heads-up that shapes the build
- Missing COOP `same-origin` / COEP `require-corp` / CORP `cross-origin` on a
  unit disables WebMCP or breaks cross-origin partner iframes (see each
  unit's deploy config).
- Cross-origin iframes need `allow="tools"` **and** their own origin-trial
  token to expose tools.
