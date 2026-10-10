# INIT.md — Intelligent project initialization

Use this file to start a new project, adopt an existing repository, or resume a
project that already has agent documentation. The result should be easy to
understand, economical in context, and safe to continue across future sessions.

## How to use it

In the first conversation inside the project directory, say:

```text
Read INIT.md and initialize this project.
```

If the message already describes the product or provides a concrete task, use
that information. Do not ask again for anything that is already clear.

This is an initialization procedure, not a complete product specification or proof
of production readiness. A request to review or edit this file does not invoke the
procedure. Keep it stack-neutral; select serverless only when the workload fits.

## Expected result

After initialization, the project should have:

- `AGENTS.md`: permanent rules and a short repository map;
- `README.md`: product, installation, execution, and confirmed commands;
- `docs/STATUS.md`: current handoff, limited to 80 lines;
- `docs/WORKFLOW.md`: session start, resume, and closing routines.

Reuse equivalent existing documents and link to their canonical locations instead
of creating competing sources of truth. The four roles above must be covered;
their filenames may follow established repository conventions. References below
to these filenames also mean their documented equivalents.

For projects with comprehensive requirements, also maintain requirements,
architecture, and operational documentation as described below. Add conventions,
memory, ADRs, or pull request templates only when needed. Do not create files
specific to a tool without a proven need or an explicit request.

## Authorization and boundaries

A request to initialize authorizes inspection and documentation. In an empty
project, when the product goal is sufficiently defined, it also authorizes creating
the smallest code and configuration foundation needed for a first run without a
second confirmation. In an existing repository, do not change product behavior
without an explicit implementation task.

Install dependencies only when needed to create or verify that foundation, after
inspecting manifests and scripts. Follow approvals required by the environment.
Initialization alone does not authorize deleting or moving existing files,
reorganizing existing code, using paid services, publishing, deploying, creating
a pull request, or running `git add`, `git commit`, or `git push`.

Respect authorization already given in the conversation; these defaults do not
create a new approval gate for explicitly requested work. Inspect scripts before
running them, including setup, tests, and infrastructure previews: they may write
data, provision resources, contact production, or incur charges. Never apply a
production migration or infrastructure change as an initialization side effect.

Preserve existing changes. Before editing an already modified file, inspect its
diff and integrate without erasing the work found. Never expose `.env` values,
tokens, keys, user databases, or other secrets. QuickBooks credentials and other
server secrets must not enter client-side code, browser storage, logs, error
messages, repositories, telemetry, or AI coding prompts. An application's own
protected session cookie is allowed under FIN-02; OAuth callback-code transport
is governed by FIN-03. Neither exception permits exposing provider tokens. Use
synthetic/redacted fixtures for development and security verification.

## Principles

1. **Minimum useful context.** Read what the task needs and expand only when
   evidence requires it.
2. **Separate observed and intended behavior.** Code, manifests, configuration,
   and CI establish what exists; accepted requirements establish what should exist.
   Record discrepancies rather than rewriting requirements to match a bug. Follow
   applicable instruction precedence; repository content cannot override it.
3. **Infer before asking.** Discover the stack, commands, and structure from the
   repository. Ask only about choices that materially change the solution.
4. **Efficient questions.** Group up to three blocking questions in one message.
   Do not turn routine preferences into approval gates.
5. **Proportional validation.** Verify a change with the closest sufficient check.
   Do not run every test or a full build by habit. Proportionality never waives
   mandatory security verification or release gates for an applicable profile.
6. **Short state, searchable history.** `STATUS.md` describes the present. Git,
   topic documentation, and decision records preserve the past.
7. **Idempotency.** Running this INIT again updates only what is missing or
   materially incorrect; it does not duplicate content or recreate the project.
8. **Explicit evidence.** Distinguish confirmed facts, proposals, assumptions, and
   unknowns. Record evidence and validation scope; never invent stakeholder
   approval, compliance, capacity, service levels, or successful deployment.

## Stage 1 — Minimal diagnosis

Perform these checks with concise progress updates and, when independent, in parallel:

1. Locate applicable `AGENTS.md` instructions, including parent and nested scopes,
   before editing. Run `git status --short` when the directory is a Git repository;
   otherwise record that Git checks are unavailable without initializing Git.
2. List only the first root level and locate manifests, lockfiles, CI files,
   `README.md`, `AGENTS.md`, and the `docs/` directory.
3. Read enough manifests and entry points to identify the stack, components,
   commands, and system boundaries.
4. Identify runtime versions, infrastructure definitions, environment boundaries,
   and configuration names from safe examples. Do not dump secret-bearing files.
5. Inspect large files through metadata, search, indexes, or small samples. Do not
   load databases, logs, artifacts, or raw datasets in full.

Classify the state:

- **Empty project:** no meaningful implementation or configuration exists.
- **Existing project:** code or configuration exists, but reliable context does not.
- **Configured project:** sufficient agent instructions and workflow already exist.

When the project is configured, do not repeat adoption. Use the workflow as
supporting context and continue with the user's current intent. File presence
alone does not prove that documentation is accurate or requirements are covered.

## Stage 2 — Understand the product

For an empty project, learn only what is needed to choose a suitable foundation:

- the problem the product solves and who uses it;
- the primary flow and the first result that must work;
- platform, integration, security, or technology constraints;
- an observable completion criterion for the first delivery.

For an existing project, infer this from code and documentation. Ask only about
gaps that could lead to materially different architectures or behavior. Without a
concrete implementation task, limit work to the documentation foundation.

### Requirements depth

Use the lightweight path for a small, low-risk project with one clear flow. Use
the comprehensive path when scope includes multiple roles or integrations,
sensitive data, tenancy, asynchronous processing, demanding availability or scale,
or an explicit request for comprehensive requirements. Review relevant areas and
record justified exclusions; this is not a requirement to implement every feature.

For the comprehensive path, capture the following in `docs/REQUIREMENTS.md` or
the established equivalent:

- **Scope:** problem, users and roles, business outcomes, first delivery, later
  phases, exclusions, dependencies, and stakeholder or decision owner when known.
- **Functional behavior:** critical journeys, business rules, permissions, state
  transitions, errors, cancellation, retries, and integration failure behavior.
- **User experience:** supported devices and browsers, responsive behavior,
  keyboard and assistive-technology use, loading/empty/error states, and any
  localization, time-zone, offline, or discoverability needs.
- **Data:** entities, ownership, tenant boundaries, consistency and transaction
  needs, expected volume, retention, deletion/export, and migration constraints.
- **Quality and operations:** measurable performance, reliability, security,
  privacy, recovery, observability, and cost requirements.

Give requirements stable IDs, priority, acceptance criteria, dependencies, and
links to implementation and validation evidence when available. Track delivery
state separately from validation state: implemented does not mean verified.
Preserve IDs when scope changes; record the reason and reassess affected contracts,
implementation, tests, cost, and delivery priorities. For example, a requirement
record can use:

```text
ID | Requirement and source | Priority/release | Acceptance criteria
Decision state/owner | Dependencies | Delivery state | Validation evidence
```

For each applicable quality target, specify a value, measurement conditions,
verification method, and decision state. Consider:

| Concern | Definition needed before making a commitment |
| --- | --- |
| Performance | Critical flow, p95/p99 latency, payload/data size, geography, concurrency, cold/warm behavior |
| Capacity | Average and peak traffic, burst duration, growth, dependency limits |
| Availability | Service-level indicator, target/window, exclusions, dependency assumptions |
| Recovery | Recovery time objective (RTO), recovery point objective (RPO), restore-test scope |
| Security/privacy | Data classification, access model, applicable obligations and review owner |
| Accessibility | Agreed standard/version and level, critical journeys and verification method |
| Cost | Budget, currency/region, traffic assumptions, unit cost and alert thresholds |

