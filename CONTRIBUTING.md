# How to contribute

**English** · [Español](CONTRIBUTING.es.md)

This guide describes how to propose changes to Grim Dawn Builds: branches, local
environment, verification commands, content rules and a checklist for pull
requests. It applies to people and to implementation agents.

If anything in this guide contradicts the constitution or the SDD
specifications, [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
and [`specs/001-mvp-guias-builds/`](specs/001-mvp-guias-builds/) prevail.

## Before you start

Every agent, subagent or harness working on the project must follow **SDD with
GitHub Spec Kit**, regardless of the provider or model. Read the
[shared instructions](AGENTS.md) and pass them on to any delegated agent.
Resume already planned tasks; new scope requires a spec, the necessary
clarifications, a plan, tasks and analysis before implementation, through the
Spec Kit commands and templates. If they are not available, locate the
installation before starting that phase. This includes changes to documentation,
configuration and infrastructure.

Claude Code loads `CLAUDE.md`, which points to these same rules and to the user's methodology, and forbids delegating with its internal tools.

1. Read the [constitution](.specify/memory/constitution.md), the
   [specification](specs/001-mvp-guias-builds/spec.md), the
   [plan](specs/001-mvp-guias-builds/plan.md) and the
   [tasks](specs/001-mvp-guias-builds/tasks.md) of the feature you are going to
   touch.
2. Work on **one task at a time**, respecting the order and dependencies of
   `tasks.md`. Tasks marked `[UI]` follow their own interface flow.
3. Mark a task as `[x]` in `tasks.md` only when its checks pass.
4. If the specification or the plan are ambiguous or contradict each other, ask
   before implementing. Do not change the specification to make the code fit.

### Review gate at closure

When you complete the implementation tasks of a spec, run and wait for the
four reviews described in [spec002](specs/002-spec-completion-reviews/), using
the [coordinator](.agents/skills/speckit-review-complete/SKILL.md). Only
declare the spec complete if the real, current and complete report passes the
gate. The local hook may not be dispatched by a harness without a router: in that
case load the skill explicitly; if the harness cannot run the reviews either,
report that closure is still pending. Pass the rules of `AGENTS.md` and the SDD
context on when delegating; an invocation announcement does not prove that the
reviews happened.

## Branch flow (GitFlow)

| Branch      | Purpose                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| `main`      | Stable versions. Only receives release pull requests from `develop`.                                                      |
| `develop`   | Integration of the next version. Receives pull requests from `mvp/1`.                                                     |
| `mvp/1`     | MVP integration branch. After each completed Spec Kit specification, one or more commits are recorded here.               |
| `feature/*` | Work on a task or feature. Integrated into `mvp/1` through a pull request.                                                |
| `release/*` | Preparation of a version. Integrated into `mvp/1` through a pull request, like the rest of the work branches.             |
| `hotfix/*`  | Urgent fix. Integrated into `mvp/1` through a pull request and then follows the same path (`mvp/1` → `develop` → `main`). |

### Path of a change

1. Create the work branch from `mvp/1`.
2. Implement the change with clear commits and open a pull request towards
   `mvp/1`.
3. When a Spec Kit specification is complete, its closing commits go into
   `mvp/1`.
4. Open a pull request from `mvp/1` to `develop`.
5. When `develop` is ready to be published, open a release pull request from
   `develop` to `main`.

### Branch names

- `feature/<id-tarea>-<resumen>`, in lowercase and with hyphens. Example:
  `feature/t-076-politica-de-ramas`.
- `release/<versión>`. The versioning scheme is not yet defined in the
  repository; do not invent one in a release branch.
- `hotfix/<resumen>`, in lowercase and with hyphens.
- Do not use spaces, uppercase letters or special characters in the names.

### Integration rules

- **Do not push or merge directly** into `main`, `develop` or `mvp/1`. Every
  change arrives through a pull request.
- Do not reuse an already merged branch for new work; create a new branch.
- Planning agents do not create branches, commits or pull requests, and do not
  push. Those actions are carried out by a person or an implementation agent
  with explicit authorization.

### Manual configuration in GitHub

The following controls are **not** versioned in the repository. The maintainer
configures them in the GitHub repository settings and this repository does not
verify them automatically:

- **Branch protection** (`main`, `develop`, `mvp/1`): require a pull request
  before merging and block direct pushes.
- **Mandatory CI check**: mark the `Verify pull request` job defined in
  [`.github/workflows/ci.yml`](.github/workflows/ci.yml) as required.
- **Mandatory Copilot review**: branch rule that requires Copilot review before
  merging.
- **Secret scanning and push protection**: enable them in the repository
  security settings.

Until the maintainer configures them, these controls are pending.

## Local environment

Requirements:

- Node.js 22. CI uses version 22.23.5.
- pnpm 12.18.0, the version pinned in the `packageManager` field of
  [`package.json`](package.json). Enable it with Corepack:

  ```bash
  corepack enable
  corepack pnpm --version
  ```

Installation and start:

```bash
pnpm install --frozen-lockfile
pnpm setup:gitleaks
pnpm setup:hooks
pnpm start
```

Open `http://localhost:4200/`. Use `--frozen-lockfile` as CI does so you do not
modify `pnpm-lock.yaml` by accident.

`setup:gitleaks` installs Gitleaks 8.30.1 only in `.tools/gitleaks/8.30.1/`
(ignored), for Windows/Linux x64. It downloads the pinned official asset and
verifies the SHA-256 before extracting/running; it does not change the global
PATH. Other environments need that native version on PATH. `setup:hooks`
enables `.githooks` only in this clone. The hook requires the exact version,
scans staging with redaction and blocks if the tool is missing. Local
verification requires it too: detection tests are not silently skipped.

### Local API with PostgreSQL

Prepare the ignored local files and start PostgreSQL and the API:

```bash
pnpm setup:env
docker compose -f infra/docker/compose.yaml up -d --wait
```

On a new volume, PostgreSQL creates the roles without login and enables only
`migrator` and `api_ro` from their secret files before running the migration.
`importer` and `editor` stay `NOLOGIN` until their tasks. `migrate` receives only
the `migrator` credential; the API only `api_ro`; the superuser secret is
delivered only to the `db` container.

If the PostgreSQL volume already exists and you changed the local credentials,
re-provision both roles without deleting data or recreating the volume:

```bash
pnpm exec tsx infra/docker/init/provision-roles.mts
```

The provisioner is idempotent and does not print passwords. The API reads only
the public views; it does not receive migration or superuser credentials.

## Continuing the work on another machine

The repository is self-contained, but the orchestration that drives the agents is
not: it lives in `~/.config/orquestacion` **on each machine** (`METODOLOGIA.md`, the
`Start-*` launchers, `Orq-Worktree.ps1` and `proveedores.local.json` with that
machine's model levels). Cloning this repository does not clone it.

1. Install Node.js 22 (`.nvmrc` pins 22.23.5), pnpm 12.18.0 through Corepack,
   Docker with Compose (API and PostgreSQL) and Chrome or Edge (`CHROME_PATH`) for
   the Lighthouse gate.
2. `git clone` the repository and run `pnpm install --frozen-lockfile`, then
   `pnpm setup:gitleaks` and `pnpm setup:hooks`, which the local commits need.
3. Copy `.env.example` to `.env` and fill the local values. The file is ignored and
   no secret ever goes into the repository.
4. Run `pnpm verify` to confirm the machine reproduces every gate; if it fails, fix
   the first failing step before touching any task (see
   [Verification commands](#verification-commands)).
5. Authenticate GitHub CLI (`gh auth login`) if you are going to open or label pull
   requests.
6. Install the user-level orchestration on that machine (see
   `~/.config/orquestacion/README.md`) and launch the agents from there: `AGENTS.md`,
   `CLAUDE.md` and `.github/copilot-instructions.md` only point to it.

The heavy setup is the same as in [Local environment](#local-environment); this
section only adds what changes on a different machine.

## Verification commands

`pnpm verify` runs the local checks in this order and stops at the first one that
fails: `check:scope`, `check:boundaries`, `check:secrets`, typecheck, lint and
tests of the `@gd/domain` package, `lint`, `lint:md`, `format:check`, `test`,
`test:scripts`, `assets:check` and `build`.

| Command                                    | What it checks                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `pnpm verify`                              | All the local checks above. Run it before opening a PR.                                                 |
| `pnpm test`                                | Unit tests of the web (Angular).                                                                        |
| `pnpm test:scripts`                        | Tests of the verification scripts.                                                                      |
| `pnpm --filter @gd/domain test`            | Tests of the `packages/domain` domain package.                                                          |
| `pnpm --filter @gd/domain typecheck`       | Types of the domain package.                                                                            |
| `pnpm --filter @gd/domain lint`            | Lint of the domain package.                                                                             |
| `pnpm lint`                                | ESLint of the web application.                                                                          |
| `pnpm lint:md`                             | markdownlint over all tracked Markdown. Check only.                                                     |
| `pnpm lint:md:fix`                         | Applies markdownlint's safe automatic fixes. Review `git diff` afterwards and run `pnpm lint:md` again. |
| `pnpm format:check`                        | Prettier over the files included in the script.                                                         |
| `pnpm format`                              | Prettier with writes. Review the diff before committing.                                                |
| `pnpm content:validate -- --dir <carpeta>` | Validates a set of content with the domain schema.                                                      |
| `pnpm assets:check`                        | Validates the official assets manifest.                                                                 |
| `pnpm check:scope`                         | Scope prohibitions (e.g. Redis, queues, external auth, storage).                                        |
| `pnpm check:boundaries`                    | Boundaries between web, API and domain.                                                                 |
| `pnpm check:secrets`                       | Secrets and credential patterns in files tracked by git.                                                |
| `pnpm build`                               | Build of the web.                                                                                       |

During development, run the narrowest command that covers your change (for
example, `pnpm test` or `pnpm lint:md`) and leave `pnpm verify` for before the
pull request.

The pull request CI runs the same checks, except `pnpm verify` itself. It also
runs `pnpm content:validate -- --dir scripts/fixtures/content-valid`, which
validates only the fixture, because `content/builds` does not have content yet
(T-014). CI runs `lint:md` only in check mode; it never applies `--fix`.

Gate matrix and language policy: see [docs/quality-gates.md](docs/quality-gates.md).

## PostgreSQL logs in Docker

From the root, query the latest errors and follow new events:

```bash
docker compose -f infra/docker/compose.yaml logs --tail=100 --timestamps -f db
docker compose -f infra/docker/compose.yaml logs --since=30m db
```

Every server message includes the UTC date, PID, SQLSTATE code, user, database,
application, client and session identifier. Connections and disconnections, lock
waits longer than `deadlock_timeout` (1 s by default), checkpoints and errors are
logged. Brief `pg_isready` connections also appear: they come from the
healthcheck. To correlate migrator failures, look for `app=gd-api-migrate`; the
readiness check uses `app=gd-api-ready`.

Logs go to stderr, also visible in Docker Desktop. The `local` driver rotates up
to three 10 MB files per container and compresses the rotated ones. Old messages
are discarded; export the interval you need before recreating the container if
you are investigating an incident.

Statement and SQL parameter dumping is not enabled. `terse` verbosity avoids
DETAIL, HINT and CONTEXT that may include row values. The main message of an
error can still contain application data: review and redact the logs before
sharing them. Do not enable traces of every query or log passwords to diagnose a
failure.

To apply configuration changes recreate only PostgreSQL, keeping its volume (do
not use `down -v`):

```bash
docker compose -f infra/docker/compose.yaml up -d --no-deps db
```

## Code quality

- **TDD where appropriate.** When the plan or `tasks.md` ask for tests before the
  code, write them first, check that they fail for the right reason and implement
  afterwards. The number of tests must be proportional to the risk
  (principle IX of the constitution).
- **Clean Code and SOLID.** They are review expectations of the project, not
  formal requirements of the constitution: functions and modules with a single
  responsibility, clear names, dependencies towards abstractions (for example,
  `ContentRepository`) and little duplication. Do not introduce refactorings or
  features that the task does not ask for.
- **Minimal scope.** Implement only what the task asks for and the files it
  lists. If the task requires touching files not listed in `tasks.md`, stop and
  ask.
- **Dependencies.** Do not add dependencies without a written justification in
  the PR (size, native alternative discarded), according to principle IV.
- **Performance.** Respect the budgets in [`plan.md`](specs/001-mvp-guias-builds/plan.md)
  (§6). Lazy-load heavy code, avoid N+1 queries and unnecessary re-renders or
  subscriptions.
- **Accessibility.** WCAG 2.2 AA (principle V): contrast, visible focus, full
  keyboard navigation, `prefers-reduced-motion` and textual alternatives for
  every interactive SVG.
- **Language.** Interface texts and content are in Spanish, through Angular's
  i18n system (principle X). Code identifiers follow the existing code
  convention.

## Secrets

Principle XII of the constitution and plan §13.

- **Never** commit secrets: not in code, Dockerfiles, image `ARG`/`ENV`,
  `package.json` scripts, `content/` fixtures, `.env.example`, frontend builds,
  logs or CI artifacts.
- Local `.env` files (except `.env.example`) and `secrets/` folders are ignored
  by git. Do not force them with `git add -f`.
- `.env.example` only contains variable names and safe default values that are
  not secrets. Secret fields are left empty.
- Local credentials are for development and are never reused in remote
  environments.
- `pnpm check:secrets` fails if git tracks `.env*`, `secrets/` files, credential
  patterns or URLs with a password. It **does not replace** GitHub secret
  scanning (manual configuration). Gitleaks complements that guard in pre-commit,
  PR CI and scheduled history (T-083), with default rules and no project
  exceptions. No local result proves that the remote workflows have already run.
- If a secret is published by mistake, treat it as compromised: rotate or revoke
  it at its provider and notify the maintainer. Deleting the commit is not
  enough. The full runbook (T-081) is pending; see plan §13.8.

## Content, rights and provenance

Principles I, II and VII of the constitution, and FR-13 to FR-15 and FR-27 to
FR-31 of the specification.

- Every guide, tier and game datum has an **author**, **source(s)**, a
  **review state** (`borrador` → `en_revision` → `publicado`), a
  **content state** (`verificado`, `sin_verificar` or `placeholder`) and a
  **rights state** (`rights_status`).
- Content with `pending` or unapproved rights is **never published**. Nor is
  anything presented as verified that is not, nor a `placeholder` as real
  content.
- **No scraping** or automatic import is done in the MVP. Imports are manual and
  editorial, with source and review.
- Texts, images or assets from third-party guides are **not copied** without
  recorded explicit permission. Permission is never assumed because something is
  public, because of silence or because of `robots.txt`.
- **Access controls are not bypassed** (login, paywalls, captchas, usage limits
  or `robots.txt` or terms that forbid it).
- An **adapted build** from third parties is only published if the source
  license or a recorded permission expressly covers the adaptation. Visible
  attribution is mandatory, but it **does not replace** permission. Without
  sufficient rights, only a link card (_link-only_) with its own factual
  metadata is possible.
- The project is not affiliated with Crate Entertainment or GrimTools. Keep the
  non-affiliation notice.
- The files in `content/` are development fixtures and import material, not a
  production source (principle VI).

## Official Grim Dawn assets

- Icons, textures and official art are only included if the assets manifest
  (`content/assets/manifest.json`) records their exact origin, owner, license or
  permission and proof, with `approved` status.
- As long as that entry does not exist, own or generic art is used: the fallback
  SVG glyphs.
- `pnpm assets:check` validates the manifest.

## Scope and boundaries

- The MVP does not add accounts, comments, calculator, Redis, queues or workers,
  external authentication providers or object storage (principle VIII).
  `pnpm check:scope` fails on these pieces.
- The monorepo boundaries are: web → `@gd/domain`, API → `@gd/domain` and
  scripts → `@gd/domain`. Web ↔ API is forbidden and the domain does not depend
  on Angular, HTTP or the database. `pnpm check:boundaries` checks it.
- Moving the application to `apps/web` is a dedicated PR; follow the order in
  [plan §12.3](specs/001-mvp-guias-builds/plan.md).

## Markdown documentation

- Every tracked Markdown file must pass `pnpm lint:md` (markdownlint, according
  to the documentation quality restrictions of the constitution).
- The configuration is in [`.markdownlint-cli2.jsonc`](.markdownlint-cli2.jsonc).
  Only disables for **MD013** (line length) and **MD060** (column style) are
  allowed, each with its written reason. Do not add one-off disables without a
  reason.
- Prettier formats the files in `format:check`. If Prettier and markdownlint
  clash on a `.md`, markdownlint prevails.

## Pull requests

Use the [`.github/pull_request_template.md`](.github/pull_request_template.md)
template and complete every point, or mark it as not applicable with a
justification.

- State the target branch: `mvp/1`, `develop` or `main`, according to the path in
  the branches section.
- Link the SDD tasks (`T-xxx`) that the PR covers.
- Describe what changes and why, and which commands you ran with their result.
- Justify any new dependency and any scope exception.
- The pull request CI must be green. The DAST and Copilot review gates are
  required according to the branch policy; see the points in the template.
- **DAST**: dynamic scanning (DAST) is pending implementation in task T-077.
  Today there is no DAST job in CI; do not assume it is covered.

## Pull request labels

Every PR carries labels: they are the minimum traceability to find it by type,
area and spec. **Without labels there is no merge**, even if CI is green.

- At least **one type label**: `documentation`, `enhancement`, `bug` or
  `accessibility`.
- At least **one area label**: `ci`, `dx` or `performance`.
- A **spec or provenance** label when applicable: `spec001` or `orquestacion`.

| Label           | When to use it                                                             |
| --------------- | -------------------------------------------------------------------------- |
| `documentation` | Documentation: `README`, `docs/`, this `CONTRIBUTING.md` or SDD artifacts. |
| `enhancement`   | New feature or product extension.                                          |
| `bug`           | Fixes a reproducible defect.                                               |
| `accessibility` | Affects or improves accessibility (WCAG, axe, keyboard, focus).            |
| `ci`            | `.github/workflows/` flows and verification gates.                         |
| `dx`            | Local environment, development scripts, tooling and skills.                |
| `performance`   | Bundle budgets, Lighthouse, LCP/CLS/TBT.                                   |
| `spec001`       | The change belongs to the spec 001 MVP.                                    |
| `orquestacion`  | Hierarchical orchestration, Herdr spaces and agents.                       |

They are applied when creating the PR or afterwards, with `gh`:

```bash
gh pr create --label "documentation,spec001"
gh pr edit <n> --add-label "documentation,ci,spec001"
```

If a PR touches several areas, several area labels are added; the spec label only
when the PR belongs to that spec.

## Related SDD documents

- [Constitution](.specify/memory/constitution.md): principles, restrictions and branch policy.
- [Specification](specs/001-mvp-guias-builds/spec.md): functional requirements and acceptance criteria.
- [Plan](specs/001-mvp-guias-builds/plan.md): architecture, budgets (§6), backend and Docker (§12), security and CI (§12.8), markdownlint (§12.14) and secrets (§13).
- [Tasks](specs/001-mvp-guias-builds/tasks.md): tasks, dependencies and order. Relevant to this process: T-064 (verification CI), T-066a (secrets), T-076 (this guide), T-077 (DAST, pending) and T-123 (markdownlint).
- [README](README.md): project overview and basic commands.
- [CI configuration](.github/workflows/ci.yml): checks that run on every pull request.

## Impeccable for sdd-ui tasks

The UI role requires the Impeccable skill. Recreate it from the root with the
pinned version (agent tool only, no web dependency):

```powershell
$env:NPM_CONFIG_CACHE = Join-Path ([IO.Path]::GetTempPath()) 'gd-impeccable-npm-cache'
$env:IMPECCABLE_HOME = Join-Path ([IO.Path]::GetTempPath()) 'gd-impeccable-runtime'
npx --yes impeccable@4.8.1 install --providers=codex --scope=project --no-hooks
```

The generated payload and its binary stay ignored exactly under
`.agents/skills/impeccable/`. No native hooks are installed and no trust is
enabled to run hooks; load SKILL.md explicitly and run its detector at the end of
the UI change. Any harness can read the same skill; Windows commands use its
`.cmd` launcher. The installation does not replace the four mandatory Spec Kit
closure reviews.

Angular lives at the root: the UI context must point to the active web file or
path, for example `context --target src/styles.css`; `apps/api` and
`packages/domain` are not the visual app. The approved tokens and scope of the
spec prevail; a styling task on that system does not require reopening product
decisions. Versions, integrity and evidence in
[tooling-provenance.md](specs/001-mvp-guias-builds/tooling-provenance.md).

## Initial JavaScript budget

The canonical `pnpm build` command runs Angular, finalizes the static landing
page and runs `check:initial-js`. The landing page keeps native HTML, SEO, styles
and links; it does not boot client JavaScript. The finalizer rejects controls
that depend on JS, unknown handlers and incompatible structures. If the landing
page needs new interaction, update its SDD contract first; do not exclude it from
the checker or remove features to achieve zero bytes.

The gate measures real gzip level 6, maximum 90000 bytes for the landing page and
110000 for the prerendered catalog. Zero is only accepted with the validated
static contract. Hydrated routes include bootstrap, lazy module, shared imports
and executable inline scripts; JSON-LD and TransferState are data. The catalog
uses i18n hydration and replay support; its scripts are not removed. Angular's
approximate raw limit (warning 280kB/error 300kB) does not replace the gzip
measurement. Running only `pnpm ng build` omits finalization and the gzip gate.

The measurement uses `dist/grim-dawn-builds/stats.json`, which stays outside the
public `browser` directory; only `browser` is served when previewing. Do not
publish the stats together with the site. To check an existing artifact:

```bash
pnpm check:initial-js
```

This check does not prove guide, CSS/HTML or Lighthouse budgets. The T-042/T-126
checks complete that coverage before closure. The release uses the same
finalization before hashing and scans secrets before and after.
