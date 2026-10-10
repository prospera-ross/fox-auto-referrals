# Security requirements and evidence gaps

Baseline: OWASP ASVS **5.0.0 Level 2**, including applicable L1 controls, required
by FIN-01 in [the QuickBooks profile](../INIT.profiles/quickbooks.md).
No compliance/certification claim. This is an initial mapping for the implemented
public slice and sandbox financial integration. A complete versioned applicability register and named independent reviewer are required before live
boundaries are implemented (D08). Do not mark unimplemented controls inapplicable.
The user has accepted ownership of QBO access and security/release approval;
this is distinct from independent review or completed verification evidence.

## Current public-slice mapping

| ASVS 5.0.0 IDs | Acceptance / location | Verification / state | Responsible owner |
| --- | --- | --- | --- |
| V4.1.1 | JSON responses declare correct type; src/http.ts | Automated claim response checks; manual ingress review pending | User approves security; reviewer unassigned |
| V4.1.2 | Deployed API refuses non-HTTPS requests; no API redirect | Automated local guard; deployed edge behavior unverified | Unassigned platform owner |
| V4.1.3 | Proxy metadata cannot be forged through deployed ingress | Proxy preserves request; CF IP test still required on target | Unassigned platform/security owner |
| V4.2.1 | End-to-end message framing agrees and ingress bounds hold | Streaming 4KB limit tested; platform framing review pending | Unassigned platform/security owner |
| V8.1.1, V8.1.2 | Public actor may create only allowed lead fields; no financial/admin access | Defined in architecture; live admin policy not defined | User owns business/security decisions |
| V8.2.1, V8.2.2, V8.2.3, V8.3.1 | Server chooses partner; reject extra fields; deny financial access | tests/claim.test.mjs; full financial access review blocked | User approves security; reviewer unassigned |
| V8.4.1 | Cross-tenant/company actions denied | Single-shop/company scope accepted; core context tests do not establish deployed isolation | User approves access; technical review unassigned |

References: [ASVS V4](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x13-V4-API-and-Web-Service.md)
and [ASVS V8](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md).
Other relevant ASVS areas (validation, browser controls, business logic, crypto,
data protection, logging, configuration, OAuth/session lifecycle) still require
complete per-ID applicability mapping; this partial table does not waive them.

## FIN / SEC-T verification register

All live controls require the combined manual/automated evidence specified in
the [QuickBooks profile](../INIT.profiles/quickbooks.md). No independent or human
manual security verification has been performed.

| Requirement / tests | Defined and implemented scope | Automated evidence / outstanding work |
| --- | --- | --- |
| FIN-01 / SEC-T07,10 | Threat model and decision/evidence gaps documented | Partial dependency audit and local tests; complete ASVS mapping, supply-chain scans, provenance and enforcement absent |
| FIN-02 / SEC-T01,02,06 | Access JWT validation, exact realm, owner confirmation and current generation | Synthetic tests plus deployed owner Access/MFA, realm and confirmation passed; recovery-policy verification pending |
| FIN-03 / SEC-T02,03 | Session-bound expiring single-use state, backend exchange, clean callback redirect | Synthetic tests plus deployed Sandbox consent and clean callback passed; ingress log review pending |
| FIN-04 / SEC-T03,07 | Worker secret credentials and AES-GCM context-bound ciphertext | Synthetic tamper/app/realm/generation/version swap tests passed; managed key/admin separation review pending |
| FIN-05 / SEC-T03 | Durable refresh preparation/dispatch/unknown hold, no lease takeover | Parallel refresh/timeout/stale-result tests passed; actual rotation and process-loss provider exercises pending |
| FIN-06 / SEC-T01,03,08 | Generation invalidation, pause, tracked provider revocation, atomic conversion guard | Synthetic revoke/late-response tests passed; remote revocation/residual-read-window exercises pending |
| FIN-07 / SEC-T05,06,09 | Approved fixed/first-claim/30-day/one-customer policy, integer rewards and unique atomic local ledger; no QBO writes | Boundary/concurrency/rollback tests plus one deployed paid Sandbox invoice and duplicate-safe reread passed; audit, reversal policy and production ledger authority pending |
| FIN-08 / SEC-T04 | Raw HMAC, scoped durable intake, conflict/dedupe, cron retries and query cursor | Synthetic event tests and deployed unsigned-request rejection passed; genuine Intuit delivery, full CDC and recovery remain unverified |
| FIN-09 / SEC-T08 | Data inventory/retention gaps identified | Local fixture-only data; lifecycle, backup deletion/restore tests absent |
| FIN-10 / SEC-T08,09,10 | Pause/audit/recovery requirements only | No operational alerts, protected audit chain, timed exercises or activation gate |

No independently reviewed exclusions or approved exceptions exist. No provider
financial write or money transfer is implemented; if scope adds one, FIN-07's
full provider intent/replay/unknown/reconciliation protocol becomes a prerequisite.
Cash/payment-allocation evidence and later liability reversals still require contracts
and review; the fixed initial reward and attribution policy are now accepted.

## Evidence and release gates

Local runner: Codex, Windows/Node 24, 2026-10-09. Source/lockfile are in this
workspace; no Git artifact identity, trusted CI attestation or target configuration
identity exists yet. README/STATUS describe actual runs; tests are reproducible
but local console output is not release evidence. No independent reviewer named.

G01 coverage, G02 authenticity, G03 artifact/config identity, G04 freshness,
G05 vulnerability policy, G06 independent approval, G07 operations and G08 enforced
deployment/activation are ALL unsatisfied. An npm audit reporting no findings
does not close any of these gates. No CI/deployment policy was invented with
unset D08 parameters. Before release, approve policy and demonstrate every
supported deployment/activation path denies missing, forged, stale or failed
evidence and unauthorized bypass attempts.
