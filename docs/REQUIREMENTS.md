# Requirements and decisions

Source: user brief and business-rule answers, 2026-10-09. The requesting user owns
QuickBooks access and security/release decisions. Independent security reviewer
remains unassigned. Comprehensive path: contact PII, financial
integration, asynchronous events, and local commission liabilities.

## First delivery

| ID | Accepted requirement / acceptance criterion | Priority | Implementation / evidence |
| --- | --- | --- | --- |
| REF-01 | `/claim?ref=...` presents the specified offer and asks only for name and phone; no commission copy | P0 | public/; local Chrome tests and desktop/mobile visual inspection passed |
| REF-02 | POST `/api/claim` validates name/US phone/referral, inserts a linked lead, returns 200 with fixed Shop Genie URL; no redirect on failed save | P0 | src/claim.ts; Node and local Pages/Worker/D1 browser tests passed |
| REF-03 | Redirect immediately after durable success, including recovery from a lost response | P0 | public/claim.js; same-key API replay and browser failure/retry tested; full network-loss exercise pending |
| REF-04 | D1 partners/leads/conversions with constrained relationships and exact reward math | P0 | migrations/; SQLite regressions and local D1 migration/seed passed |
| REF-05 | Verify current QBO invoice/payment/customer evidence before matching contact and crediting once | P0 | reader/core tests plus one deployed QBO Sandbox customer/invoice/payment conversion; production provider verification pending |
| REF-06 | Entirely automated ingestion, retries, reconciliation, and commission recording | P0 | durable inbox, bounded cron/retries, token renewal and recent-invoice polling implemented; full CDC/reversal/recovery absent |
| REF-07 | Accessible responsive US-English form with keyboard, error and loading states; prominent transparent logo integrated into the mobile offer card | P0 | public/; mobile/desktop layout and error tests passed; assistive technology/keyboard audit pending |
| REF-08 | ANY fully paid invoice earns the first lead's snapshotted FIXED reward; no percentage, tax or service-item calculation | P0 | policy.ts, process-invoice.ts, migration 0002; synthetic tests passed |
| REF-09 | First claim owns attribution for 30 days; later claims cannot restart the window or take credit | P0 | policy.ts and database trigger; boundary/tie/late-delivery tests passed |
| REF-10 | One reward per customer, including different invoices/concurrent jobs | P0 | migration 0002 and local-store.ts; provider customer/contact uniqueness and concurrency tests passed |
| REF-11 | After a valid QR link opens, remove its referral query from the address bar while retaining it in that tab's history entry | P0 | public/claim.js; browser URL and submission tests |

Delivery and validation states are independent. No requirement is accepted as
production verified by this document. Millisecond capture is a latency aspiration,
not an agreed p95 target or a verified guarantee. Capture begins after voluntary
form submission; QR scanning alone cannot disclose a person's contact details.

## Accepted scope and business rules

Accepted stack: Cloudflare Pages, Workers (TypeScript), D1; QBO Accounting API;
Shop Genie redirect. No scheduling API or customer-data handoff is implemented.
A supported Shop Genie integration is now planned in
[SHOPGENIE_INTEGRATION.md](SHOPGENIE_INTEGRATION.md). Until that work is approved,
tested, and activated, the fixed URL remains the only handoff; discount enforcement
within Shop Genie/QBO and staff offer fulfillment are external dependencies.

Accepted by the user: ANY fully paid invoice, fixed amount per converted lead,
first claim, 30-day validity, one reward per customer; one shop and QBO company,
no partner login and commission recording only. The requesting user owns QBO
access and security/release decisions. $10 is an example, not an instruction to
replace every partner's configured payout. Existing synthetic rates are unchanged.

Delivery sequence confirmed by the user: validate the core sandbox integration
with the basic QuickBooks connection screen first. The next phase is an Admin
Dashboard for registering referral partners (restaurants/stores), managing their
details, viewing leads/commissions, and generating QR codes. These businesses are
referral partners, not additional shops or QuickBooks companies. Keep one Fox shop
and one connected company. QuickBooks accounting data is read-only: no customer,
invoice, payment or accounting-setting writes. OAuth token lifecycle operations
and the local D1 commission ledger remain required.

Current deployment target is explicitly Staging/Homologation: QuickBooks Sandbox,
isolated D1 and synthetic datasets. Validate the entire claim-to-commission flow,
OAuth renewal, schema and signed webhooks before user approval of a separate
production transition. Staging uses the main Pages deployment branch for a stable
callback URL; that Pages label does not make this a QuickBooks production system.

Implementation interpretation: first claim includes all stored history, with
database insertion order breaking timestamp ties; later claims never reset it.
The user approved payment accounting dates and shop-local calendar days. The
first claim's date in `QB_TIME_ZONE` is day 1; days 1-30 are eligible, day 31 is
excluded. Same-day payments qualify even when their time of day is unknown.
Use the latest allocated `Payment.TxnDate` when several payments settle an invoice.
Provider event delivery and invoice modification time are irrelevant. The first
claim's fixed rate remains snapshotted. Migration 0004 records policy v2 without
rewriting previous commissions or inventing exact payment timestamps.
Matching uses normalized phone, email fallback when phone is absent, and holds
conflicting identities. Uniqueness includes provider customer ID and lead contacts.

