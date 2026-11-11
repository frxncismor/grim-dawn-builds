# Grim Dawn Builds

**English** · [Español](README.es.md)

Fast, accessible and interactive Grim Dawn build guides: skill trees, devotion
routes, gear, loot filters and a tier list with editorial provenance.

[![CI](https://github.com/frxncismor/grim-dawn-builds/actions/workflows/ci.yml/badge.svg)](https://github.com/frxncismor/grim-dawn-builds/actions/workflows/ci.yml)

> **Status**: MVP under local development. Content is published only after
> authorship, rights, sources and editorial review are validated. The migrated
> guide stays in `borrador` (draft) with `rights_status: pending`, so the public
> build ships without a published guide.

## Goal

This project offers a modern alternative to static build directories. Every guide
is represented from structured data and can include:

- Skill priorities and point-investment order.
- Skill trees and devotions rendered as accessible SVG.
- Gear, notes, loot filter and optional video.
- Author, sources, game version and review state.

The tier list covers every mastery combination through informational slots. A slot
does not imply a guide exists, nor that it has a tier: entries without a documented
editorial assessment stay as `Unclassified`.

## Content principles

- No scraping and no copying of third-party content.
- First-party or licensed guides require source, author and rights state.
- Content pending rights stays as a local draft and is never emitted in the public
  output.
- Official Grim Dawn assets are used only when the asset manifest records their
  origin and permission or license. Until then, our own SVG icons are used as a
  fallback.

This project is not affiliated with Crate Entertainment or GrimTools.

## Stack

- **Web**: Angular 21 with SSR/static prerender, strict TypeScript, i18n and
  CSS with custom design tokens.
- **Domain**: `@gd/domain` — Zod schemas and pure rules shared by web, API and
  scripts. No Angular, HTTP or database dependencies.
- **Backend**: Fastify + Drizzle ORM on Node.js 22 and PostgreSQL 17, in Docker
  Compose. PostgreSQL is the single source of truth for editorial content.
- **Quality**: Vitest, Playwright, axe-core, Lighthouse and markdownlint.
- **Visual design**: Cairn palette inspired by Grim Dawn (iron, bronze and ember),
  verified for WCAG 2.2 AA contrast.

## Requirements

- Node.js 22.12.0 (see `.nvmrc`).
- pnpm 12.18.0, enabled through Corepack: `corepack enable`.
- Docker Desktop only for the local backend and the release build.

## Local development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm setup:gitleaks
pnpm setup:hooks
pnpm start
```

Open `http://localhost:4200/`.

Without Docker the web app runs on fixtures (`CONTENT_SOURCE=fixture`). For the
real backend:

```bash
pnpm setup:env
docker compose -f infra/docker/compose.yaml up -d --wait
```

`pnpm setup:env` creates local credentials that are ignored by git. Secrets are
**never** committed: details are in [`CONTRIBUTING.md`](CONTRIBUTING.md) and
[`docs/security/secrets.md`](docs/security/secrets.md).

## Verification

Before opening a pull request:

```bash
pnpm verify
```

`pnpm verify` chains, stopping at the first failure: `check:scope`,
`check:boundaries`, `check:secrets`, typecheck, lint, `lint:md`, formatting,
domain tests, web tests, script tests, `assets:check` and `build`.

Focused commands during development:

| Command                                   | What it checks                                    |
| ----------------------------------------- | ------------------------------------------------- |
| `pnpm test`                               | Web unit tests                                    |
| `pnpm --filter @gd/domain test`           | Domain tests                                      |
| `pnpm test:scripts`                       | Verification script tests                         |
| `pnpm lint`                               | ESLint                                            |
| `pnpm lint:md`                            | markdownlint over all tracked Markdown            |
| `pnpm format:check`                       | Prettier                                          |
| `pnpm content:validate -- --dir <folder>` | Content schema                                    |
| `pnpm check:contrast`                     | Color token contrast                              |
| `pnpm check:initial-js`                   | Initial JavaScript budget                         |
| `pnpm check:public-build`                 | No secrets and no pending content in the artifact |

Release build (requires the API running and `CONTENT_SOURCE=api`):

```bash
pnpm build:release
pnpm check:release
```

## Layout

```text
apps/api/         Fastify + Drizzle API (public read-only)
packages/domain/  Zod schema, types and shared pure rules
src/              Angular application (web)
content/          Development fixtures and import material
infra/docker/     Compose, local secrets and role provisioning
scripts/          Validators, generators and verification gates
e2e/              Playwright tests
docs/             Operational and editorial documentation
specs/            SDD specifications, plans and tasks
.specify/         Constitution and SDD methodology memory
.agents/skills/   Review, spec closure and Impeccable skills
```

The original HTML guide is kept as a local migration fixture. It is not considered
publishable while its rights are pending.

## Working method

The project follows **Spec-Driven Development with GitHub Spec Kit** and **GitFlow**:

- `main`: stable releases.
- `develop`: integration of the next version.
- `mvp/1`: MVP integration branch.
- `feature/*`, `release/*` and `hotfix/*`: working branches.

Every change lands through a pull request; nothing is merged directly into `main`,
`develop` or `mvp/1`. Full rules are in [`CONTRIBUTING.md`](CONTRIBUTING.md) and the
multi-agent methodology in [`AGENTS.md`](AGENTS.md).

### Delivery milestones

The spec ships in reviewable milestones rather than one block. The mapping between
milestones, tasks and PRs is in
[`specs/001-mvp-guias-builds/milestones.md`](specs/001-mvp-guias-builds/milestones.md).

1. **SDD foundation and domain** — rules, tooling, typed domain and validated
   content.
2. **Content backend** — API, PostgreSQL, gated migrations and secrets.
3. **Web and experience** — static home, catalog, interactive SVG and Cairn design.
4. **Quality closure** — e2e, accessibility, performance and the review gate.

## Documentation

- [Constitution](.specify/memory/constitution.md): principles and constraints.
- [MVP specification](specs/001-mvp-guias-builds/spec.md).
- [Plan](specs/001-mvp-guias-builds/plan.md) and
  [tasks](specs/001-mvp-guias-builds/tasks.md).
- [Milestones](specs/001-mvp-guias-builds/milestones.md).
- [Spec closure reviews](specs/002-spec-completion-reviews/).
- [How to contribute](CONTRIBUTING.md).

## Language

English is the primary language of the repository: README, pull requests, commits
and the default site locale. Spanish is a first-class option, not an afterthought:
see [`README.es.md`](README.es.md) and the `es` locale on the website. Interface
strings go through Angular i18n so both locales stay complete.

## License

The code currently ships without a declared license: all rights reserved until the
maintainer chooses one. Third-party editorial content is governed by its own
licenses and permissions recorded in `content/sources/`.
