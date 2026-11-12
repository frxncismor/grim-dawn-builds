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

- Node.js 22.23.5 (see `.nvmrc`).
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

## Static artifact preview and editorial flow

`pnpm build` writes the deployable static artifact to
`dist/grim-dawn-builds/browser/`. The same run also writes
`dist/grim-dawn-builds/stats.json`, which stays **outside** `browser/`: it is
measurement evidence and must never be published or served with the site.

To preview the artifact as published, serve `browser/` with a minimal Node 22
static server: no `ng serve`, no extra dependency and no file added to the
repository. It answers a missing path with the artifact's real `404.html`. Run
`pnpm build` first when `browser/` does not exist:

```powershell
node -e "const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),root=path.resolve('dist/grim-dawn-builds/browser'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.ico':'image/x-icon','.woff2':'font/woff2'};http.createServer((req,res)=>{const url=decodeURIComponent((req.url||'/').split('?')[0]);if(url.includes('..')){res.writeHead(403,{'Content-Type':'text/plain; charset=utf-8'}).end('forbidden');return;}let file=path.join(root,url);try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');const body=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(body);}catch{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(fs.existsSync(path.join(root,'404.html'))?fs.readFileSync(path.join(root,'404.html')):'not_found');}}).listen(4321,'127.0.0.1',()=>console.log('preview: http://127.0.0.1:4321/ -> '+root));"
```

Open `http://127.0.0.1:4321/` and stop the server with Ctrl+C. Files are read
from disk on every request, so a new `pnpm build` only needs a reload.

### Build variables

These are shell environment variables read by the build and the preview. Angular
does not load `.env` files automatically, so export them in the shell before the
command. [`.env.example`](.env.example) lists the public names and safe defaults
as a reference; real secrets live in git-ignored files only, as documented in
[secret management](docs/security/secrets.md).

| Variable         | Accepted values                                               | Effect on the build and the preview                                                                                              |
| ---------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `BASE_URL`       | absolute `http(s)` URL without credentials, query or fragment | Fixes the absolute canonical and Open Graph URLs, `sitemap.xml` and `robots.txt`. Defaults to `http://localhost:4200/`.          |
| `INCLUDE_DRAFTS` | `true` or `false`                                             | Adds the local `borrador` guide when `true`. Public and release builds force it to `false`.                                      |
| `CONTENT_SOURCE` | `fixture` or `api`                                            | Selects fixtures (development, tests, CI without Docker) or the public API (release). `api` never degrades silently to fixtures. |

An invalid `BASE_URL` fails the sitemap and robots generation with a fixed
message that does not echo credentials. `INCLUDE_DRAFTS` only accepts `true` or
`false`: any other value fails with `INCLUDE_DRAFTS debe ser true o false.`, and
`CONTENT_SOURCE=api` rejects it with `La API pública no admite INCLUDE_DRAFTS.`.
Exporting `INCLUDE_DRAFTS=true` before `pnpm build` renders the `borrador` guide
with the "Borrador · no público" banner and `noindex`, so the route stays out of
the sitemap and is never part of a public or release build.

### Editorial flow

`content/` holds development fixtures and import material. The editorial CLI
edits canonical documents through the PostgreSQL `editor` role, with no accounts
or write endpoints:

```bash
pnpm db:edit --kind build --slug <slug> --file <local-json>
```

The [editorial CLI](docs/content/editorial-cli.md) documents the envelope, the
required role and the fixed failure codes. `pnpm db:seed` loads development
fixtures, `pnpm db:bootstrap` performs the single initial load into an empty
migrated database ([bootstrap](docs/content/bootstrap.md)), and
`pnpm content:validate -- --dir <folder>` checks any content folder against the
domain schema.

### Deployment

Hosting is still deferred and out of scope. There is no deployment provider, no
target domain, no contact data and no deploy workflow: `.github/workflows` only
runs verification and secret scanning, and deployment credentials stay
unconfigured until the maintainer makes an explicit decision.

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
