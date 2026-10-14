# Current handoff — 2026-10-10

Updated with provider support evidence on 2026-10-13.

## Current objective and boundaries
Local cron and read-only staging diagnostics passed; Intuit now asserts successful
webhook sending, but application receipt/processing and the visual checks remain open.
Production remains blocked. Prior documentation commit authorization was completed;
no new commit, deployment, paid resource, push or provider mutation. Keep secrets ignored.
Repository: prospera-ross/fox-auto-referrals; use git log for the current revision.

## Implemented
- English responsive claim page, transparent Fox logo, Pages-to-Worker proxy,
  server contact normalization, idempotent saves and exact Shop Genie redirect.
- D1 migrations 0001-0005; integer fixed rewards, first-claim attribution for 30
  shop-local calendar dates, latest allocated Payment.TxnDate, one reward/customer.
- Protected owner dashboard: partner management, lead/commission ledgers, filters,
  QR SVG delivery/download; separate Admin Access audience and mutation audit.
- Sandbox OAuth: owner Access JWT, session-bound one-use state, realm pinning,
  company confirmation, encrypted D1 tokens, coordinated refresh/uncertainty holds.
- Signed webhook inbox, durable retry/quarantine jobs, minute cron and bounded
  invoice polling. QBO accounting reads only; no transfers or automatic reversals.
- Reusable INIT now separates the QuickBooks profile into INIT.profiles/quickbooks.md;
  project references preserve FIN-01–10, D01–08, SEC-T01–10 and G01–08 requirements.
- INIT/WORKFLOW/AGENTS define validated commit checkpoints and current Git inspection.
- Public manual covers dashboard/QR, Access and evidence; mobile overflow corrected.

## Executed in this validation session
- Local APP_ENV=local/QB_ENABLED=false; dev:api + cron:local passed, server stopped.
  This proves scheduler invocation only: disabled QBO performs no job work.
- Browser connector unavailable; Windows URL safety check stopped inspection twice,
  including after owner login. Dashboard title alone does not pass live visual smoke.
- Owner completed Wrangler login after initial credential failures; D1 reads now pass.
  Queries reported zero writes. Connection active, generation 7, paused=0, encrypted
  tokens present; version advanced 2 -> 3, expiry 2026-10-10 21:39:35 UTC at 20:44 check.
- Earlier current-generation snapshot: 14 scans; 12 done, 1 unpaid pending,
  1 evidence_review_required quarantine. Ledger still 1 PENDING commission, 1000 cents.
- Sanitized real-time tails covered both public Pages and the private Worker. An
  unsigned control reached both and returned 400; no bodies, headers or URLs were kept.
- A portal invoice.updated test reached both layers at 20:57:57 UTC, returned 200 in
  about 0.23 s with no exception and added an unauthorized_company sample-realm row.
- A harmless description probe produced no authorized-realm request in five minutes.
- Owner then created and fully paid Sandbox invoice 1040. Polling saw its company realm
  and first read it unpaid; no authorized Invoice/Payment webhook arrived before stop.
- Later signed traffic stayed sample-realm/duplicate; ledger remained 1 PENDING / 1000 cents.
- Owner screenshots show Development, exact webhook URL, CloudEvents enabled and
  Invoice/Payment created/updated/deleted/void selected; emailed excluded as intended.
- Sandbox Manage integrations screenshot lists Fox-auto, with no pending task shown;
  portal app also named Fox-auto. Display names alone do not compare OAuth client IDs.
- Scheduled reads matched the converted invoice to the authorized realm; no provider change.
- On 2026-10-13, Intuit Support replied that it is successfully sending webhooks to
  the exact configured endpoint. The reply supplied no delivery timestamps, HTTP
  statuses, request/event identifiers or realm/entity correlation.
- Full application suite/build and an active provider processing test were not rerun.

## Prior execution evidence (carried forward)
- Windows Node 24.18.0/npm 11.16.0: typecheck, 43 Node/SQLite tests and Worker bundle
  passed; four local Chrome claim/OAuth/admin tests and desktop/mobile inspection passed.
