-- Synthetic staging fixture ONLY. Never run against production.
-- Customer and lead are deliberately not inserted: submit the public claim form.
-- Re-running preserves the partner and its existing terms.
INSERT INTO partners (id,name,phone,referral_code,payout_type,payout_value_units)
VALUES ('00000000-0000-4000-8000-000000000101','Staging Referral Partner',
  '+12025550161','staging-restaurant','FIXED',1000)
ON CONFLICT(id) DO NOTHING;

SELECT id,referral_code,payout_type,payout_value_units,active FROM partners
WHERE id='00000000-0000-4000-8000-000000000101';