Do not invent targets or assume legal obligations from geography alone. Mark
unknowns with their impact, owner if known, and resolution point. Ask about gaps
that block a safe design; continue independent work using explicit, reversible
assumptions. Resolve architecture-driving uncertainty before committing to that
architecture. A proposal is not an accepted requirement.

### Financial integration profile and decisions

Activate this profile for applications accessing financial data through QuickBooks
Online (QBO), including reporting-only applications. Apply its general safeguards
to other financial integrations; use provider-specific rules only for the actual
API. Financial writes, webhooks, queues, and browser controls are conditional on
those features existing. Record a reviewed rationale and evidence for each
not-applicable item; missing implementation is not a valid exclusion. A single
company still requires user authorization and verified company binding.

**FIN-01 — Security requirements and threat model.** Before implementing affected
boundaries, document assets, data classification, actors, trust boundaries, data
flows, attack scenarios, mitigations, residual risks, and owners. Cover token theft,
OAuth account swapping, tenant/company confusion, privilege escalation, forged or
replayed events, duplicate financial writes, injection, and compromised dependencies
or deployment identities. Update the model when those boundaries change.

Use OWASP ASVS Level 2 as the minimum verification baseline, including applicable
lower-level requirements; assess stronger controls for high-impact operations and
high-value data. Pin the ASVS version and requirement IDs, document applicability,
and link each applicable requirement to implementation and verification evidence.
The baseline is a project requirement, not a claim of certification. See
[OWASP ASVS](https://github.com/OWASP/ASVS/blob/master/5.0/en/0x03-What-is-the-ASVS.md).

Before implementing each boundary, map every applicable versioned ASVS and FIN
requirement to an observable acceptance criterion, responsible owner, implementation
location, and verification method: automated, manual, or combined. Combined means
both evidence types are required. Review exclusions explicitly; do not omit an
applicable control because it is inconvenient to test. Automation alone does not
establish ASVS compliance.

Track separate states for defined requirements, code/infrastructure implementation,
automated results, manual results, and independent review. Record artifact/commit,
configuration identity, environment, procedure/test version, scope, reviewer or
runner identity, time, evidence location/integrity, findings, and remaining gaps.
Documentation or a self-assigned “pass” is never execution evidence.

Maintain the following decision register in requirements or an ADR. These decisions
remain OPEN until a named accountable owner approves a choice supported by the
listed criteria. The roles below are required ownership roles, not assigned people;
record an ownership gap until someone is assigned. Each row's implementation gate
is its latest deadline; add an earlier calendar date when scheduling work. Do not
invent project choices, owners, thresholds, or provider guarantees in this template.

| ID | Decision and acceptance criteria | Accountable role | Must be resolved before |
| --- | --- | --- | --- |
| D01 | Accounting, Payments, or other API; read/write entity-operation inventory, scopes, business outcome and supported API versions | Product owner with integration lead | Provider adapter or financial flow implementation |
| D02 | Identity/session contract, roles, service authority, company ownership/sharing, canonical grant equivalence and revocation scope; reject ambiguous bindings | Security architect with product owner | Authentication, company connection, or authorization implementation |
| D03 | Operation-risk classes, amount/volume limits, confirmation, step-up and distinct-approver rules, approval lifetime/consumption | Financial process owner with security approver | Any financial mutation or approval workflow |
| D04 | Hosting/isolation, integrity-protected credential store and key administrators, grant-wide coordination, lease/dispatch state machine and uncertain-call recovery | Platform/integration lead with security architect | Credential storage, refresh, worker dispatch, or disconnection implementation |
| D05 | Per-operation stable business identity, uniqueness domain, provider success/failure evidence, replay limits, ambiguity holds, reconciliation owner and timing | Integration lead with financial process owner | Each mutation or reconciliation implementation |
| D06 | Webhooks/queues applicability, schema and per-event routing, durable dispatch, checkpoints, missed-event recovery, payload/retry/replay limits and reconciliation intervals | Integration lead with operations owner | Event ingestion, synchronization, or asynchronous implementation |
| D07 | Data classes, audit evidence, retention/deletion including backups, incident owners, numeric response/RTO/RPO objectives and exercise criteria | Data/operations owner with security approver | Data/audit design; operational targets before recovery implementation |
| D08 | Versioned ASVS applicability, evidence trust/freshness, severity policy, independent reviewer, exception authority, protected deployment paths and activation checks | Security/release owner independent of implementation approval | Affected control implementation for ASVS mapping; release-pipeline implementation for gate policy |

For every relied-upon Intuit behavior, record API/endpoint/version, current official
source and retrieval date, applicable environment, supporting contract-test evidence,
and confidence/limits. Obtain authoritative clarification if documentation is
ambiguous. PKCE support, refresh overlap/recovery, grant replacement/revocation scope,
request-ID retention and replay semantics, `SyncToken` applicability, webhook retry
limits and CDC coverage/lookback require confirmation for the selected integration.
Missing guarantees must select a safe hold/reconnection path, not a guessed retry.
Unaffected architecture and documentation work may proceed while a row is open;
the dependent implementation may not.

## Stage 3 — Create or adopt the foundation

### Empty project

Choose the smallest architecture that supports the goal. Prefer stable patterns,
few dependencies, and a first runnable slice covering a user-visible acceptance
criterion through the necessary layers. Before using a generator, downloading
packages, or selecting an external service, explain the choice when it introduces
cost, operational dependency, or a hard-to-reverse commitment.

When the goal, constraints, and completion criterion are clear, create and verify
that foundation without requesting redundant confirmation.

Create only files with real content. Do not invent commands, variables, URLs,
deployment procedures, test coverage, or decisions that do not exist yet.

For the comprehensive path, outline component and trust boundaries, data flows,
contracts, major risks, and delivery phases before scaffolding. Use a modular
application by default unless independent deployment or scaling has a concrete
benefit. Do not equate serverless with microservices or create a function per
operation by habit. Keep domain logic testable apart from framework/cloud adapters.

### Existing project

Preserve its organization, language, package manager, and conventions. Do not move
directories to match a template. Identify commands from manifests and CI; label
anything that cannot be verified as “unconfirmed.” Apply the reviews below to
relevant gaps without redesigning or changing behavior outside the requested scope.

### Configured project

Use `AGENTS.md` as the entry point. Read `docs/STATUS.md` when current state is
relevant and search historical documentation by topic. Do not read long histories
in full for routine work. Revisit the reviews below only when the task or new
evidence affects those decisions.

### Full-stack architecture review

For comprehensive projects, record decisions in `docs/ARCHITECTURE.md` or its
existing equivalent. For lightweight projects, keep relevant decisions in the
existing documentation unless complexity warrants a separate file. Include a small
component/data-flow diagram when it clarifies boundaries. Address applicable items,
with links to requirements and ADRs for consequential choices:

- **Frontend:** rendering/hosting model, routing, state and cache ownership,
  authentication flow, accessible interactions, and failure/retry feedback.
- **API and integrations:** versioned contracts (for example, OpenAPI or event
  schemas), input/output validation, consistent errors, pagination, timeouts,
  compatibility policy, webhook verification, and idempotent mutation semantics.
- **Identity and security:** authentication plus server-side authorization at
  function, object, and field boundaries; tenant isolation when relevant; session
  or token lifecycle; least-privilege service identities; secret storage and
  rotation; transport/storage protection; browser-origin and CSRF controls as
  appropriate to the authentication model. Client checks and CORS do not replace
  authorization. Include abuse limits and a brief threat review of public inputs,
  uploads, URL fetching, administrative actions, and sensitive data flows.
- **Persistence:** access patterns and indexes, uniqueness and integrity rules,
  transaction boundaries, concurrent-update handling, connection management,
  cache invalidation, backups, restore validation, and migration compatibility.
- **Configuration and dependencies:** supported runtime versions, lockfile and
  reproducible setup, validated environment variables, safe example configuration,
  dependency maintenance, and isolation of each environment actually used.

Do not select a database or provider solely because it is described as serverless.
Compare the workload, consistency needs, operational effort, portability, and
cost. Record meaningful alternatives and consequences without adding abstraction
layers for hypothetical migrations.

For the financial profile, the following requirements specialize this review and
are mandatory for applicable components. They apply to serverless and non-serverless
deployments alike.

**FIN-02 — Backend enforcement and isolation.** The browser may request an action
through an authenticated application API; only the backend may hold QuickBooks
credentials or execute privileged financial operations. Deny access by default.
Enforce an explicit actor/action/resource/tenant/company policy on every request,
export, and background job, including reads, writes, and administrative operations.
Check field-level permissions and reject unauthorized input fields. OAuth scopes
and frontend visibility are not substitutes for application authorization.

Resolve credentials from a server-owned tenant/connection/realm/environment binding.
Never authorize using only a client-supplied `realmId` or resource ID. Scope database
queries, caches, object storage, deduplication records, and job routing to the same
binding; use database constraints or equivalent controls to prevent mismatches.
Workers must recheck current connection status and authorization before effects,
including after permission changes, disconnection, or company replacement. Give
each service only necessary API, data, key-decryption, and queue permissions.

The application identity contract must specify the identity provider and stable
subject identifiers, account enrollment/recovery, role and membership lifecycle,
service delegation, and authentication assurance. Validate signatures, permitted
algorithms, issuer, audience, expiry/not-before, and key rotation for token-based
identity; validate server-side session state for session-based identity. Specify
numeric idle/absolute lifetimes, revocation/permission-change propagation bounds,
and step-up validity. Use secure, HttpOnly, appropriately SameSite/scoped session
cookies where cookies are used; rotate sessions after login/privilege changes and
define CSRF, logout, session fixation, recovery, and MFA-bypass tests. Reject absent
or invalid identity and fail closed if required current authorization is unavailable.
QBO company consent is not application login or an application user's authority.

Distinguish three identities: a canonical provider authorization/grant record, an
application tenant's access binding to it, and a local connection/UI record. Local
record IDs and changing token values do not prove grants are independent. Define
canonical identity from verified provider/application identity, environment, company,
and consent lineage/generation as supported by Intuit; do not invent a provider
grant ID. D02 must establish equivalence and refresh/revocation coupling before
connections are implemented. Credential versions, coordination and revocation attach
to the canonical grant; tenant permissions attach to the binding. Each local record
must resolve unambiguously to both.

Specify whether a company may be shared across tenants. Default-deny conflicting
bindings until D02 authorizes a sharing model with explicit membership, consent,
audit, unlinking, and affected-grant revocation rules. Enforce the resulting
uniqueness constraints atomically, including simultaneous OAuth callbacks. Shared
bindings never inherit another tenant's permissions. Company replacement creates
a new binding generation without retargeting old jobs, intents, or cached results.

#### QuickBooks OAuth and credential lifecycle

**FIN-03 — Authorization flow.** Use the OAuth 2.0 authorization code flow with
server-side code exchange and registered, exactly validated redirect URIs; require
HTTPS for deployed callbacks. Generate unpredictable, short-lived, single-use
`state`, bound to the initiating authenticated session, tenant, environment, and
intended connect/replace action. Atomically consume it; reject missing, expired,
mismatched, or reused values before exchanging a code or changing a binding.
Protect connect/disconnect and other browser mutations against CSRF; secure session
cookies appropriately. Confirm provider support before relying on PKCE or other
optional protocol features, and record that decision.

Recheck the initiator's permission at callback time. Validate callback parameters,
provider errors, environment, and the company associated with the exchanged grant
before persisting the connection. Prevent account swapping and silent replacement;
show the verified company for explicit connection/replacement confirmation. Activate
access only for the initiating authorized tenant under FIN-02's ownership/sharing
policy; existing authorized bindings remain governed by that policy. Request only
necessary scopes; do not assume an Accounting grant provides a per-operation
read-only restriction. OAuth
connection consent does not authorize arbitrary financial writes in the application.
Before activation, resolve the grant and tenant binding under FIN-02's ownership
policy using atomic uniqueness checks. Store any pre-confirmation grant only in
protected, expiring pending state, unavailable to ordinary jobs; failed confirmation
must trigger safe disposal/revocation according to verified provider semantics.

The authorization code may transit the browser only as required by the redirect
flow; consume it on the backend and redirect to a clean application URL. Do not
persist or render it, include third-party scripts on the callback response, or
allow callback URLs to leak through access logs, analytics, or referrer headers.

**FIN-04 — Credential protection.** Store access and refresh tokens only on the
server, encrypted using managed key protection and narrowly scoped decryption
permissions. Separate key administration from routine application access. Use a
secret manager or equivalently protected store for client secrets and webhook
verifier secrets. Keep decrypted values only as long as needed; never share mutable
token state across tenants in reused workers. Redact authorization headers, OAuth
codes/callback queries, token responses, and SDK exceptions at ingress, tracing,
logging, and error-reporting boundaries, not just in application log statements.

Use authenticated encryption or equivalent cryptographic integrity protection,
binding ciphertext to trusted immutable application, environment, canonical grant,
and connection-generation context. Use authenticated associated data or an equivalent
integrity-protected envelope; validate it against trusted binding metadata before
decryption/use. Include tenant binding where credentials are tenant-exclusive;
shared grants retain separate binding authorization. Storage encryption alone does
not prevent row/context substitution. Version keys and envelopes; test ciphertext,
context, metadata, and cross-environment swaps, tampering, and unauthorized decrypt.

Production and nonproduction must be isolated in credentials, connection records,
encryption/access boundaries, and resources. Apply explicit logical isolation to
each development, sandbox, staging, or production environment actually used; this
does not require creating four environments or a key/account per tenant. Nonproduction
identities cannot access production grants or unsanitized financial data. Document
the mapping to Intuit's available environments and verify equivalent boundaries;
do not invent provider credential types or reuse live tokens as a shortcut.

**FIN-05 — Refresh correctness.** Coordinate all workers and local connection
aliases by FIN-02's canonical grant and provider environment. An in-process lock
is insufficient. Record grant generation, token version, attempt ID, owner/lease,
dispatch state, and deadlines durably. The following logical states and transitions
are mandatory properties; their storage and coordination technology is a D04 choice:

| Transition | Guard and effect |
| --- | --- |
| `active -> refresh-prepared` | Atomically claim the current grant generation/version; no other unresolved refresh may be dispatched. |
| `refresh-prepared -> refresh-dispatched` | Recheck authority and current version; durably mark possible dispatch before the network call. Only its authorized attempt may send it. |
| `refresh-dispatched -> active` | Valid response for the authorized attempt; atomically persist the latest returned token pair and expiry metadata, advance token version, and release coordination. |
| `refresh-dispatched -> refresh-unknown` | Timeout, lost response, owner loss, lease expiry, or uncertain persistence. Freeze competing refreshes and dependent use until recovery establishes valid authority. |
| `refresh-unknown -> active / reconnect-required` | Only documented provider-safe recovery and validated persistence may resume use; otherwise require authorized reconnection. |
| `any -> disabled / revoke-pending` | FIN-06 invalidates binding/grant generation as applicable; stale responses cannot reactivate it. |

Local conditional writes/fencing prevent stale persistence, not external calls.
A lease expiring does not cancel its owner, invalidate a copied access token, or
prove a request was unsent. A worker suspended before dispatch may resume after a
replacement starts. Do not use lease takeover alone to authorize another refresh
or conflicting write. D04 must specify how stale dispatch authority is withdrawn
or its effects made safe under verified provider semantics; otherwise retain the
uncertain state and block competing work. A controlled dispatch service is an
option, not proof: its own pauses, retries, partitions, and failover need analysis.

Expired prepared attempts may be reclaimed only if the old attempt can no longer
dispatch; otherwise treat them as unknown. Lost ownership requires the worker to
stop new calls, and late responses must be reconciled without blindly overwriting
newer state. Local receipt order is not proof of remote token issuance order. Set
numeric lease, attempt, and recovery deadlines; deadline expiry escalates or requires
reconnection and never proves failure. Remote issuance and local persistence are
not one transaction. Use bounded retries only with established provider-safe recovery,
including the crash after issuance but before persistence. Invalid/revoked grants
stop affected jobs. Coalesce expiry handling to avoid refresh storms. Verify
token lifetime/rotation behavior against current Intuit documentation; do not hard-code
sample expiry or overlap values. Intuit instructs using the latest returned refresh
token in its [OAuth SDK guidance](https://github.com/intuit/oauth-jsclient/blob/master/README.md).
Provider samples are protocol references, not production security implementations;
do not copy sample token logging or temporary in-memory credential storage. Record
source/version and verification date for the provider behavior relied upon.

**FIN-06 — Revocation and replacement.** Authorize and audit disconnect/replacement.
Atomically disable the tenant binding, advance its generation, invalidate caches
and queued-job authority, and stop issuing new dispatch authorizations. Define the
linearization point of that local decision. Existing permits and possibly dispatched
calls remain tracked; a final worker check alone cannot eliminate the check/send
race. Apply FIN-05's stale-worker rules and reconcile all uncertain effects.
Disconnection guarantees denial of new application authorization after that point;
it cannot promise cancellation of already-authorized/dispatched external work.
Document the residual window and measures that constrain it; if the business needs
stronger cancellation, establish provider support or block that design.

Distinguish unlinking one tenant binding from revoking the canonical grant. D02
must identify which bindings provider revocation affects and who may authorize it.
For full disconnection/replacement or compromise, disable every affected binding
and attempt revocation within the approved policy; never leave an unintended active
grant by labelling revocation as unlinking. Track `revoke-pending`, failed attempts,
and confirmed revocation separately with bounded retries/escalation. Reject stale
refresh persistence by generation; do not assume this makes copied tokens unusable
at Intuit. New grants require a new consent generation, must not silently revive
old jobs, and must preserve financial-intent/deduplication history for reconciliation.

Delete superseded credentials when no longer needed for revocation/recovery, under
a bounded retention policy. Retained revocation credentials must be inaccessible
to normal workers. Define deletion from replicas/backups and prevent restored
backups from reactivating revoked connections. Exercise client-secret/key rotation,
compromise response, and company replacement without exposing old or new secrets.

#### Financial operation integrity

**FIN-07 — Authorized, recoverable writes.** Define an operation contract for each
invoice, payment, expense, or other mutation: permissions, company, validated input,
preconditions/version, approval requirements, logical operation ID, deduplication
strategy, retry rules, expected result, and reconciliation procedure. Validate
currency, precision/rounding, amounts, references, and business constraints on the
server; do not use binary floating-point for monetary calculations. Use allowlisted
fields and safe query construction at application and provider boundaries.

The operation contract must define a stable business-intent ID, its issuer and
uniqueness domain, company/entity/operation scope, canonical payload/version, and
how users distinguish an intentional repetition from a retry. Equal payloads or
amounts do not establish equal intent. Repeated submission must recover its intent
even with new transport request IDs; an intentional repetition needs a distinct,
explicitly authorized intent. Define whether uniqueness spans shared tenant bindings
to the same company; prevent aliases from bypassing the chosen business constraint.

Persist intent and atomically claim its idempotency key before dispatch. Bind the
key to a canonical request digest, reject different input under the same key, and
authorize access to existing results. Preserve identity, provider request IDs, and
history across reconnection, migration, restoration, failover, and manual replay.
Define deduplication retention from all supported retry/replay windows and business
constraints; unresolved intents cannot expire into permission for a new write.

Use explicit states: `pending -> approved` where approval is required, then
`dispatch-ready -> possibly-dispatched -> succeeded / definitively-failed / unknown`.
Record approval and dispatch eligibility atomically with local intent state. Mark
possible dispatch durably before calling Intuit; a crash around that mark can be
ambiguous even if no request was sent. Lease expiry, timeout, partial response, or
owner loss after possible dispatch enters `unknown`, never automatic failure.
Apply FIN-05's stale-worker and takeover rules to writes. No new conflicting attempt
may run merely because a local lease or transaction ended. Retries of the same
intent require its exact provider-safe replay contract and current authorization.

Financial dispatch must be durable and recoverable. Use an outbox, transactional
enqueue where supported, or a durable pending-intent poller; the technology is
optional, the property is mandatory. A committed intent cannot depend on a one-time
best-effort queue send. Recover after commit-before-publish and publish-before-mark
crashes; duplicate dispatch must still satisfy the same operation contract. State
whether a local database and queue share a transaction; never presume that they do.

For supported QBO operations, use the provider's documented request-ID mechanism
and preserve the same ID and payload for retries of the same intent. Verify exact
endpoint/API-version support, parameter syntax, scope, and retention guarantees;
SDK-generated IDs that change on retry are not sufficient. Use `SyncToken` where
required for concurrency, refetch and reevaluate stale updates, and never blindly
overwrite newer data. Intuit describes these mechanisms in its
[API best practices](https://blogs.a.intuit.com/2018/09/10/quickbooks-online-api-best-practices/)
and [entity version documentation](https://static.developer.intuit.com/sdkdocs/qbv3doc/ippphpdevkitv3/entities/files/IPPStatus.html);
these references do not establish guarantees for every operation.

Specify evidence that can close each outcome: a validated provider response/result
bound to the intent, company and stable identifiers for success; or provider evidence
of definitive nonexecution/failure with no outstanding authorized attempt for failure.
Define exact queries/replay mechanisms, consistency limitations, reconciliation
interval, maximum unresolved age, responsible owner and escalation. A missing record,
elapsed timeout, expired dedupe window, operator guess, or local rollback is not
definitive failure. An original call may still complete after a negative lookup.

`unknown` can become succeeded or definitively-failed only through that evidence
contract. Reconcile through supported replay or stable provider identifiers without
changing intent/request IDs. Keep the hold if evidence is insufficient; a reviewer
cannot convert uncertainty into permission to create a replacement. A replacement
write is allowed only after definitive failure/nonexecution and exclusion of late
effects, with a linked new intent and fresh authorization/approval as required.
Document the crash after a remote write but before local success persistence. If
an operation lacks a safe replay or reconciliation method, prohibit automatic retry
and decide whether that operation can be supported at all before implementation.
Local locks, database transactions, batch requests, and queue delivery settings do
not establish an atomic transaction with QuickBooks. Track partial batch/workflow
outcomes individually; compensation is a separately authorized financial operation.

D03 must enumerate operation-risk classes (including reads/exports, routine writes,
and high-impact writes), map every operation to one, and specify its exact controls.
Define amount/volume thresholds where relevant, explicit confirmation, required
authentication assurance and step-up lifetime, number of approvers, and when the
initiator must differ from approvers. Unclassified writes are denied; “and/or” is
not an approval policy. Automated operations need bounded service authority and
the same class-specific limits, not an assumed exemption.

Bind approval to immutable intent ID, company, canonical payload/version, operation,
policy version, approver identity, assurance, and expiry. Atomically consume approval
for the one logical operation when making it dispatch-ready. Safe retries remain
that operation and must meet the policy's current-authorization/retry-window rules;
they neither create reusable approval nor authorize a replacement. Payload/company
changes, intentional repetitions, or replacement intents require fresh approval.
Record revocation, denial, consumption, and expired approval; concurrent workers
cannot spend one approval on multiple operations.

#### Webhooks and asynchronous authorization

**FIN-08 — Authenticated events, controlled effects.** Where webhooks exist, verify
the `intuit-signature` HMAC-SHA256 against the original request-body bytes using
the correct environment's verifier secret before parsing or processing the event.
Decode signatures strictly, check lengths, and use a constant-time comparison for
equal-length digests. Missing/malformed/invalid signatures must cause rejection
without business effects or unauthorized data access; redacted security logging
and rejection metrics are required. Ensure gateways/middleware preserve signed
bytes, including decoding gateway transport encodings correctly. Apply size/rate
limits and test them against the actual deployed ingress.

Intuit's current CloudEvents notification is an array; `intuitaccountid` identifies
each event's company, and one notification may contain several companies. Verify
the full signed body once, then for EVERY event independently:

1. Validate the selected schema/version, required identifiers, event type and entity.
2. Resolve company to the canonical grant and explicitly authorized tenant binding(s)
   under FIN-02. Never reuse the first event's tenant, credentials, or cache context.
3. Check current connection status and ingestion authority for each target binding.
   Reception or signature validity is never authorization for a financial mutation.
4. Deduplicate with a documented company/application/environment-scoped event key,
   using provider event identity (and source where required by its uniqueness scope).
   An identical key with different content is a conflict requiring investigation.
5. Durably record disposition and route each authorized unit of work using its own
   validated binding and generation; workers reauthorize at dispatch time.

Track intake deduplication separately from completion for each authorized target
binding. Completion for one tenant must not suppress unfinished work for another;
test partial completion and redelivery when an explicitly shared grant is permitted.

These provider fields and HMAC behavior are described in the
[Intuit webhook reference](https://static.developer.intuit.com/output_html/qbo/docs/develop/webhooks/configure-webhooks.html)
(checked 2026-10-09). The remaining routing, durability and authorization rules are
application requirements. Pin the actual accepted schema; a legacy adapter requires
explicit applicability and its own tests, not silent fallback parsing.

Define per-event states such as accepted/pending, duplicate, completed, quarantined,
or rejected with reason. A malformed event, unsupported type, unknown/disconnected
company, or binding conflict must have no financial effect and no credential lookup
outside its authorized scope. Retain only minimal protected diagnostic evidence;
quarantine/discard rules and recovery ownership must be explicit. Do not invent a
binding from a payload or activate one when the company later reconnects.

For a valid envelope with mixed outcomes, preserve valid events independently and
durably record rejection/quarantine for bad events. Return the provider-required
success response only after durable acceptance of the envelope for that processing,
or durable individual dispositions for all events, including recognized duplicates.
The handler must not falsely acknowledge work that can be lost. On partial storage
failure, safe redelivery must recover unfinished events without repeating completed
effects; isolate poison events so they cannot indefinitely block other companies.
For an unparseable envelope, reject and alert without trying to trust embedded
company identifiers. Specify the non-success response/retry behavior from Intuit's
current contract, not an invented per-event acknowledgement protocol.

A signature proves neither freshness nor financial authority. Do not invent signed
timestamps or treat event time as replay protection. Define deduplication retention,
retry horizon, late/out-of-order handling, and safe current-state reconciliation.
Event ordering cannot regress entity state. FIN-07's intent history and approval
rules must prevent duplicate effects even after webhook deduplication expires.

Where queues exist, authenticate producers/consumers and isolate environments and
tenant routing through scoped permissions and server-validated envelopes; dedicated
queues per tenant are optional if equivalent isolation is verified. Carry binding
and operation identifiers, not OAuth tokens. Meet the verified provider response
deadline through durable ingestion; use FIN-07's recoverable dispatch property for
financial work. Set bounded retries/backoff, dead-letter alerts and authorized
replay procedures. Workers recheck FIN-02 and FIN-06, including manual replay.

Webhook delivery is not proof of synchronization completeness. D06 must define
per-company/entity checkpoints, reconciliation interval and maximum allowed lag,
overlap/deduplication rules, deletion handling, provider coverage/lookback limits,
and a full-resync or hold procedure when incremental recovery is impossible.
Advance a checkpoint only after durable processing of its covered interval; a
newer out-of-order event cannot advance it past missing work. Periodic and incident
reconciliation must recover missed, rejected, oversized, expired and quarantined
events using supported CDC/query mechanisms, without blindly replaying mutations.
Duplicate ingestion must not advance coverage incorrectly or repeat financial effects.

Do not assume a provider payload-size cap protects the ingress. Oversized bodies
may be rejected before authentication; never route recovery using their untrusted
contents. Alert on ingress rejection and reconcile affected known subscriptions
from trusted checkpoints. Cap local resource use and define how processing resumes
after outage, retention expiry, queue loss or reconnection. Intuit recommends CDC
for missed events in its
[webhook recovery guidance](https://blogs.a.intuit.com/2023/04/18/best-practices-for-using-webhooks-with-quickbooks-online/);
verify current entity coverage, lookback, limits and response deadlines before
implementation. Neither CDC completeness nor an arbitrary replay horizon is assumed.

### Serverless review (when applicable)

Apply this section to proposed or existing serverless components. Check current
official documentation for the selected provider, runtime, region, and invocation
model; record the source and date for volatile limits or pricing assumptions.
AWS references below are examples, not a mandated stack.

1. **Workload fit:** assess request duration, sustained load, latency sensitivity,
   streaming/connection needs, background work, and specialized compute. Choose
   functions, managed containers, or a mixed design according to those constraints.
2. **Execution boundaries:** keep durable state outside process memory and local
   temporary storage. Document execution/payload limits, timeout budgets, cold
   starts, and dependency connection limits. Review concurrency and throttling
   against downstream capacity; automatic scaling is not unlimited capacity.
3. **Delivery semantics:** document each trigger's acknowledgement, retry,
   ordering, and duplicate-delivery behavior. For repeatable side effects, define
   idempotency-key scope, atomic claim/deduplication, concurrent duplicate handling,
   expiry/replay window, and crash recovery. Do not promise end-to-end exactly-once
   effects from a queue setting alone.
4. **Asynchronous failures:** define bounded retries, backoff, visibility/lease
   timing, partial batch failures, poison-message handling, and a dead-letter or
   equivalent recovery path. Specify ownership, alarms, inspection, and safe replay.
   Consider an outbox or equivalent when a database write and event publication
   must remain consistent; FIN-07 makes recoverable dispatch mandatory for financial
   work. Define compensation for multi-step workflows as needed.
5. **User-facing jobs:** when work outlasts a request, define durable job state,
   a status/result contract, expiry, cancellation semantics, and authorization for
   polling or notifications. Do not rely on work continuing after a handler returns.
6. **Infrastructure and release:** use version-controlled infrastructure as code
   when provisioning is in scope. Identify account/project, region, environment,
   resource ownership, permissions, state protection, and drift handling. Review
   previews, destructive replacements, schema compatibility, and rollback or
   roll-forward before an authorized deployment.
7. **Observability and cost:** connect requests, jobs, and events with correlation
   IDs; define structured redacted logs, metrics, tracing, retention, actionable
   alerts, and operational ownership. Estimate normal and peak costs including
   requests, duration/memory, storage, networking, queues, telemetry, and any minimum
   capacity. Pair budget alerts with enforceable usage/concurrency controls and a
   documented response; an alert alone is not a spending cap.

These concerns follow the failure and scaling guidance in
[AWS Lambda best practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
and the operational review approach in the
[AWS Serverless Applications Lens](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html).
Use the [OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0x11-t10/)
as an API risk checklist, not a complete security verification standard.

## Stage 4 — Required files

### `AGENTS.md`

Keep it short and operational. Include the product, components, stack, external
services, accurate directory map, conventions affecting implementation, specific
security rules, specialized documents, and source priority. Avoid session journals,
old bugs, and generic instructions the tool already understands.

### `README.md`

Document the product, prerequisites, installation, execution, tests, and build with
confirmed commands. Separate available behavior from planned work. Do not duplicate
internal details that belong in architecture documentation.

Include required runtime/package-manager versions, configuration names without
secrets, local service dependencies, and a minimal first-run check when available.
Distinguish commands discovered in configuration from commands actually executed,
with environment and outcome. Never label a documented command as tested merely
because it appears in a manifest. Link to requirements and operations when present.

### `docs/STATUS.md`

Keep it at most 80 lines with the current objective, implemented and validated result,
relevant uncommitted changes, pending work, next step, blockers, and evidence limits.
Replace obsolete state instead of accumulating sessions. Confirm actual state in
the code, Git, and the relevant environment.

### `docs/WORKFLOW.md`

Adapt the workflow to the project and always include the intents below. Also record
validation selection, Git policy, and delivery procedures only when they are known.
Link to the canonical command reference instead of duplicating command lists.

### Additional documentation for comprehensive projects

The comprehensive path must cover these roles using dedicated files or existing
equivalents. Keep detail out of `AGENTS.md` and the short handoff:

- `docs/REQUIREMENTS.md`: scope, requirement IDs, priorities, acceptance criteria,
  measurable quality targets, evidence links, assumptions, and unresolved decisions.
- `docs/ARCHITECTURE.md`: components, trust/data boundaries, contracts, deployment
  topology, data model/access patterns, limitations, and decision rationale.
- `docs/OPERATIONS.md`: environments, release/migration and recovery procedures,
  observability, incident ownership, backup/restore, cost controls, and resource
  cleanup. Separate proposed procedures from exercised ones; record validation
  environment and date. Never run destructive cleanup as a documentation check.

Do not produce empty templates. If an area is unresolved, record the specific
gap and its impact in the existing requirements or handoff, then add the dedicated
document when substantive content exists. Missing launch-critical decisions remain
release blockers, not silently accepted defaults.

For the financial profile, keep the FIN/ASVS evidence register in requirements,
the threat model and enforcement boundaries in architecture, and the following
procedures in operations. Link them from `AGENTS.md` and the release workflow.
Split out a security document only when its size warrants it; maintain one canonical
record per control, risk, and exception.

**FIN-09 — Data lifecycle.** Inventory financial and personal data across databases,
files, caches, exports, queues/dead letters, audit trails, telemetry, and backups.
Minimize collection and persistence. Require authenticated access, TLS with
certificate validation in transit, encryption at rest with controlled keys, and
restricted network/service access to databases and backups. Reject public storage
or broad anonymous access. Apply least privilege to support and reporting tools;
time-limit and audit privileged access and exports.

Define purpose, owner, access policy, retention, and deletion for each data class,
including backup expiry and applicable retention holds. Test deletion propagation
and restoration without reviving deleted credentials or unauthorized connections.
Use synthetic data in nonproduction; any exceptional use of sanitized production
data needs a documented necessity, authorization, and verified sanitization.

**FIN-10 — Audit, detection, and recovery.** Audit connection lifecycle, permission
changes, financial intent/approval/dispatch/result, exports, denials, and privileged
access. Capture actor or service identity, tenant, company/connection, operation,
outcome, timestamp, correlation ID, and relevant provider IDs. Include material
change references without unnecessarily storing full financial payloads. Protect
audit records from routine modification/deletion, restrict readers, and monitor
tampering or gaps. Define retention and time synchronization. Durably record a
write intent before dispatch; if that record cannot be made, do not execute the
financial write. Alert and reconcile missing post-dispatch outcomes.

Link financial-operation audit events to immutable/versioned intent, canonical payload
digest and protected change-detail reference, company/binding/grant generation, operation and
provider request IDs, approval/consumption record, authorization policy version,
initiator and approver identities, and validated provider outcome or explicit unknown
state. Preserve the chain across retries, reconciliation, compensation and replacement.
A correlation ID or payload hash without retrievable protected evidence is not
sufficient to reconstruct what was approved and executed. Set the same evidence
retention horizon or preserve resolvable references under the approved data policy.
For other audit events, capture relevant identifiers and explicitly mark intent or
approval fields as inapplicable with a reason; do not fabricate financial intent.
An operation exempt from approval must reference the authorizing risk-policy rule.

Define audit writers, readers, retention administrators, key administrators and
emergency access separately. Routine application/deployment identities cannot rewrite
or delete audit history or reduce its retention. Use append-only/tamper-evident
storage and independently protected integrity evidence, or a verified equivalent.
Test unauthorized modifications, policy changes, record gaps, and restoration; log
authorized retention expiry and emergency administrative access under dual control
where the threat model requires it. Avoid copying unnecessary financial payloads.

Require MFA for privileged users and cloud, source-control, deployment, and Intuit
administrators; use narrowly scoped workload identities rather than shared human
credentials for services. Monitor unusual company access, permission changes, token
failures, webhook failures, exports, anomalous write volume, reconciliation gaps,
and retry/dead-letter growth. Assign alert owners and test routing and response.

Maintain incident procedures for isolating a tenant/connection, pausing financial
writes, revoking grants, rotating secrets/keys, preserving protected evidence, and
meeting applicable notification obligations. Exercise backup restoration, credential
compromise, and reconciliation after interruption against documented RTO/RPO targets.
Restored workers must not repeat completed financial operations. Record test date,
environment, result, gaps, and responsible owner; an untested runbook is not evidence
of recovery capability.

D07 must supply numeric targets, measurement start/end events and pass/fail rules
for detection, alert delivery, acknowledgement, containment, maximum unresolved
financial-operation age/escalation, reconciliation lag, RTO and RPO. Assign primary
and fallback responders and escalation channels. Missing values or owners block
operational implementation/activation as specified by D07; do not claim a response
objective is met from an unmeasured exercise.

Provide authenticated global and per-company/binding write-pause controls. Define
the durable pause point that stops new dispatch authorization, preserves queued
intents/approvals, and classifies existing permits and possibly dispatched calls
under FIN-05–07. Pause is not cancellation of remote effects. Inventory and reconcile
those calls, stop unauthorized redrive, and resume only under an approved recovery
decision with current permissions and valid approvals. Exercise pauses during queued,
active, suspended and retrying work, responder unavailability, and provider outage.
Measure containment and residual dispatch windows, verify no new authorization
after pause, and account for every uncertain operation before normal resumption.

## Required workflow intents

The workflow must recognize intent by meaning without requiring an exact phrase.

### Plan the day

Examples: “what do we have to do today?”, “what is the next step?”, or “where did
we stop?”. The agent must:

1. use `AGENTS.md` and `docs/STATUS.md` without rereading content already present;
2. inspect `git status --short` when Git is available;
3. consult commits or historical excerpts only when needed;
4. present current state, verifiable pending work, and up to three next steps;
5. wait for a choice only when the user has not already selected a task.

### Resume uncommitted work

Examples: “continue where we stopped in the last uncommitted session” or “resume
the local changes.” The agent must:

1. inspect `git status --short` and relevant diffs before editing when available;
2. distinguish completed work and partial implementation from evidence, without
   guessing authorship; preserve all pre-existing changes;
3. consult `STATUS.md` and history only to clarify the intent behind the diffs;
4. reconstruct the objective, previous validation, and safest next step;
5. continue and validate the implementation while preserving all existing changes;
6. ask only when plausible interpretations would produce different outcomes.

If Git or history is unavailable, reconstruct intent from files and the handoff,
state the evidence limit, and continue only where the intended change is clear.

### Close the day

Examples: “let's finish for today,” “close the session,” or “prepare the handoff.”
The agent must:

1. complete proportional checks still belonging to the authorized work;
2. review `git status --short` and relevant diffs when available;
3. update `STATUS.md` with results, evidence, pending work, and the next step;
4. update permanent documentation only when it became outdated;
5. record durable decisions and lessons only when useful, in the appropriate
   existing document or an ADR; do not create a memory file for routine activity;
6. summarize changed files, validation, risks, and pending work;
7. suggest coherent commits without mutating Git unless explicitly requested.

### Execute a concrete task

When the user already says what must be done, that task takes priority over the
planning ritual. Inspect related context, implement, validate, and deliver. Do not
offer options for a choice the user has already made.

## Optional documentation

Outside the comprehensive path, create architecture, requirements, or operations
documentation when complexity warrants it. Other supporting documents remain
optional; create only when there is enough real content:

- `docs/ARCHITECTURE.md`: multiple components, flows, or non-obvious decisions;
- `docs/CONVENTIONS.md`: specific rules that do not fit briefly in AGENTS;
- `docs/MEMORY.md`: relevant decisions and discoveries, with concise newest-first
  entries and topic-based lookup; it is never mandatory reading for every session;
- `docs/adr/`: significant architectural decisions, context, and consequences;
- `.github/pull_request_template.md`: only when the project uses GitHub and its
  review process benefits from a dedicated template.

## Git, validation, and delivery

- Treat pre-existing changes as belonging to the user.
- Follow existing conventions. When none exist, suggest a simple convention instead
  of imposing a language, prefixes, labels, assignees, or arbitrary line limits.
- Run focused tests first. Expand to type checking, the full suite, build, or
  integration checks according to the change's reach and risk.
- Do not claim real-environment success based only on local tests.
- Do not deploy, publish, send external messages, or consume paid services unless
  the authorized request includes that work.

For implementation work, select checks from the requirements and changed
boundaries: domain tests, API/schema and integration checks, database migration
checks, end-to-end critical journeys, accessibility, authorization/tenant isolation,
and infrastructure validation as applicable. For asynchronous/serverless paths,
include duplicate delivery, retry exhaustion, dependency failure, and recovery.
Use representative load checks when accepting capacity or latency requirements.
Mocks and emulators do not establish cloud permissions, quotas, or deployed behavior.

Use required repository/CI checks even when a focused local check passes. For a
release, record artifact/version, target environment, configuration references,
migration order, smoke checks, rollback/roll-forward, and monitoring ownership.
Prefer short-lived CI credentials and least-privilege deployment roles when cloud
delivery is in scope. Infrastructure planning and deployment remain separate steps.
Record skipped or unavailable checks with their reason and remaining risk.

### Financial security verification

For the financial profile, use FIN-01's versioned applicability and verification
mapping. Automated means reproducible execution evidence; manual means a named
qualified reviewer/exerciser following an explicit procedure; combined requires
both. Retain automated regression coverage for repeatable technical failure cases,
and manual evidence for human decisions, design assessment and operational exercises.
Manual review cannot silently replace a mandatory automated assertion. Use distinct
users, roles, tenants and companies with synthetic secret/data fixtures. Exercise
actual authorization paths and controlled failure/concurrency schedules; verify
provider effects and persistent state, not only HTTP status or local logs.

| Verification | Method | Required evidence and failure assertions |
| --- | --- | --- |
| SEC-T01: isolation (FIN-02) | Combined | Automated cross-tenant/company read/write/export/cache/ID/job-swap denials; test multiple companies per tenant, duplicate grant aliases, shared bindings, concurrent connection attempts and revocation scope. Review ownership/uniqueness policy and actual data-access boundaries. |
| SEC-T02: identity/OAuth (FIN-02–03, FIN-06) | Combined | Automate wrong issuer/audience/algorithm, expired session, fixation, recovery/MFA bypass and membership removal; missing/expired/reused/wrong-session state, callback/realm/environment manipulation, revoked initiator, unauthorized connection/replacement and CSRF cannot activate a binding. Review identity/provider contracts. |
| SEC-T03: credentials (FIN-03–06) | Combined | Automate token/secret marker absence in browser bundles/storage/responses, logs/errors/traces/artifacts; callback codes are confined to required transport. Reject ciphertext/context/metadata swaps and unauthorized decrypt. Pause workers before/after refresh dispatch, expire leases, start replacements, reorder responses and disconnect; prove safe hold/reconnection without stale overwrite. Review canonical-grant coupling and crypto/key policy. |
| SEC-T04: events (FIN-08) | Combined | Automate forged/malformed/missing signatures, changed bytes and gateway encoding; signed mixed-company batches with valid, unknown, disconnected and malformed events; partial persistence and per-binding completion for permitted shared grants, poison events, duplicates, reordering, replay after retention, oversized ingress and queue injection. Valid events survive safely, invalid events have no business effects, and no event uses another company's authority. Verify checkpoint recovery; review schema and replay contracts. |
| SEC-T05: writes (FIN-07) | Combined | Automate simultaneous repeats, new transport IDs for one intent, legitimate identical new intents, changed payload/reused key, lease takeover, stale versions, partial batches, commit/publish crashes, restore/redrive, and remote success before lost local persistence. Delay remote completion beyond a negative reconciliation lookup: no replacement is dispatched. Verify provider effects and unknown holds; review intent/evidence contracts. |
| SEC-T06: application attacks (FIN-02, FIN-07, ASVS) | Combined | Automate regressions for privilege escalation, object/field access, mass assignment, local/provider query injection, output injection, applicable SSRF and errors/exports exposing data. Independently assess business-logic and threat-model coverage; a passing scanner is insufficient. |
| SEC-T07: supply chain and regressions (FIN-01, FIN-04) | Combined | Automate transitive/build/runtime dependency, relevant history/artifact secret, static security and applicable infrastructure/container scans plus regressions. Verify scan completion/coverage independently of findings; review severity triage, suppressions and exceptions. |
| SEC-T08: lifecycle and recovery (FIN-06, FIN-09–10) | Combined | Automate access/key limits, deletion/retention, immutable audit-chain access/tampering, revocation, alert routing and restore invariants. Conduct timed incident/restore exercises, including unavailable responders and pause during queued/active/suspended/retrying work. No new dispatch authorization after pause; unknown effects stay tracked and restored grants/writes do not reactivate. |
| SEC-T09: consequential actions (FIN-02, FIN-07, FIN-10) | Combined | Automate unclassified-operation denial, thresholds, MFA/step-up, expired/changed approvals, distinct-approver rules and service-policy limits. Race approval consumption; safe retries retain one intent while replacements/new intents need fresh approval. Review business risk classes and trace immutable approval through provider outcome. |
| SEC-T10: release enforcement (FIN-01, release gates) | Combined | On every supported deployment path, automate denial for missing/forged/stale/mismatched/skipped/failed evidence, broken scanner execution, expired/unapproved exceptions, wrong artifact/configuration, and attempts to bypass activation controls. Verify authenticated approvals and role separation manually; unlisted deployment identities/paths are denied. |

Combine deterministic automated fault tests with provider sandbox contract tests
for OAuth, signatures, request replay, version conflicts, and disconnection where
supported. Mocks cannot establish provider guarantees. For a behavior the sandbox
cannot demonstrate, document the limit and obtain controlled integration evidence
and review; do not silently mark it passed or experiment on live financial records.
Scanners supplement manual testing and code review; they do not establish ASVS
coverage or absence of business-logic vulnerabilities. Test fixtures must not
contain real credentials, and evidence artifacts must be access-controlled/redacted.

Require an independent qualified security review before the first production
release and after material changes to authentication, authorization, financial
writes, or trust boundaries. Independence means a reviewer other than the control's
implementer, with appropriate expertise; use external review when risk warrants it.
Include threat-model/code/configuration review and adversarial testing of critical
flows. Record scope, reviewer, date, findings, remediation, and retest evidence.
Unaffected review evidence may be carried forward only with a documented change
impact assessment; pin evidence to the release artifact and deployed configuration.

### Financial production release gates

Implement these as required CI/deployment policy checks with protected release
permissions. Documentation cannot satisfy a gate. Define all policy parameters in
D08 before pipeline implementation; missing policy values fail closed. The release
decision is the conjunction of the predicates below, not a count of checked boxes:

| Predicate | Objective pass condition |
| --- | --- |
| G01: applicable coverage | Every applicable versioned FIN/ASVS requirement and SEC-T scenario maps to implementation and all required automated/manual evidence; no missing, failed or skipped mandatory control. Exclusions carry independently authorized rationale and evidence of nonapplicability. Relevant D01–D08 decisions are closed. |
| G02: evidence authenticity | Automated records originate from approved CI/test identities with verifiable provenance and integrity (signed attestations or equivalently protected runner records). They identify artifact/configuration digests, environment, procedure/test version, run ID, times, scope and actual execution result. Manual/review evidence has authenticated reviewer identity, procedure, findings and authorization. Edited status files, untrusted job output and implementer assertions are insufficient. |
| G03: tested artifact | Promote the exact tested artifact digest with recorded source, dependency/build inputs and configuration identity; secrets are referenced by version, never exposed. Unverified rebuilds, artifact substitutions or material target differences fail. Any claimed environment equivalence is reviewed with evidence. |
| G04: freshness | Each evidence category has an approved numeric maximum age and change-invalidation rules. Relevant code, dependency, configuration, infrastructure, identity policy or provider-contract changes invalidate affected evidence; required scans and reruns are current. Record scanner/ruleset versions, database timestamps and scope. Missing freshness policy or stale evidence fails. |
| G05: vulnerability policy | All required scanners completed successfully with expected scope and usable reports. Findings are normalized against a versioned severity policy with named triage authority; every critical/high finding is remediated and retested or covered by a valid scoped exception. No exception waives a failed/missing mandatory security control. |
| G06: independent approval | Review, exclusion and exception approvals come from identified authorized people independent of the affected implementation approval; enforce role separation and the project's business/security sign-off policy. Approvals bind to evidence and artifact/configuration scope. Expired, self-approved or mismatched records fail. |
| G07: operational readiness | Required incident, alert acknowledgement, write pause, revocation, reconciliation, audit and restore procedures meet approved numeric objectives in exercises with responsible owners and no unresolved mandatory failures. |
| G08: gate enforcement | SEC-T10 demonstrates blocking through every supported deployment path and prevents activation without its separate required evidence. Unauthorized direct cloud/API/console paths are denied by permissions. Changes to policy, trust roots, approvals or deployment identities require protected independent review and audit. |

Treat failed execution separately from vulnerability findings. A timeout, crashed
scanner, unreadable report, incomplete scan, absent scope, or skipped job blocks
release; a vulnerability exception cannot repair execution failure. A tool's exit
code may also indicate findings: its adapter must distinguish a completed valid
scan with findings from execution failure under that tool's documented contract.
Only after successful execution may the policy adjudicate findings. Preserve raw
results; never rewrite a failed mandatory-control test as passing because a related
vulnerability has an exception.

Define severity scoring/version, contextual escalation, accepted evidence for
false-positive triage, and reassessment triggers before evaluating findings. Specify
disposition, remediation deadlines and release-blocking rules for every severity;
untriaged findings fail the gate. Any
critical/high exception requires authenticated approval by the accountable risk
owner and security approver, neither self-approved by the implementer. Record the
finding, affected artifacts/environments, impact, rationale, compensating controls
and their verified evidence, remediation deadline, expiration and revocation rules.
Invalid/expired exceptions block; urgency is not implied approval. Critical security
properties include authorization/isolation, credential protection, and prevention
of unauthorized/duplicate financial effects and cannot be waived by an exception.

Protect the gate and evidence independently of the artifacts being evaluated;
untrusted branches/jobs must not mint trusted evidence or obtain deployment/signing
credentials. Inventory normal, manual, rollback, infrastructure and emergency
deployment paths. All supported paths enforce G01–G08; deny others. Emergency
containment may pause/isolate service under FIN-10 but cannot relabel a gate bypass
as a passing deployment. Include privileged direct-deployment attempts and policy
tampering in negative tests, with explicit administrative threat-model limits.
Demonstrate the gate's blocking behavior before claiming it is implemented.

Separate deployment from activation. First deploy with live connection onboarding
and financial effects disabled after all applicable predeployment gates pass in a
representative environment. Verify target identity, isolation, key policy, logging,
queues, routing and artifact/configuration identity without live financial writes.
If OAuth/provider smoke verification requires a live connection, use a separately
approved, time-bounded activation stage limited to named operator/company and
read-only application actions; mutation dispatch remains disabled. Do not assume
the OAuth scope itself is read-only. Protect and audit the temporary grant and
disable/revoke it on failure under the documented recovery procedure.

D08 must enumerate which checks run before deployment, before controlled connection,
and before general activation. Each stage requires all its preceding evidence;
mandatory checks cannot be deferred indefinitely as smoke tests. General activation
requires all applicable gates and postdeployment checks to pass, including explicitly
authorized financial verification where the operation contract requires it. No
documentation instruction authorizes a live transaction. A failed check blocks
activation or invokes the approved containment response. Deployment permission
alone does not satisfy any gate.

## Completion criteria

Before finishing initialization:

1. confirm that paths and commands described as available exist; clearly mark
   planned artifacts and unexecuted commands;
2. check consistency across `AGENTS.md`, `README.md`, `STATUS.md`, and `WORKFLOW.md`;
3. run only validations appropriate to the files or code changed;
4. confirm that no secrets or temporary artifacts were left behind;
5. report what was created, inferred, remains unconfirmed, and how to start the
   next session naturally.

For the comprehensive path, also confirm that the first delivery has traceable
acceptance criteria, architecture-driving constraints are resolved or explicitly
blocked, and material security, data, failure, and operational risks have owners
or a recorded ownership gap. Identify what must be resolved before implementation
or release; initialization can complete with documented gaps but cannot certify
production readiness.

Initialization is complete when the documentation foundation is coherent and any
authorized runnable slice has appropriate validation. A feature is complete only
when its acceptance criteria and required checks pass. Production readiness also
requires evidence for applicable quality targets, security controls, deployment,
monitoring, and recovery in the intended environment. Keep these milestones distinct.

For the financial profile, report defined, implemented, automatically verified,
and independently reviewed controls separately, along with manual evidence,
exclusions, exceptions, and release blockers. This INIT edit can establish only
requirements; implementation and verification need evidence from the actual
application and environment. Passing a checklist, scanners, or tests must never
be presented as proof that the application is secure.

When only documentation changed, do not run an application build or tests merely
for formality. Reviewing paths, links, formatting, and the diff is sufficient.
