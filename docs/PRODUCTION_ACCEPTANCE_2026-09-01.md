# Jumping Beans — production acceptance packet

Date: 2026-09-01  
Release: `v0.5.1` (`ecaf97329ba1b0c3269e090bd3643fae04332a0e`)
Deployment: [Cloudflare workflow 33526038926](https://github.com/stevekkall-beansgc/jumping-beans/actions/runs/33526038926)
Decision: **CODE/DEPLOY PASS; COMPETITION ACCEPTANCE OPEN**

This packet records fresh production checks. It does not replace the required
clean extension-free Stable/Canary native WebMCP run, and it makes no claim
that the competition gate is complete.

## Public surfaces

- Engine: `https://jumping-beans-engine.steve-k-kall.workers.dev/`
- Petsupply: `https://petsupply.pages.dev/`
- Coffee Co: `https://coffee-amk.pages.dev/`
- Watch Co: `https://watch-ce8.pages.dev/`

## Fresh checks

| Check | Result | Evidence |
|---|---|---|
| Product gate | PASS | `517 assertions passed` on main |
| CI | PASS | Gate and Jumping Beans checks passed for `9b756fc` |
| Public deployment | PASS | All four surfaces deployed by the release workflow |
| Anonymous account behavior | PASS | `GET /api/account` → `{"signedIn":false}` |
| Google login route | PASS | HTTP 302 to `accounts.google.com`; state/nonce/PKCE present; OIDC cookie redacted and Secure/HttpOnly/SameSite=Lax |
| Hosted UI | PASS | Account panel and explicit import controls present in deployed engine |
| Watch summary | PASS | Empty 30-day cohort returned from production D1 |
| Watch staging | PASS | HTTP 201 server-authoritative pending grant; no demand signal committed |
| Watch session controls | PASS | Bootstrap response includes redacted `HttpOnly; SameSite=Strict; Secure` cookie |
| Watch commit/replay/concurrency | PASS for approved smoke | One concurrent request committed, the other replayed; same-payload replay returned the original receipt; changed-payload replay returned HTTP 409; summary showed one `$123.45` record |
| Signed-in personal experience | PASS for one account | Google sign-in, hosted preference save, explicit two-note import, logout, relogin, and hosted-note restoration passed in the headed browser |
| Two-user isolation | PASS for hosted memory boundary | First account restored two hosted notes; second authenticated identity reported no hosted product notes while the same browser retained only local notes |
| Canary native WebMCP capability | PASS | Clean Chrome Canary 154 reported native `modelContext`, `crossOriginIsolated: true`, exactly three allowlisted partner tools, and native partner calls returned bounded offers from all three origins |
| Stable native WebMCP | OPEN | The clean Stable process is available, but the approved browser controls cannot attach to its isolated window in this session |

No secret, raw session token, OAuth state, nonce, code verifier, CSRF token,
or personal profile payload is included in this packet.

## Resolved hosted-account run

After v0.5.1 deployed, the same signed-in browser session completed the
following sequence:

1. The account initially reported no hosted product notes while the browser
   held two local notes.
2. The user explicitly approved import; the UI reported `Selected browser
   memory imported to your account`, reset the checkbox, and reported two
   hosted product notes.
3. Logout returned the page to anonymous mode while leaving the browser-local
   notes visible.
4. Relogin with the same Google account returned to the signed-in state and
   restored the two hosted product notes.

The first attempt correctly failed closed with `csrf-rejected` after an
account-preference save exposed a client token-retention defect. Terra fixed
that defect in `7f9f95b`; Luna reviewed it; main integrated it as `ecaf973`;
CI passed at 517 assertions; and v0.5.1 redeployed it. No rejected import
uploaded the notes.

## Clean Canary native WebMCP run

In an extension-free Chrome Canary 154 window, the public engine reported
`typeof document.modelContext === "object"` and `crossOriginIsolated === true`.
Native `getTools({ fromOrigins })` returned the engine tools plus exactly one
`get_matching_deals` tool for each of Petsupply, Coffee Co, and Watch Co. Native
`executeTool()` calls (serialized input, as required by this Chromium build)
returned bounded results from all three origins: 1, 9, and 24 offers
respectively. A redacted native `get_journey_receipt()` call also returned the
journey/capability receipt with the three connected origins. Because this
console run did not complete the page's explicit apply action, its receipt had
zero exposed offers and is not counted as the full public-journey acceptance.

## Second-account isolation run

The user completed Google sign-in for a separate test identity. The resulting
headed session reported a signed-in account with no saved hosted product notes,
while the browser still displayed the first account's two browser-local notes.
This proves the hosted memory boundary is account-scoped and does not inherit
the first account's imported notes. No profile payload, credential, token, or
secret is included here.

## Remaining release gates

1. Complete the remaining account-owned forget, expiry, reload/cross-device,
   and relogin checks; the two-account hosted-memory boundary is now proven.
2. Repeat production isolation for watches, receipts, and sessions, not only
   hosted memory.
3. Complete the explicit-apply native journey receipt in clean Canary, then
   run the full public journey in clean Chrome Stable without the
   Codex/ChatGPT extension: native discovery, three partner invocations,
   personalization, apply-once/save/forget, provenance, partial/no-match
   states, and a redacted native journey receipt.
4. Retain the approved Watch Co smoke evidence above and reconcile the final
   acceptance record after the remaining browser lanes pass.
5. Run release preflight for the final acceptance documentation, push the final
   release commit, and leave the working tree clean and synced.

## Approved production Watch smoke

The approved smoke used SKU `NIV-77007Q45` at `$123.45`. Watch Co staged a
server-authoritative pending grant, then two identical commit requests were
sent concurrently:

- first response: HTTP 201, `committed`;
- second response: HTTP 200, `replayed`;
- later same-payload replay: HTTP 200, `replayed`;
- changed-payload replay: HTTP 409, `idempotency-conflict`;
- public summary: count 1, median/min/max `$123.45`, 30-day window.

The record is explicitly non-binding demand research. No notification,
purchase, reservation, or payment was created.
