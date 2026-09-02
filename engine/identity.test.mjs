import assert from "node:assert/strict";
import { OIDC_COOKIE, SESSION_COOKIE, handleIdentity, safeReturnPath, sanitizeAccountPreferences, sha256 } from "./identity.mjs";

assert.equal(SESSION_COOKIE, "__Host-jb-session");
assert.equal(OIDC_COOKIE, "__Host-jb-oidc");
assert.equal(safeReturnPath("/"), "/");
assert.equal(safeReturnPath("/offers?source=engine"), "/offers?source=engine");
assert.equal(safeReturnPath("https://attacker.invalid"), "/");
assert.equal(safeReturnPath("//attacker.invalid"), "/");
assert.equal(safeReturnPath("/\\attacker.invalid"), "/");
const digest = await sha256("account-session-test");
assert.match(digest, /^[a-f0-9]{64}$/);
assert.notEqual(digest, "account-session-test");

const hostedPreferences = sanitizeAccountPreferences({
  feedStyle: "compare",
  category: "coffee",
  maxPrice: 40,
  formats: ["price-proof", "not-supported"],
  sessionId: "session-secret",
  grantId: "grant-secret",
  rules: [{ id: "proof", text: "Show price proof", scope: "everywhere", idempotencyKey: "write-secret" }],
});
assert.equal(hostedPreferences.feedStyle, "compare");
assert.deepEqual(hostedPreferences.formats, ["price-proof"]);
assert.equal(JSON.stringify(hostedPreferences).includes("secret"), false);

const anonymous = await handleIdentity(new Request("https://engine.invalid/api/account"), {});
assert.equal(anonymous.status, 200);
assert.deepEqual(await anonymous.json(), { signedIn: false });
const unavailable = await handleIdentity(new Request("https://engine.invalid/api/account", { headers: { cookie: "__Host-jb-session=forged" } }), {});
assert.equal(unavailable.status, 503);
assert.deepEqual(await unavailable.json(), { error: "storage-unavailable" });
const crossSiteWrite = await handleIdentity(new Request("https://engine.invalid/api/account/profile", {
  method: "POST",
  headers: { origin: "https://attacker.invalid", "content-type": "application/json" },
  body: JSON.stringify({ profile: { displayName: "Nope" } }),
}), { ENGINE_PUBLIC_ORIGIN: "https://engine.invalid" });
assert.equal(crossSiteWrite.status, 403);
assert.deepEqual(await crossSiteWrite.json(), { error: "origin-rejected" });

console.log("engine identity contracts pass");
