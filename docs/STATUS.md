# Current handoff — 2026-10-09

## Objective and authorization
Complete personal-account Cloudflare staging, then validate QuickBooks Sandbox.
User explicitly authorized account setup/deployment; Wrangler login completed.
No production, paid plan/domain purchase, Git initialization or commits authorized.

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
- English web manual added; mobile claim uses name/phone and integrated transparent logo.

## Cloud staging executed
- Account: 75d4cc849d22526730a76a2f200446d7 (user's personal account).
- Pages: https://fox-referrals.pages.dev; Worker: fox-referrals-api.
- D1 fox-referrals: c141811c-68fe-4e89-bb88-739f2449442c, migrations 0001-0004 applied.
- Synthetic staging partner seeded: referral code staging-restaurant.
- Private Worker deployed; workers_dev/preview URLs disabled; cron registered.
- Pages deployment: https://0abf0db8.fox-referrals.pages.dev.
- Separate remote QB_TOKEN_KEY generated/uploaded without displaying its value.
- QB_ENABLED=true; all four QB secrets uploaded; OAuth active for sandbox realm.
- ACCESS_* and realm deployed; version c70a7d08-f377-4345-81b4-cddc89fffc0c.
- Corrected CloudEvents `void` (portal screenshot), retains legacy job review guard.
- Access organization fox-referrals-staging.cloudflareaccess.com now configured.
- Admin app 722b3386-0e88-44cc-9215-bc85a1a91dca allows owner email only,
  with email OTP plus independent MFA (TOTP/biometrics/security key), 15m sessions.
- Exact webhook bypass app: 22d91fd5-dd20-40c2-818d-b89de06589d7.
- Anonymous connect/status/callback redirect to Access; claim stays 200.
- Webhook GET returns 405; unsigned POST returns 400 INVALID_WEBHOOK after activation.
- Repeated synthetic POST with same retry key returned success twice and one
  D1 lead (+12025550169, deployment-smoke@example.test); zero conversions.

## Validation
- Windows Node 24.18.0/npm 11.16.0; TypeScript, bundle/deployment succeeded.
- Prior 31 Node/SQLite and 3 Chrome tests passed. Latest TypeScript and QBO run:
  30 passed; prior real Chrome OAuth form regression passed.
- Browser coverage: real local save, retry, mobile layout, logo and intercepted
  OAuth redirect/CSP. Desktop/mobile screenshots inspected.
- Local migrations/seed reapplied after changing configured D1 identifier.

## Local state
- Private GitHub repository published: prospera-ross/fox-auto-referrals.
- Ignored .dev.vars contains local encryption key and owner-provided sandbox
  client credentials. Never print this file or its secrets.
- Ignored .cloudflare-access.local prepared for temporary Access setup token.
- .wrangler/local contains synthetic data; test-results contains screenshots.
- Local API/Pages ports: 8787/8788. cron:local helper has not been exercised.
- No tunnel or custom domain. Public staging hosts OAuth/webhooks; Windows runs
  local development independently.

## Immediate next step
Access identity/MFA, callback, webhook events/secrets and realm are configured.
Sandbox Company US 4e3b, US Plus, realm 9341458457635639 is active.
Probe isolated Workers `redirect:error` TypeError while manual mode returned
Intuit HTTP 400. Token, revoke and reads use manual no-follow with 3xx rejection.
Provider disconnected; generation 3 retired. Generation 5 now active, company
confirmed, encrypted token version 1 (about 101 refresh days at issuance).
Cron queried 31 days of invoices; one Intuit sample remains safely quarantined.
Synthetic referral +12025550162 matched QBO customer 100000001 and paid invoice
145/doc 1038 ($86.40). Lead is COMPLETED; exactly one PENDING conversion records
$10.00 reward, payment/claim date 2026-10-09, policy v2 and evidence reference.
Repeated scan retained one reward, confirming effect deduplication; terminal jobs
now stay done and mutable outcomes retry every five minutes. Conversion was created
by reconciliation polling; no genuine Intuit webhook row observed yet.

## Limits
Production blocked by code; G01-G08 unsatisfied, ASVS mapping partial.
Owner Access/JWT and QBO sandbox happy path are verified. Genuine Intuit webhook,
token refresh, logging, load, independent review, retention/restore/alerts and
release enforcement remain unverified.
No full CDC/backfill, automatic liability reversal or immutable external audit.
Unknown refresh requires reviewed recovery; Shop Genie integration is specified but unimplemented.
