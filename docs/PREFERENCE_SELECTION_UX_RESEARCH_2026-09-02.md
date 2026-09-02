# Preference-selection UX research memo

Date: 2026-09-02  
Scope: interaction-design research only. No implementation, release, deployment, or production claim is made by this memo.

## Executive recommendation

Replace the three-path setup plus chat/editor/review sequence with **one
intent-first preference canvas**: a small structured selection (category and
optional budget), an optional free-form field, an immediately editable summary
of what was understood, and one explicit "Show matching offers" commitment.
That commitment contains a clearly selected retention choice: **this visit** or
**save in this browser**. Account sync becomes an optional, post-result upgrade,
not a third choice at the moment someone is trying to get results.

Keep the existing preference-plane data model, anonymous use, exact
save/apply-once distinction, browser-local saving, account gate, and native-only
WebMCP invocation boundary. This is a change to how people form and approve the
same preference plane, not a proposal for a new transport or retention model.

## Evidence and limits

### Observed browser behavior

I reviewed the current dirty canonical-checkout candidate at
`http://127.0.0.1:8082/` in the in-app browser. The session already had a
browser-saved selection for watches, so I observed both saved and fresh-draft
states. I did not press an apply/save action: doing so would persist data and
invoke connected partner surfaces. Findings below labeled **observed** are from
the rendered UI and its interaction states, not a production claim.

| Moment | Observed behavior |
| --- | --- |
| Saved entry | The first screen says “Your preferences are ready to review” and offers `Review saved preferences` and `Start fresh`. It explains the saved copy remains unchanged until replacement or Forget. |
| Saved review | The review shows feed style, category scope, scope/retention/outcome facts, then `Fine-tune preferences`, `Back to setup options`, `Start over with a blank draft`, `Save and apply`, `Apply once without saving`, and `Save to account for sync`. |
| Fine-tuning | One expanded card contains category, feed style, price ceiling, “Add another preference in your own words,” and a second rule composer with an everywhere/category selector plus per-rule Edit/Pause/Forget. |
| Words candidate | `Describe it in your own words` opens a focused chat. A submitted sentence receives a generic acknowledgement; `Continue to review` is then enabled. The header and product hero are hidden during chat and its completed review. |
| Interpretation | “Show repair options first under $200” became both `Budget: Up to $200.00` and the raw everywhere rule “Show repair options first under $200.” The review does not indicate which portion was parsed or offer inline correction. |
| Account handoff | `Save to account for sync` opens a separate account view. In the local anonymous configuration the account service was unavailable; the UI retained the draft and continued to offer anonymous use. This matches the account-access design intent. |
| Narrow view | In a 390 x 844 viewport review, the preference review, edit/back/restart controls, retention choice, and account-sync action remain a long vertical sequence before any results action. |

The current account behavior and privacy boundary are corroborated by
[`ACCOUNT_ACCESS_REVIEW_2026-09-02.md`](ACCOUNT_ACCESS_REVIEW_2026-09-02.md).
The production packet establishes native discovery and execution evidence, but
does not establish the usability of this candidate:
[`PRODUCTION_ACCEPTANCE_2026-09-02.md`](PRODUCTION_ACCEPTANCE_2026-09-02.md).

### Inferred UX judgment

The critique and recommendation below are professional interaction-design
judgment, based on those observations, source review, the project plan, and the
design-system guidance. They are hypotheses to validate with users, not claims
that usability testing has already proven them.

## Why the current mechanics feel poor

1. **The starting choice asks for an interaction style, not the user’s goal.**
   `Start with a style`, `Describe it in your own words`, and `Set up manually`
   imply three different products. They ultimately construct the same
   preference plane. A person trying to find something must first decide how
   they would like to configure the system.

2. **The words path performs conversation without conversational value.**
   Each message gets the same acknowledgement and the useful interpretation is
   deferred to a second screen. That adds a Send/Continue transition without
   helping a person resolve ambiguity, see what changed, or correct it. The
   focused layout also removes the usual page context, making it feel like a
   separate mode rather than an optional way to express a preference.