- Staging: https://fox-referrals.pages.dev; private fox-referrals-api Worker;
  D1 fox-referrals migrations 0001-0005 applied, synthetic staging partner seeded.
- Owner-only Access/MFA configured for QBO and admin routes; anonymous requests
  redirect to Access. Claim remains public; unsigned webhook POST rejected.
- Sandbox consent/confirmation and 16 natural renewals passed in earlier checks;
  prior closeout recorded generation 7, confirmed, encrypted token v1.
- One synthetic fully paid invoice created exactly one $10 PENDING commission;
  repeated scans retained one reward. One sample invoice remained quarantined.
- Deployed admin authenticated reads returned 2 leads, 1 commission and $10 pending;
  filters, QR decoding/download and live CSS/JS hashes passed. Live visual smoke pending.

## Remaining gaps
- Genuine authorized-realm Invoice/Payment receipt and processing remain unverified
  locally despite Intuit Support's general successful-delivery assertion.
- Authenticated live dashboard visual smoke remains blocked by browser automation.
- Full CDC/backfill, automatic liability reversal and immutable external audit absent.
- Ingress logging review, load, retention/deletion, restore/alerts, independent review,
  full ASVS mapping and production provider contracts remain open; G01–08 unsatisfied.
- Unknown refresh requires reviewed recovery; Shop Genie API handoff remains backlog.
- Git inspection worked, but this sandbox cannot read the user's global Git ignore file.

## Commit checkpoint and next action
Prior documentation commits: manual/CSS (15dfeee), QuickBooks profile (66da384),
commit-checkpoint policy/handoff (47679b5); none pushed or deployed in this session.
This handoff records the sanitized ingress evidence and remaining validation gaps.
Invoice 1040 follow-up: remote D1 read-only checks found no qb_events row for it and no
evidence row; the ledger stayed 1 PENDING / 1000 cents. Owner confirmed the Development
Client ID matches QB_CLIENT_ID in .dev.vars (deployed secret not independently read) and
that the workspace holds only the Fox-auto app. Intuit Support case #00230633 (Webhooks,
Events not received) was opened 2026-10-12 with sanitized timestamps. On 2026-10-13,
Support asserted that webhooks are being sent successfully to the exact endpoint and
asked Fox to inspect application logs, but provided no correlatable delivery details.
Historical Worker invocation logs are unavailable under the deployed
`observability.enabled=false` configuration. If retained, review Cloudflare Security
Events/request analytics for 2026-10-10 20:45-22:00 UTC. Ask Intuit in the existing
ticket for UTC delivery-attempt timestamps, response statuses, Intuit request/event IDs,
and confirmation that the assertion covers invoice 1040's authorized realm. Then create
one new controlled Sandbox change while sanitized real-time tails watch both Pages and
the private Worker, followed by the read-only inbox/job diagnostic. Send the realm ID
only via the support ticket; do not send credentials, payloads or customer data.
Keep production blocked; partner PWA/Flutter work follows resolution of this gate.

## Webhook inbox fix — 2026-10-14 (local only, not deployed)
- Defect: every rejected CloudEvent with the same reason and array index shared one
  `event_key`, so after the first rejection later ones were silent duplicates; rejected
  rows also dropped realm/entity, and `verify-staging.sql` joined on realm/generation.
  A genuine authorized-realm event failing validation was therefore invisible.
- Parser rejected the whole delivery (HTTP 400) above 100 events or 256 KB; Intuit sets
  no limit, mixes realms in one delivery and suggests a 2 MB bound. Now 1000 / 2 MB,
  D1 writes in atomic 100-row batches.
- Only routing fields are required; `time` is unused and `datacontenttype` may be absent.
- Rejected rows key on their own byte digest and keep numeric realm/entity hints. Webhook
  logs carry fixed reasons and disposition counts only (no body, headers, IDs or realm).
