# Mastery portraits — attribution notice / Aviso de atribución

## English

Mastery portraits listed in `manifest.json` (served from `apps/web/public/assets/portraits/`)
are derived from **Grim Dawn © Crate Entertainment**.

- This project is **not affiliated with or endorsed by Crate Entertainment**.
- **There is no written permission from Crate.** The basis is de facto tolerance of the
  community, accepted as a risk by the repository owner (constitution §VII, 1.10.0,
  approved by Paco, 2026-11-13). Attribution does not replace permission.
- Each portrait needs an `approved` manifest entry with `license_or_permission =
tolerancia_de_facto_sin_permiso` and a `proof_ref` to
  `specs/003-catalogo-arboles-maestria/research.md#t029`. Portraits are added manually,
  never fetched automatically.
- Backgrounds, frames, other art, internal game data and the Grim Tools database are not
  included and not allowed.
- **Where it ships (T015)**: the six mastery buttons (197×41, unmodified PNG from
  `UI.arc`) are shown on `/maestrias` with a visible credit to Crate and a
  non-affiliation notice. `build:release` and the CI artifact build use
  `ASSET_SOURCE=game`; local builds default to `own`. Skill icons are not published.
- **Withdrawal**: if Crate asks, set the entry to `status: withdrawn`, delete the file,
  record it in `handoff.md` and switch to the own icon set (`ASSET_SOURCE=own`) in the
  same change.

## Español

Los retratos de maestría listados en `manifest.json` (servidos desde
`apps/web/public/assets/portraits/`) derivan de **Grim Dawn © Crate Entertainment**.

- Este proyecto **no está afiliado ni respaldado por Crate Entertainment**.
- **No existe permiso escrito de Crate.** La base es tolerancia de facto de la comunidad,
  asumida como riesgo por el dueño del repositorio (constitución §VII, 1.10.0, aprobada por
  Paco, 2026-11-13). La atribución no sustituye al permiso.
- Cada retrato exige una entrada `approved` en el manifiesto con `license_or_permission =
tolerancia_de_facto_sin_permiso` y `proof_ref` a
  `specs/003-catalogo-arboles-maestria/research.md#t029`. Se incorporan a mano, nunca por
  descarga automática.
- No se incluyen ni se permiten fondos, marcos, otro arte, datos internos del juego ni la
  base de Grim Tools.
- **Dónde se publican (T015)**: los seis botones de maestría (197×41, PNG sin modificar de
  `UI.arc`) se muestran en `/maestrias` con crédito visible a Crate y aviso de no
  afiliación. `build:release` y el build del artefacto de CI usan `ASSET_SOURCE=game`;
  el build local usa `own` por defecto. Los iconos de habilidad no se publican.
- **Retirada**: si Crate lo pide, la entrada pasa a `status: withdrawn`, se borra el
  archivo, se registra en `handoff.md` y se cambia a la iconografía propia
  (`ASSET_SOURCE=own`) en el mismo cambio.