3. **One fact appears in two semantic forms.**
   In the observed example, a price ceiling was both structured budget and part
   of the raw rule. The user cannot tell whether changing one changes the other
   or which value reaches partners. This undermines the product’s otherwise
   strong inspectability promise.

4. **The editor exposes implementation concepts too early.**
   Feed style, category, price, free-form prompt, rules, scopes, active/paused
   state, and per-rule lifecycle controls are all available before someone has
   demonstrated a need for them. “Everywhere” versus “For this category” is a
   worthwhile advanced control, but it competes with the initial task.

5. **The commitment is split across three competing outcomes.**
   `Save and apply`, `Apply once without saving`, and `Save to account for
   sync` are all reasonable capabilities, but in one visual decision area they
   force a person to understand browser persistence, partner application, and
   cross-device account storage before seeing the product’s payoff. The action
   a new user most likely wants—see the results—is absent from that moment.

6. **The feedback loop is too indirect.**
   Applying performs a new resolution, but the UI then offers `See your
   results`. The person has had to complete input, review, choose retention,
   and then make another navigation decision to verify the effect. On mobile,
   the result is physically and conceptually distant from the selection.

7. **Back, restart, and start-over overlap.**
   The chat has Back and Restart; the review has Back and Start over. Their
   different effects are defensible in code, but their labels make the user
   learn state-machine distinctions before they have a result.

8. **Trust information is accurate but placed as a reading task.**
   Scope, retention, sharing, and outcome are essential here. Repeating them as
   a dense definition list and a second consent callout makes people scan
   policy before they can act. Trust should be concise at the decision point,
   with details available on demand.

## Selection models worth considering

### A. Intent-first preference canvas — recommended

One surface starts with the product/context, then offers structured constraints
and an optional plain-language preference. It turns every input into visible,
editable summary chips before the user asks for results.

**Strengths:** lowest cognitive load; works equally well with typing, touch,
and keyboard; makes parsing inspectable; naturally supports privacy disclosure
and a single result-oriented action.

**Risk:** it is less theatrically “AI chat.” Mitigate by making the live
understanding genuinely useful rather than simulating a conversation.

### B. Guided conversational interpreter

Keep a conversational entry but make each turn produce an explicit, editable
interpretation card: “I heard: Watches; under $200; prioritize repairability.”
Ask one targeted clarification only when confidence is low or a value conflicts.
The conversation ends automatically when the person chooses `Show matching
offers`.

**Strengths:** approachable for complex, narrative intent; can minimize form
language for people who prefer speech-like input.

**Risk:** still introduces turn-taking, visual history, and scroll management.
It is only justified if interpretation is materially better than a compact
composer. The current generic acknowledgement is not sufficient.

### C. Results-first filter tray

Show open inventory immediately, with a persistent “Refine these results” tray
or mobile bottom sheet. Preferences are adjusted against visible offers and can
then be applied to opted-in partners.

**Strengths:** immediate value and an easy before/after comparison; good for
returning browsing users.

**Risk:** it can blur “open inventory” and partner-enabled results, and invites
the user to change preferences after viewing results without understanding when
sharing occurs. It needs especially careful source/provenance labeling.

## Recommended model: intent-first canvas

### Compact wireframe

```text
Tell us what to prioritize                         [Saved selection ▾]

Shopping for       [ watches, dog gear, or anything ]
Budget             [ Any budget ▾ ]  (optional)
Anything else?     [ Prefer repair options first                 ]

We’ll use
[Watches ×] [Up to $200 ×] [Repair options first ×]       [Edit details]

Only these items will be sent to opted-in member sites when you continue.
Nothing is saved yet.                                      [What’s shared?]

Use for:  (• This visit only)  (  Save in this browser)
                                  [ Show matching offers ]

After result:
Using: Watches · up to $200 · repair options first  [Change]
Results / loading / no-match / degraded-state explanation
Saved in this browser. [Sync this saved selection across devices] (optional)
```

