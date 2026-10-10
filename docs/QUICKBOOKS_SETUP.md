# Connect the QuickBooks sandbox

New to Cloudflare or QuickBooks? Follow the
[staging setup guide for first-time operators](SETUP.md) first. This file is the technical runbook
for exact contracts, diagnostics and recovery behavior.

The implementation is sandbox-only. Personal-account Cloudflare staging was
deployed at https://fox-referrals.pages.dev on 2026-10-09. Migrations, secrets,
Access/MFA, owner identity and the sandbox realm are configured. OAuth is active;
an authenticated paid-invoice test created exactly one synthetic $10 commission.
The successful conversion came from reconciliation polling. Natural background
renewal passed repeatedly; genuine authorized-realm webhook delivery remains
pending despite a successful signed Intuit portal test. See STATUS.md before
repeating any setup.

## 1. Configure the public routes and operator access

Use Pages project `fox-referrals` and Worker `fox-referrals-api`. Pages forwards
`/api/quickbooks/*` to the Worker through `REFERRAL_API`; do not put provider
secrets on the static Pages project. The default Worker remains private.

Protect `/api/quickbooks/*` with a Cloudflare Access self-hosted application and
an allow policy limited to your owner identity, with MFA and a 15-minute session.
Exclude **only** `/api/quickbooks/webhook` from interactive Access: Intuit calls
that route without a browser session; the Worker verifies its HMAC instead.
Keep connect, callback, confirm, status, pause, resume and disconnect protected.
The Worker independently verifies Access RS256 JWTs, issuer, audience, expiry
and the configured subject. Do not substitute an unsigned identity header.

For this staging, the API-created Access apps already protect the main hostname:
`fox-referrals-staging.cloudflareaccess.com`, 15-minute sessions, owner email only,
email OTP plus independent MFA (authenticator app, biometrics or security key).
Anonymous admin routes redirect to Access; the claim stays public; only the exact
webhook route bypasses interactive login. Owner confirmed TOTP enrollment; the
Access API returned the owner identity. An authenticated end-to-end operator
request, Intuit consent and company confirmation have passed.
The owner-only App Launcher is enabled for MFA enrollment at
https://fox-referrals-staging.cloudflareaccess.com/AddMfaDevice. Keep enrollment
reachable after email authentication; the admin app separately requires MFA.
The issuer, audience and API-verified owner subject are deployed to the Worker.

