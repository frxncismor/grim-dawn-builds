---
name: verify-before-pr
description: Run the full local gate on a worktree before integrating or opening a PR, and produce a citable summary. Use when asked to "verify everything", "prepare the PR", "is this ready to merge" or before integrating an agent worktree.
---

# Verify before PR

## Steps

1. Run `git status --short` and `git diff --stat <base>...HEAD` in the worktree. Every changed file must belong
   to the active task's file list in `tasks.md`; list any extra file as scope drift.
2. Run `pnpm verify` (it runs `scripts/verify-local.mjs`). It is long, so start it in the background
   (`hc run --bg --name verify ...`) and wait with `hc wait verify`; do not poll.
3. If the change touches docs, also run `pnpm lint:md`. If it touches scope rules, run `pnpm check:scope`.
4. On failure, report the first failing step with its output tail (last 40 lines). Do not retry blindly.
5. On success, write the summary for the PR body:

   ```text
   Task: T-xxx
   Gate: pnpm verify -> <N steps passed>, <duration>
   Extra: <lint:md / check:scope results>
   Scope: <files>, no drift
   ```

## Done when

`pnpm verify` passes in the same worktree that will be integrated, and the summary quotes real output.

## Never

- Use `--no-verify`, skip a failing step or weaken a gate.
- Push or open a PR without the principal's permission.