“Shopping for” can be blank when the product supports a broad, non-category
intent. It should not fabricate a category from free text. The initial canvas
is not a wizard: all basic controls stay visible and the summary changes in
place.

### State model

```text
Fresh or saved entry
        |
        v
Draft canvas <--------------------- Edit / Change <----- Results
  |       |                                             ^
  |       +-- explicit Discard --> Fresh/saved entry    |
  v                                                     |
Reviewable exact summary + retention choice              |
  |                                                     |
  +-- This visit only --> native apply --> resolving ----+
  |
  +-- Save in browser --> local save + native apply -----+
                                                        
Results --> optional “Sync across devices” --> Account review/sign-in
                                           --> return to unchanged Results
```

No path silently saves, shares, imports, or applies. A failed or unavailable
partner resolution remains a result state with the selection summary and an
obvious `Change selection` action.

### Interaction specification

1. **Entry and returning state.** A first-time visitor lands directly on the
   canvas. A returning browser-local user sees a compact “Saved selection:
   Watches · up to $200” summary with `Use saved selection`, `Edit`, and an
   overflow/management path containing `Forget`. Do not make “start fresh” a
   peer to the main result action.

2. **Basic structured constraints.** Category and budget are first-class
   controls. Budget has an `Any budget` default, a number input when enabled,
   and a visible currency label. These are not expressed as rules.

3. **Free-form words.** “Anything else?” is optional and can accept one or
   many sentences. After entry/brief pause, extract only high-confidence facts
   into chips. Preserve the remaining meaningful wording as an “Other priority”
   chip. For the observed sentence, display `[Up to $200]` and `[Repair options
   first]`, not both a $200 chip and the unedited original sentence. A chip is
   removable; selecting it opens a small, direct editor. Ask one plain-language
   clarification for low-confidence category/budget extraction rather than
   guessing.

4. **Progressive detail.** `Edit details` reveals feed/presentation format and
   advanced scope controls. Do not show rule state, pause, or category-scoped
   override management until there is more than one saved rule or the user
   explicitly chooses “Use this only for [category].” Existing stored rules
   still migrate intact and remain editable in a management view.

5. **Exact trust moment.** Directly above the commitment, state the current
   fact: “Only [category, budget, priorities] will be sent to opted-in member
   sites when you continue.” A short `What’s shared?` disclosure can name
   native WebMCP, partner eligibility, and the absence of a purchase/message.
   It replaces repeated broad policy copy without removing it.

6. **One commitment with selected retention.** The radio/segmented choice is
   “This visit only” by default and “Save in this browser.” The sole primary
   button is `Show matching offers`. Its accessible name/state incorporates the
   selection, e.g., “Show matching offers for this visit only.” Existing
   semantics map exactly: visit-only = Apply once; browser save = Save and
   apply.

7. **Results are the immediate next state.** On activation, show a resolving
   state in the same workspace, retain the selection summary, then show open
   baseline and opted-in partner outcomes with the existing provenance,
   comparison, partial-failure, and no-match language. There is no extra “See
   your results” decision. `Change selection` returns to the populated draft.

8. **Account sync is progressive disclosure.** After a browser-saved result,
   offer a quiet “Sync this saved selection across devices” action. On explicit
   selection, use the existing focused account view and account gate. Make clear
   that signing in and saving to account do not apply to partners or import any
   other browser memory automatically. Keep anonymous browsing, temporary use,
   browser saving, and editing available throughout.

9. **Back, discard, and Forget.** Back means return to the populated draft;
   it never deletes it. `Discard draft` is the only unsaved-draft destructive
   label. `Forget saved selection` is available only in saved-state management,
   names its browser/account scope, and receives a confirmation appropriate to
   the storage target. Eliminate “Restart conversation” because the recommended
   model has no separate conversation state.

## What to remove, consolidate, defer, and disclose progressively

