---
name: review-security
description: Review changed code and design for security boundary, validation, authorization, rights, and secret-handling risks. Use for a scoped local security review; it does not replace DAST or an audit.
---

# Security review

Read `AGENTS.md`, the project constitution (especially the rights and secret
principles), `CONTRIBUTING.md`, and the active feature's spec, plan, tasks, and
contracts. Inspect the actual changes and relevant trust boundaries.

Assess applicable input validation, authorization and role boundaries, public
content and rights gates, secret handling, and deployment controls. Report only
risks supported by code or configuration evidence. Never make network requests,
run destructive or exploitative tests, expose a secret value, or copy it into
commands, logs, or the report. Identify a possible secret by repository-relative
location and risk, with its value redacted. Do not change files or implementation
tasks. Run only safe, local checks that are relevant and available, recording
their actual outcomes.

Return one JSON `Review` object for specialty `security` using the canonical
shared schema and contract at
[`specs/002-spec-completion-reviews/data-model.md`](../../../specs/002-spec-completion-reviews/data-model.md)
and
[`specs/002-spec-completion-reviews/contracts/review-gate.md`](../../../specs/002-spec-completion-reviews/contracts/review-gate.md),
regardless of which feature is under review. The active feature's own data model
and contracts provide product context; do not assume they define review reports.
Include actual reviewer identity, coordinator-supplied mode, status, non-empty
coverage, checks, limitations, and findings. Every finding needs a stable ID, allowed
severity, repository-relative path, positive line, sanitized evidence, impact,
recommendation, and valid disposition. A resolved finding cites a verified SDD
correction; only MEDIUM/LOW may be deferred with a reason. Explicitly list DAST,
dependency audit, or other security checks as limitations when they were not
performed; this review must not imply they were.
