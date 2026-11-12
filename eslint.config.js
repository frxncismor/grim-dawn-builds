// @ts-check
// T-067: the web app and its ESLint configuration live in `apps/web`. This root
// shim keeps `pnpm --filter @gd/domain lint` (and any root tooling that resolves
// a flat config upward from a workspace package) using the same rules, with a
// single source of truth and no duplicated rule definitions.
module.exports = require('./apps/web/eslint.config.js');
