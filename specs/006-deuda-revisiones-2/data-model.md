# Data Model: spec006

Sin esquema nuevo ni migración. Solo cambian tipos internos de presentación y el orden de escritura de la siembra.

## Puerta sobre el artefacto (T001)

| Campo | Tipo | Regla |
| ----- | ---- | ----- |
| `gate` | texto | Nombre que encabeza el mensaje de error (`ASSET_SOURCE=<modo>: <etiqueta>` en las de crédito; «marca antigua» en la de marca). |
| `browserDir` | ruta | `<artefacto>/browser`; debe existir y ser un directorio real. |
| `minPages` | entero ≥ 1 | 1 por defecto; `MIN_PRERENDERED_PAGES + 1` (= 6) en la puerta de marca. |
| resultado | lista de rutas `.html` | Ordenada; nunca vacía (si no, error). |

Puertas que la usan (P33 = A): `assertPortraitCredit`, `assertSkillIconCredit`, `assertNoGamePortraits` (solo `own`) y `assertNoLegacyBrand`.

## Entrada y datos de la tarjeta (T002, T003)

| Campo | Antes | Después |
| ----- | ----- | ------- |
| `BuildCardInput.key` | — | `string`, obligatoria, sin espacios, única en la página |
| `BuildCardData.key` | — | copia de la entrada |
| `BuildCard.descriptionId` | `build-card-combination-<contador de módulo>` | `build-card-combination-<key>` |
| `BuildCardData.srCombination` | se pinta en la rama sin enlace | solo decide si el enlace lleva `aria-describedby` (o se sustituye por `combinationLang`, a elección de T003 si ahorra bytes) |

Origen de `key`: catálogo `CatalogCard.id` (`<combinación>:<tipo de entrada>:<slug de guía o índice>`); portada `guide.slug`; preview de desarrollo, literales.

## Siembra del catálogo (T005)

Sin cambios de tablas. Orden en la transacción de `seed`, `bootstrap` y `seedCatalog`:

1. Aparcar slugs (como hoy).
2. Borrar nodos ausentes de las fixtures **sin** referencias en `build_skill_nodes`.
3. Upsert de maestrías y nodos (23505 por celda ocupada por un nodo ausente aún referenciado → `SeedError('reference', <maestría>)`).
4. `writeContentRows` (salvo `seedCatalog`).
5. Borrar los nodos ausentes restantes (23503 → `SeedError('reference', <maestría>)`).
6. `retireMasteries` (como hoy).
