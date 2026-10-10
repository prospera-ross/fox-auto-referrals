# Fox Auto Services referrals

A fast QR offer page backed by Cloudflare Pages, a TypeScript Worker and D1.
Customers enter their contact details, claim the 50% oil-change offer, and go
straight to the supplied Shop Genie booking page after the lead is saved.
The mobile form asks only for name and phone, hides the referral from the
shareable URL after opening, and integrates the supplied transparent Fox logo
into the offer card so the booking action remains visible in the first viewport.

**Status:** the claim flow, protected owner dashboard, and QuickBooks Sandbox
happy path are deployed and tested: partner/lead/commission ledgers, QR assets,
protected OAuth, encrypted D1 tokens, scheduled invoice verification and one
synthetic paid-invoice reward. Production remains disabled. Start with the
[staging setup guide for first-time operators](docs/SETUP.md); use the
[technical QuickBooks runbook](docs/QUICKBOOKS_SETUP.md) for implementation,
recovery and security details.

## Run locally

Prerequisites: Node.js 24.x, npm 11.x (tested with Node 24.18.0 and npm 11.16.0).
No Cloudflare account, QBO credentials, or external database is needed locally.
Use `npm.cmd` on Windows PowerShell if execution policy blocks `npm.ps1`.

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run setup:local
npm.cmd run db:migrate:local
npm.cmd run db:seed:local
npm.cmd run dev:api
```

In a second terminal in the same directory:

```powershell
npm.cmd run dev:web
```

Open **http://localhost:8788/claim?ref=restaurant-x**. Use `localhost`, matching
the configured origin. Local D1 state persists under `.wrangler/local/`.
The seed creates only a synthetic restaurant. Never apply it to remote D1.
Submitting the form normally leaves localhost for the real booking destination;
browser tests intercept that navigation without contacting Shop Genie.

## Files and contracts

| Artifact | Purpose |
| --- | --- |
| [migrations/0001_initial.sql](migrations/0001_initial.sql) | Partners, leads, conversions, indexes, constraints and atomic completion trigger |
| [migrations/0002_fixed_first_claim.sql](migrations/0002_fixed_first_claim.sql) | Fixed rewards, first-claim/30-day guards and customer-level reward uniqueness |
| [migrations/0003_quickbooks_sandbox.sql](migrations/0003_quickbooks_sandbox.sql) | Encrypted connection, OAuth state, token attempts, durable jobs/evidence and atomic authority guard |
| [migrations/0004_calendar_day_policy.sql](migrations/0004_calendar_day_policy.sql) | Shop-local calendar-day eligibility, explicit payment dates, preserved legacy rewards |
| [migrations/0005_admin_dashboard.sql](migrations/0005_admin_dashboard.sql) | Partner edit versions and redacted owner mutation audit |
| [src/claim.ts](src/claim.ts) | Validated/idempotent `POST /api/claim` |
| [src/admin/route.ts](src/admin/route.ts) | Protected partner management, lead/commission ledgers and SVG QR assets |
| [public/admin/](public/admin/) | Responsive owner dashboard UI |
| [public/claim.html](public/claim.html) | Responsive customer form with external JS/CSS |
| [src/quickbooks/process-invoice.ts](src/quickbooks/process-invoice.ts) | Current invoice/payment/customer verification and reward orchestration |
| [src/quickbooks/contracts.ts](src/quickbooks/contracts.ts) | Server-only provider/evidence and store interfaces |
| [src/quickbooks/policy.ts](src/quickbooks/policy.ts) | Accepted first-claim, 30-day eligibility policy |
| [src/quickbooks/oauth.ts](src/quickbooks/oauth.ts) | Owner-only OAuth and company confirmation |
| [src/quickbooks/tokens.ts](src/quickbooks/tokens.ts) | Encrypted tokens, coordinated refresh, uncertainty holds and revocation |
| [src/quickbooks/inbox.ts](src/quickbooks/inbox.ts) | Signed CloudEvents durable intake |
| [src/quickbooks/jobs.ts](src/quickbooks/jobs.ts) | Scheduled renewal, retry processing and recent-invoice catch-up |
| [wrangler.jsonc](wrangler.jsonc) | Pages configuration and API service binding |
| [wrangler.worker.jsonc](wrangler.worker.jsonc) | Private Worker and local D1 binding |

`POST /api/claim` accepts JSON with `ref`, `customer_name`, `customer_phone`, and
optional `customer_email`. It requires the exact configured `Origin`. A UUID v4
`Idempotency-Key` header is optional for API clients and always sent by the form.
Unknown fields are rejected; phone numbers are normalized to `+1XXXXXXXXXX`.
NANP syntax validation does not prove US residence or contact ownership.

```json
{
  "ref": "restaurant-x",
  "customer_name": "Sample Customer",
  "customer_phone": "(202) 555-0124",
  "customer_email": "sample@example.test"
}
```

On success (including a retry of the same key and payload):

```json
{
  "success": true,
  "redirect_url": "https://booking.shopgenie.io/?shop=fox-auto-services-4101880591&preselect_account=fox-auto-services-4101880316"
}
```

Errors use 400/403/409/413/415/429/503 and a safe `message`. There is no public
lead lookup, partner reward endpoint or payout operation. A retry key is held in
tab memory only; reload/new keys can create additional claims. Attribution still
belongs to the first claim; later claims neither change the partner nor restart
eligibility. The customer-facing flow does not reveal these internal decisions.

## Schema and money

UUID identifiers and UTC timestamps use TEXT in D1/SQLite. `payout_value_units`
is cents for FIXED: 1000 = $10.00. Only fixed payouts are supported under the
confirmed rules. `payout_value` is a generated REAL projection; insert
the integer units column. `amount_paid_cents` and `reward_amount_cents` are the
authoritative conversion amounts; requested REAL columns are generated views
of those values. Migration 0002 blocks new percentage partners/leads; old records
are preserved and cannot be credited under the fixed policy.
The $1,000,000 prototype ceiling is a defensive bound, not an approved reward cap.

Each lead snapshots partner reward terms. Conversion uniqueness covers both
the lead and provider environment + realm + invoice/customer ID/contact. A composite foreign key
prevents mismatching the conversion's partner. The trigger completes the lead
only within a successful conversion insert; failed writes roll back together.
`PENDING` means commission recorded but not paid to a partner. No transfer occurs.

Any fully paid invoice is eligible, not just an oil change; there is no tax/item
percentage base calculation. The fixed value is snapshotted on the first lead.
The claim's date in `QB_TIME_ZONE` is day 1. Payment accounting dates on days
1 through 30 qualify, including same-day payments; day 31 does not. For example,
a September 1 claim qualifies through September 30. DST does not add/remove a
calendar day. Webhook delay and invoice creation time do not change eligibility.
Equal claim timestamps use database insertion order.

Customer identity is matched by normalized phone, with email fallback when QBO
has no usable phone. Conflicting contacts are held. QBO customer ID plus contact
uniqueness prevents repeat rewards even for different invoices/concurrent jobs.
Changed provider IDs and wholly different contact details cannot be proven to be
the same person by this system. Single company, no partner login, recording only.

The sandbox reader retains the latest allocated `Payment.TxnDate` and the shop
timezone. Migration 0004 stores explicit payment/claim dates and the claim's UTC
offset; new rows leave `paid_at` null. Historical rows keep their original policy
and timestamp. Later refund/reversal treatment remains a separate policy decision.

## Verification

```powershell
npm.cmd run check
# With both local servers running and Google Chrome installed:
npm.cmd run test:browser
```

Tests use Node's SQLite engine plus a D1 method bridge and synthetic QBO readers.
They cover validation, SQL constraints, duplicate claims/conversions, payment
allocation, currency, first-claim/30-day boundaries, customer-level duplicate
prevention, ambiguous contact, revocation, raw webhook signatures,
redacted failures, ledger filtering/totals and QR payload isolation. Browser tests
exercise actual local Pages -> Worker -> D1, redirect-on-success, missing referral,
failure/retry, and responsive claim/admin layouts.

Confirmed on Windows, 2026-10-10: dependency install, typecheck, unit/database
tests, Worker bundle, local D1 migration/seed, both dev servers, Chrome browser
tests and visual inspection at desktop/mobile widths. See
[validation evidence and limits](docs/STATUS.md). `npm ci --ignore-scripts` is the
lockfile-based fresh-install command; initial setup used `npm install`.

## Configuration and release

Existing names: `DB`, `APP_ENV`, `PUBLIC_ORIGIN`, `REFERRAL_API`, and optional
`CLAIM_RATE_LIMITER` (required by the claim handler outside localhost).
QuickBooks adds `QB_*`/`ACCESS_*` bindings, and the dashboard uses the separate
`ADMIN_ACCESS_AUD`, all listed in QUICKBOOKS_SETUP.md.
`QB_CLIENT_ID` and `QB_CLIENT_SECRET` are Worker secrets; tokens are encrypted in
D1 with a separate `QB_TOKEN_KEY`. Do not put credential values in config or source.
The configured database ID identifies the personal-account staging D1. Local
commands use its emulator, not the remote database. `QB_ENABLED=false` keeps
QuickBooks disconnected. Production mode is explicitly rejected by this adapter.

For a future authorized release, follow [OPERATIONS.md](docs/OPERATIONS.md).
The Worker stays private behind the Pages service binding. Configure real isolated
D1 resources, exact HTTPS origin, abuse controls and reviewed privacy/retention
before collecting live contact data. The Sandbox connection, Access login, owner
consent, company confirmation, paid-invoice reads, and natural token renewal passed.
Genuine authorized-realm Intuit webhook delivery and production ingress contracts
remain open.

- [Requirements / decisions](docs/REQUIREMENTS.md)
- [Beginner staging setup](docs/SETUP.md)
- [Architecture / threat model](docs/ARCHITECTURE.md)
- [Security evidence / release blockers](docs/SECURITY.md)
- [Operations](docs/OPERATIONS.md)
- [Session workflow](docs/WORKFLOW.md)
- [Provider sources](docs/SOURCES.md)
- [Shop Genie integration backlog](docs/SHOPGENIE_INTEGRATION.md)
- [Shop Genie tracking issue](https://github.com/prospera-ross/fox-auto-referrals/issues/1)
