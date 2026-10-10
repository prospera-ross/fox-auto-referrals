# Current handoff — 2026-10-10

## Current objective and boundaries
Documentation closeout and public manual update complete; resume sandbox validation next.
Production remains blocked. User authorized all pending local documentation commits;
no deployment, paid resource, push or provider mutation. Keep secrets in ignored files.
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
- INIT/WORKFLOW define proactive validated commit checkpoints; AGENTS links them
  and requires current Git inspection without retaining initialization history.
- Public manual now covers owner dashboard/QR operations, separate Admin Access,
  prior renewal evidence and pending checks; mobile overflow corrected in docs CSS.

## Executed in this closeout
- Reviewed staged/unstaged diffs and the new profile before selecting commit scopes.
- Verified 68 extracted financial-control paragraphs/tables against 15dfeee:INIT.md
  with whitespace normalized; all control/decision/test/gate IDs preserved.
- Confirmed INIT and WORKFLOW checkpoint policy text matches; 39 local Markdown
  links/anchors resolve; UTF-8 replacement-character check and git diff --check pass.
- Public manual Chrome checks pass: anchors/copy targets, search, 14-item checklist,
  mobile navigation, no page errors/overflow at 1440/390/320px; screenshots inspected.
- Full application suite/build not rerun; manual checks used local files only.
- No cloud/provider checks executed; prior results below were not revalidated.

## Prior execution evidence (carried forward)
- Windows Node 24.18.0/npm 11.16.0: typecheck, 43 Node/SQLite tests and Worker bundle
  passed; four local Chrome claim/OAuth/admin tests and desktop/mobile inspection passed.
- Staging: https://fox-referrals.pages.dev; private fox-referrals-api Worker;
  D1 fox-referrals migrations 0001-0005 applied, synthetic staging partner seeded.
- Owner-only Access/MFA configured for QBO and admin routes; anonymous requests
  redirect to Access. Claim remains public; unsigned webhook POST rejected.
- Sandbox consent/confirmation and 16 natural renewals passed; latest recorded
  connection is generation 7, confirmed, encrypted token v1 (not a current query).
- One synthetic fully paid invoice created exactly one $10 PENDING commission;
  repeated scans retained one reward. One sample invoice remained quarantined.
- Deployed admin authenticated reads returned 2 leads, 1 commission and $10 pending;
  filters, QR decoding/download and live CSS/JS hashes passed. Live visual smoke pending.

## Remaining gaps
- Genuine authorized-realm Intuit create/update webhook delivery remains unverified.
- Authenticated live dashboard visual smoke and cron:local helper remain unexecuted.
- Full CDC/backfill, automatic liability reversal and immutable external audit absent.
- Ingress logging review, load, retention/deletion, restore/alerts, independent review,
  full ASVS mapping and production provider contracts remain open; G01–08 unsatisfied.
- Unknown refresh requires reviewed recovery; Shop Genie API handoff remains backlog.
- Git inspection worked, but this sandbox cannot read the user's global Git ignore file.

## Commit checkpoint and next action
All pending documentation is covered by the authorized local commit sequence:
public manual/CSS and related handoff (15dfeee), QuickBooks profile/reference
extraction (66da384), then commit-checkpoint policy and current handoff (this commit).
Documentation checks pass; prior application and cloud evidence retains its limits.
These documentation updates have not been pushed or deployed.
Next: authenticated read-only live dashboard visual smoke, then genuine sandbox
webhook monitoring. Keep production blocked and record new evidence separately.
