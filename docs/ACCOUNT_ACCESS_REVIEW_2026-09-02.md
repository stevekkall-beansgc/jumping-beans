# Account access UX — candidate for parent review

Date: 2026-09-02. Hub task: 173. No commit, push, tag, deployment, or release.

## Candidate and integration boundary

- Worktree: `/Users/stephenkall/beans/review-worktrees/jumping-beans-account-access`
- Branch: `ag/jumping-beans-account-access`, based on `1a1bb37`.
- The parent's existing five dirty onboarding files were copied into this isolated
  worktree before implementation. The canonical checkout remains unchanged.
- Incremental patch: `/private/tmp/jumping-beans-account-access.patch`. Apply it
  only against the preserved parent onboarding baseline; review before integration.
- The Hub task is recorded and gated; no runner was dispatched. Coordinator review,
  Hub disposition, integration, and release preflight remain with the parent.

## What changed

The global header now exposes Sign in or Account, with a generic signed-in status.
Account controls live in a focused `#account` view instead of Demo. Sync saving,
optional browser-memory import, and profile editing explain their account
requirement at point of use. Account features use one focused section at a time.
Browsing, setup, local drafts, browser saving, and apply-once remain anonymous.

Sign-in uses the existing `/auth/login` route with `returnTo=/#account`. A deliberate
allowlist preserves the preference draft, unfinished editor fields, requested
account action, and return location in this tab for up to 30 minutes. The temporary
record is consumed once, excludes identity, notes, receipts, and apply grants, and
cannot authorize an account write. Return drafts win over account hydration. If tab
storage is unavailable, the redirect is blocked with recovery copy.

The existing anonymous account response now adds `signInAvailable`, a boolean
based on the presence of the existing account binding and OIDC configuration.
It exposes no configuration values. The UI rejects missing/false readiness,
malformed responses, missing signed-in CSRF state, failed writes, and timeouts.
It offers retry and preserves anonymous use. Account errors render fixed copy;
identity-provider names/emails and raw error payloads are never rendered.

Account imports preview the exact current rules, display name, and browser-saved
notes. They require an unchecked-by-default consent checkbox. Only allowed note
fields are submitted; account-hydrated notes are not silently reclassified as
browser notes. Account writes keep visible keyboard focus and restore the page's
position. Native Back and explicit return controls retain the previous workspace.

## Changed files relative to the parent baseline

- `engine/index.html`: header entry, account view, account-only action entry points.
- `engine/app.css`: Bean-token account composition and narrow header layout.
- `engine/app.js`: account UI, gates, return state, request guards, local feedback.
- `engine/account-access.js`: pure gate copy, safe nickname, temporary draft rules.
- `engine/identity.mjs`: anonymous sign-in readiness boolean only.
- `engine/identity.test.mjs`: readiness and `/#account` return-path assertions.
- `scripts/account-access.test.mjs`: actual account-controller functions exercised
  in a deterministic DOM fixture, plus draft and privacy boundary tests.
- `scripts/check-product.mjs`: account checks and design/navigation assertions.
- `engine/static.js`: regenerated deployable assets.
- This review note.

No partner files, adapters, `engine/p0.js`, `engine/config.js`, transport, receipt,
consent, or WebMCP invocation/discovery code changed.

## Exact local checks

All commands exited 0:

| Check | Outcome |
| --- | --- |
| `node engine/identity.test.mjs` | Engine identity contracts pass |
| `node engine/personal-experience.test.mjs` | Personal experience hydration contracts pass |
| `node engine/preference-plane.test.mjs` | 6 tests pass, 0 fail |
| `node scripts/account-access.test.mjs` | Account access contracts pass |
| `node scripts/check-product.mjs` | 702 assertions pass |
| JavaScript syntax within product gate | 36 files pass |
| JSON parsing within product gate | 15 files pass |
| `node engine/bundle-static.mjs --check` | Current, 17 assets |
| `node scripts/sync-static-ui.mjs --check` | Current, pinned Bean Labs snapshot |
| `git diff --check` | No whitespace errors |

The account tests cover anonymous write denial, all three gate messages, exact
header states, identity/error non-rendering, explicit import consent, restoration
without apply consent, return view/focus/scroll, unavailable/configuration-missing
service, stale authentication, retry, and unavailable/expired/malformed tab storage.
Existing product checks cover WebMCP and consent contracts independently.

## Browser evidence and its limits

Observed in the in-app browser at `http://127.0.0.1:8789/`, with desktop
1280 × 900, narrow 390 × 844, and 320 × 900 viewports:

- Anonymous header entry and unconfigured-service message; setup and apply-once
  continue without sign-in. The unconfigured response uses the actual identity
  handler with no environment bindings.
- Sync and import sign-in explanations and the anonymous return action.
- Back restores unfinished rule text and focus to the originating sync action.
- A synthetic same-tab sign-in redirect restores the draft rule in the account
  review and returns it to the workspace as a draft, without applying it.
- Synthetic account save/profile success, unchecked import feedback, write-error
  redaction, entered-name retention, retry recovery, and generic signed-in header.
- Browser-local Save and apply, saved preferences after reload, and apply-once.
- `#network` and `#demo` navigation; Account returns to each. Browser Back from
  Account restores Network.
- Visible 3px keyboard focus. In a settled keyboard-submit measurement, the
  failed request retained `account-save-profile` focus and scrollY 452.5 before
  and after. No horizontal overflow at the tested sizes.
- Synthetic private identity/token strings were absent from rendered text.

Screenshots: `/private/tmp/jumping-beans-account-desktop.png` and
`/private/tmp/jumping-beans-account-narrow.png`.

The sign-in and signed-account browser cases use an isolated local fixture server,
not Google OIDC or production account storage. These are UI observations, not
production account or cross-device evidence. Unit tests corroborate the boundaries;
transport preservation is established by unchanged source and the existing gate.

## Open browser check

The final attempt to verify an unfinished edit of an existing rule across Account
and Back timed out while locating the returned “Edit preference” textbox. The
allowlisted draft code includes that editor and its rule identifier, and its
unit checks pass, but this browser path is **unverified and requires parent
review**. The earlier unfinished-new-rule return check passed. Work stopped at
the parent's request; no further investigation was performed.

## Production limitations / remaining parent work

- Real Google login/callback/logout, production writes/import/forget, session
  expiry, and separate-device hydration were not revalidated in this task.
- Readiness proves configuration presence; it cannot prove credentials, database
  migrations, provider health, or a subsequent OAuth exchange will succeed.
- The new UI and API should ship together so the readiness field is present.
- Redirect recovery is same-tab, temporary, and best effort. An expired record or
  cleared tab storage cannot restore an unsaved draft. Applied consent is never
  restored from the return record.
- Live partner discovery/execution was not proven by this local account QA. No
  fallback transport, simulated partner registry, or WebMCP bridge was introduced.
- Full screen-reader, dark-mode, and production-origin accessibility audits were
  not performed; native controls, semantic Bean tokens, and existing reduced-motion
  checks remain in place.

Reference for the small server-side change: Cloudflare's current
[bindings documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/)
and [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).
