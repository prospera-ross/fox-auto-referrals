-- D1 uses SQLite: UUIDs are TEXT; timestamps are UTC RFC3339 TEXT.
-- Money is INTEGER cents; requested REAL fields are read-only projections.
PRAGMA foreign_keys = ON;

CREATE TABLE partners (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  phone TEXT NOT NULL UNIQUE CHECK(length(phone) = 12 AND substr(phone,1,2) = '+1' AND substr(phone,3) NOT GLOB '*[^0-9]*' AND substr(phone,3,1) BETWEEN '2' AND '9' AND substr(phone,6,1) BETWEEN '2' AND '9'),
  referral_code TEXT NOT NULL UNIQUE CHECK(length(referral_code) BETWEEN 1 AND 64 AND referral_code NOT GLOB '*[^a-z0-9-]*'),
  payout_type TEXT NOT NULL CHECK(payout_type IN ('FIXED','PERCENTAGE')),
  payout_value_units INTEGER NOT NULL CHECK(typeof(payout_value_units) = 'integer' AND payout_value_units >= 0 AND payout_value_units <= 100000000 AND (payout_type = 'FIXED' OR payout_value_units <= 10000)),
  payout_value REAL GENERATED ALWAYS AS (payout_value_units / 100.0) VIRTUAL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE leads (
  id TEXT PRIMARY KEY NOT NULL,
  partner_id TEXT NOT NULL REFERENCES partners(id),
  customer_name TEXT NOT NULL CHECK(length(customer_name) BETWEEN 1 AND 120),
  customer_phone TEXT NOT NULL CHECK(length(customer_phone) = 12 AND substr(customer_phone,1,2) = '+1' AND substr(customer_phone,3) NOT GLOB '*[^0-9]*' AND substr(customer_phone,3,1) BETWEEN '2' AND '9' AND substr(customer_phone,6,1) BETWEEN '2' AND '9'),
  customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'CLAIMED' CHECK(status IN ('CLAIMED','COMPLETED','EXPIRED')),
  claim_key TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL CHECK(length(payload_hash) = 64),
  payout_type TEXT NOT NULL CHECK(payout_type IN ('FIXED','PERCENTAGE')),
  payout_value_units INTEGER NOT NULL CHECK(typeof(payout_value_units) = 'integer' AND payout_value_units >= 0 AND payout_value_units <= 100000000 AND (payout_type = 'FIXED' OR payout_value_units <= 10000)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(id, partner_id)
);
CREATE INDEX leads_phone_status ON leads(customer_phone, status, created_at);
CREATE INDEX leads_email_status ON leads(customer_email, status, created_at) WHERE customer_email IS NOT NULL;

CREATE TABLE conversions (
  id TEXT PRIMARY KEY NOT NULL,
  lead_id TEXT NOT NULL UNIQUE,
  partner_id TEXT NOT NULL,
  quickbooks_invoice_id TEXT NOT NULL,
  quickbooks_realm_id TEXT NOT NULL,
  provider_environment TEXT NOT NULL CHECK(provider_environment IN ('sandbox','production')),
  amount_paid_cents INTEGER NOT NULL CHECK(typeof(amount_paid_cents) = 'integer' AND amount_paid_cents > 0 AND amount_paid_cents <= 100000000),
  reward_amount_cents INTEGER NOT NULL CHECK(typeof(reward_amount_cents) = 'integer' AND reward_amount_cents >= 0 AND reward_amount_cents <= 100000000),
  amount_paid REAL GENERATED ALWAYS AS (amount_paid_cents / 100.0) VIRTUAL,
  reward_amount REAL GENERATED ALWAYS AS (reward_amount_cents / 100.0) VIRTUAL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PAID')),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency = 'USD'),
  policy_version TEXT NOT NULL,
  evidence_reference TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(lead_id, partner_id) REFERENCES leads(id, partner_id),
  UNIQUE(provider_environment, quickbooks_realm_id, quickbooks_invoice_id)
);
CREATE INDEX conversions_partner_status ON conversions(partner_id, status);

-- INSERT and lead completion share a single SQLite/D1 transaction.
CREATE TRIGGER conversion_requires_claim BEFORE INSERT ON conversions
WHEN NOT EXISTS (SELECT 1 FROM leads WHERE id = NEW.lead_id AND partner_id = NEW.partner_id AND status = 'CLAIMED')
BEGIN SELECT RAISE(ABORT, 'lead_not_claimed'); END;

CREATE TRIGGER conversion_completes_lead AFTER INSERT ON conversions
BEGIN UPDATE leads SET status = 'COMPLETED' WHERE id = NEW.lead_id; END;

-- New commissions always start pending. This slice has no payout writer.
CREATE TRIGGER conversion_starts_pending BEFORE INSERT ON conversions
WHEN NEW.status <> 'PENDING'
BEGIN SELECT RAISE(ABORT, 'conversion_must_start_pending'); END;
