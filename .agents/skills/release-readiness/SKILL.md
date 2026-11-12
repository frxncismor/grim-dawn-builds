---
name: release-readiness
description: Build and check the release artifact and report whether a release can ship, without deploying. Use when asked to "prepare a release", "is the build releasable", "validate the artifact" or before any deploy.
---

# Release readiness

The release path exists in `package.json` (`build:release`, `check:release` and `check:public-build`). Where
it deploys to depends on the publication decision (consultancy brief S11); until that decision exists, this
skill only validates.

## Steps

1. Confirm the content source the release must use (API versus fixtures) from the plan or release runbook. If
   it is not documented, stop and report.
2. Run `pnpm build:release`, then `pnpm check:release`, then `pnpm check:public-build`, in that order, and keep
   each output.
3. Smoke-check the artifact under `dist/`: `/` and `/es` index pages exist, `404.html` exists, and
   `sitemap.xml` lists both locales.
4. Report a checklist with status and evidence: build, release check, public build, smoke, and content source.

## Done when

All checks pass and the checklist quotes real output. The verdict is "releasable" or "not releasable: `<reason>`".

## Never

- Deploy, push tags or touch hosting.
- Say "deployed" or "released" without a public URL that answers 200, which the deploy owner provides.
