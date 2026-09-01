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
| Product gate | PASS | `516 assertions passed` on main |
| CI | PASS | Gate and Jumping Beans checks passed for `9b756fc` |
| Public deployment | PASS | All four surfaces deployed by the release workflow |
| Anonymous account behavior | PASS | `GET /api/account` → `{"signedIn":false}` |
| Google login route | PASS | HTTP 302 to `accounts.google.com`; state/nonce/PKCE present; OIDC cookie redacted and Secure/HttpOnly/SameSite=Lax |
| Hosted UI | PASS | Account panel and explicit import controls present in deployed engine |
| Watch summary | PASS | Empty 30-day cohort returned from production D1 |
| Watch staging | PASS | HTTP 201 server-authoritative pending grant; no demand signal committed |
| Watch session controls | PASS | Bootstrap response includes redacted `HttpOnly; SameSite=Strict; Secure` cookie |
| Watch commit/replay/concurrency | OPEN | Deterministic and modeled D1 gates pass; fresh production commit proof remains required |
| Signed-in personal experience | PASS for one account | Google sign-in, hosted preference save, explicit two-note import, logout, relogin, and hosted-note restoration passed in the headed browser |
| Two-user isolation | OPEN | Requires two authenticated test identities in clean headed sessions |
| Stable/Canary native WebMCP | OPEN | Current Codex browser surfaces are not admissible clean extension-free evidence |

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

## Remaining release gates

1. Complete Google sign-in in a clean headed session and verify account-owned
   profile, preferences, memory, explicit import, forget, logout, expiry, and
   relogin behavior.
2. Repeat with a second authenticated test identity and prove that profile,
   memory, watches, receipts, and sessions cannot cross boundaries.
3. Run the full public journey in clean Chrome Stable and Canary without the
   Codex/ChatGPT extension: native discovery, three partner invocations,
   personalization, apply-once/save/forget, provenance, partial/no-match
   states, and a redacted native journey receipt.
4. Complete one explicitly approved Watch Co production commit, then verify
   same-payload replay, changed-payload conflict, same-key concurrency, and
   truthful summary behavior. The commit is a consequential demand-signal
   write and must be action-time confirmed before it is submitted.
5. Update the acceptance record with the fresh evidence, run release preflight,
   push the final release commit, and leave the working tree clean and synced.
