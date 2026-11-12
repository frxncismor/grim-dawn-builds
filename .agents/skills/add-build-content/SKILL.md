---
name: add-build-content
description: Add or validate a community build or guide in content/ with authorship, sources, provenance and rights. Use when asked to "add a build", "add a guide", "validate this content" or "publish this build".
---

# Add build content

Read `AGENTS.md`, `docs/content/editorial-cli.md` and `docs/content/source-policy.md` first. The active task in
`specs/001-mvp-guias-builds/tasks.md` must cover this content; if none does, stop and ask the orchestrator to
plan it (SDD).

## Steps

1. Work only in your own worktree (`Orq-Worktree.ps1 -Accion nuevo -Agente <you>`), never in the main checkout.
2. Copy the closest existing file in `content/builds/` as a template; keep its field order.
3. Fill authorship (`content/authors/`), every source (`content/sources/`) and the rights or adaptation
   evidence. If a right is unknown, mark it as pending exactly as the schema allows; never invent approvals.
4. Add both locales when the schema asks for them (English primary, Spanish complete).
5. Run, in order, and keep the real output:
   - `pnpm content:validate -- --dir content`
   - `pnpm assets:check`
   - `pnpm catalog:generate` and then `pnpm catalog:check`
6. Report the files touched, the three outputs and any pending right as a blocker.

## Done when

All three commands pass, and no source or right is asserted without evidence.

## Never

- Copy text from third-party sites.
- Mark a source as approved because it is attributed.
- Edit `packages/domain` schemas to make invalid content pass.
