---
name: close-spec-task
description: Close a Spec Kit task (T-xxx) with reproducible evidence, keeping tasks.md as the single source of truth and the handoff in sync. Use when asked to "close T-xxx", "mark the task done", "record evidence" or "write the handoff".
---

# Close a spec task

Read `AGENTS.md`, `CONTRIBUTING.md`, and the task line in `specs/001-mvp-guias-builds/tasks.md`, including its
acceptance criteria and dependencies.

## Steps

1. Check that every dependency named in the task is `[x]`. If one is not, stop and report it.
2. Run the verification each acceptance criterion names, and keep the real command and output. Classify each
   piece of evidence as `local`, `CI` or `release`.
3. If any criterion needs `CI` or `release` evidence that does not exist yet, do **not** mark `[x]`. Append
   `— pending: <what is missing>` to the task line instead.
4. When everything passes, change `- [ ]` to `- [x]` and append a short `Verified:` note with the commands and
   result counts (for example "check-scope 30/30, lint:md 0 issues").
5. Mark the same item in the Over9k To-do (`todo done <n>`).
6. Update the handoff inventory with the counting commands in the consultancy's S02 brief; never edit the
   counts by hand.
7. Run `pnpm lint:md`, then commit with `git commit -F <file>`:
   `docs(spec001): close T-xxx with evidence (T-xxx)`.

## Done when

The task line states real evidence by type, `lint:md` passes, and the handoff counts match `tasks.md`.

## Never

- Treat a dispatch announcement or "it's green" as evidence.
- Close a task whose evidence is only local when its criterion says CI.
