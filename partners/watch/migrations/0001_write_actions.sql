-- Watch Co D1 authoritative write schema. Apply before binding WATCH_DB.
-- The repository commits receipt claim, grant consumption, and interest insert
-- as one D1 batch. KV must not be used for any of these records.
CREATE TABLE IF NOT EXISTS watch_pending_actions (
  grant_id TEXT PRIMARY KEY,
  grant_digest TEXT NOT NULL,
  action_id TEXT NOT NULL UNIQUE,
  idempotency_key_digest TEXT NOT NULL UNIQUE,
  semantic_payload_hash TEXT NOT NULL,
  action_json TEXT NOT NULL,
  session_subject TEXT NOT NULL,
  audience_origin TEXT NOT NULL,
  audience_path TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS watch_pending_expiry ON watch_pending_actions(expires_at);

CREATE TABLE IF NOT EXISTS watch_write_sessions (
  session_digest TEXT PRIMARY KEY,
  csrf_digest TEXT NOT NULL,
  audience_origin TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS watch_sessions_expiry ON watch_write_sessions(expires_at);

CREATE TABLE IF NOT EXISTS watch_rate_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY(bucket, window_start)
);

CREATE TABLE IF NOT EXISTS watch_action_receipts (
  idempotency_key_digest TEXT PRIMARY KEY,
  action_id TEXT NOT NULL UNIQUE,
  semantic_payload_hash TEXT NOT NULL,
  session_subject TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  committed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watch_interests (
  record_id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL UNIQUE REFERENCES watch_action_receipts(action_id),
  product TEXT NOT NULL,
  target_price_minor INTEGER NOT NULL CHECK(target_price_minor > 0),
  currency TEXT NOT NULL CHECK(currency = 'USD'),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS watch_interests_active ON watch_interests(product, expires_at);
