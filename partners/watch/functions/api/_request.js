// HTTP request boundary for Watch consequential writes. No caller-controlled
// header is treated as a session; the opaque cookie is validated in D1.
import { createWriteSession, takeWriteRateLimit, validateWriteSession } from "./_store.js";
import { randomId } from "../../action-contract.js";

const MAX_BODY_BYTES = 12 * 1024;
const SESSION_COOKIE = "__Host-watch-session";
const LOCAL_COOKIE = "watch-local-session";
const PRODUCTION_ORIGIN = "https://watch-ce8.pages.dev";

function parseCookies(request) { return Object.fromEntries((request.headers.get("cookie") || "").split(";").map((part) => part.trim().split(/=(.*)/s)).filter(([key]) => key)); }
function localMode(env) { return env?.WATCH_WRITE_MODE === "local-development"; }
function allowedOrigin(request, env) {
  const actual = new URL(request.url).origin; const supplied = request.headers.get("origin") || "";
  if (localMode(env)) return supplied === actual && /^(https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|watch\.invalid)(?::\d+)?)$/.test(actual);
  const expected = env?.WATCH_PUBLIC_ORIGIN || PRODUCTION_ORIGIN;
  return actual === expected && supplied === expected;
}
export function cookieHeader(sessionId, env) {
  const name = localMode(env) ? LOCAL_COOKIE : SESSION_COOKIE;
  return `${name}=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800${localMode(env) ? "" : "; Secure"}`;
}
export async function readJson(request, { allowedFields, maxBytes = MAX_BODY_BYTES } = {}) {
  const type = request.headers.get("content-type") || "";
  const length = Number(request.headers.get("content-length") || 0);
  if (!type.toLowerCase().startsWith("application/json") || (length && (!Number.isSafeInteger(length) || length > maxBytes))) return { ok: false, status: 415, error: "json-content-type-and-size-required" };
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) return { ok: false, status: 413, error: "request-body-too-large" };
  let body; try { body = JSON.parse(text); } catch { return { ok: false, status: 400, error: "request-body-must-be-json" }; }
  if (!body || typeof body !== "object" || Array.isArray(body) || (allowedFields && Object.keys(body).some((key) => !allowedFields.includes(key)))) return { ok: false, status: 400, error: "invalid-request-envelope" };
  return { ok: true, body };
}
export async function authorizeWrite(request, env, { allowSessionBootstrap = false } = {}) {
  if (!allowedOrigin(request, env)) return { ok: false, status: 403, error: "origin-policy-rejected" };
  const cookies = parseCookies(request); const sessionId = cookies[localMode(env) ? LOCAL_COOKIE : SESSION_COOKIE];
  const bootstrap = async () => {
    const freshSession = randomId("session"); const csrfToken = randomId("csrf");
    await createWriteSession(env, { sessionId: freshSession, csrfToken, audienceOrigin: new URL(request.url).origin });
    return { ok: false, status: 401, error: "session-initialized", csrfToken, setCookie: cookieHeader(freshSession, env) };
  };
  if (!sessionId && allowSessionBootstrap) return bootstrap();
  if (!sessionId) return { ok: false, status: 401, error: "missing-session" };
  const verified = await validateWriteSession(env, { sessionId, csrfToken: request.headers.get("x-watch-csrf"), audienceOrigin: new URL(request.url).origin });
  if (!verified.ok && allowSessionBootstrap) return bootstrap();
  return verified.ok ? { ok: true, sessionId, subject: verified.subject } : { ok: false, status: 403, error: verified.code };
}
export async function rateLimit(env, details) {
  const result = await takeWriteRateLimit(env, details);
  return result.allowed ? { ok: true } : { ok: false, status: 429, error: "rate-limit-exceeded", retryAfter: result.retryAfter };
}
