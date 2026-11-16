# Mastery catalog

**English** · [Español](mastery-catalog.es.md)

How the mastery skill-tree catalog is built, what of it is versioned, under what
basis the game's art is used and how to withdraw it. Everything below is checked
against the repository; the specification is
[`specs/003-catalogo-arboles-maestria/spec.md`](../../specs/003-catalogo-arboles-maestria/spec.md),
the plan is [`plan.md`](../../specs/003-catalogo-arboles-maestria/plan.md) and the
evidence behind each decision is in
[`research.md`](../../specs/003-catalogo-arboles-maestria/research.md). This page
links to them instead of copying them.

## Purpose and scope

The catalog is the canonical skill tree of each Grim Dawn mastery: for every skill
node, its id, English and Spanish name, tier (required mastery-bar level), grid
column and row, maximum points, parent node and kind (spec FR-003).

- **v1 scope**: the **6 base masteries** (`class01` to `class06`: Soldier,
  Demolitionist, Occultist, Nightblade, Arcanist and Shaman) and **186 skill
  nodes** (Soldier 32, Demolitionist 33, Occultist 30, Nightblade 31, Arcanist 30,
  Shaman 30). The expansions (Ashes of Malmouth, Forgotten Gods, Fangs of Asterkarn)
  and mods are **out of v1**, a decision of Paco on 2026-11-13; the schema does not
  prevent adding them later.
- **Who consumes it**: the data flows one way, from the versioned fixtures to the
  public site.

```text
fixtures/content/mastery-trees/*.json
  -> pnpm db:seed (role importer; tables mastery_trees and catalog_skill_nodes)
  -> public views v_public_* (role api_ro, read only)
  -> GET /api/v1/masteries and GET /api/v1/masteries/:slug
  -> web: /maestrias and /maestrias/:slug (prerendered in English and Spanish)
```

Local and CI builds without a backend read the same fixtures
(`CONTENT_SOURCE=fixture`); release builds read the API
(`CONTENT_SOURCE=api`), with no silent fallback (constitution XI). Editorial guides
(`skill_nodes`) may reference a catalog node through the optional
`skill_node_id`; the catalog never contains editorial fields (FR-006, FR-015).

## Data origin

- **Local extraction from a legal copy of the game.** `pnpm catalog:extract` reads
  `database.arz` and the localization archives `Text_EN.arc` and `Text_ES.arc` of
  the maintainer's own installation (tasks T001, T006 and T022). The repository
  receives only the derived JSON and the hashes. No scraping and no content copied
  from the wiki or from any website is involved (constitution II).
- **Textures** (tasks T028): `pnpm catalog:textures` decodes the `.tex` files of
  `resources/UI.arc` to PNG into `.game-assets/textures/`, which is gitignored.
- **Provenance recorded in every fixture** (`source`, identical in the six files):

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| `game_version` | `steam-build-25813250` (Steam `buildid`)                           |
| `database.arz` | `9e3532250cdb611a4cc989997c8f97fcec2d6c422063a845e6c43cd538c30603` |
| `Text_EN.arc`  | `82defd8a0fddf71e8491b7494fada51b034b1af14ffc0a6cf9c8aabdf8700c25` |
| `Text_ES.arc`  | `e6f785d155d0791b3100092762111f59a06faa9e1a86d91898ec98317e395752` |

The three hashes are the `source.sha256` array, in that order. The sha256 of each
published mastery button, with its `source_path` and size, is in
[`fixtures/content/assets/manifest.json`](../../fixtures/content/assets/manifest.json)
(`provenance`). How the format was probed is in `research.md` (sections T001, T022
and T028).

## What is versioned and what is not

Rule: spec FR-014 and constitution 1.10.1, section VII.