| Action or information | Recommendation |
| --- | --- |
| Three setup paths | **Remove.** Replace with the one canvas; optional free-form input is a field, not a path. |
| Chat log and generic replies | **Remove.** If a conversation is later retained, require per-turn interpreted chips and targeted clarification. |
| Separate raw prompt and rule composer | **Consolidate.** One free-form input creates inspectable structured chips and, only where needed, an “other priority.” |
| Feed style | **Defer.** Set a sensible default; expose in `Edit details` or after a person sees results. |
| Everywhere/category scope | **Defer.** Default the current search/draft scope; reveal only when saving/editing multiple preferences. |
| Pause/Use again/per-rule controls | **Defer.** Put them in saved-selection management rather than first-run setup. |
| Scope/retention/outcome blocks | **Consolidate.** Use one exact one-line sharing statement beside the commitment and a details disclosure. |
| Save/apply/temporary/account buttons | **Consolidate.** Retention selector + one result button. Move sync to post-result account progression. |
| “See your results” | **Remove.** Results follow the commitment immediately. |
| Demo/WebMCP details | **Progressively disclose.** Keep under “How this works,” separate from selection and results. |
| Legacy demo preference controls | **De-emphasize or isolate.** They are useful for protocol demonstration but compete with the primary product selection model. |

## Constraint handling

### Free-form words

Free text remains user-owned source material. The UI must show the exact
interpreted result before any sharing; it should not imply a language model
understood more than it did. Parsing is a convenience, never authorization.
Keep raw prose only when it carries meaning not represented by structured
fields. Avoid retaining raw prompts in default telemetry, consistent with the
project plan.

### Category and budget

Category and max price are visible structured fields, with values mirrored in
the outgoing preference-plane payload. A parsed budget modifies the budget
field; it does not generate a duplicate rule. A category-scoped preference
cannot be created until a category is explicit. This makes the existing
`effectiveRules` behavior explainable rather than hidden.

### Editing and recovery

Edits occur against the summary, not by reopening a large editor. Input changes
produce a draft and clearly mark the active results as using the last approved
selection until the person applies again. Back preserves draft; discard and
Forget are deliberate, separately named actions. Reapply results in place after
an edit so users can compare outcome changes.

### Saved state and account

Browser-local saving stays a default anonymous capability. The saved summary
must identify scope (“in this browser”) and offer review/edit/forget. Account
sync remains an explicit, gated copy: no sign-in redirects, uploads, imports,
or cross-device assumptions happen merely because a person has saved locally.
Account imports retain their existing unchecked consent boundary and exact
preview.

### Results and privacy

Only the approved preference plane travels during native WebMCP invocation;
account data, identity, receipts, and unapproved draft fields do not. The
result view retains existing source labels, verification distinctions,
partner-health/no-match states, and consequential-action staging. A preference
selection is never presented as a purchase, notification, or authorization.

## Smallest safe migration sequence

1. **Establish baseline observations without raw prompt collection.** Record
   funnel events using the existing redaction principles: canvas shown, a basic
   constraint added, free text interpreted, review correction, visit-only vs
   browser-save choice, applied result/no-match/degraded result, and optional
   sync entry. Do not add raw free text to telemetry.

2. **Introduce the canvas as a presentation layer over the current
   `PreferencePlane`.** Reuse category, `maxPrice`, formats, rules,
   `reviewPreferencePlane`, save/apply helpers, storage keys, and account
   boundaries. Initially leave the legacy editor behind an internal/temporary
   route only if needed for regression comparison.

3. **Replace the words chat with interpretation chips.** Preserve the current
   deterministic parser at first, but show its extracted budget/formats and the
   remaining rule immediately. Add correction/removal before changing parsing
   breadth. Do not infer a category where one is not explicit.

4. **Replace the three action buttons with retention selection plus `Show
   matching offers`.** Map it to the unchanged `applyPreferences({persist})`
   behavior. Keep exact retention/sharing copy and test both paths before
   moving account affordances.

