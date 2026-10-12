# Current handoff — 2026-10-10

## Current objective and boundaries
Local cron and read-only staging diagnostics passed; genuine webhook/visual checks open.
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
- Genuine authorized-realm Invoice-created/Payment-created delivery remains unverified.
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
Next: inspect invoice 1040's post-stop scheduled reread (due after 21:21:37 UTC), then
compare the Development OAuth client ID with the app that owns the webhook subscription.
If they match, file an Intuit Webhooks/events-not-received case with sanitized timestamps.
Keep production blocked; partner PWA/Flutter work follows resolution of this gate.
