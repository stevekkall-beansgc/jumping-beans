// Optional hosted identity for the engine. This is deliberately separate from
// WebMCP: it never participates in partner discovery, tool inputs, or receipts.

import { normalizePreferencePlane } from "./preference-plane.mjs";

export const SESSION_COOKIE = "__Host-jb-session";
export const OIDC_COOKIE = "__Host-jb-oidc";
const LOCAL_SESSION_COOKIE = "jb-local-session";
const LOCAL_OIDC_COOKIE = "jb-local-oidc";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OIDC_TTL_MS = 10 * 60 * 1000;
const MAX_BODY_BYTES = 24 * 1024;
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
let jwksCache = { expiresAt: 0, keys: [] };

const plainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype);
const text = (value, limit = 512) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const fromB64url = (value) => Uint8Array.from(atob(String(value).replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - String(value).length % 4) % 4)), (char) => char.charCodeAt(0));

export function safeReturnPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function localMode(env) { return env.ENGINE_IDENTITY_MODE === "local-development"; }
function cookieName(env, kind) { return localMode(env) ? (kind === "session" ? LOCAL_SESSION_COOKIE : LOCAL_OIDC_COOKIE) : (kind === "session" ? SESSION_COOKIE : OIDC_COOKIE); }
function cookieAttributes(env, maxAge, sameSite = "Strict") { return `Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${localMode(env) ? "" : "; Secure"}`; }
function setCookie(env, kind, value, maxAge, sameSite) { return `${cookieName(env, kind)}=${value}; ${cookieAttributes(env, maxAge, sameSite)}`; }
function clearCookie(env, kind) { return `${cookieName(env, kind)}=; ${cookieAttributes(env, 0)}`; }
function cookies(request) { return Object.fromEntries((request.headers.get("cookie") || "").split(";").map((part) => part.trim().split(/=(.*)/s)).filter(([key]) => key)); }
function json(value, status = 200, headers = {}) { return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } }); }
function failure(error, status = 400, headers = {}) { return json({ error }, status, headers); }
function publicOrigin(request, env) { return new URL(env.ENGINE_PUBLIC_ORIGIN || request.url).origin; }
function trustedOrigin(request, env, { required = false } = {}) { const origin = request.headers.get("origin"); return required ? origin === publicOrigin(request, env) : (!origin || origin === publicOrigin(request, env)); }
function redirect(location, cookiesToSet = []) {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const cookie of cookiesToSet) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

async function body(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("content-type-required");
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) throw new Error("request-too-large");
  const source = await request.text();
  if (new TextEncoder().encode(source).byteLength > MAX_BODY_BYTES) throw new Error("request-too-large");
  const parsed = JSON.parse(source || "{}");
  if (!plainObject(parsed)) throw new Error("invalid-request");
  return parsed;
}

function db(env) { if (!env.ENGINE_DB) throw new Error("storage-unavailable"); return env.ENGINE_DB; }
async function first(statement) { return statement.first(); }

async function rateLimit(env, request, bucket, limit, windowMs = 10 * 60 * 1000) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const slot = Math.floor(Date.now() / windowMs);
  const key = await sha256(`${bucket}:${ip}:${slot}`);
  const database = db(env);
  await database.prepare("/* engine:rate */ INSERT INTO engine_identity_rate_limits (bucket_key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket_key) DO UPDATE SET count = count + 1").bind(key, new Date((slot + 1) * windowMs).toISOString()).run();
  const row = await first(database.prepare("/* engine:rate-read */ SELECT count FROM engine_identity_rate_limits WHERE bucket_key = ?").bind(key));
  return Number(row?.count || 0) <= limit;
}

function readOidcCookie(request, env) {
  try { return JSON.parse(new TextDecoder().decode(fromB64url(cookies(request)[cookieName(env, "oidc")] || ""))); } catch { return null; }
}

