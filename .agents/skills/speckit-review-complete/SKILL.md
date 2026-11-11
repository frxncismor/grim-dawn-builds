---
name: speckit-review-complete
description: Run the four evidence-based review passes after a Spec Kit implementation is ready to close, then evaluate the current completion report. Use only as the post-implementation spec gate.
---

# Spec completion review

Use this coordinator only after the implementation agent reports its work. Read
`AGENTS.md`, the constitution, `CONTRIBUTING.md`, the active feature's spec,
plan, tasks, research, data model, and relevant product contracts. Also read the
canonical report schema at
[`specs/002-spec-completion-reviews/data-model.md`](../../../specs/002-spec-completion-reviews/data-model.md)
and CLI/coordination contract at
[`specs/002-spec-completion-reviews/contracts/review-gate.md`](../../../specs/002-spec-completion-reviews/contracts/review-gate.md)
for every feature. The active feature's data model may describe product-domain
entities and need not define review evidence. Do not edit application
files, alter implementation task markers, commit, publish, or treat this
coordination as permission for those actions.

## Prepare before dispatch

From the repository root, run:

```text
node scripts/spec-review.mjs prepare --feature specs/<feature>
```

Do not dispatch reviewers unless the command exits 0 and its JSON status is
`ready`. For `pending-tasks`, report the pending task IDs and stop without
dispatching or creating a success report. For `invalid`, report the reason and
stop. If the helper or command cannot be run, state that the gate was not
executed; do not substitute a manual claim of readiness.

## Execute four actual passes

Use the prepared snapshot and pass the complete relevant context: shared rules,
constitution, contribution guidance, feature spec/plan/tasks/contracts, actual
changes, and each reviewer skill. Do not include expected findings or a desired
decision in reviewer instructions.

Run exactly one pass for each specialty: `code`, `architecture`, `security`, and
`best-practices`. When the harness supports subagents, request an independent
reviewer distinct from the implementation actor and wait for the actual result
of all four passes. The passes may be assigned to one independent reviewer if
the harness preserves four separate specialty results. If subagents are not
available, perform four separate self-review passes and record the real
capability limitation; do not claim independence. If a pass cannot be executed,
record `not-run` rather than manufacturing a result. A command announcement,
empty response, incomplete output, or synthetic test fixture is not a completed
review.

Each reviewer returns the `Review` object defined in the canonical shared
`specs/002-spec-completion-reviews/data-model.md` and
`specs/002-spec-completion-reviews/contracts/review-gate.md`, not in the active
feature's product data model. Preserve the actual reviewer identity, mode,
coverage, checks, limitations, and findings. Never invent a reviewer identity,
check, finding, or pass result. Sanitize evidence and redact secret values.

## Consolidate and evaluate

Only after collecting the four real results, write the `CompletionReview` JSON
to `specs/<feature>/reviews/completion-review.json`. Use the exact prepared
snapshot, actual UTC time, actual implementation actor, and actual delegation
capability. The file is review evidence, not a generated model judgment. If any
result is unavailable, preserve `not-run` and expect the gate to remain pending.

Then run:

```text
node scripts/spec-review.mjs check --feature specs/<feature>
```

Report the returned status, link the JSON report, summarize each specialty,
independence or self-review limitation, open severities, checks, and review
limits. Only `passed` permits the agent to report the spec's review gate as
passed. `blocked`, `pending-review`, or `invalid` must be reported as such. A
later eligible file change requires fresh reviews. A finding that needs a code
change returns to SDD planning and implementation; reviewers do not fix it or
mark tasks.

## Harness fallback

The local Spec Kit hook is registered as `speckit.review.complete`. If the
harness actually routes that command, invoke it and wait. If no command router
exists, load this `SKILL.md` explicitly and follow the same flow, reporting the
fallback. A hook entry or `EXECUTE_COMMAND` announcement alone is not proof of
dispatch. If the harness cannot invoke this skill, run the gate explicitly when
possible; otherwise leave closure pending and state the unsupported capability.
