-- Preserve existing rows. Legacy percentage configurations cannot accept new
-- claims or credits. Resolve any pre-existing duplicate rewards before applying
-- this migration; a uniqueness failure must never silently delete history.
ALTER TABLE conversions ADD COLUMN quickbooks_customer_id TEXT;
ALTER TABLE conversions ADD COLUMN customer_phone TEXT;
ALTER TABLE conversions ADD COLUMN customer_email TEXT;
ALTER TABLE conversions ADD COLUMN paid_at TEXT;

UPDATE conversions SET
  customer_phone = (SELECT customer_phone FROM leads WHERE id = conversions.lead_id),
  customer_email = (SELECT customer_email FROM leads WHERE id = conversions.lead_id);

CREATE UNIQUE INDEX conversions_customer_once ON conversions
  (provider_environment, quickbooks_realm_id, quickbooks_customer_id)
  WHERE quickbooks_customer_id IS NOT NULL;
CREATE UNIQUE INDEX conversions_phone_once ON conversions
  (provider_environment, quickbooks_realm_id, customer_phone);
CREATE UNIQUE INDEX conversions_email_once ON conversions
  (provider_environment, quickbooks_realm_id, customer_email)
  WHERE customer_email IS NOT NULL;
CREATE INDEX leads_phone_first ON leads(customer_phone, created_at);
CREATE INDEX leads_email_first ON leads(customer_email, created_at) WHERE customer_email IS NOT NULL;

CREATE TRIGGER partner_fixed_insert BEFORE INSERT ON partners
WHEN NEW.payout_type <> 'FIXED'
BEGIN SELECT RAISE(ABORT, 'fixed_rewards_only'); END;
CREATE TRIGGER partner_fixed_update BEFORE UPDATE OF payout_type ON partners
WHEN NEW.payout_type <> 'FIXED'
BEGIN SELECT RAISE(ABORT, 'fixed_rewards_only'); END;
CREATE TRIGGER lead_fixed_insert BEFORE INSERT ON leads
WHEN NEW.payout_type <> 'FIXED'
BEGIN SELECT RAISE(ABORT, 'fixed_rewards_only'); END;
CREATE TRIGGER lead_fixed_update BEFORE UPDATE OF payout_type ON leads
WHEN NEW.payout_type <> 'FIXED'
BEGIN SELECT RAISE(ABORT, 'fixed_rewards_only'); END;

CREATE TRIGGER conversion_policy_guard BEFORE INSERT ON conversions
WHEN NEW.quickbooks_customer_id IS NULL OR length(NEW.quickbooks_customer_id) NOT BETWEEN 1 AND 30
  OR NEW.quickbooks_customer_id GLOB '*[^0-9]*'
  OR NEW.policy_version <> 'fox-fixed-first-30d-v1'
  OR NEW.paid_at IS NULL OR julianday(NEW.paid_at) IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM leads l WHERE l.id = NEW.lead_id
      AND l.payout_type = 'FIXED' AND l.payout_value_units = NEW.reward_amount_cents
      AND l.customer_phone = NEW.customer_phone AND l.customer_email IS NEW.customer_email
      AND julianday(NEW.paid_at) >= julianday(l.created_at)
      AND julianday(NEW.paid_at) < julianday(l.created_at) + 30
      AND NOT EXISTS (
        SELECT 1 FROM leads earlier
        WHERE (earlier.customer_phone = l.customer_phone OR
          (l.customer_email IS NOT NULL AND earlier.customer_email = l.customer_email))
        AND (earlier.created_at < l.created_at OR
          (earlier.created_at = l.created_at AND earlier.rowid < l.rowid))
      )
  )
BEGIN SELECT RAISE(ABORT, 'ineligible_conversion'); END;
