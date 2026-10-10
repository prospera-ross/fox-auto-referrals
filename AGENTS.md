# Fox Auto Services referral system

Read `docs/STATUS.md` for the handoff and `README.md` for commands.
The accepted product brief is recorded in `docs/REQUIREMENTS.md`; distinguish it
from proposed business policies. `INIT.md` remains the initialization procedure.

## Components and map

- `public/`: buildless, English claim page for Cloudflare Pages.
- `functions/`: Pages API proxy to the TypeScript Worker via a service binding.
- `src/`: claim API and isolated QuickBooks processing core.
- `migrations/`: D1 schema; `seeds/`: synthetic fixtures with explicit local/staging scope.
- `tests/`: validation, API, and database regression tests.
- `docs/`: requirements, architecture, security, operations, status, workflow.

## Rules

- Preserve the exact Shop Genie destination specified in the product brief.
- Never expose partner rewards or tracking internals in the customer flow.
- Public claims can only create leads; no public financial/admin read or write API.
- Normalize contacts on the server; parameterize SQL; store fixed rewards as
  integer cents. REAL columns are compatibility projections only.
- Any fully paid invoice qualifies, regardless of service/tax line items. First
  claim owns attribution for 30 shop-local calendar dates, claim date = day 1;
  use the latest allocated Payment.TxnDate. Later claims do not reset it.
  Credit once per customer. No partner login or transfers; one shop/QBO company.
  The user owns QBO access and security/release approval. See requirements for
  accepted accounting-date semantics and remaining live integration gates.
- No provider credentials, personal data, callback queries, or request bodies in
  source, logs, browser storage, error messages, or test fixtures.
- QBO notifications are hints, never proof of payment. Read current records;
  bind every operation to the authorized company/environment and deduplicate effects.
- Financial profile FIN-01 through FIN-10 and release gates in
  [INIT.profiles/quickbooks.md](INIT.profiles/quickbooks.md) apply.
  The user authorized sandbox OAuth, renewal and webhook implementation; see
  docs/SANDBOX.md for engineering defaults and docs/QUICKBOOKS_SETUP.md for setup.
  Keep production blocked. Sandbox implementation/tests do not close production
  decision gates or establish provider-contract/independent review evidence.
- Use README commands and focused tests. Record unexecuted cloud/provider checks.
- No deployment, paid resources, Git initialization, staging, commits, or pushes
  without authorization. No Git repository existed at initial inspection.
