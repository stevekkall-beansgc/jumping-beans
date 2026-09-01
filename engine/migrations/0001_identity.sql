-- Engine-owned identity and personal experience authority. Never share this
-- binding with partner Watch Co writes or WebMCP capability invocation.
CREATE TABLE IF NOT EXISTS engine_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS engine_users_email ON engine_users(email);
CREATE TABLE IF NOT EXISTS engine_identities (
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES engine_users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (provider, provider_subject)
);
CREATE TABLE IF NOT EXISTS engine_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES engine_users(id),
  token_digest TEXT NOT NULL UNIQUE,
  csrf_digest TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS engine_sessions_user_expiry ON engine_sessions(user_id, expires_at);
CREATE TABLE IF NOT EXISTS engine_oidc_transactions (
  state_digest TEXT PRIMARY KEY,
  nonce_digest TEXT NOT NULL,
  verifier_digest TEXT NOT NULL,
  return_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS engine_user_data (
  user_id TEXT PRIMARY KEY REFERENCES engine_users(id),
  profile_json TEXT NOT NULL,
  preferences_json TEXT NOT NULL,
  memory_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS engine_identity_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS engine_account_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES engine_users(id),
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);
