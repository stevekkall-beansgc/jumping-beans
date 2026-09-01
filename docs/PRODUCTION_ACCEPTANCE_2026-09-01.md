# Jumping Beans — production acceptance packet

Date: 2026-09-01  
Release: `v0.5.2` (`fa51ded5b2aa8e40e3027a9bdaf3711c68395cde`)
Deployment: [Cloudflare workflow 33538384695](https://github.com/stevekkall-beansgc/jumping-beans/actions/runs/33538384695)
Decision: **OPERATIONAL DEMO GO; COMPETITION ACCEPTANCE OPEN**

This packet records fresh production checks. It does not replace the required
clean extension-free Stable/Canary native WebMCP run, and it makes no claim
that the competition gate is complete.

Mobile continuity is accepted as supplemental operational evidence for the
personal experience. It does not replace clean desktop Stable native WebMCP
evidence.

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
| Watch summary | PASS | 30-day production D1 cohort returned 2 active signals at `$123.45` |
| Watch staging | PASS | HTTP 201 server-authoritative pending grant; no demand signal committed |
| Watch session controls | PASS | Bootstrap response includes redacted `HttpOnly; SameSite=Strict; Secure` cookie |
| Watch commit/replay/concurrency | PASS for approved smoke | One concurrent request committed, the other replayed; same-payload replay returned the original receipt; changed-payload replay returned HTTP 409; summary showed one `$123.45` record |
| Signed-in personal experience | PASS for one account | Google sign-in, hosted preference save, explicit two-note import, logout, relogin, hosted-note restoration, second-account reload persistence, and disposable hosted-note forget passed in headed browsers |
| Two-user isolation | PASS for hosted memory and separate Watch session | First account restored two hosted notes; second authenticated identity reported no hosted product notes, retained only local notes, and independently committed an approved Watch signal |
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
respectively. The page's explicit Alex-context/apply-once journey then returned
a redacted native `get_journey_receipt()` with 37 considered, 24
eligible/relevant, 12 exposed, and the three connected origins. The visible
page reported the applied-once outcome and an opted-in partner result.

## Second-account isolation run

The user completed Google sign-in for a separate test identity. The resulting
headed session reported a signed-in account with no saved hosted product notes,
while the browser still displayed the first account's two browser-local notes.
This proves the hosted memory boundary is account-scoped and does not inherit
the first account's imported notes. No profile payload, credential, token, or
secret is included here.

Reloading the second-account session preserved its signed-in state and still
reported no saved hosted product notes. The browser-local two-note set remained
separate, confirming reload hydration does not cross account boundaries.

For the disposable lifecycle check, the second account explicitly imported its
two local notes, verified two hosted notes, then used the account-level forget
control. The hosted count returned to zero while the two browser-local notes
remained. The first account's hosted notes were not removed.

In a separate production Watch session, the second identity staged and
confirmed the approved non-binding `$123.45` target for `NIV-77007Q45`. The
merchant view then showed two active signals in the deployed D1 aggregate,
with the expected `$123.45` median/range. No notification, purchase,
reservation, payment, or account credential was created.

## Remaining release gates

1. Complete the remaining account-owned expiry check and a true cross-device
   hydration check; hosted forget, two-account memory isolation, and reload
   behavior are now proven.
2. Repeat production isolation for watch records, receipts, and sessions, not
   only hosted memory and a separate Watch write.
3. Preserve the clean Canary native journey receipt evidence and run the full
   public journey in clean Chrome Stable without the Codex/ChatGPT extension:
   native discovery, three partner invocations, personalization, apply-once/
   save/forget, provenance, partial/no-match states, and a redacted native
   journey receipt.
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
