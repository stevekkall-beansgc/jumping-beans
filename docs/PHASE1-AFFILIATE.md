# Phase 1 — Affiliate-first inventory & ease-of-execution

Status: DECIDED direction, not yet implemented. North star: **ease of execution**
(reduce clicks/friction). Later phase (Stripe-as-merchant + dropship) is queued in
BeanMind — NOT built now.

## 1. Inventory: affiliate product feeds, surfaced as our tools (zero provider opt-in)

- Data source: product feeds/APIs from affiliate networks
  (Amazon PA-API, CJ, Impact, Rakuten, eBay, Walmart, etc.).
  Each yields: title, category, price (list/deal), image, and a deep-link URL
  that carries the affiliate ref.
- Expose as a `registerTool` named `get_matching_deals` over that ingested feed
  — same `inputSchema` (`categories`, `maxPrice`) as the current partners, so the
  engine's `getTools`/`executeTool`/`buildFeed` aggregation is **unchanged**.
- This is read-only (`readOnlyHint: true`), so no provider participation, no
  write-back, no dropship. Income = affiliate commission on click/conversion.

## 2. Handoff / transition (mobile-safe): discovery-in-iframe, handoff-out-of-iframe

- Keep the tool-discovery iframes (they work for read-only cross-origin tools).
- **Do NOT transact inside a partner iframe.** Real merchants ship
  `X-Frame-Options: DENY` / CSP `frame-ancestors`, and mobile browsers strip
  iframes. Transacting in-iframe fails on real sites and is not mobile-safe.
- Each deal card gets one-tap action: a plain top-level anchor / `window.open`
  deep-link to the merchant (affiliate `goto`), i.e. `target="_top"` navigation.
  This is a real top-level navigation → works on mobile, keeps the merchant's own
  mobile page/auth/payment, respects their frame policy.
- Optional: a lightweight hosted `goto?u=...` redirector (validate + 302) for
  attribution + link safety, still landing native.

## 3. Friction reductions to make in the engine feed (concrete gaps today)

Current gaps found in `engine/app.js`:
- Deal cards (`CARD`, app.js:115) render **no actionable link** — the user finds a
  deal and has nothing to tap. Add a one-tap "View deal / Shop" anchor → the
  affiliate `goto` URL on every card.
- The email-preview `Shop at ${d.partnerName}` button (app.js:212) is **non-functional**.
  Make it the same live goto link, or remove it if it can't carry the real URL.
- Add a `landing` (or `goto`) field to the shared deal shape
  (currently `catalog.json` items have no URL) — the affiliate deep-link.
- Keep persona budget filtering + ranking; ensure the tap-through keeps the user's
  context (product SKU) so the merchant lands on the right item.

## 4. Guardrails (standing rules)

- No spend without approval. Affiliate/key integration that costs money (e.g.
  Amazon PA-API has fees beyond free tier) → state cost, get approval first.
- No secrets in repo: affiliate API keys live in GCP Secret Manager (BeanLaunch).
  AWS/PA-API keys, CJ/Impact credentials never in files.
- Keep the abstraction so engine discovery is unchanged; new sources = new
  feeds, same `get_matching_deals` contract.
