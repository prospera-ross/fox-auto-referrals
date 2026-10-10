-- User-approved calendar-day policy. Preserve legacy rows and their paid_at;
-- new rows use explicit dates, never a fabricated payment timestamp.
ALTER TABLE conversions ADD COLUMN payment_date TEXT;
ALTER TABLE conversions ADD COLUMN shop_time_zone TEXT;
ALTER TABLE conversions ADD COLUMN claim_local_date TEXT;
ALTER TABLE conversions ADD COLUMN claim_utc_offset_minutes INTEGER;

DROP TRIGGER conversion_policy_guard;
CREATE TRIGGER conversion_policy_guard BEFORE INSERT ON conversions
WHEN NEW.quickbooks_customer_id IS NULL OR length(NEW.quickbooks_customer_id) NOT BETWEEN 1 AND 30
  OR NEW.quickbooks_customer_id GLOB '*[^0-9]*'
  OR NEW.policy_version <> 'fox-fixed-first-30-calendar-days-v2'
  OR NEW.paid_at IS NOT NULL
  OR NEW.payment_date IS NULL OR length(NEW.payment_date) <> 10
  OR date(NEW.payment_date,'+0 days') IS NOT NEW.payment_date
  OR NEW.claim_local_date IS NULL OR length(NEW.claim_local_date) <> 10
  OR date(NEW.claim_local_date,'+0 days') IS NOT NEW.claim_local_date
  OR NEW.shop_time_zone IS NULL OR length(NEW.shop_time_zone) NOT BETWEEN 1 AND 100
  OR typeof(NEW.claim_utc_offset_minutes) <> 'integer'
  OR NEW.claim_utc_offset_minutes NOT BETWEEN -840 AND 840
  OR NOT EXISTS (
    SELECT 1 FROM leads l WHERE l.id = NEW.lead_id
      AND l.payout_type = 'FIXED' AND l.payout_value_units = NEW.reward_amount_cents
      AND l.customer_phone = NEW.customer_phone AND l.customer_email IS NEW.customer_email
      AND NEW.claim_local_date = date(l.created_at,printf('%+d minutes',NEW.claim_utc_offset_minutes))
      AND julianday(NEW.payment_date) >= julianday(NEW.claim_local_date)
      AND julianday(NEW.payment_date) < julianday(NEW.claim_local_date) + 30
      AND NOT EXISTS (
        SELECT 1 FROM leads earlier
        WHERE (earlier.customer_phone = l.customer_phone OR
          (l.customer_email IS NOT NULL AND earlier.customer_email = l.customer_email))
        AND (earlier.created_at < l.created_at OR
          (earlier.created_at = l.created_at AND earlier.rowid < l.rowid))
      )
  )
BEGIN SELECT RAISE(ABORT, 'ineligible_conversion'); END;

CREATE TRIGGER qb_conversion_calendar_evidence BEFORE INSERT ON conversions
WHEN NEW.connection_generation IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM qb_evidence e WHERE e.id = NEW.evidence_reference
    AND json_extract(e.payload,'$.paymentDate') = NEW.payment_date
    AND json_extract(e.payload,'$.timeZone') = NEW.shop_time_zone
)
BEGIN SELECT RAISE(ABORT, 'calendar_evidence_mismatch'); END;

-- Previously held timing cases get fresh API reads under the new policy.
-- Other evidence ambiguities will be held again; conflict/foreign jobs stay held.
UPDATE qb_events SET state='pending',reason=NULL,attempts=0,available_at=0,
  lease_id=NULL,lease_until=0
WHERE state='quarantined' AND reason='evidence_review_required'
  AND EXISTS (SELECT 1 FROM qb_connection c WHERE c.id=1
    AND c.state='active' AND c.paused=0
    AND c.generation=qb_events.generation AND c.realm_id=qb_events.realm_id);
