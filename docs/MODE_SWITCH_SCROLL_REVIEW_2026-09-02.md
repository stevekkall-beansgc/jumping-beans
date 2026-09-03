# Chat/manual mode-switch scroll review

Date: 2026-09-02. Local candidate only; no commit, tag, push, deployment or release.

## Diagnosis and fix

The in-app browser's locator click reproduced a desktop scrollY change from
0 to 114.5 at 1280×900. The visible button's center was at 564.3828125px;
the resulting scroll placed it near the viewport center (450px). Ordinary
pointer clicks at the button's visible coordinates preserved 0 in both
directions before the fix. The workspace remained 306px tall throughout.
At 390×844 the same locator behavior centered the button; ordinary clicks
again preserved 0 and a 354px workspace. The observed large jump therefore
comes from locator preparation, rather than the mode render or its existing
`focus({ preventScroll: true })` call.

A second, product-level case was verified: a smooth scroll already pending
when a switch activates continued afterward. The new regression fails on the
preserved baseline with click-dispatch scrollY 100 and settled scrollY 0.
The fix snapshots both scroll coordinates at entry to `setCanvasEntryMode`
and restores them with `behavior: "instant"` after rendering and focusing.
This also cancels pending smooth scrolling. Global navigation CSS, layout,
input handling, retention and transport remain unchanged. See the browser
semantics for [scroll behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-behavior)
and [focus without scrolling](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus).

The guarantee starts at handler dispatch. Product code cannot undo a
locator's completed pre-click centering without interfering with legitimate
user scrolling. The regression explicitly positions the page before measuring
and uses visible-coordinate pointer clicks or native Tab/Enter; it does not
scroll the locator into view as part of the measured action.

## Exact incremental files

- `engine/app.js`: four added lines in the mode-switch handler, including comment.
- `engine/static.js`: regenerated; `/app.js` is the only changed bundled route.
- `scripts/preference-canvas.test.mjs`: window fixture supports instant scroll restoration.
- `scripts/chat-mode-scroll.browser.mjs`: focused headed browser regression.
- This review note.

The existing dirty chat-first candidate was preserved in the canonical checkout
as requested. Initial snapshot: `/private/tmp/jumping-beans-scroll-baseline/`.
Its existing patch is `existing-candidate.patch`. The pre-existing changes in
`engine/app.css`, `engine/index.html`, `engine/preference-canvas.mjs`,
`scripts/account-access.test.mjs`, `scripts/check-product.mjs` and the untracked
`scripts/chat-entry.browser.mjs` match that initial snapshot exactly.

## Verification

All final checks exited 0:

| Check | Result |
| --- | --- |
| `node scripts/check-product.mjs` | 659 assertions; 41 JavaScript and 20 JSON files checked |
| `node scripts/preference-canvas.test.mjs` | Pass |
| `node scripts/account-access.test.mjs` | Pass |
| `node engine/bundle-static.mjs --check` | Current, 18 assets |
| `node scripts/sync-static-ui.mjs --check` | Current, pinned Bean Labs snapshot |
| `git diff --check` | Clean |
| `node scripts/chat-mode-scroll.browser.mjs` | 16 cases; 96 stable switches; 16 pending-scroll cases; no page errors |
| Existing `node scripts/chat-entry.browser.mjs` | 6 cases; no page errors |

Browser scripts used local `CHAT_TEST_URL=http://127.0.0.1:8082`, installed
Playwright via `PLAYWRIGHT_MODULE`, and headed Google Chrome 152.0.7977.65 via
`CHROME_EXECUTABLE`. The focused matrix covers 1280×900, 390×844, 320×900 and
320×568, each in light/dark and normal/reduced motion. Both directions retain
exact scroll and workspace geometry immediately and throughout 650ms of frame
sampling. Pointer and keyboard cases preserve typed words, the manual budget
correction, visit retention, one offer commitment, and an editable interpretation.
Assertions require no horizontal overflow and the focused field fully within
the viewport. The short 568px screen starts at scrollY 200 to reach the button;
other sizes test 0. All sizes also test a further 100px of ordinary scrolling.

The existing browser suite additionally verifies invalid budgets, Account and
Back, visit-only use, browser saving, Forget, and category-scope recovery.
It retains its original reduced-motion scope; the new suite supplies normal-
motion and frame-by-frame scroll coverage.

Direct in-app pointer checks against the canonical candidate, including the
existing saved-selection disclosure, measured:

| Viewport | Chat → manual | Manual → chat | Workspace height | Overflow |
| --- | --- | --- | --- | --- |
| 1280×900 | 0 → 0 | 0 → 0 | 306px unchanged | None |
| 390×844 | 0 → 0 | 0 → 0 | 354px unchanged | None |
| 320×900 | 0 → 0 | 0 → 0 | 354px unchanged | None |

Evidence: `/private/tmp/jumping-beans-scroll-evidence/scroll-results.json`,
`in-app-results.json`, `in-app-320-chat.png`, 16 matrix screenshots, and check
logs in that directory. Broader browser results and screenshots are in
`/private/tmp/jumping-beans-scroll-entry-evidence/`. The preserved baseline
failed the pending-scroll assertion with `0 !== 100` on localhost port 8891;
the temporary baseline server was used only for static UI testing.

Independent source review found no blocking product issue. Its focus-visibility
coverage finding was addressed with full viewport containment and reviewed
again with no remaining actionable findings.

## Limits

No new native WebMCP execution, real account/OIDC, cross-device, production
origin/header, physical mobile keyboard or mobile Safari verification was
performed. Existing native-only, consent, identity and privacy contracts pass
the product gate. No transport, endpoint, bridge, analytics or monitoring code
was added. A browser locator that deliberately centers a button can still move
the viewport before activation; use native pointer/keyboard interaction when
evaluating the product's in-place behavior.
