# Sandbox integration contract

The user explicitly authorized implementation and personal-account staging of
sandbox OAuth, D1 token renewal and paid-invoice webhooks on 2026-10-09. OAuth,
company confirmation and one polling-based paid-invoice conversion succeeded.
This does not authorize production. D01-D08 production gates and independent
review remain open.

## Engineering choices for this sandbox implementation

- One configured `QB_REALM_ID`, Accounting API reads only, sandbox host only.
- Cloudflare Access RS256 JWT, exact issuer/audience and allowlisted subject for
  operator routes; 15-minute maximum token age. Configure MFA in Access/IdP.
  A Secure/HttpOnly/SameSite=Lax host cookie binds OAuth state to this browser.
  State expires after 10 minutes and is atomically consumed once. POST operator
  actions require the exact configured Origin. The owner confirms the verified
  company before jobs can use its grant. No partner accounts or shared grants.
- D1 singleton canonical connection per app/environment/company, monotonically
  increasing generation/token version. AES-256-GCM token ciphertext is bound to
  client ID, sandbox realm, generation and version. Key lives in a Worker secret;
  ordinary SQL access cannot decrypt tokens. This is a sandbox key-management
  choice; production requires independently reviewed key/admin separation.
- Refresh uses D1 compare-and-swap preparation and durable dispatch intent, a
  30-second attempt deadline and 15-second HTTP timeout. No lease takeover or
  automatic retry of an uncertain token exchange. Lost responses/crashes enter
  an unknown hold; a late response cannot overwrite a newer state. A healthy
  scheduled run renews access within 60 seconds of expiry even without events.
- Disconnect first disables local authority/generation and records revocation
  pending; provider revocation is tracked separately. Pending company confirmation
  expires after 10 minutes and is revoked. Unknown refresh/exchange attempts block
  automatic reconnect; operator recovery must retire old dispatchers and confirm
  revocation before any reviewed database repair. Never clear a hold blindly.
- CloudEvents v1 signed-byte validation; durable per-event disposition and scoped
  source/event digest dedupe. Mixed unknown realms are quarantined. Same ID with
  altered content is a conflict. 256 KiB/100-event ingress limit; periodic polling
  recovers missed notifications. Pending jobs persist before a 200 acknowledgement.
- Cron every minute, at most 10 event jobs plus one invoice query page per run.
  Read/job retries: exponential delay starting at 30 seconds, max 8 attempts;
  then quarantine for operator inspection. DB lease fencing protects completion;
  duplicate GETs are harmless and unique atomic ledger inserts prevent double credit.
- User-approved payment-date policy: use the latest allocated Payment.TxnDate
  and the claim's date in `QB_TIME_ZONE`. Claim date is day 1; days 1-30 qualify,
  including same-day payments, regardless of DST. Do not substitute invoice
  modification/event time or invent an exact payment timestamp. Migration 0004
  snapshots payment/claim dates, timezone and claim UTC offset under policy v2.
  It preserves old conversions and requeues current authorized evidence holds
  for fresh API reads; other identity/allocation ambiguities still require review.
- Reconciliation repeatedly scans the last 31 accounting days of invoices using
  fixed paginated queries, restarts each completed sweep, and stores its cursor.
  This is bounded catch-up for new acquisition invoices, not complete CDC history.
  Pre-existing invoices paid later, deletions, refunds and outages exceeding the
  window require operator reconciliation; never claim complete recovery coverage.

## Threats and verification mapping before implementation

| Boundary | Acceptance and mapping | Planned evidence |
| --- | --- | --- |
| Operator/OAuth | FIN-02/03; ASVS 5.0.0 V8.2.1-3, V8.3.1; deny wrong JWT/state/session/realm/replay and require company confirmation | JWT/callback/CSRF/replay tests and deployed owner Access/MFA/consent passed; recovery drill pending |
| Credentials | FIN-04/05/06; only server ciphertext; reject context/ciphertext swaps, race refresh, hold ambiguity, prevent stale persistence | Synthetic crypto/refresh/revocation tests; provider rotation and admin separation review pending |
| Webhooks | FIN-08; verify exact bytes before parse; scope every event, persist all dispositions and reject changed-key replay | Mixed batches/signatures/dedupe/storage-failure tests and deployed unsigned rejection passed; genuine Intuit delivery pending |
| Ledger | FIN-02/07/10; current realm/generation/pause and evidence bound to atomic reward insert | Atomic guard, duplicate, revocation and paid-day tests plus one deployed Sandbox conversion passed |
| Operations | FIN-09/10; sandbox data only, redacted structured failure codes, protected status and quarantine counts | Local tests; real alerts/retention/restore/independent review remain absent |

Full ASVS applicability and G01-G08 enforcement are still incomplete. These are
documented engineering defaults, not invented stakeholder or reviewer approvals.
Owner: requesting user for account access and release decisions; independent
reviewer, incident responders and production privacy/retention owners unassigned.
