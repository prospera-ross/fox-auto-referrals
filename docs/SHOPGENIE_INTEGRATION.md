# Shop Genie integration backlog

**Status:** planned, not implemented. The current customer flow saves the Fox
referral lead and then opens a fixed public Shop Genie booking URL. It does not
create, read, update, or confirm an appointment, and it sends no customer details
to Shop Genie.

## Goal

Connect the referral flow to a supported Shop Genie interface so Fox can relate a
booking to the originating lead without exposing personal data in URLs or trusting
the browser as proof that an appointment exists.

## Discovery required

- Obtain current official Shop Genie API, webhook, authentication, sandbox, rate
  limit, privacy, and support documentation directly from Shop Genie.
- Confirm whether Fox's subscription includes API or webhook access and obtain a
  separate test account or sandbox. Do not test writes against the live calendar.
- Decide which event matters to the business: booking created, visit completed,
  invoice created, or another provider state. A redirect alone proves none of them.
- Approve the minimum data set and retention period. Prefer an opaque correlation
  identifier; never place a name, phone number, token, or internal lead ID in a URL.
- Define how the 50% oil-change offer is represented and honored by Fox staff.

## Implementation tasks

- [ ] Add server-side Shop Genie configuration with secrets stored only as managed
  secrets and strict staging/production separation.
- [ ] Create an authenticated provider client with timeouts, bounded retries,
  idempotency, redacted errors, and rate-limit handling.
- [ ] Add a signed webhook endpoint or an approved polling fallback. Persist events
  before acknowledging them and deduplicate every external event/effect.
- [ ] Store the minimum booking reference and status needed for reconciliation;
  keep customer contact data out of provider metadata unless explicitly required.
- [ ] Correlate a confirmed Shop Genie booking with a saved lead on the server.
  Treat ambiguous or conflicting matches as manual review, never automatic proof.
- [ ] Keep the current fixed redirect as a documented fallback until the supported
  integration passes sandbox and failure-recovery testing.
- [ ] Add contract, retry, replay, signature, authorization, privacy, and end-to-end
  tests using synthetic customers and appointments.
- [ ] Add operator diagnostics, alerts, reconciliation, revocation, and a runbook.
- [ ] Complete an independent security/privacy review before any live activation.

## Acceptance criteria

1. A successful form save still cannot be lost or duplicated when Shop Genie is
   slow, unavailable, or returns an unknown result.
2. A booking status shown internally comes from current provider evidence, not a
   browser redirect or unverified callback.
3. Replayed requests and webhook deliveries cannot create duplicate appointments
   or duplicate business effects.
4. No secret or customer contact value appears in a URL, log, browser storage,
   public response, repository file, or support screenshot.
5. Staging tests cover success, rejection, timeout, retry, duplicate delivery,
   invalid signature, revocation, and reconciliation before production is enabled.

## Out of scope until separately approved

- Production appointment writes.
- Marketing messages or customer contact outside the booking purpose.
- Replacing QuickBooks as the source used to verify paid invoices and commissions.
