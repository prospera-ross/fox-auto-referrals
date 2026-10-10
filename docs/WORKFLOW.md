# Working in this project

## Start or plan the day

Read AGENTS.md and STATUS.md; reuse context already read. Check `git status --short`
only if Git is initialized. Consult README for commands and requirements for
the selected behavior. Present current evidence, pending work and at most three
next steps; ask for a choice only when no task has already been selected.

## Resume local work

Inspect relevant files and diffs before editing; preserve existing work without
guessing authorship. Git is initialized: inspect `git status --short` and relevant
staged and unstaged diffs; use STATUS.md to clarify intent. Separate completed
code, partial scaffolding and actual test evidence. Ask only if alternatives
would materially change behavior; continue independent authorized work.

## Execute a concrete task

Follow the selected task directly. For financial boundaries, consult the D01-D08
register and applicable FIN/ASVS controls before implementation. Unresolved rules
must not become silent policy. Use synthetic contacts and financial fixtures.
Never request provider credentials in chat. Keep secrets outside logs and artifacts.

Select validation by reach: docs -> paths/links/content; claim/UI -> unit tests
and relevant browser flow; schema -> SQLite tests plus local D1; financial ->
mapped fault tests, sandbox contracts, manual review and independent evidence as
required. README is the canonical command reference. Local tests do not satisfy
provider behavior or deployed infrastructure checks.

## Close the day

Complete outstanding proportional checks, review files/diffs when available and
replace obsolete STATUS.md content (maximum 80 lines). Record what is implemented,
what was executed, remaining gaps and next action. Change permanent docs only when
their facts changed; keep historical details out of AGENTS.md. Evaluate the commit
checkpoint policy below and suggest any ready commits.

## Proactively suggest commit checkpoints

Evaluate commit readiness after completing a coherent unit of work, before moving
to a different objective or a broad/risky refactor, and when preparing a handoff.
Do this without waiting for the user to ask or the session to end. Use meaningful
boundaries, not elapsed time, file counts, or a suggestion after every small edit.

A good checkpoint is a self-contained feature slice, bug fix, refactor, or
documentation/configuration update that can be reviewed and reverted as one unit.
Before recommending it:

1. inspect Git status, relevant staged and unstaged diffs, and intended untracked
   files; identify the exact files or hunks belonging to the proposed commit;
2. confirm that this unit is complete, includes its necessary tests/documentation,
   and has passed the applicable checks; for documentation-only changes, review
   consistency, links, and formatting instead of running application tests;
3. exclude unrelated or pre-existing work outside the authorized scope, secrets,
   and temporary artifacts; if several independent units are ready, suggest
   separate commits and their order without changing the index.

Give one concise recommendation with why this is a useful checkpoint, its scope,
a proposed commit message following repository conventions, and validation results
or limits. For example: "This fix is complete and its regression test passes.
Suggested commit: `<message>`. Scope: `<files or hunks>`."

If required checks failed or are unavailable, or the unit is incomplete, state
what remains before it is ready instead of presenting it as validated. A clean
working tree needs no suggestion. If Git is unavailable, report that limit without
initializing a repository. Commit readiness does not imply release readiness.

Suggest once per meaningful checkpoint; if the user defers or ignores it, continue
authorized work without repeating the same suggestion until scope or readiness
materially changes. The recommendation is not a blocking approval step. Run
`git add`, `git commit`, or `git push` only when authorized by the user, honoring
authorization already given and its scope; commit permission alone is not push
permission.

## Delivery

Report changed behavior, tests, and material limits. Deployment and activation are
separate authorized steps under OPERATIONS.md and gates G01-G08 in the
[QuickBooks profile](../INIT.profiles/quickbooks.md). Do not
label a partial OAuth scaffold or a passing checklist production-ready. Publishing,
paid resources and live QBO operations require their own authorized scope.
