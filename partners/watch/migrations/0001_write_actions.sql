-- Required next checkpoint: apply through an approved D1 migration, then make
-- the repository seam in functions/api/_store.js use one transaction for grant
-- consumption, idempotency claim, interest insert, and receipt persistence.
CREATE TABLE IF NOT EXISTS watch_pending_actions (
  grant_id TEXT PRIMARY KEY,
  grant_digest TEXT NOT NULL,
  action_id TEXT NOT NULL UNIQUE,
  idempotency_key_digest TEXT NOT NULL UNIQUE,
  semantic_payload_hash TEXT NOT NULL,
  session_subject TEXT NOT NULL,
  audience_origin TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
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
  action_id TEXT NOT NULL UNIQUE,
  product TEXT NOT NULL,
  target_price_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
