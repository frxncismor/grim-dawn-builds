---
name: review-best-practices
description: Review changed implementation for proportionate maintainability, accessibility, performance, documentation, and verification quality. Use where those concerns apply; avoid style-only findings and unrelated refactors.
---

# Best-practices review

Read `AGENTS.md`, the project constitution, `CONTRIBUTING.md`, and the active
feature's spec, plan, tasks, and relevant contracts. Focus on the actual change
and the quality requirements that apply to it.

Look for concrete maintenance risks, harmful duplication, disproportionate
complexity, applicable accessibility or performance regressions, missing
required documentation, and verification that does not cover the acceptance
criteria. Apply SOLID or other design guidance proportionally; do not create
findings for taste, naming preferences, or hypothetical refactors. Do not change
application files or mark tasks. Run only safe, relevant local checks that are
available and record actual results. State limitations instead of implying an
unrun check passed.

Return one JSON `Review` object for specialty `best-practices` using the canonical
shared schema and contract at
[`specs/002-spec-completion-reviews/data-model.md`](../../../specs/002-spec-completion-reviews/data-model.md)
and
[`specs/002-spec-completion-reviews/contracts/review-gate.md`](../../../specs/002-spec-completion-reviews/contracts/review-gate.md),
regardless of which feature is under review. The active feature's own data model
and contracts provide product context; do not assume they define review reports.
Include the actual reviewer identity, coordinator-supplied mode, status,
non-empty coverage, checks, limitations, and findings. Findings need a stable ID, allowed severity,
repository-relative path, positive line, concise evidence, impact,
recommendation, and valid disposition. A resolved finding must cite a verified
SDD correction; only MEDIUM/LOW findings may be deferred with a reason. A clean
review describes its coverage and any limits. Never copy secret values into the
report.
