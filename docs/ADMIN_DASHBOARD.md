# Admin Dashboard plan

Status: partners, ledgers and SVG QR cards are deployed to Cloudflare staging.
Production remains blocked.

## Product boundary

The dashboard serves the single Fox Auto Services owner. It manages referral
partners, reviews captured leads and recorded commissions, and creates QR assets.
It does not create another shop, expose a partner login, write to QuickBooks,
transfer rewards, or let an operator manufacture or edit financial evidence.

Partner changes affect future claims only. Each lead keeps its fixed reward
snapshot. Referral codes are stable after creation because printed QR codes depend
on them. Deactivation stops new claims without deleting history.

## Delivery slices

1. **Protected foundation:** a new owner-only dashboard and API using Cloudflare
   Access JWT verification, exact operator subject checks, same-origin mutations,
   no-store responses, bounded inputs, parameterized SQL and mutation audit rows.
2. **Partners:** create, list, edit contact/reward details, activate/deactivate,
   copy the shareable claim link and show the effect of reward changes.
3. **Leads:** filter by partner/status/date, view contact and attribution details,
   and keep statuses read-only because completion belongs to verified processing.
4. **Commissions:** filter and total recorded liabilities by partner/status/date.
   `PENDING` remains recorded but unpaid; no manual paid toggle or transfer action.
5. **QR assets:** render a scannable preview for the exact claim URL and download
   SVG artwork suitable for a counter card. The QR contains only the public
   referral URL and never contains rewards, contacts, or tracking internals.
6. **Verification:** authorization negatives, validation, concurrency, audit,
   pagination, empty/error states, keyboard/mobile behavior, QR decode/link checks,
   and local Pages-to-Worker browser coverage before an authorized staging deploy.

## API shape

All routes require the owner Access JWT. The dashboard shell is also protected.

| Method and route | Purpose |
| --- | --- |
| `GET /api/admin/dashboard` | Protected HTML shell |
| `GET /api/admin/overview` | Counts and integer-cent commission totals |
| `GET /api/admin/partners` | Paginated partner list |
| `POST /api/admin/partners` | Register a fixed-reward partner |
| `PATCH /api/admin/partners/:id` | Edit details or active state with version check |
| `GET /api/admin/leads` | Paginated, filtered lead ledger |
| `GET /api/admin/commissions` | Paginated, filtered commission ledger |
| `GET /api/admin/partners/:id/qr.svg` | QR for the exact public claim URL |

No delete endpoint, public admin endpoint, commission mutation, lead mutation,
or QuickBooks write is planned.

## Data changes

Add an integer partner version and update timestamp for safe edits. Add a bounded
admin audit table containing the operator subject, action, target identifier,
changed field names and timestamp. Do not copy customer contacts, request bodies,
provider payloads or credentials into audit records.

Partner input uses server-normalized NANP phone numbers, a normalized display
name, lowercase referral codes, and integer cents for fixed rewards. The existing
database ceiling remains a defensive constraint rather than an approved business
limit. A numeric business limit remains a production decision.

## Visual direction

- **Subject:** the Fox owner checking the referral network between shop tasks.
- **Palette:** service white `#f7f9fa`, Fox navy `#16334a`, lift steel `#d8e1e6`,
  signal orange `#c64b13`, inspection green `#27734d`, carbon `#18232b`.
- **Type:** Franklin Gothic/Arial Narrow for terse work-order headings, Segoe UI
  for controls and explanations, and Consolas for referral codes and money.
- **Layout:** fixed operator rail on wide screens, compact top rail on mobile;
  dense ledger tables with calm spacing and clear empty/error states.
- **Signature:** a partner's QR preview appears as a detachable shop placard with
  a perforation line, making the digital record visibly connect to the physical QR.

Motion respects reduced-motion settings. Keyboard focus, horizontally scrollable
ledger tables on narrow screens, and plain-language actions are required from the
first interactive slice.

## Staging deployment

The separate Cloudflare Access application for `/api/admin/*` is configured for
the owner identity with MFA and a distinct audience binding. The Worker verifies
that Access JWT on every dashboard request. Migration 0005, the private Worker,
and the Pages assets are deployed; live CSS and JavaScript match local hashes.
