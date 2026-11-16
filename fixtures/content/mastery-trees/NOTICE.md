# Mastery catalog fixtures — attribution notice / Aviso de atribución

## English

The `*.json` files in this folder contain **factual data** (mastery and skill names in
English and Spanish, tier, grid position, point limits, parent links) derived from
**Grim Dawn © Crate Entertainment**, game version `steam-build-25813250`.

- Source: the `database.arz`, `Text_EN.arc` and `Text_ES.arc` files of a legal local copy
  of the game. Their SHA-256 hashes are recorded in each file's `source.sha256`.
- Extracted locally with `pnpm catalog:extract` and split with
  `scripts/split-mastery-catalog.mts`; nothing here is hand-edited.
- Skill and mastery names are Crate's property. They are used as facts, with this
  attribution, to identify game elements.
- This project is **not affiliated with or endorsed by Crate Entertainment**.
- No official art, icons or descriptive game text is included.
- `icon` is the game's internal texture path and stays in these source files only. `icon_id` is the
  public handle of that icon (`ic-` plus the first 16 hex of the SHA-256 of the path, derived by
  the extractor and checked by `pnpm content:validate`); it is the only icon reference the API and
  the emitted JSON expose (spec004 T025).

To regenerate (output goes outside the repository first, then is split here):

```text
pnpm catalog:extract --game-dir <Grim Dawn folder> --out <tmp>/all.json
pnpm exec tsx scripts/split-mastery-catalog.mts <tmp>/all.json fixtures/content/mastery-trees
pnpm catalog:nodes
```

## Español

Los archivos `*.json` de esta carpeta contienen **datos factuales** (nombres de
maestrías y habilidades en inglés y español, tier, posición en la rejilla, límites de
puntos y relaciones de padre) derivados de **Grim Dawn © Crate Entertainment**, versión
del juego `steam-build-25813250`.

- Origen: los archivos `database.arz`, `Text_EN.arc` y `Text_ES.arc` de una copia local
  legal del juego. Sus hashes SHA-256 constan en `source.sha256` de cada archivo.
- Se extraen localmente con `pnpm catalog:extract` y se reparten con
  `scripts/split-mastery-catalog.mts`; nada se edita a mano.
- Los nombres de habilidades y maestrías son propiedad de Crate. Se usan como hecho, con
  esta atribución, para identificar elementos del juego.
- Este proyecto **no está afiliado ni respaldado por Crate Entertainment**.
- No se incluye arte oficial, iconos ni textos descriptivos del juego.
- `icon` es la ruta interna de textura del juego y solo vive en estos archivos fuente. `icon_id` es
  el identificador público de ese icono (`ic-` más los 16 primeros hex del SHA-256 de la ruta, que
  deriva el extractor y comprueba `pnpm content:validate`); es la única referencia a un icono que
  exponen la API y el JSON emitido (spec004 T025).

Para regenerar, usa los mismos tres comandos de la sección en inglés.
