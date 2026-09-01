# Optional engine identity setup

The hosted personal experience is optional. Without its D1 binding and Google
OIDC configuration, `/api/account` fails closed and the public engine remains
anonymous and usable. It is not a WebMCP transport and it does not change
partner discovery or invocation.

## Provision the engine boundary

1. Create a dedicated Cloudflare D1 database for the engine account service.
   Put its approved ID in `engine/wrangler.toml` as `ENGINE_DB`; do not reuse
   Watch Co's `WATCH_DB`.
2. Apply `engine/migrations/0001_identity.sql` through Wrangler's D1 migration
   command for that binding.
3. Set `ENGINE_PUBLIC_ORIGIN` to the exact HTTPS engine origin. The value must
   match the Google OAuth redirect origin and is used for same-origin CSRF
   checks. Keep `ENGINE_IDENTITY_MODE=production` in production so the Worker
   issues `__Host-` Secure, HttpOnly, SameSite cookies.
4. Create a Google OAuth web-client for that exact origin and add exactly
   `https://<engine-origin>/auth/callback` as its redirect URI. Store
   `GOOGLE_OIDC_CLIENT_ID` and `GOOGLE_OIDC_CLIENT_SECRET` as Worker secrets;
   never commit them or add them to public Worker vars.

The login flow uses state, nonce, PKCE, a short-lived server transaction, and
ID-token signature/issuer/audience validation. Session and CSRF values are
stored as hashes in D1; the raw session token exists only in the HttpOnly
cookie. Login and account writes are rate limited. Profile, preferences, and
memory updates require an exact same-origin `Origin` header plus the current
server-bound CSRF token.

## Data and separation

The account service stores only the account profile, explicitly saved display
preferences, explicitly imported browser-local product notes, and a minimal
import audit event. It does not upload browser memory on login, refresh, or
partner discovery. The UI requires the import checkbox for that operation.

Watch Co remains a separate D1 authority for its own stage/confirm/commit
workflow. It must not trust engine identity claims, session cookies, or account
receipts. Neither service sends identity data or credentials to WebMCP tools.

## Verification

Before release, run the product gate and manually verify: anonymous browsing,
Google login/callback/logout, expired or replayed callbacks, cross-site write
rejection, account save/import/forget, and that a Watch Co handoff still starts
with Watch Co's own explicit confirmation.