Still open for live operation: numeric reward/service limits, live payment-allocation
contract, post-accrual refunds/voids/chargebacks and contact/identity remediation.
Refund exclusion from a percentage base is no longer relevant; later reversal
of an already-earned reward was not specified and is not automatically performed.

## Financial implementation gates (D01-D08)

Source: [QuickBooks initialization profile](../INIT.profiles/quickbooks.md).

| ID | State / decision and impact | Accountable role / latest resolution point |
| --- | --- | --- |
| D01 | PARTIAL: any fully paid invoice; QBO Accounting reads of Invoice, Payment, Customer; no writes. Payment accounting dates/shop-local days approved; minor-version Sandbox allocation passed; production contract review remains | User owns access/product decisions; integration reviewer unassigned; before live activation |
| D02 | PARTIAL: one shop/realm, no sharing or partner login accepted; user owns access. Admin identity, canonical grant lineage, consent and revocation rules unresolved | User approves security; independent technical review unassigned; before OAuth/connection implementation |
| D03 | PARTIAL: fixed reward, first claim/30 days/one reward per customer accepted; no transfers. Numeric service limits unresolved | User owns business/security decisions; before live accrual |
| D04 | OPEN: Workers/D1 accepted. Encrypted credential broker and grant-wide refresh state machine proposed; keys/isolation/deadlines unresolved | Platform/security owner unassigned; before credential/refresh/dispatch implementation |
| D05 | PARTIAL: one reward per customer accepted; unique invoice/lead/customer/contact, integer cents and atomic completion implemented locally. Verified payment history and later reversal policy unresolved | User approves business/security policy; before live reconciliation |
| D06 | PROPOSED: CloudEvents v1 verified-byte ingestion, durable D1 inbox, bounded cron processing; CDC checkpoint/backfill policy and numeric retry/lag limits unresolved | Integration/operations owner unassigned; before live ingestion |
| D07 | OPEN: PII/audit retention, deletion/backups, numeric alert/incident/RTO/RPO targets and responders | Data/operations/security owners unassigned; before production data/operations |
| D08 | PARTIAL: user owns security/release approval; ASVS 5.0.0 L2 baseline. Independent reviewer, evidence age/severity/exception policy and protected paths unresolved | User is release approver; independent qualified reviewer unassigned; before release pipeline |

The user subsequently explicitly authorized sandbox OAuth, encrypted D1/KV token
renewal and webhook implementation with environment-bound credentials and callback
`https://fox-referrals.pages.dev/api/quickbooks/callback`. That authorization permits
the sandbox boundary described in SANDBOX.md; it supersedes the prior offline-only
limit. Engineering defaults are documented there, not labelled stakeholder-approved
production decisions. Remaining D01-D08 production decisions/provider evidence stand.

## Quality decisions

Traffic, capacity, p95/p99 latency, region, budget, retention, recovery targets,
browser support policy, and accessibility conformance level are unconfirmed.
Measure claim latency end to end in the selected US deployment region with
agreed load and payload before adopting a numeric target. Propose WCAG 2.2 AA;
keyboard/responsive checks alone do not establish conformance. Owners are gaps.

## Later phases and exclusions

### Admin Dashboard phase

| ID | Accepted requirement / acceptance criterion | Priority |
| --- | --- | --- |
| ADM-01 | Owner-only dashboard for the existing single Fox shop; Access JWT and exact owner subject required for the page and every API | P0 |
| ADM-02 | Register and manage referral partners with name, normalized phone, stable referral code, fixed reward cents and active state; deactivate instead of deleting history | P0 |
| ADM-03 | View and filter leads by partner/status/date; attribution and processing-owned statuses are read-only | P0 |
| ADM-04 | View and total recorded commissions by partner/status/date; no transfer, payout or QuickBooks write control | P0 |
| ADM-05 | Preview/download a QR containing only the exact public claim URL; no reward, contact or tracking internals in the asset | P0 |
| ADM-06 | Audit admin mutations without request bodies, contacts or credentials; reject stale edits and validate pagination, authorization, keyboard/mobile and QR decoding | P0 |

Implementation sequencing and proposed API/design details are in
[ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md). Numeric business reward limits remain
unresolved for production; the existing schema ceiling is only defensive.

1. Runnable local claim flow, schema, tested invoice-processing core, contracts.
2. Approved OAuth/credential lifecycle, sandbox REST/webhook/recovery integration.
3. Independent review, operational exercises and enforced release/activation gates.

No partner portal, QR-printing service, automatic disbursement, SMS/email marketing,
or QuickBooks financial writes in the requested first slice. Financial controls
for QBO reads and local rewards remain applicable; exclusions need independent
review before release. See SECURITY.md and OPERATIONS.md.
