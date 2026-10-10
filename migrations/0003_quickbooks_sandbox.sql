CREATE TABLE qb_connection (
  id INTEGER PRIMARY KEY CHECK(id = 1), realm_id TEXT NOT NULL DEFAULT '',
  generation INTEGER NOT NULL DEFAULT 0, credential_generation INTEGER NOT NULL DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'empty' CHECK(state IN ('empty','authorizing','pending','active','refresh_prepared','refresh_dispatched','refresh_unknown','revocation_pending','revoked')),
  token_envelope TEXT, access_expires_at INTEGER NOT NULL DEFAULT 0,
  refresh_expires_at INTEGER NOT NULL DEFAULT 0,
  attempt_id TEXT, attempt_deadline INTEGER NOT NULL DEFAULT 0,
  pending_until INTEGER NOT NULL DEFAULT 0, owner_sub TEXT, session_hash TEXT,
  company_name TEXT, paused INTEGER NOT NULL DEFAULT 1 CHECK(paused IN (0,1))
);
INSERT INTO qb_connection(id) VALUES (1);
CREATE TABLE qb_oauth_states (
  state_hash TEXT PRIMARY KEY, subject TEXT NOT NULL, session_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL, realm_id TEXT NOT NULL, redirect_uri TEXT NOT NULL
);
CREATE TABLE qb_token_attempts (
  id TEXT PRIMARY KEY, generation INTEGER NOT NULL, kind TEXT NOT NULL,
  state TEXT NOT NULL, deadline INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE qb_events (
  event_key TEXT PRIMARY KEY, digest TEXT NOT NULL, realm_id TEXT,
  generation INTEGER, entity_type TEXT, entity_id TEXT, operation TEXT,
  state TEXT NOT NULL CHECK(state IN ('pending','processing','done','quarantined','conflict')),
  reason TEXT, attempts INTEGER NOT NULL DEFAULT 0, available_at INTEGER NOT NULL,
  lease_id TEXT, lease_until INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX qb_events_pending ON qb_events(state, available_at);
CREATE TABLE qb_evidence (
  id TEXT PRIMARY KEY, realm_id TEXT NOT NULL, generation INTEGER NOT NULL,
  invoice_id TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE qb_scan (
  id INTEGER PRIMARY KEY CHECK(id = 1), generation INTEGER NOT NULL,
  start_date TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE qb_audit (
  id TEXT PRIMARY KEY, action TEXT NOT NULL, generation INTEGER,
  created_at INTEGER NOT NULL
);
ALTER TABLE conversions ADD COLUMN connection_generation INTEGER;
CREATE TRIGGER qb_conversion_authority BEFORE INSERT ON conversions
WHEN NEW.connection_generation IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM qb_connection c JOIN qb_evidence e
    ON e.id = NEW.evidence_reference AND e.realm_id = c.realm_id AND e.generation = c.generation
  WHERE c.id = 1 AND c.state = 'active' AND c.paused = 0
    AND c.generation = NEW.connection_generation AND c.realm_id = NEW.quickbooks_realm_id
    AND NEW.provider_environment = 'sandbox' AND e.invoice_id = NEW.quickbooks_invoice_id
)
BEGIN SELECT RAISE(ABORT, 'connection_not_authorized'); END;
