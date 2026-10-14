-- Read-only staging diagnostics. No credential values or raw provider payloads.
SELECT state,realm_id,generation,paused,token_version,
  (token_envelope IS NOT NULL) AS has_encrypted_tokens,
  datetime(access_expires_at/1000,'unixepoch') AS access_expires_utc
FROM qb_connection WHERE id=1;

SELECT l.id AS lead_id,l.status AS lead_status,l.created_at,
  c.quickbooks_invoice_id,c.quickbooks_customer_id,c.amount_paid_cents,
  c.reward_amount_cents,c.status AS commission_status,c.payment_date,
  c.claim_local_date,c.shop_time_zone,c.policy_version,c.provider_environment
FROM leads l LEFT JOIN conversions c ON c.lead_id=l.id
WHERE l.customer_phone='+12025550162' ORDER BY l.created_at;

SELECT COUNT(*) AS customer_reward_count,
  COALESCE(SUM(reward_amount_cents),0) AS total_reward_cents
FROM conversions WHERE customer_phone='+12025550162';

-- Current implementation sets digest=event_key only for reconciliation jobs.
-- This distinguishes a polling recovery from actual webhook intake.
SELECT CASE WHEN e.digest=e.event_key THEN 'scan' ELSE 'webhook' END AS intake,
  e.entity_type,e.entity_id,e.operation,e.state,e.reason,e.attempts,
  datetime(e.created_at/1000,'unixepoch') AS received_utc
FROM qb_events e JOIN qb_connection c ON c.id=1
  AND e.realm_id=c.realm_id AND e.generation=c.generation
ORDER BY e.created_at DESC LIMIT 20;

-- Webhook rows that never became jobs: parser rejections and other realms.
-- Rows written before the 2026-10-14 inbox fix lack realm/entity hints and
-- identical rejections collapsed into one row, so absence there is not proof.
SELECT e.reason,e.realm_id=c.realm_id AS authorized_realm,e.entity_id,
  COUNT(*) AS n,datetime(MAX(e.created_at)/1000,'unixepoch') AS latest_utc
FROM qb_events e JOIN qb_connection c ON c.id=1
WHERE e.state IN ('quarantined','conflict') AND e.digest<>e.event_key
GROUP BY 1,2,3 ORDER BY latest_utc DESC LIMIT 20;