- `verify-staging.sql` adds a quarantine/conflict summary. Rows stored before this fix
  cannot be reinterpreted.
- Executed: `npm run check` (45 tests), local migrate/seed, both dev servers, 5 Chrome
  browser tests and a local claim. Not executed: deploy, staging tail, provider event.

## Post-deploy diagnosis — 2026-10-14
- Owner deployed Worker version 0dc45eed at 03:44:36 UTC. At 03:47:40 UTC the first
  genuine authorized-realm webhook was received, verified and stored (invoice 149,
  updated). Delivery for the authorized realm is now observed.
- It was held because the connection has been `refresh_unknown`/paused since the
  2026-10-11 02:38:34 UTC refresh attempt (generation 7, token v8; prior hourly
  refreshes succeeded; refresh grant valid until 2027-01-19). Cause is unrecorded.
- Fix (local, pending deploy): authorized-realm events during a hold are labeled
  `connection_inactive`; refresh failures audit `refresh_failed_<category>` and
  scheduler expiry audits `refresh_deadline_expired`. 47 tests pass.
- Known issue: from `refresh_unknown`, the status-page Disconnect leaves
  `revocation_pending` with an unknown attempt and the cron re-sends revoke each minute.
  Do not use it for this recovery.
- Recovery order: deploy; owner disconnects Fox-auto in the Intuit sandbox company;
  guarded D1 SQL marks the gen-7 attempt `abandoned` and moves the connection to
  `revoked` (generation 8, ciphertext cleared, audited); owner reconnects and confirms;
  then read-only verification of scan and webhook processing.

## Recovery and end-to-end webhook evidence — 2026-10-14
- Owner deployed Worker version 1d2385b1 (03:55:23 UTC), disconnected Fox-auto in the
  sandbox company's Manage integrations, ran the guarded recovery SQL (connection
  `revoked`, generation 8, ciphertext cleared, gen-7 attempt `abandoned`, audited),
  then reconnected and confirmed the company; status page reported active.
- 04:02:32-33 UTC: scheduled scan resumed and processed recent invoices (unpaid and
  claim_ineligible outcomes; no new commission expected or created).
- 04:03:47 UTC: authorized-realm webhook for invoice 151 was received, verified,
  stored as `pending`, and processed by cron to `done`/`invoice_unpaid` in one attempt.
  The authorized-realm webhook delivery gate is satisfied for sandbox.
- 04:05:59 UTC: webhook payment 152 created -> linked invoice 149 read as fully paid
  -> `claim_ineligible`; 04:06:50 invoice 149 updated gave the same result. Evidence
  shows invoices 145 and 149 share QBO customer 100000001, whose only lead is already
  COMPLETED by the 145 commission, so one-reward-per-customer held. Rescan of 145 did
  not duplicate. Ledger unchanged: 1 PENDING / 1000 cents. Connection generation is 9.
- Observation: every reprocessing retains a new qb_evidence row (149 has three); not a
  money risk, but relevant to D07 retention.
- New-customer test: 04:12:09 UTC public claim (staging-restaurant, synthetic
  555-01xx phone); sandbox customer with the same Phone; invoice 153 webhook
  04:16:04 -> invoice_unpaid; payment 154 webhook 04:17:12. Cron at ~04:17:46 created
  exactly one commission: invoice 153, 5400 cents paid, 1000 cents PENDING, payment and
  claim date 2026-10-14, generation 9. Ledger now 2 PENDING / 2000 cents.
- The queued scan row for 153 ran before the payment webhook job in that cycle and
  created the conversion; the webhook job then reported `claim_ineligible` because the
  lead was already COMPLETED. Money was correct. Local fix (pending deploy): an
  invoice already credited to a matching lead returns `duplicate` before retaining
  evidence, which also stops repeated evidence rows. 47 tests pass.
- Not yet exercised: natural token renewal under the new refresh-failure audit.
- Intuit case #00230633 can be updated: delivery observed; the gap was a local hold.
