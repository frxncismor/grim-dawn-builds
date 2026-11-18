# Data Model: spec009

Cambios de contrato (dominio + PostgreSQL); todo lo demás se conserva. Decisiones en `research.md` D4 y D6.

## Guía (`BuildContentSchema`, tabla `builds`, vista `v_public_build_documents`)

Campos nuevos, todos obligatorios en el documento (con valores vacíos permitidos) para que el contrato siga siendo `.strict()`:

| Campo           | Tipo de dominio                                            | Columna PostgreSQL                                   | Reglas                                                                                                    |
| --------------- | ---------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `intro`         | texto o `null` (≤ 400 caracteres)                           | `intro text NULL`                                    | Texto editorial en el idioma de la guía; `null` oculta el bloque.                                         |
| `stage`         | `subida` \| `final` \| `ambas`                             | `stage text NOT NULL` + CHECK                         | Chip de etapa.                                                                                            |
| `changelog`     | lista de `{ date: fecha ISO, text: texto ≤ 200 }`          | `changelog jsonb NOT NULL DEFAULT '[]'` + CHECK      | Fechas únicas, orden descendente, ninguna anterior a `published_at` (si hay). La primera da la fecha de actualización. |
| `pros`          | lista de textos (0–5, ≤ 120 cada uno)                       | `pros text[] NOT NULL DEFAULT '{}'`                  | Lista vacía oculta la tarjeta.                                                                            |
| `cons`          | lista de textos (0–5, ≤ 120 cada uno)                       | `cons text[] NOT NULL DEFAULT '{}'`                  | Ídem.                                                                                                     |
| `hotbar`        | lista ordenada de `skill_node_slug` (0–10, sin repetidos)   | `hotbar text[] NOT NULL DEFAULT '{}'`                | Cada slug existe en `skill_nodes` de la guía.                                                             |
| `key_devotions` | lista de `constellation_slug` (0–6, sin repetidos)          | `key_devotions text[] NOT NULL DEFAULT '{}'`         | Cada slug existe en `constellations` de la guía.                                                          |

Las reglas referenciales (`hotbar`, `key_devotions`, fechas) se validan en `validateGuide` (dominio) y se replican en la API/BD donde el esquema lo permita (CHECK de forma; las referencias, en dominio y en la escritura, como el resto de referencias internas de la guía). `PublicBuildSchema` expone los siete campos. La paridad dominio–BD se comprueba con el test de paridad existente.

Derivados sin columna: **fecha de actualización** = `changelog[0].date` o `published_at`; **rol** = `playstyle`; **resumen del autor** = `author.bio`.

## Activo: portada de maestría

Entrada de manifiesto por maestría base (6), como los retratos:

- `slug`: `banner-<mastery-slug>`; `file_path`: `public/assets/banners/<mastery-slug>.webp`; `fallback_svg`: el símbolo SVG propio de la maestría.
- `license_or_permission`: `tolerancia_de_facto_sin_permiso`; `proof_ref`: `specs/009-rediseno-completo-ui/research.md#r8`.
- `provenance`: versión del juego, ruta de origen interna y `sha256` (la ruta interna nunca sale en el sitio; §VII).

## Sin cambios

`purchase_steps` (el checklist reutiliza su progreso local), `skill_nodes`, `constellations`, `devotion_steps`, `notes`, `loot_filter_columns`, `guide_npcs`, `sections_meta` (se añaden las claves de sección nuevas: `build-final` y `changelog`, con `visible`).