| Item                                                                                                    | Status                                                                                       |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Factual data: names, tier, grid position, point limits, parent links, with `source` hashes              | **Versioned** in `fixtures/content/mastery-trees/*.json`                                     |
| The six **mastery buttons**, 197x41 PNG, unmodified, published as the mastery "portraits" (Paco's call) | **Versioned** in `apps/web/public/assets/portraits/`, each with an `approved` manifest entry |
| **Skill icons** (32x32)                                                                                 | Extracted to `.game-assets/textures/` (never versioned); **published** as derived PNG with **one manifest entry per icon** only after constitution 1.11.0 and the own fallback are in place |
| `.arz`, `.arc`, `.dbr`, localization dumps, skill descriptions                                          | **Never** versioned                                                                          |
| Backgrounds, frames, other art, Grim Tools data                                                         | **Never**; they are outside the exceptions of section VII                                    |

The fixtures carry `icon` paths and texture names as plain strings; they are
identifiers, not images. The attribution notices that travel with the data are
[`fixtures/content/mastery-trees/NOTICE.md`](../../fixtures/content/mastery-trees/NOTICE.md)
and
[`fixtures/content/assets/NOTICE.md`](../../fixtures/content/assets/NOTICE.md).

## Licensing and attribution

- **Attribution**: Grim Dawn © Crate Entertainment. Skill and mastery names are
  Crate's property and are used as facts, with attribution, to identify game
  elements. The pages that show the buttons carry a visible credit to Crate.
- **Basis for using the art**: there is **no written permission from Crate
  Entertainment**. The basis is **de facto tolerance of the community, accepted as
  a risk by the repository owner**. Attribution does not replace permission. This is
  the literal wording of constitution section VII (1.10.1); the risk analysis is
  [`research.md`, section T029](../../specs/003-catalogo-arboles-maestria/research.md),
  which is the `proof_ref` of every manifest entry. Each entry records
  `license_or_permission = tolerancia_de_facto_sin_permiso`.
- **Wiki licence**: the Grim Dawn wiki is licensed **CC BY-SA 4.0** (question Q1,
  resolved by Paco on 2026-11-13: the body of the page says 3.0, the footer says 4.0;
  see [`research.md`, section T004](../../specs/003-catalogo-arboles-maestria/research.md)
  and the revision
  [`Project:Copyrights?oldid=82`](https://grimdawn.miraheze.org/wiki/Project:Copyrights?oldid=82)).
  This only fixes the terms that would apply to anything derived from the wiki
  (attribution and share-alike). **It does not authorize scraping**: the wiki is not
  a default source, and the catalog is generated from the game files alone, so it
  does not inherit that obligation.
- **No affiliation**: this project is **not affiliated with or endorsed by Crate
  Entertainment**. The notice is shown wherever the game's art appears.
- **Nothing else is covered**: the exceptions are explicit, bounded and reversible,
  and widening them needs a new constitutional amendment.

## `ASSET_SOURCE`

One switch decides which art the mastery index (`/maestrias`) serves. It is read on
the server during the prerender (`apps/web/src/app/core/content/portraits.server.ts`).

| Value           | Effect                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `own` (default) | The project's own SVG icons (`apps/web/src/assets/icons/mastery-*.svg`, the manifest `fallback_svg`). No game art is served.                    |
| `game`          | The game's mastery button of each mastery, only for entries that are `approved` with `license_or_permission = tolerancia_de_facto_sin_permiso`. |

Unset means `own`. Any other value is an error, and it fails closed: an invalid
value, `game` without a readable manifest, or a malformed approved entry fails the
build instead of degrading silently.

- **Where `game` applies** (task T015, Paco's decision of 2026-11-13): `pnpm
build:release` and the CI jobs that build the measured artifact (`verify` and
  `dast` in `.github/workflows/ci.yml`). The release also checks the manifest
  before building (`assertGameAssets`) and refuses to build unless all six
  masteries have an `approved` portrait. Local builds stay on `own`. Release does
  not default the switch: an unset `ASSET_SOURCE` is an error (T036, S-003).
- **The PNGs**: `angular.json` does not copy `public/assets/portraits/`; only
  `ASSET_SOURCE=game` emits them (`apps/web/tools/emit-portraits.mts`, run by
  `pnpm build` and `build:release`) and release rejects an `own` artifact that has
  any (T036, S-001). `ng serve` and `--configuration development` still serve them.
- **Fallback**: with `own`, or with a missing, `withdrawn` or non-approved entry,
  the row shows the project's own icon. The site is never left without icons. Skill
  icons use the project's own icons until the skill icons are published under
  constitution 1.11.0 (one manifest entry per icon, `proof_ref` to
  [`research.md`, section R10](../../specs/004-rediseno-ui-grim-dawn/research.md)).

## Withdrawal procedure

If Crate Entertainment, or anyone with standing, asks for the art to be removed, in
**one** change:

1. Set the affected manifest entries to `status: withdrawn` (the entry carries no
   file path) in `fixtures/content/assets/manifest.json`.
2. Delete the PNG files from `apps/web/public/assets/portraits/`.
3. Switch to the own icon set: release with `ASSET_SOURCE=own` (an explicit `own` is
   accepted by `build:release`), and drop `ASSET_SOURCE: game` from the CI jobs
   that set it.
4. Record the withdrawal in `handoff.md` and in the manifest.
5. Run `pnpm assets:check` and `pnpm verify`, then rebuild and republish.

The generic removal procedure, the 72 hour operational objective, the channel and
the evidence to keep are in [`takedown-runbook.md`](takedown-runbook.md), which is
not duplicated here. A request for the game's art has priority over other work, as
that runbook says.

## Regenerating the catalog

Prerequisite: a legal local copy of Grim Dawn. Pass its folder with `--game-dir` or
the `GRIMDAWN_DIR` environment variable. The extractor only reads from the game
folder and writes only to the path given in `--out` (or to stdout), so send that
output outside the repository first.

```text
pnpm catalog:extract --game-dir <Grim Dawn folder> --out <tmp>/all.json
pnpm exec tsx scripts/split-mastery-catalog.mts <tmp>/all.json fixtures/content/mastery-trees
pnpm catalog:nodes
pnpm catalog:textures --game-dir <Grim Dawn folder> [--out <folder>] [--kind masteries|skills|all]
```

- `catalog:extract` emits the six base masteries as a JSON array with the shape of
  `MasteryTreeSchema` and `source {game_version, sha256[]}`. Options:
  `--game-version <text>` forces the version (the Steam `buildid` by default) and
  `--no-localize` keeps the localization tags and skips the `.arc` files.
- `split-mastery-catalog.mts` writes one `<slug>.json` per mastery. Nothing in the
  fixtures is edited by hand.
- `catalog:nodes` (`scripts/check-mastery-catalog.mts`, option `--dir <folder>`)
  validates every fixture with `MasteryTreeSchema` and checks: acyclic tree, every
  `parent_id` exists, unique ids, no grid collisions, tier increasing from the
  root, `bar_required` consistent with the tier, `max_points` in the range 1 to 16,
  `ultimate_points` at most 26, non-empty names, file name equal to the slug, and
  exactly the six base masteries (SC-001). It runs inside `pnpm verify` and in CI.
- `catalog:textures` writes PNG files and its own `manifest.json` into
  `.game-assets/textures/` (gitignored) by default. `--kind` is `masteries` by
  default. To publish a mastery button, copy it by hand to
  `apps/web/public/assets/portraits/` and add its manifest entry; the ingestion is
  never automated (constitution II, 1.10.0). `pnpm assets:check` rejects a file
  under `apps/web/public/assets/` without an `approved` entry or with a different hash.
- **Reproducibility (SC-002)**: the output has sorted keys, no timestamps, and two
  runs over the same installation produce an empty `diff`. The same holds for the
  textures (two runs to different folders, an empty `diff -r`). A new game build
  changes `game_version` and the hashes, so regenerate and commit the fixtures in
  the same change.
