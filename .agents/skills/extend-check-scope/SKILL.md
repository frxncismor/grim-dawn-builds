---
name: extend-check-scope
description: Turn a scope rule ("never X in this project") into a tested check-scope guard. Use when asked to "forbid X", "extend check-scope", "make sure nobody adds Y", or when a task adds a new out-of-scope category.
---

# Extend check-scope

The guard is `scripts/check-scope.mts`, and its tests are in `scripts/check-scope.test.mts`. Earlier examples:
T-046 (scrapers, comments and calculator routes) and T-104/T-113 (auth, registration and public editing).

## Steps (TDD)

1. Write the rule in one sentence, including what must **fail** and what must still **pass**. Near-misses must
   pass too (for example, `comments` in a code comment is not a comments feature).
2. In `scripts/check-scope.test.mts`, add one failing fixture and one passing near-miss fixture, following the
   style of the existing cases.
3. Run `node --import tsx --test scripts/check-scope.test.mts`. The new failing-case test **must fail** first;
   keep that output.
4. Implement the smallest rule in `scripts/check-scope.mts`.
5. Run the test again (green) and then `pnpm check:scope` over the real repo. It must pass with no false
   positive. Keep both outputs.

## Done when

Red, then green, is shown; `pnpm check:scope` passes on the repo; and the task line cites the new test names.

## Never

- Add a rule without a passing near-miss test.
- Exclude real files to silence a false positive. Fix the rule instead.