async function verifyGoogleIdToken(idToken, { clientId, nonce }) {
  const [headerPart, payloadPart, signaturePart] = String(idToken || "").split(".");
  if (!headerPart || !payloadPart || !signaturePart) throw new Error("invalid-id-token");
  let header; let claims;
  try { header = JSON.parse(new TextDecoder().decode(fromB64url(headerPart))); claims = JSON.parse(new TextDecoder().decode(fromB64url(payloadPart))); } catch { throw new Error("invalid-id-token"); }
  if (header.alg !== "RS256" || !header.kid) throw new Error("invalid-id-token");
  if (Date.now() >= jwksCache.expiresAt) {
    const response = await fetch(JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload.keys)) throw new Error("google-key-unavailable");
    jwksCache = { keys: payload.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  }
  const jwk = jwksCache.keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) throw new Error("google-key-unavailable");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64url(signaturePart), new TextEncoder().encode(`${headerPart}.${payloadPart}`));
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!valid || !["https://accounts.google.com", "accounts.google.com"].includes(claims.iss) || !audiences.includes(clientId) || (Array.isArray(claims.aud) && claims.azp !== clientId) || claims.nonce !== nonce || !claims.sub || !claims.email_verified || Number(claims.exp) * 1000 <= Date.now()) throw new Error("invalid-id-token");
  return { subject: text(claims.sub, 255), email: text(claims.email, 320), name: text(claims.name, 160) };
}

async function userForIdentity(env, identity) {
  const database = db(env);
  const existing = await first(database.prepare("/* engine:identity */ SELECT u.id, u.email, u.display_name FROM engine_users u JOIN engine_identities i ON i.user_id = u.id WHERE i.provider = ? AND i.provider_subject = ?").bind("google", identity.subject));
  if (existing) return existing;
  const userId = id("user");
  try {
    await database.batch([
      database.prepare("/* engine:user */ INSERT INTO engine_users (id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(userId, identity.email, identity.name || null, now(), now()),
      database.prepare("/* engine:identity-create */ INSERT INTO engine_identities (provider, provider_subject, user_id, created_at) VALUES (?, ?, ?, ?)").bind("google", identity.subject, userId, now()),
      database.prepare("/* engine:data-create */ INSERT INTO engine_user_data (user_id, profile_json, preferences_json, memory_json, updated_at) VALUES (?, '{}', '{}', '[]', ?)").bind(userId, now()),
    ]);
    return { id: userId, email: identity.email, display_name: identity.name || null };
  } catch {
    const retry = await first(database.prepare("/* engine:identity-retry */ SELECT u.id, u.email, u.display_name FROM engine_users u JOIN engine_identities i ON i.user_id = u.id WHERE i.provider = ? AND i.provider_subject = ?").bind("google", identity.subject));
    if (!retry) throw new Error("identity-create-failed");
    return retry;
  }
}

async function createSession(env, userId) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const csrfToken = b64url(crypto.getRandomValues(new Uint8Array(24)));
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db(env).prepare("/* engine:session-create */ INSERT INTO engine_sessions (id, user_id, token_digest, csrf_digest, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)").bind(id("session"), userId, await sha256(`engine-session:${token}`), await sha256(`engine-csrf:${csrfToken}`), now(), expiresAt).run();
  return { token, csrfToken, expiresAt };
}

async function accountSession(request, env, { csrf = false } = {}) {
  const token = cookies(request)[cookieName(env, "session")];
  if (!token) return null;
  const row = await first(db(env).prepare("/* engine:session */ SELECT s.id, s.user_id, s.csrf_digest, s.expires_at, s.revoked_at, u.email, u.display_name FROM engine_sessions s JOIN engine_users u ON u.id = s.user_id WHERE s.token_digest = ?").bind(await sha256(`engine-session:${token}`)));
  if (!row || row.revoked_at || Date.parse(row.expires_at) <= Date.now()) return null;
  if (csrf) {
    const tokenValue = request.headers.get("x-jb-csrf") || "";
    if (!tokenValue || await sha256(`engine-csrf:${tokenValue}`) !== row.csrf_digest) return { denied: "csrf-rejected" };
  }
  return { ...row, token };
}

