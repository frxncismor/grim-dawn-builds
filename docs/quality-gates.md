# Quality gates

**English** · [Español](quality-gates.es.md)

This matrix is derived from `scripts/verify-local.mjs` (the order of the local
steps) and `.github/workflows/ci.yml` (the pull-request job `verify`); it does
not replace either file, which remain the source of truth.

| Gate | Command | Local (`pnpm verify`) | CI (PR) | Blocking | Owner task |
|---|---|---|---|---|---|
| Scope guard | `pnpm run check:scope` | yes | yes | yes | T-046 |
| Monorepo boundaries | `pnpm run check:boundaries` | yes | yes | yes | T-052 |
| Tracked secrets | `pnpm run check:secrets` | yes | yes | yes | T-066a |
| CI workflow secrets (local command) | `pnpm run check:ci-secrets` | yes | no | no | T-086 |
| Domain build | `pnpm --filter @gd/domain build` | yes | yes | yes | T-051 |
| Domain typecheck | `pnpm --filter @gd/domain typecheck` | yes | yes | yes | T-051 |
| Domain lint | `pnpm --filter @gd/domain lint` | yes | yes | yes | T-051 |
| Domain unit tests | `pnpm --filter @gd/domain test` | yes | yes | yes | T-051 |
| API typecheck | `pnpm --filter @gd/api typecheck` | yes | yes | yes | T-053 |
| API lint | `pnpm --filter @gd/api lint` | yes | yes | yes | T-053 |
| API tests | `pnpm --filter @gd/api test` | yes | yes | yes | T-053 |
| Credential rotation test | `pnpm test:rotation` | yes | no | no | T-082 |
| Web lint | `pnpm lint` | yes | yes | yes | T-002 |
| Markdown lint | `pnpm lint:md` | yes | yes | yes | T-123 |
| Format check | `pnpm format:check` | yes | yes | yes | T-002 |
| Web unit tests | `pnpm test` | yes | yes | yes | T-002 |
| Script tests | `pnpm test:scripts` | yes | yes | yes | T-004 |
| Content validation (repository content) | `pnpm run content:validate -- --dir content` | yes | yes | yes | T-009 |
| Catalog check | `pnpm run catalog:check` | yes | yes | yes | T-016 |
| Locale parity | `pnpm run check:locale-parity` | yes | yes | yes | T-138 |
| Assets manifest | `pnpm assets:check` | yes | yes | yes | T-047 |
| Contrast | `pnpm check:contrast` | yes | no | no | T-135 |
| Web build | `pnpm build` | yes | yes | yes | T-001 |
| Public artifact guard | `pnpm check:public-build` | yes | no | no | T-084 |
| Performance budgets | `pnpm check:performance` | yes | yes | yes | T-042 |
| Dependency install (frozen lockfile) | `pnpm install --frozen-lockfile` | no | yes | yes | T-064 |
| CI workflow secrets (CI command) | `pnpm exec tsx scripts/check-ci-secrets.mts` | no | yes | yes | T-086 |
| gitleaks install (pinned, SHA-256 checked) | `curl -sSfL …gitleaks_8.30.1_linux_x64.tar.gz; sha256sum --check --strict; tar -xzf` | no | yes | yes | T-083 |
| Secret scan (PR commit range) | `gitleaks git --redact --exit-code 1 --config .gitleaks.toml --log-opts="$BASE_SHA..$HEAD_SHA" .` | no | yes | yes | T-083 |
| PostgreSQL fixture image (pinned digest) | `docker pull <image pinned by digest in infra/docker/compose.yaml>` | no | yes | yes | T-065 |
| Compose configuration | `docker compose --env-file infra/docker/.env.example -f infra/docker/compose.yaml config --quiet` | no | yes | yes | T-065 |
| API image build (no push) | `docker build --file apps/api/Dockerfile --tag gd-api:ci .` | no | yes | yes | T-065 |
| API image runs as non-root | `test "$(docker run --rm gd-api:ci id -u)" != "0"` | no | yes | yes | T-065 |
| Content validation (fixture) | `pnpm run content:validate -- --dir scripts/fixtures/content-valid` | no | yes | yes | T-064 |
| Drafts artifact build (isolated) | `pnpm exec ng build --output-path dist/e2e-drafts` | no | yes | yes | T-126 |
| Playwright Chromium install | `pnpm exec playwright install --with-deps chromium` | no | yes | yes | T-126 |
| E2E journeys | `pnpm run e2e:journeys` | no | yes | yes | T-040 |
| Accessibility gate (axe) | `pnpm run e2e:a11y` | no | yes | yes | T-041 |
| Artifact source report | `test ! -f dist/build-info.json; echo "CONTENT_SOURCE=…"` | no | yes | yes | T-126 |

`pnpm verify` runs 25 steps in order and stops at the first failure, so later
steps do not report while an earlier gate is red. The `verify` job in CI runs 35
`run:` commands: the same 21 controls as the local run, except `pnpm verify` in
itself, plus 14 commands that only exist in the workflow (dependency install,
the gitleaks toolchain, the pinned PostgreSQL image, the container checks, the
fixture validation, the drafts artifact, the Playwright install, the E2E and axe
suites and the artifact source report). The CI workflow secret check appears
twice because both runners invoke the same script through different commands.

## Document language policy

- **Rule.** Public docs are English primary, with a Spanish counterpart named
  `*.es.md`.
- **Current coverage.** `README.md`, `CONTRIBUTING.md` and this
  `docs/quality-gates.md` ship both languages. Still Spanish-only, pending
  translation in T-158: `docs/orchestration/*.md` (`herdr`, `hierarchy`,
  `modelos`, `remote-access`); the docs under `docs/content/` are also
  Spanish-only.
- **Internal SDD artifacts** (`specs/**`, `handoff.md`, `plan.md`, `tasks.md`):
  Spanish only, as the constitution allows; no parity required.
- **What the automation checks.** `pnpm check:locale-parity` compares the Angular
  i18n catalogs (`src/locale/messages.en.xlf` and `messages.es.xlf`). It does not
  check Markdown, so the `*.es.md` rule is not enforced by any gate today.
- **Translation debt.** Bringing the stable public docs to both languages is
  tracked in T-158 (no date). Until then, a new public doc either ships both
  languages or records the debt in its task.
