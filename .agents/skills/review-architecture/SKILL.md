---
name: review-architecture
description: Review a feature's architectural boundaries, source of truth, rendering, scope, and dependency choices against its approved Spec Kit design. Use for architectural review without redesigning the feature.
---

# Architecture review

Read `AGENTS.md`, the project constitution, `CONTRIBUTING.md`, and the active
feature's spec, plan, tasks, and relevant contracts. Compare the actual changes
with the approved design and the existing repository boundaries.

Check only applicable concerns: separation among web, API, and domain; the
declared source of truth; SSR/prerender requirements; scope and task boundaries;
dependency choices; and consistency with existing interfaces. Identify a
concrete broken boundary, contradiction, unplanned dependency, or material
maintenance risk. Do not propose a broad redesign or expand the feature to
address preferences. Do not modify application files, implementation tasks, or
perform remote actions. Record only checks actually performed.

Return one JSON `Review` object for specialty `architecture` using the canonical
shared schema and contract at
[`specs/002-spec-completion-reviews/data-model.md`](../../../specs/002-spec-completion-reviews/data-model.md)
and
[`specs/002-spec-completion-reviews/contracts/review-gate.md`](../../../specs/002-spec-completion-reviews/contracts/review-gate.md),
regardless of which feature is under review. The active feature's own data model
and contracts provide product context; do not assume they define review reports.
Report actual reviewer identity, coordinator-supplied mode, status, non-empty
coverage, checks, limitations, and findings. Findings need a stable ID, allowed severity, a
repository-relative path and positive line, evidence, impact, recommendation,
and a valid disposition. A resolved finding must cite a verified SDD correction;
only MEDIUM/LOW may be deferred, with a reason. Zero findings are valid when the
review describes the design areas inspected and any limits. Do not include
secret values in evidence.
