# Bean Labs design-system adapter

Jumping Beans follows the Bean Labs design-system release `beanlabs@db815c6`.
This repo carries a reviewed snapshot in `vendor/beanlabs-design-system` so a
standalone checkout and CI run do not depend on a sibling workspace. The source
files products must read before a material refresh are `README.md`,
`CONTRACT.md`, `COMPONENTS.md`, `PATTERNS.md`, `COMPOSITIONS.md`,
`tokens.json`, `tokens.css`, and `primitives.css`.

`tokens.json` is the canonical token data. `tokens.css` is its zero-build token
distribution and `primitives.css` is the zero-build component distribution.
Product code preserves the `--bl-*` semantic names and composes the `bl-*`
primitives rather than reimplementing their generic treatments.

## Why this repo has generated copies

The engine and each partner are separate static deployments. A deployed partner
directory cannot import a file outside its Cloudflare Pages root, and runtime
links to a second origin would add an unnecessary availability and
cross-origin-isolation dependency.

`scripts/sync-static-ui.mjs` is the adapter. It:

1. reads the central `tokens.json`, `tokens.css`, and `primitives.css`;
2. verifies that every canonical JSON token name is present in the CSS
   distribution;
3. writes versioned, hashed, generated design-system copies into each deploy root;
4. copies the repo-owned shared storefront CSS and renderer into each partner
   deploy root; and
5. supports a read-only `--check` mode that fails when any generated asset is
   stale.

The generated headers name their source and tell contributors not to edit the
copies. Product CSS uses only the preserved `--bl-*` semantic token names.

Generated deployment assets are:

- `engine/design-system/tokens.css` and `primitives.css`;
- `partners/<id>/design-system/tokens.css`;
- `partners/<id>/design-system/primitives.css`;
- `partners/<id>/storefront.css`; and
- `partners/<id>/storefront.js`.

Do not edit those files directly. Edit central tokens for shared visual values,
or `shared/storefront.css` / `shared/storefront.js` for this product's shared
partner implementation, then run the refresh command. A generated copy is a
deployable adapter artifact, never an alternate source of truth.

## Refresh or verify

From the Jumping Beans repository root:

```bash
node scripts/sync-static-ui.mjs
node scripts/sync-static-ui.mjs --check
node engine/bundle-static.mjs
node engine/bundle-static.mjs --check
node scripts/check-product.mjs
```

The checked-in snapshot is the default source. To refresh it from a Bean Labs
checkout, set `BEANLABS_DESIGN_SYSTEM_DIR` to the central design-system
directory, update `sourceRef` to the reviewed central commit, copy the central
`tokens.json`, `tokens.css`, and `primitives.css` into
`vendor/beanlabs-design-system`, then run
the refresh command. The committed generated assets keep standalone static
deployments self-contained and carry the source ref and hashes.

`scripts/check-product.mjs` is the dependency-free, read-only local gate. It
checks:

- generated token/storefront freshness against the central and repo-owned
  sources;
- JavaScript syntax and JSON parsing;
- engine bundle freshness and required routes;
- semantic HTML landmarks, unique IDs, label relationships, and local assets;
- focus, target-size, reduced-motion, and semantic-token CSS anchors;
- imperative and declarative WebMCP contract anchors;
- the A → preference/memory → B journey;
- open inventory, verified tool opt-in, illustrative fallback, provenance, and
  unsupported-verification messaging; and
- save/apply-once/forget consent controls.

If the gate reports a stale generated asset, run the named refresh command and
run the gate again. The gate never rewrites output.

## Required before a surface ships

For every new or materially refreshed engine, storefront, form, or merchant
surface:

1. Read the central contract files named above. Use semantic HTML first,
   persistent labels, native state attributes, the shared focus treatment,
   minimum target size, reflow, and reduced-motion behavior.
2. Load the generated central tokens and use semantic tokens. Product identity
   may override only the documented theme tokens.
3. Keep source categories explicit. “Open inventory” means no partner tool was
   required. “Opted-in partner” requires an actual WebMCP tool response. Tool
   opt-in verifies participation, not price or product facts; those remain
   partner-provided and not independently verified unless separate evidence
   exists. A fallback must say that it is illustrative.
4. Keep consequential results traceable with what, who, source, time,
   verification status, and evidence. Say when source time or evidence is
   unavailable.
5. Show the exact memory fact, scope, and retention before saving. Preserve
   “Apply once without saving,” edit, and forget controls. Do not silently turn
   a draft or prompt into retained memory.
6. Refresh generated UI assets and, when engine inputs changed, refresh the
   Worker bundle:

```bash
node scripts/sync-static-ui.mjs
node engine/bundle-static.mjs
```

7. Run the required local gate:

```bash
node scripts/check-product.mjs
```

8. In a local headed browser, verify keyboard order and visible focus, 400%
   zoom/reflow or an equivalent narrow viewport, light and dark schemes,
   reduced motion, loading/error recovery, the apply-once path, and the Forget
   controls. With WebMCP enabled, verify all three partner tools register and
   the engine distinguishes a responding opted-in partner from its illustrative
   fallback.
9. Before production release, verify the deployed origins, COOP/COEP/CORP and
   origin-trial headers, real cross-origin tool discovery/execution, catalog
   freshness, and any server-side watch-interest persistence. These are
   production checks and are not proven by the local gate.
