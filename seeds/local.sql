-- Synthetic partner only. Never apply this fixture to a remote database.
INSERT INTO partners (id, name, phone, referral_code, payout_type, payout_value_units)
VALUES ('00000000-0000-4000-8000-000000000001', 'Demo Restaurant', '+12025550123', 'restaurant-x', 'FIXED', 2500)
ON CONFLICT(id) DO NOTHING;
