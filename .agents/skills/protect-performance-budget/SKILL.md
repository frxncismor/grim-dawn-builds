---
name: protect-performance-budget
description: Measure and protect the initial-JS and Lighthouse budgets before and after a change. Use when asked to "optimize the bundle", "check performance", "Lighthouse is failing" or when a change touches routing, bootstrap or shared UI.
---

# Protect the performance budget

Budgets live in `angular.json` (bundle budgets) and `lighthouserc.json` (Lighthouse assertions).
`scripts/check-performance.mts` reads `lighthouserc.json` as the single source.

## Steps

1. **Baseline** on the base branch or before your change: `pnpm build`, `pnpm check:initial-js` and
   `pnpm check:performance`. Keep the numbers: initial JS bytes, LCP, TBT, CLS and the scores.
2. Make the change in your worktree.
3. **After**: run the same three commands again. Report a table with columns metric, before, after, budget and
   delta.
4. If any metric gets worse or breaks the budget, find the cause (for example a new import in the initial
   chunk, or hydration of a static page) and fix it.

## Done when

All budgets pass, and the before/after table is in the report.

## Never

- Raise a budget or loosen an assertion to make a check pass. That needs an SDD task approved by the user.
- Measure only one locale when the change affects both: Lighthouse covers `/` and `/es` routes.