5. **Bring results forward.** On successful apply, make the resolution result
   the next visible state with loading, no-match, partial-failure, and retry
   behavior. Retain the current provenance and decision receipt.

6. **Move account sync after browser-saved results.** Reuse existing account
   draft preservation, availability checks, consented import, and return flow.
   Do not change identity APIs or storage scope in this UX migration.

7. **Progressively hide advanced rule management, then remove the obsolete
   paths only after migration and accessibility checks pass.** Existing saved
   rules must continue to render, edit, pause, and forget correctly.

8. **Refresh only the appropriate static bundle and run the existing local
   gates when implementation is authorized.** This memo does not authorize a
   deploy, release, transport change, or production readiness claim.

## Acceptance criteria

### Interaction and clarity

- A first-time anonymous user can express category, optional budget, and an
  optional preference in one workspace and reach a clear result action without
  choosing a setup mode.
- Every extracted fact is visible, editable, and removable before it is shared;
  a structured value is never duplicated as an unexplained raw rule.
- There is exactly one primary first-run commitment: `Show matching offers`.
  Its retention mode is visible and defaults to this visit only.
- Results, including loading, no-match, and degraded/partial-partner states,
  appear immediately after commitment; users do not need a second result
  navigation choice.
- Back preserves a draft; discard and Forget name their target and scope. No
  action silently saves, applies, shares, imports, or deletes.

### Privacy, account, and protocol

- Anonymous users can complete temporary use and browser-local save without
  sign-in. Browser save and account sync are visually and behaviorally distinct.
- Sync is unavailable until explicitly requested; account sign-in does not
  auto-save/apply/import, and existing draft-return limits remain intact.
- The exact approved preference-plane fields and their partner-sharing scope
  are shown immediately before invocation.
- No bridge, fallback, direct capability endpoint, server-side tool gateway,
  polyfill, or non-native transport is introduced. Existing native WebMCP
  discovery/invocation behavior remains unchanged.

### Accessibility and responsive behavior

- Keyboard users can complete draft, edit an interpreted chip, choose retention,
  apply, reach results, and return to editing with visible focus and logical
  focus placement.
- Semantics use one page H1, native labels/inputs/radios, persistent error/status
  messages, and no chat-log announcement of historical content.
- At 320 px, 390 px, 400% zoom, and desktop widths, no horizontal scrolling,
  clipped targets, or ambiguous button grouping occurs; result status remains
  close to the selection summary.
- Reduced motion, light/dark schemes, and browser-storage/account-unavailable
  recovery remain usable.

## Test and observation plan

1. **Five to eight moderated usability sessions**, split between people who
   prefer forms and people who naturally use prose. Ask participants to find a
   product under a budget, state one qualitative priority, use once, edit it,
   save it, and explain what would be sent and retained. Do not test with
   sensitive personal needs or retain their typed text.

2. **Task measures:** completion rate; time to first result; number of
   backtracks; selection-correction rate; false beliefs about saving/sharing;
   ability to distinguish this-visit, browser-save, and account-sync; and
   comprehension of no-match/partial-partner results. Observe confusion rather
   than treating clicks as proof of understanding.

3. **Accessibility review:** keyboard-only, screen reader, 320/390 mobile,
   400% zoom/reflow, reduced motion, and high contrast. Explicitly test focus
   after parsed-chip edit, validation error, apply, account return, and no-match.

4. **Deterministic regression:** preserve normalization, scope precedence,
   save/apply-once, Forget, account draft restoration, explicit import consent,
   source/provenance labels, native discovery, and partner partial-failure tests.
   Add tests that parsed `$200` yields one visible budget fact; draft edits do
   not affect applied results until re-applied; and results appear after the
   single commitment.

5. **Read-only browser verification:** inspect fresh, saved, browser-storage
   unavailable, account unavailable, signed-in return, no-match, and partial
   partner states. Treat production WebMCP evidence as a separate acceptance
   gate; do not conflate a local UX pass with production or competition
   readiness.