function parseStored(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
function profile(value) { return plainObject(value) ? { displayName: text(value.displayName, 120), bio: text(value.bio, 500) } : {}; }
export function sanitizeAccountPreferences(value) { return normalizePreferencePlane(value); }
function memory(value) { if (!Array.isArray(value)) return []; return value.filter(plainObject).map((item) => ({ key: text(item.key, 160), title: text(item.title || item.name, 160), detail: text(item.detail || item.reason, 500), observedAt: text(item.observedAt, 64) })).filter((item) => item.key && item.title).slice(0, 30); }

async function accountPayload(env, session, csrfToken = null) {
  const row = await first(db(env).prepare("/* engine:data */ SELECT profile_json, preferences_json, memory_json, updated_at FROM engine_user_data WHERE user_id = ?").bind(session.user_id));
  const rawPreferences = row?.preferences_json || "{}";
  const rawMemory = row?.memory_json || "[]";
  return { signedIn: true, user: { email: session.email, displayName: session.display_name || null }, profile: profile(parseStored(row?.profile_json, {})), preferences: sanitizeAccountPreferences(parseStored(rawPreferences, {})), memory: memory(parseStored(rawMemory, [])), hasPreferences: rawPreferences !== "{}", hasMemory: rawMemory !== "[]", updatedAt: row?.updated_at || null, csrfToken };
}

async function requireAccount(request, env) {
  if (!trustedOrigin(request, env, { required: true })) return { error: failure("origin-rejected", 403) };
  const session = await accountSession(request, env, { csrf: true });
  if (!session) return { error: failure("authentication-required", 401) };
  if (session.denied) return { error: failure(session.denied, 403) };
  return { session };
}

async function updateData(env, userId, column, value) {
  await db(env).prepare(`/* engine:data-update */ UPDATE engine_user_data SET ${column} = ?, updated_at = ? WHERE user_id = ?`).bind(JSON.stringify(value), now(), userId).run();
}

export async function handleIdentity(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/auth/") && !path.startsWith("/api/account")) return null;
  try {
    if (path === "/auth/login" && request.method === "GET") {
      if (!(await rateLimit(env, request, "login", 20))) return failure("rate-limited", 429);
      const clientId = text(env.GOOGLE_OIDC_CLIENT_ID, 512); const origin = publicOrigin(request, env);
      if (!clientId || !env.GOOGLE_OIDC_CLIENT_SECRET || !env.ENGINE_PUBLIC_ORIGIN) return failure("identity-not-configured", 503);
      const state = b64url(crypto.getRandomValues(new Uint8Array(24))); const nonce = b64url(crypto.getRandomValues(new Uint8Array(24))); const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
      const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
      const expiresAt = new Date(Date.now() + OIDC_TTL_MS).toISOString();
      await db(env).prepare("/* engine:oidc-start */ INSERT INTO engine_oidc_transactions (state_digest, nonce_digest, verifier_digest, return_path, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?, NULL)").bind(await sha256(`engine-state:${state}`), await sha256(`engine-nonce:${nonce}`), await sha256(`engine-verifier:${verifier}`), safeReturnPath(url.searchParams.get("returnTo")), now(), expiresAt).run();
      const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authorize.searchParams.set("client_id", clientId); authorize.searchParams.set("redirect_uri", `${origin}/auth/callback`); authorize.searchParams.set("response_type", "code"); authorize.searchParams.set("scope", "openid email profile"); authorize.searchParams.set("state", state); authorize.searchParams.set("nonce", nonce); authorize.searchParams.set("code_challenge", challenge); authorize.searchParams.set("code_challenge_method", "S256"); authorize.searchParams.set("prompt", "select_account");
      return redirect(authorize.href, [setCookie(env, "oidc", b64url(new TextEncoder().encode(JSON.stringify({ state, nonce, verifier }))), Math.floor(OIDC_TTL_MS / 1000), "Lax")]);
    }
    if (path === "/auth/callback" && request.method === "GET") {
      if (!trustedOrigin(request, env)) return failure("origin-rejected", 403);
      const state = text(url.searchParams.get("state"), 512); const code = text(url.searchParams.get("code"), 4096); const local = readOidcCookie(request, env);
      if (!state || !code || !local || local.state !== state) return failure("oidc-state-rejected", 403, { "set-cookie": clearCookie(env, "oidc") });
      const transaction = await first(db(env).prepare("/* engine:oidc-read */ SELECT * FROM engine_oidc_transactions WHERE state_digest = ?").bind(await sha256(`engine-state:${state}`)));
      if (!transaction || transaction.used_at || Date.parse(transaction.expires_at) <= Date.now() || transaction.nonce_digest !== await sha256(`engine-nonce:${local.nonce}`) || transaction.verifier_digest !== await sha256(`engine-verifier:${local.verifier}`)) return failure("oidc-state-rejected", 403, { "set-cookie": clearCookie(env, "oidc") });
      const consumed = await db(env).prepare("/* engine:oidc-consume */ UPDATE engine_oidc_transactions SET used_at = ? WHERE state_digest = ? AND used_at IS NULL").bind(now(), transaction.state_digest).run();
      if (!consumed.meta?.changes) return failure("oidc-state-rejected", 403, { "set-cookie": clearCookie(env, "oidc") });
      const origin = publicOrigin(request, env);
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: env.GOOGLE_OIDC_CLIENT_ID, client_secret: env.GOOGLE_OIDC_CLIENT_SECRET, redirect_uri: `${origin}/auth/callback`, grant_type: "authorization_code", code_verifier: local.verifier }) });
      const token = await tokenResponse.json(); if (!tokenResponse.ok || !token.id_token) return failure("oidc-token-rejected", 403, { "set-cookie": clearCookie(env, "oidc") });
      const identity = await verifyGoogleIdToken(token.id_token, { clientId: env.GOOGLE_OIDC_CLIENT_ID, nonce: local.nonce }); const user = await userForIdentity(env, identity); const session = await createSession(env, user.id);
      return redirect(safeReturnPath(transaction.return_path), [setCookie(env, "session", session.token, Math.floor(SESSION_TTL_MS / 1000)), clearCookie(env, "oidc")]);
    }
    if (path === "/api/account" && request.method === "GET") {
      const session = await accountSession(request, env); if (!session) return json({ signedIn: false });
      // A CSRF token is readable only by the authenticated same-origin page; its hash remains server-side.
      const csrfToken = b64url(crypto.getRandomValues(new Uint8Array(24)));
      await db(env).prepare("/* engine:csrf-rotate */ UPDATE engine_sessions SET csrf_digest = ? WHERE id = ?").bind(await sha256(`engine-csrf:${csrfToken}`), session.id).run();
      return json(await accountPayload(env, session, csrfToken));
    }
    if (path === "/api/account/logout" && request.method === "POST") {
      const auth = await requireAccount(request, env); if (auth.error) return auth.error;
      await db(env).prepare("/* engine:session-revoke */ UPDATE engine_sessions SET revoked_at = ? WHERE id = ?").bind(now(), auth.session.id).run();
      return json({ signedIn: false }, 200, { "set-cookie": clearCookie(env, "session") });
    }
    if (["/api/account/profile", "/api/account/preferences", "/api/account/memory", "/api/account/import"].includes(path) && request.method === "POST") {
      const auth = await requireAccount(request, env); if (auth.error) return auth.error;
      if (!(await rateLimit(env, request, "account-write", 60))) return failure("rate-limited", 429);
      const input = await body(request);
      if (path === "/api/account/profile") await updateData(env, auth.session.user_id, "profile_json", profile(input.profile));
      if (path === "/api/account/preferences") await updateData(env, auth.session.user_id, "preferences_json", sanitizeAccountPreferences(input.preferences));
      if (path === "/api/account/memory") {
        const current = await accountPayload(env, auth.session);
        const next = input.action === "forget-all" ? [] : input.action === "forget" ? current.memory.filter((item) => item.key !== text(input.key, 160)) : memory(input.memory);
        if (!(["replace", "forget", "forget-all"].includes(input.action))) return failure("invalid-memory-action", 400);
        await updateData(env, auth.session.user_id, "memory_json", next);
      }
      if (path === "/api/account/import") {
        if (input.confirmed !== true) return failure("import-confirmation-required", 400);
        await db(env).batch([
          db(env).prepare("/* engine:import-profile */ UPDATE engine_user_data SET profile_json = ?, preferences_json = ?, memory_json = ?, updated_at = ? WHERE user_id = ?").bind(JSON.stringify(profile(input.profile)), JSON.stringify(sanitizeAccountPreferences(input.preferences)), JSON.stringify(memory(input.memory)), now(), auth.session.user_id),
          db(env).prepare("/* engine:import-audit */ INSERT INTO engine_account_events (id, user_id, event_type, created_at) VALUES (?, ?, ?, ?)").bind(id("event"), auth.session.user_id, "explicit-browser-memory-import", now()),
        ]);
      }
      return json(await accountPayload(env, auth.session));
    }
    return failure("not-found", 404);
  } catch (error) {
    const code = error instanceof Error ? error.message : "identity-failed";
    return failure(["storage-unavailable", "identity-not-configured", "request-too-large", "content-type-required", "invalid-request"].includes(code) ? code : "identity-failed", code === "storage-unavailable" || code === "identity-not-configured" ? 503 : code === "request-too-large" ? 413 : 400);
  }
}
