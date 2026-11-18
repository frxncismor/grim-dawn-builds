# Mastery portraits — attribution notice / Aviso de atribución

## English

Mastery portraits listed in `manifest.json` (served from `apps/web/public/assets/portraits/`)
are derived from **Grim Dawn © Crate Entertainment**.

- This project is **not affiliated with or endorsed by Crate Entertainment**.
- **There is no written permission from Crate.** The basis is de facto tolerance of the
  community, accepted as a risk by the repository owner (constitution §VII, 1.10.1,
  approved by Paco, 2026-11-13; the training button ratified as portrait on 2026-11-14). Attribution does not replace permission.
- Each portrait needs an `approved` manifest entry with `license_or_permission =
tolerancia_de_facto_sin_permiso` and a `proof_ref` to
  `specs/003-catalogo-arboles-maestria/research.md#t029`. Portraits are added manually,
  never fetched automatically.
- Backgrounds, frames, other art, internal game data and the Grim Tools database are not
  included and not allowed.
- **Where it ships (T015)**: the six mastery buttons (197×41, unmodified PNG from
  `UI.arc`) are shown on `/maestrias` with a visible credit to Crate and a
  non-affiliation notice. `build:release` and the CI artifact build use
  `ASSET_SOURCE=game`; local builds default to `own`.
- **Skill icons (constitution §VII, 1.11.0, approved by Paco, 2026-11-15)**: the same
  basis, attribution and withdrawal apply to the skill icons of the six base masteries
  (unmodified PNG derived from `UI.arc`), with **one manifest entry per icon** whose
  `proof_ref` is `specs/004-rediseno-ui-grim-dawn/research.md#r10`. **Where they are
  (spec004 T027)**: 164 unmodified 32×32 PNG in `apps/web/public/assets/skill-icons/`, named
  by their public `icon_id`, each with an `approved` manifest entry (`origin_url`, `sha256`,
  game build, `fallback_svg` = the own symbol of `public/assets/ui/skill-icons.svg`). They are
  added manually, never fetched automatically, and the Angular build does **not** copy that
  folder: they ship only with `ASSET_SOURCE=game` once the tree shows them (spec004 T028).
  Withdrawal: set the entries to `status: withdrawn`, delete the PNG files, record it in
  `handoff.md` and switch to `ASSET_SOURCE=own` in the same change.
- **Withdrawal**: if Crate asks, set the entry to `status: withdrawn`, delete the file,
  record it in `handoff.md` and switch to the own icon set (`ASSET_SOURCE=own`) in the
  same change.

## Español

Los retratos de maestría listados en `manifest.json` (servidos desde
`apps/web/public/assets/portraits/`) derivan de **Grim Dawn © Crate Entertainment**.

- Este proyecto **no está afiliado ni respaldado por Crate Entertainment**.
- **No existe permiso escrito de Crate.** La base es tolerancia de facto de la comunidad,
  asumida como riesgo por el dueño del repositorio (constitución §VII, 1.10.1, aprobada por
  Paco, 2026-11-13; botón de entrenamiento ratificado como retrato el 2026-11-14). La atribución no sustituye al permiso.
- Cada retrato exige una entrada `approved` en el manifiesto con `license_or_permission =
tolerancia_de_facto_sin_permiso` y `proof_ref` a
  `specs/003-catalogo-arboles-maestria/research.md#t029`. Se incorporan a mano, nunca por
  descarga automática.
- No se incluyen ni se permiten fondos, marcos, otro arte, datos internos del juego ni la
  base de Grim Tools.
- **Dónde se publican (T015)**: los seis botones de maestría (197×41, PNG sin modificar de
  `UI.arc`) se muestran en `/maestrias` con crédito visible a Crate y aviso de no
  afiliación. `build:release` y el build del artefacto de CI usan `ASSET_SOURCE=game`;
  el build local usa `own` por defecto.
- **Iconos de habilidad (constitución §VII, 1.11.0, aprobada por Paco, 2026-11-15)**: se
  aplican la misma base, atribución y retirada a los iconos de habilidad de las seis
  maestrías base (PNG derivado sin modificar de `UI.arc`), con **una entrada de manifiesto
  por icono** cuyo `proof_ref` es `specs/004-rediseno-ui-grim-dawn/research.md#r10`. **Dónde
  están (spec004 T027)**: 164 PNG de 32×32 sin modificar en
  `apps/web/public/assets/skill-icons/`, con el nombre de su `icon_id` público y cada uno con
  su entrada `approved` en el manifiesto (`origin_url`, `sha256`, versión del juego,
  `fallback_svg` = el símbolo propio de `public/assets/ui/skill-icons.svg`). Se incorporan a
  mano, nunca por descarga automática, y el build de Angular **no** copia esa carpeta: solo se
  publican con `ASSET_SOURCE=game` cuando el árbol los muestre (spec004 T028). Retirada: las
  entradas pasan a `status: withdrawn`, se borran los PNG, se registra en `handoff.md` y se
  cambia a `ASSET_SOURCE=own` en el mismo cambio.
- **Retirada**: si Crate lo pide, la entrada pasa a `status: withdrawn`, se borra el
  archivo, se registra en `handoff.md` y se cambia a la iconografía propia
  (`ASSET_SOURCE=own`) en el mismo cambio.
