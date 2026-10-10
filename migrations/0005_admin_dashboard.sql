-- Owner dashboard support. Referral codes remain stable in application code;
-- version guards prevent one browser tab from overwriting a newer edit.
ALTER TABLE partners ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
ALTER TABLE partners ADD COLUMN version INTEGER NOT NULL DEFAULT 1
  CHECK(typeof(version) = 'integer' AND version >= 1);
UPDATE partners SET updated_at = created_at;

CREATE TABLE admin_audit (
  id TEXT PRIMARY KEY NOT NULL,
  actor_sub TEXT NOT NULL CHECK(length(actor_sub) BETWEEN 1 AND 255),
  action TEXT NOT NULL CHECK(action IN ('partner_created','partner_updated')),
  target_type TEXT NOT NULL CHECK(target_type = 'partner'),
  target_id TEXT NOT NULL REFERENCES partners(id),
  changed_fields TEXT NOT NULL CHECK(length(changed_fields) BETWEEN 2 AND 256),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX admin_audit_created ON admin_audit(created_at, id);