For a new Pages project where direct application creation does not protect the
hostname, follow Cloudflare's dashboard procedure: enable the Pages Access policy,
then manage its generated Access application. Change its public hostname from
`*.fox-referrals.pages.dev` to `fox-referrals.pages.dev` and scope the path to
`/api/quickbooks/*`. Add a more-specific application for
`fox-referrals.pages.dev/api/quickbooks/webhook` with Bypass for Everyone; only
that exact path bypasses Access and still requires the Intuit HMAC. Keep the
claim page public. Re-enable a separate preview policy if preview deployments
are used. Verify this hostname/path configuration before connecting: the default
Pages preview policy alone does not protect the main hostname.
See [Cloudflare's Pages Access instructions](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain).

Set these non-secret vars in `wrangler.worker.jsonc` (or the corresponding Worker
dashboard settings; keep config and dashboard consistent):

| Variable | Value |
| --- | --- |
| `APP_ENV` | `staging` for this sandbox deployment; keep `local` for local-only development |
| `PUBLIC_ORIGIN` | `https://fox-referrals.pages.dev` |
| `QB_REDIRECT_URI` | `https://fox-referrals.pages.dev/api/quickbooks/callback` |
| `QB_REALM_ID` | Your sandbox company ID; required before connecting |
| `QB_MINOR_VERSION` | `75` is the pinned test baseline; verify it with your sandbox contracts before activation |
| `QB_TIME_ZONE` | `America/New_York` — configured for the Maryland shop |
| `ACCESS_TEAM_DOMAIN` | Your exact issuer, such as `https://your-team.cloudflareaccess.com` |
| `ACCESS_AUD` | Application audience tag from Access |
| `ADMIN_ACCESS_AUD` | Distinct audience tag for the owner dashboard Access application |
| `ACCESS_ADMIN_SUB` | Your owner account's stable subject from an authenticated Access identity; never trust an unverified token's contents |
| `QB_ENABLED` | Keep `false` until the required settings/secrets/database are ready, then `true` |

If your actual Pages URL differs, change BOTH origin and redirect vars, Intuit's
registered redirect, and the Access application URL. No trailing slash in origin.
Do not connect a production company or use production app credentials here.
Do not place credentials in `vars`, code, a committed JSON file or URL parameters.

## 2. Add Worker secrets

From the project directory, these are the exact interactive commands:

```powershell
npx.cmd wrangler secret put QB_CLIENT_ID --config wrangler.worker.jsonc
npx.cmd wrangler secret put QB_CLIENT_SECRET --config wrangler.worker.jsonc
npx.cmd wrangler secret put QB_WEBHOOK_VERIFIER --config wrangler.worker.jsonc
```

Paste each value only at Wrangler's prompt. The third value is the Development
webhook verifier token from the Intuit app dashboard, not the Client Secret.
On shells other than Windows, use `npx` instead of `npx.cmd`.

Create the independent AES-256 token-encryption key without printing it:

```powershell
node scripts/set-token-key.mjs
```

That helper pipes a fresh cryptographic 32-byte base64 key directly into the
equivalent command below. To supply an existing managed key yourself, use:

```powershell
npx.cmd wrangler secret put QB_TOKEN_KEY --config wrangler.worker.jsonc
```

**Do not generate/replace this key after connecting unless you are performing a
planned credential migration.** Existing ciphertext requires the original key.
Manage recovery/key access under your account policy; the key is not stored in D1.

Dashboard alternative: Workers & Pages -> **fox-referrals-api** -> Settings ->
Variables and Secrets -> Add. Use type **Secret** for all four names above.
The code reads `env.QB_CLIENT_ID`, `env.QB_CLIENT_SECRET`, `env.QB_TOKEN_KEY` and
`env.QB_WEBHOOK_VERIFIER`; none is sent to the customer landing page. The Client ID
necessarily appears in the owner-only authorization request to Intuit; it is not
an OAuth access/refresh credential. Provider tokens remain encrypted in D1.

## 3. Prepare the sandbox D1 and deploy when authorized

For a first deployment, authenticate and create only resources that do not
already exist (run from the project root):

```powershell
npx.cmd wrangler login
npx.cmd wrangler whoami
npx.cmd wrangler d1 create fox-referrals --config wrangler.worker.jsonc
npx.cmd wrangler pages project create fox-referrals --production-branch main
```

Copy the returned D1 UUID into the existing `DB` binding. If the Pages name is
unavailable, use the actual project name/domain consistently throughout this
guide, the config and Intuit's registered redirect. Resources created here incur
normal account usage; initial personal-account provisioning has already run.

Use the isolated staging D1 database already configured in `wrangler.worker.jsonc`;
change its ID only for a new target and confirm the account. Apply all migrations,
not just 0001. No production/local seed belongs in a remote database.
The config already sets `APP_ENV=staging` and
`PUBLIC_ORIGIN=https://fox-referrals.pages.dev`; fill the sandbox realm and Access
settings above, and provision the four secrets. Set `QB_ENABLED=true` when ready.
This project has no named Wrangler `sandbox` environment: use the explicit config
below without `--env sandbox`.

```powershell
npx.cmd wrangler login
npx.cmd wrangler whoami
npx.cmd wrangler d1 migrations list fox-referrals --remote --config wrangler.worker.jsonc
npx.cmd wrangler d1 migrations apply fox-referrals --remote --config wrangler.worker.jsonc
npx.cmd wrangler d1 migrations list fox-referrals --remote --config wrangler.worker.jsonc
npx.cmd wrangler deploy --config wrangler.worker.jsonc
npx.cmd wrangler pages deploy public --project-name fox-referrals --branch main
```

`migrations apply` runs all pending migrations in order. If 0001-0003 are already
applied, it runs only `0004_calendar_day_policy.sql`; on a fresh database it runs
all four. Use the migration command rather than executing 0004 as a standalone
SQL file so Wrangler records its migration history. The second list should show
no pending migrations. Deploy Pages as well on initial setup so its service proxy
exposes the private Worker's OAuth routes at the registered callback domain.

The migrations and Worker/Pages deployment commands were executed for personal
staging on 2026-10-09. Do not recreate existing resources; list them first.
Follow OPERATIONS.md for the claim rate limiter and remote claim configuration.
Review account/Pages/Access request logging: OAuth callback code/query parameters,
Authorization and cookie headers must be excluded/redacted at ingress. Worker
observability is disabled by default; that does not control account-level logs.

## 4. Connect and confirm

Operator HTML uses `Referrer-Policy: same-origin` so native POST forms retain their
Origin header; OAuth redirect responses remain `no-referrer`. Missing, null and
foreign origins are rejected. If an old connection page reports `INVALID_ORIGIN`,
reopen `/api/quickbooks/connect` to load the current page rather than resubmitting
the failed POST. The Chrome regression exercises the actual OAuth handler/D1.

1. Register the exact callback URL above in Intuit Settings > Redirect URIs >
   Development. Owner confirmed this step for the personal Fox-auto app.
2. Open `https://fox-referrals.pages.dev/api/quickbooks/connect` as the Access owner.
3. Choose **Authorize sandbox company**, sign in to Intuit, select the sandbox
   company matching `QB_REALM_ID`, approve access, and return in the same browser.
4. On the clean status page, verify the company name and ID, then choose
   **Confirm sandbox company**. Unconfirmed grants cannot run jobs and expire
   after ten minutes. A wrong configured company ID is rejected. The status page
   must show **active** without **(paused)** before automatic processing can run.
5. Configure the Intuit Development webhook endpoint as
   `https://fox-referrals.pages.dev/api/quickbooks/webhook`. Subscribe to Invoice
   and Payment create/update/delete/void changes supported by the app dashboard.
   Select `qbo.invoice.{created,updated,deleted,void}.v1` and the corresponding
   `qbo.payment.*` events; deselect `emailed`. The actual void operation is `void`,
   not `voided`. Enable CloudEvents v1; legacy eventNotifications are not accepted.

The one-minute cron renews healthy access tokens automatically using the latest
encrypted refresh token and processes durable pending jobs. Repeated callbacks,
events and concurrent jobs do not create duplicate commissions. Invoice/payment
notifications trigger current API reads; the event body is never payment proof.

OAuth connection test pass criteria:

- Before consent, the protected status page shows `empty` (or `revoked` after a
  prior confirmed disconnect). An unauthenticated visitor cannot access it.
- Consent returns to the same host, strips callback query parameters, and shows
  the expected sandbox company name and configured realm ID as `pending`.
- Confirmation changes it to `active` without `(paused)`.
- Inspect only sanitized connection metadata with this read-only command:

```powershell
npx.cmd wrangler d1 execute fox-referrals --remote --config wrangler.worker.jsonc --command "SELECT state, realm_id, paused, token_version, (token_envelope IS NOT NULL) AS has_encrypted_tokens FROM qb_connection WHERE id = 1"
```

Expect `active`, the intended realm, `paused=0`, `token_version=1` on the initial
connection and `has_encrypted_tokens=1`. CompanyInfo's entity Id may be `1`; it is
not the realm ID. The code validates the callback realm and authenticates the read
at the pinned company URL, then requests owner confirmation of its name.
After the token's first expiry cycle, the one-minute cron should renew it and
increment `token_version` while remaining active. Do not edit encrypted token
contents or expiration fields to force this test against the live provider.

Troubleshooting: `QUICKBOOKS_NOT_CONFIGURED` means required Worker settings/secrets
are incomplete; `ADMIN_NOT_CONFIGURED` means Access settings are missing;
`ADMIN_REQUIRED` means the Access assertion is missing, expired or not allowlisted.
An Intuit redirect mismatch requires the exact registered URI. A pending state
without a verified name must not be confirmed; inspect configuration/provider
availability and disconnect/revoke through the owner screen. Never share tokens,
callback query strings, cookies or Authorization headers when reporting failures.

OAuth success is separate from the full referral test. Before testing public
claims, configure `CLAIM_RATE_LIMITER` as described in OPERATIONS.md; nonlocal
claim requests intentionally return 503 when that binding is absent.

## 5. Verify with synthetic sandbox records

This is a Staging/Homologation deployment with test data, not a production launch.
The Pages `main` branch provides the stable callback hostname; the Worker still
uses `APP_ENV=staging`, the sandbox API host and Development credentials. Do not
reuse its database or OAuth grant for the later production rollout.

The config includes a staging `CLAIM_RATE_LIMITER` binding: namespace `1001`,
60 calls per 60 seconds per IP/Cloudflare location. Confirm that this namespace
is not shared with another app in your account (change it if necessary). This is
a staging default, not a globally exact abuse limit or production policy.

### Create the referral through the real claim flow

After OAuth is active and webhook subscriptions are configured, seed the dedicated
synthetic partner in the isolated staging D1:

```powershell
npx.cmd wrangler d1 execute fox-referrals --remote --config wrangler.worker.jsonc --file seeds/staging.sql
```

The output must show `staging-restaurant`, `FIXED`, `1000` cents and `active=1`.
This $10 rate is only a test fixture. Never apply seeds/local.sql remotely, and
never apply seeds/staging.sql to production.

Open `https://fox-referrals.pages.dev/claim?ref=staging-restaurant` and submit:

| Field | Synthetic value |
| --- | --- |
| Full name | Staging Customer 001 |
| Phone | (202) 555-0162 |

Confirm the save succeeds and the browser reaches the configured Shop Genie
URL. Stop there; do not create a real appointment. The redirect is an external
booking handoff, not proof of an appointment or a QuickBooks conversion.

Run the diagnostic command below. At this stage, the lead must be `CLAIMED`,
conversion fields null and `customer_reward_count=0`.

### Create and pay a sandbox invoice

1. Open the connected US sandbox company from the Intuit Developer dashboard.
   Check its company ID matches `QB_REALM_ID`; do not use the live Fox company.
2. Create a customer named `Staging Customer 001` with phone `(202) 555-0162`.
   Email may be left blank. Leave mobile blank or use the same phone; conflicting
   primary/mobile identities deliberately do not convert.
3. Create an invoice for this customer with one ordinary service line, quantity
   1, total **USD 80.00**. Use today's Maryland date and a non-taxable test line
   to keep the arithmetic simple. Save it without emailing it. No specific
   oil-change item is required for eligibility.
4. Leave the invoice unpaid initially. Once its webhook/read job has run, verify
   there is still no conversion. An unpaid invoice must not earn a commission.
5. In QuickBooks, choose **+ Create -> Receive payment**, select that customer,
   enter **80.00**, and apply the entire amount to this invoice only. Use today's
   Maryland payment date, a manual Cash/Check method and an appropriate sandbox
   deposit account. Choose **Record and close** (or **Save and close**).
6. Verify the invoice is fully paid with zero balance and a linked payment.
   This records synthetic accounting data; it does not charge a real card.

The owner creates these fixtures in the QuickBooks UI. Our Worker continues to
read accounting data only. Follow Intuit's [invoice creation](https://quickbooks.intuit.com/learn-support/en-us/help-article/invoicing/create-invoices-quickbooks-online/L7gSzvCld_US_en_US)
and [record-payment](https://quickbooks.intuit.com/learn-support/en-us/help-article/invoicing/record-invoice-payments-quickbooks-online/L4ZadDW7F_US_en_US)
instructions if menu labels differ.

### Observe the webhook and commission

Intuit must deliver a signed Invoice/Payment change to the configured Development
endpoint. The Worker persists it, then a one-minute cron refetches provider data.
Allow delivery time plus a few cron cycles; this is not an instant-delivery SLA.

```powershell
npx.cmd wrangler d1 execute fox-referrals --remote --config wrangler.worker.jsonc --file scripts/verify-staging.sql
```

Expected after payment:

| Check | Expected |
| --- | --- |
| Connection | `active`, `paused=0`, encrypted tokens present |
| Lead | `COMPLETED` |
| Customer reward count | `1` |
| Paid amount / reward | `8000` / `1000` cents |
| Commission status | `PENDING` (recorded; no partner transfer) |
| Environment / timezone | `sandbox` / `America/New_York` |
| Payment date | The accounting date entered in QuickBooks |
| Intake evidence | A `webhook` job for the invoice/payment, eventually `done` |

The diagnostic differentiates webhook jobs from reconciliation `scan` jobs.
A conversion produced solely by polling does NOT pass the webhook-delivery test.
Check Intuit's available delivery diagnostics, Access bypass, verifier token and
event envelope if no webhook appears. Review `reason` for quarantined/retried jobs;
do not insert a conversion or change a lead status manually to force a pass.

### Repeat and renewal checks before approval

- Replay a signed provider notification through Intuit's redelivery facility if
  available: the same invoice must still have only one conversion. Editing/saving
  an invoice generates a new event, so it tests repeated processing, not exact
  event-ID deduplication. Synthetic duplicate-event coverage also exists locally.
- Create and fully pay a second invoice for this same customer. Reward count must
  remain `1`, total reward `1000` cents. A new run needing a new reward must use a
  fresh synthetic contact and new QuickBooks customer, not deleted ledger history.
  Update the phone filters in the diagnostic SQL for those additional customers.
- Before the first access-token renewal, record `token_version` and
  `access_expires_utc`. After that expiry cycle and cron execution, rerun diagnostics:
  version increases, expiry advances and state remains active. Then process a new
  test customer/invoice to establish that refreshed credentials can read records.
- Use separate synthetic customers for partial-payment (no reward until fully
  paid), unmatched-contact, calendar cutoff and competing-partner cases. Natural
  calendar-boundary tests require controlled dated fixtures; local DST/day-30/day-31
  tests are already automated. Do not rewrite timestamps on converted staging rows.
- Test pause/resume and disconnect/reconnect after the happy path; retain evidence
  of expected holds and recovery. Refresh-timeout/conflict paths have local tests
  and need controlled fault-injection validation, not arbitrary token edits.

Record the test date, deployment/version, sandbox realm, invoice/payment IDs,
sanitized diagnostic results, token version changes and failures. A happy-path
conversion alone does not approve the entire staging environment for production.

The approved rule uses the latest allocated `Payment.TxnDate` and shop-local
calendar days. The claim date is day 1; same-day payments and day 30 qualify,
day 31 does not. A September 1 claim is valid through September 30. Configure
`QB_TIME_ZONE` to the actual shop timezone before activation. Do not change it
casually: it determines claim dates, while each conversion snapshots its zone.
Apply migration 0004 before deploying this version. It preserves prior rewards
and requeues evidence holds from the current active connection for fresh reads.
New conversions have `payment_date`, `claim_local_date`, `shop_time_zone` and
`claim_utc_offset_minutes`; `paid_at` remains null because no exact time is known.

Refresh ambiguity (`refresh_unknown`) or unresolved revocation stops authorization.
Do not clear the hold or keep retrying the old token. Retire old dispatchers,
revoke the grant in Intuit, and investigate the persisted attempt before reviewed
reconnection recovery. There is deliberately no unsafe lease-takeover button.
Pause/disconnect controls are on `/api/quickbooks/status` and require the owner.

If the initial code exchange reaches `refresh_unknown` with no encrypted tokens,
the local disconnect cannot revoke a grant it does not possess. Disconnect Fox-auto
from the selected sandbox company's integrations in Intuit first. Confirm provider
revocation and retire the failed dispatcher before reviewed D1 recovery; do not
reset the hold based only on elapsed time or missing tokens. New callback failures
record `oauth_failed_<stage>` and a fixed HTTP/transport/body/shape category for
token failures in `qb_audit`. Provider response bodies and exception messages are
never recorded. These categories diagnose the next attempt, not historical errors.

Polling covers recent invoice accounting dates only (31 days). Old-invoice payments,
deleted payments, refunds and long outages still require reconciliation review;
full CDC/backfill, alert delivery, retention and production gate enforcement are
not represented as complete. See SANDBOX.md and SECURITY.md for evidence limits.
