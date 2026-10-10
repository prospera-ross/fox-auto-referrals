# Operations and activation

Local tests and a deployed staging paid-invoice conversion have been exercised.
Sandbox OAuth/renewal/intake and scheduled verification are implemented; follow
SETUP.md for the beginner path and QUICKBOOKS_SETUP.md for technical recovery.
This runbook does not attest to production access, incident response or recovery.
Owners/targets that remain open are recorded in REQUIREMENTS.md D01-D08.

## Local operation

Use README commands. Start the Worker and Pages in separate terminals; Ctrl+C
stops each server. The Pages service binding should report `connected`. Both D1
commands and the Worker share `.wrangler/local/`; no remote binding is enabled.
Use `/claim?ref=restaurant-x` on the exact localhost origin. Tests leave only
synthetic data and ignored screenshots. The initial failed validation used a
separate `.wrangler/state/` emulator; current commands do not use that directory.

Do not use the local seed for a real partner. Real partner enrollment and changes
need an authenticated operator workflow, approved rates and audit history.
No admin API or SQL-writing browser interface is exposed in this slice.

## Cloud claim release

Personal-account staging was deployed on 2026-10-09 with user authorization:
D1 migrations 0001-0004, staging seed, private Worker, cron and public Pages.
The synthetic claim, Sandbox OAuth and paid-invoice conversion succeeded through
reconciliation polling. Genuine webhook delivery and natural token renewal still
need evidence. Production is unverified.

1. The user owns QBO access and security/release approval; assign remaining data,
   operations and independent review roles. Agree privacy notice, retention/deletion,
   partner enrollment/rates, offer terms, budget and abuse thresholds. Confirm
   Shop Genie destination and how Fox staff honor the discount.
2. Select Cloudflare account, domains, plan, resource region and independent
   production/sandbox resources. Provision through reviewed configuration after
   authorization; replace the staging D1 ID only when targeting a different DB.
3. Set `APP_ENV` to the selected nonlocal environment and `PUBLIC_ORIGIN` to the
   exact Pages HTTPS origin. Keep `workers_dev=false` and `preview_urls=false`.
   The staging config includes `CLAIM_RATE_LIMITER`: 60 requests per 60 seconds,
   namespace `1001`. Reserve that namespace for this app or replace it if already
   used in your account. Reassess numeric limits before production.
   This per-location permissive IP limit is preliminary abuse resistance, not
   identity verification, a global request cap or financial rate accounting;
   test shared/mobile-IP impact and trusted header behavior through Pages.
4. Review the target, backup and schema changes before authorized remote migration.
   CLI shape: `npx wrangler d1 migrations apply fox-referrals --remote --config
   wrangler.worker.jsonc`. It was run for staging only. No production seed.
5. After required release checks, deploy the reviewed Worker artifact/config
   (`npx wrangler deploy --config wrangler.worker.jsonc`) and Pages
   (`npx wrangler pages deploy public`). These commands were run for staging;
   provision the Pages project and binding first. Local build verification does
   not verify a future artifact rebuilt by a deployment command.
6. Verify HTTPS, CSP, exact-origin checks, forwarded IP provenance, rate controls,
   sanitized edge/access logs, least privilege and private Worker access. Test a
   controlled synthetic claim end to end; remove it through approved retention
   procedures. Keep preview resources separate from production PII.

Review protected deployment paths and signoffs first; current files do not enforce
G01-G08 in [the QuickBooks profile](../INIT.profiles/quickbooks.md).
Do not bypass the live claim guard by leaving APP_ENV set to local.
Logging is disabled in Worker configuration to avoid accidental data exposure;
add redacted operational metrics/logging with retention and tested alert routing
before release. Review Pages and account-level logging independently.

## QuickBooks production work remaining

Sandbox versions of the connection/refresh/reader/inbox/cron boundaries below are
now implemented under the user's explicit instruction. SANDBOX.md records the
defaults and limitations; QUICKBOOKS_SETUP.md is the current setup procedure.
The following remains the production review/strengthening sequence, not a claim
that the sandbox files are absent.

1. Close D01/D02: select API minor version and exact read operations; define admin
   identity/MFA, session/CSRF lifetimes, company ownership and canonical consent
   generation. No company identifier from a webhook may create authority.
2. Close D04 and implement backend OAuth authorization-code flow: unpredictable
   expiring single-use state bound to the authenticated initiator and intended
   action; callback permission recheck, exact redirect URI, backend exchange,
   verified company confirmation and atomic exclusive binding. Redact callback
   query strings at every ingress layer. Do not assume PKCE support without review.
3. Use a protected managed credential/key store with authenticated context-bound
   encryption. Implement FIN-05 from the QuickBooks profile: a durable refresh
   state machine and uncertain response holds; expiry of a lease never authorizes a competing refresh. Implement
   generation-based disconnect/replacement and tracked revocation. No plain tokens
   in D1, client code, browser storage or Wrangler vars.
4. Implement `AuthorizedQboReader` with runtime JSON validation, fixed provider
   hosts, bounded requests/timeouts/retries, current-company authorization and
   protected evidence. Contract-test Invoice/Payment/Customer fields and refund,
   void, deletion and allocation behavior using Intuit sandbox fixtures.
5. Use the accepted fixed/first-claim/30-day/one-customer policy in `policy.ts`.
   Use the approved latest allocated Payment.TxnDate and 30 shop-local dates
   (claim date = day 1). Contract-test allocation/date behavior in sandbox.
   Verify the store's atomic connection generation and pause guards. Resolve later
   reversal rules and add immutable audit; do not introduce percentage/item filters.
6. Close D06: signed raw-byte CloudEvents intake, current authorized realm lookup,
   event/source/environment deduplication plus conflicting-body detection, durable
   dispositions for every batch member, bounded retries and quarantine. Only then
   validate the implemented sandbox inbox on deployed ingress. Signature validation is not company authority.
7. Add scheduled processing and recovery checkpoints. Payment changes resolve
   linked invoice IDs; invoice changes refetch current records. Deletion/void
   events and removed allocations require prior linkage/evidence, not blind GET
   retries. Recover missed notifications with approved CDC coverage/backfill; never
   advance a checkpoint past unfinished events. No `waitUntil`-only dispatch.
8. Execute mapped automated/manual tests, independent review and operational drills,
   then enforce G01-G08 on every deployment and activation path. A cron, Sandbox
   grant and subscriptions exist; genuine provider webhook delivery has not yet
   been observed.

## Recovery, privacy and cost

Required data inventory: lead contacts/referral history; reward snapshots and
financial evidence; connection grants; inbox/retry/checkpoint state; audit, logs,
backups and local test artifacts. D07 must define purpose, access, retention,
deletion/export and backup expiry for each. Preserve dedupe/evidence long enough
for supported replays and liabilities; never delete an unresolved intent into
permission to duplicate it. No retention durations are invented here.

Before activation, implement authenticated global/company pause, alert primary
and fallback responders, credential rotation/revocation, quarantine triage and
restore procedures. Measure detection, acknowledgement, containment, unresolved
operation age, reconciliation lag, RTO and RPO against approved numeric objectives.
Restore into a paused isolated environment; revoked grants and completed
conversions must not reactivate/repeat. Test before asserting recovery works.

Cloud expenses are unestimated: record plan, traffic/payload assumptions, database
reads/writes/storage, worker duration, logs and provider quotas, then agree budget
alerts and enforceable caps. No services were provisioned or paid resources used.
