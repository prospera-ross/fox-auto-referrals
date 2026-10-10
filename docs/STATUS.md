# Current handoff — 2026-10-10

## Objective and authorization
Validate the deployed owner dashboard and QuickBooks Sandbox integration.
Public manual commit authorized; no production, paid resources or push authorized.

## Implemented
- Responsive English QR claim page, supplied Fox logo, Pages service proxy.
- Validated/normalized contacts, idempotent save, exact Shop Genie redirect.
- D1 migrations 0001-0004, integer reward snapshots and atomic deduplication.
- Fixed payout on any fully paid invoice; first claim owns attribution, once per
  customer. Claim date is day 1; latest allocated Payment.TxnDate must be days 1-30.
- Calendar policy v2 snapshots dates/zone/offset; America/New_York configured.
- Sandbox OAuth with owner Access JWT, one-use session-bound state, realm pinning,
  encrypted D1 tokens, confirmation, coordinated refresh and uncertainty holds.
- Signed webhook inbox, durable jobs/retries/quarantine, minute cron and bounded
  invoice polling. Accounting reads only; no transfers or QBO accounting edits.
- Public manual covers owner dashboard/QR operations, separate Access and current gaps.

## Cloud staging executed
- Account: 75d4cc849d22526730a76a2f200446d7 (user's personal account).
- Pages: https://fox-referrals.pages.dev; Worker: fox-referrals-api.
- D1 fox-referrals: c141811c-68fe-4e89-bb88-739f2449442c, migrations 0001-0005 applied.
- Synthetic staging partner seeded: referral code staging-restaurant.
- Private Worker deployed; workers_dev/preview URLs disabled; cron registered.
- Latest Pages deployment: https://5523df21.fox-referrals.pages.dev.
- Separate remote QB_TOKEN_KEY generated/uploaded without displaying its value.
- QB_ENABLED=true; all four QB secrets uploaded; OAuth active for sandbox realm.
- ACCESS_* and realm deployed; Worker e2fc3620-39be-4baa-91e7-2d503b936b92.
- Corrected CloudEvents `void` (portal screenshot), retains legacy job review guard.
- Access organization fox-referrals-staging.cloudflareaccess.com now configured.
- Access app 722b3386-0e88-44cc-9215-bc85a1a91dca protects /api/quickbooks/*
  with owner-only email OTP plus independent MFA and 15-minute sessions.
- Dashboard Access app 2f09e0df-4e6e-48ad-9739-2aa5afb90968 protects /api/admin/* with owner-only MFA and a distinct audience.
- Exact webhook bypass app: 22d91fd5-dd20-40c2-818d-b89de06589d7.
- Anonymous connect/status/callback redirect to Access; claim stays 200.
- Webhook GET returns 405; unsigned POST returns 400 INVALID_WEBHOOK after activation.
- Repeated synthetic POST with same retry key returned success twice and one
  D1 lead (+12025550169, deployment-smoke@example.test); zero conversions.

## Validation
- Manual Chrome: anchors/copy targets, search, 14 checks, mobile menu and 1440/390/320px layouts pass; screenshots reviewed. Manual not deployed.
- Windows Node 24.18.0/npm 11.16.0; TypeScript, bundle/deployment succeeded.
- Latest local suite: 43 Node/SQLite tests, TypeScript and Worker bundle pass.
  Admin Chrome UI test and prior three claim/OAuth Chrome tests pass.
- Browser coverage: real local save, retry, mobile layout, logo and intercepted
  OAuth redirect/CSP. Desktop/mobile screenshots inspected.

## Local state
- Private GitHub repository published: prospera-ross/fox-auto-referrals.
- Ignored .dev.vars contains local encryption key and owner-provided sandbox
  client credentials. Never print this file or its secrets.
- Ignored .cloudflare-access.local prepared for temporary Access setup token.
- .wrangler/local contains synthetic data; test-results contains screenshots.
- Local API/Pages ports: 8787/8788. cron:local helper has not been exercised.
- No tunnel or custom domain. Public staging hosts OAuth/webhooks; Windows runs
  local development independently.

## Current state and next step
Access identity/MFA, callback, webhook events/secrets and realm are configured.
Sandbox Company US 4e3b, US Plus, realm 9341458457635639 is active.
OAuth calls use manual no-follow with 3xx rejection; the isolated probe gets Intuit 400.
Generations 3/5 retired. Generation 5 passed 16 natural renewals (token v1 to v17).
Generation 7 is active/confirmed with encrypted token v1 after revoke/reconnect.
Cron queried 31 days of invoices; one Intuit sample remains safely quarantined.
Synthetic referral +12025550162 matched QBO customer 100000001 and paid invoice
145/doc 1038 ($86.40). Lead is COMPLETED; exactly one PENDING conversion records
$10.00 reward, payment/claim date 2026-10-09, policy v2 and evidence reference.
Repeated scans retained one reward; real create/update callbacks remain absent.
Admin API, migration 0005 and redesigned dashboard UI are deployed. Access redirect
and authenticated reads pass: 2 leads, 1 commission and $10 pending. Filters, QR
SVG delivery/download and exact URL decoding pass; live CSS/JS match local hashes.
Next: authenticated live visual smoke, then resume genuine webhook monitoring.

## Limits
Production blocked by code; G01-G08 unsatisfied, ASVS mapping partial.
Owner Access/JWT, QBO sandbox happy path and natural token refresh are verified;
genuine webhook, logging, load, review, retention/restore/alerts and release remain unverified.
No full CDC/backfill, automatic liability reversal or immutable external audit.
Unknown refresh requires reviewed recovery; Shop Genie integration is specified but unimplemented.
