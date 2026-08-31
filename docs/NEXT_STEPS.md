# Jumping Beans — next steps

Status: working prototype shipped and design/release foundation codified.
Last updated: 2026-08-31.

## Current baseline

- The core thesis is demonstrated: a user-owned advertising and offer memory
  layer records offer context, explains provenance, lets the user control
  preferences, and changes which offer collateral is shown and how it is
  presented.
- The engine and three partner surfaces are live on Cloudflare. The current
  release is `jumping-beans v0.2.0`; the shared Bean Labs design system is
  `beanlabs v0.3.0`.
- Offer inventory currently comes from open/public sources and normalized demo
  catalogs. Partner opt-in is demonstrated as an enrichment path, not a
  prerequisite for inventory.
- The Bean Labs UI standard is centrally owned, copied with provenance into
  each static deployment, checked locally and in CI, and deployed through the
  repository-owned GitHub Actions workflow.

## Next phase, in order

### 1. Make the demo journey unmistakable

- Tighten the Site A → user preference/memory → Site Y journey so it can be
  completed in one short guided path.
- Show the same offer with a visibly different presentation rule, such as
  testimonials, video, proof, or concise comparison detail.
- Add a repeatable headed-Chrome acceptance script covering partner discovery,
  preference save/apply-once, forget, provenance, and the resulting rendering
  change.

### 2. Strengthen the user-owned memory model

- Define the smallest durable records for an observed offer, user preference,
  presentation rule, scope, source, timestamp, and retention.
- Make every retained fact inspectable, editable, forgettable, and clearly
  distinct from an inferred interest or an unverified claim.
- Keep passive understanding conservative: explain the evidence, avoid
  sensitive-attribute inference, and default to user control.

### 3. Expand open offer inventory without changing the thesis

- Add more reliable public/open feeds and normalize them into the existing
  offer structure.
- Preserve explicit source, freshness, verification, and illustrative-fallback
  labels.
- Treat partner catalogs and WebMCP opt-in as a benefit demonstration: richer
  collateral, fresher facts, and better matching for partners that participate.

### 4. Add product-grade persistence and measurement

- Move demo-only browser persistence behind a small user-scoped storage layer
  with clear retention and deletion behavior.
- Define privacy/compliance boundaries before adding account connections or
  identity signals; do not import Meta, Google, TikTok, or other account data
  until the consent and data-use model is explicit.
- Measure whether preference-aware presentation improves useful engagement,
  while keeping user controls and provenance visible.

### 5. Keep the operating system healthy

- Continue all shared UI work through the central Bean Labs design system and
  its generated, hashed adapters.
- Keep product changes behind the local gate, exact-head CI, gated Agency work,
  and repository-owned Cloudflare deployment.
- Revisit the separate affiliate-account task only when credentials, cost, and
  partner terms are explicitly approved.

## Definition of next-phase done

An evaluator can start with an open-inventory offer on Site A, understand and
edit what is remembered, carry a selected preference to Site Y, see the same
offer rendered with that preference applied, inspect why it appeared, and
forget the preference—using the live Cloudflare demo with repeatable evidence.
