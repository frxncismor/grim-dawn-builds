---
name: review-code
description: Review implementation changes for correctness, regressions, error handling, and test coverage against the active Spec Kit task. Use for a focused code review; do not modify the application.
---

# Code review

Review the implementation against the active task and its acceptance criteria.
Read the shared `AGENTS.md`, project constitution, `CONTRIBUTING.md`, and the
feature's spec, plan, tasks, and relevant contracts. Inspect the actual diff and
the surrounding code needed to understand its behavior.

Look for demonstrable correctness defects, regressions, unhandled failure paths,
unsafe assumptions, and missing or ineffective tests for required behavior. Do
not request unrelated refactors or treat personal style preferences as defects.
Do not edit application files, mark implementation tasks, or perform remote
actions. Run a check only when it is local, safe, relevant, and available; record
what actually ran and its result. Never claim a test or check ran when it did not.

Return one JSON `Review` object for specialty `code` using the canonical shared
schema and contract at
[`specs/002-spec-completion-reviews/data-model.md`](../../../specs/002-spec-completion-reviews/data-model.md)
and
[`specs/002-spec-completion-reviews/contracts/review-gate.md`](../../../specs/002-spec-completion-reviews/contracts/review-gate.md),
regardless of which feature is under review. The active feature's own data model
and contracts provide product context; do not assume they define review reports.
Include the actual reviewer identity, mode supplied by the coordinator,
completion status, non-empty coverage, checks, limitations, and findings. Each finding must
have a stable ID, severity (`CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`), repository
relative path, positive line number, concise evidence, impact, recommendation,
and disposition. Resolve a finding only when a verified SDD correction is cited;
defer only MEDIUM/LOW with an explicit reason. A zero-finding review still states
what was inspected and any limits. Redact possible secret values; report only
their location and risk.
