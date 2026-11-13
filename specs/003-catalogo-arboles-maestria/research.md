# Research: Catálogo propio de árboles de maestría (Fase 0)

**Feature**: `003-catalogo-arboles-maestria` | **Fase**: 0 — Investigación de formato
**Tareas**: T001, T002, T003, T004 de [`tasks.md`](tasks.md)

Cada sección la rellena la tarea que la nombra. Toda afirmación lleva su evidencia
(comando y salida real, o URL con revisión). Ningún archivo del juego (`.arz`, `.dbr`,
`.arc`, traducciones) se versiona: aquí solo se citan nombres de campo y valores factuales.

<!-- ===================================================================== -->

## T001 — Extracción real de `.arz`/`.dbr` en la versión instalada

_Pendiente (T001)._

<!-- ===================================================================== -->

<!-- separador T001/T002: no editar -->

<!-- ===================================================================== -->

## T002 — Tabla `tier → bar_required` y mapa de campos

_Pendiente (T002, depende de T001)._

<!-- ===================================================================== -->

<!-- separador T002/T003: no editar -->

<!-- ===================================================================== -->

## T003 — Decisión de parser (propio mínimo vs librería)

_Pendiente (T003)._

<!-- ===================================================================== -->

<!-- separador T003/T004: no editar -->

<!-- ===================================================================== -->

## T004 — Licencia de la wiki (Q1)

Comprobado en vivo el **2026-11-13** (solo lectura de la página de derechos y de metadatos
del sitio; sin scraping ni copia de contenido de la wiki, Constitución II).

**Página de derechos**: <https://grimdawn.miraheze.org/wiki/Project:Copyrights?oldid=82>

| Dato                 | Valor                                    |
| -------------------- | ---------------------------------------- |
| Revisión actual      | `oldid=82` (padre 81), pageid 7, ns 4    |
| Fecha de la revisión | 2020-05-21T16:52:07Z                     |
| Autor                | `Rostiger Bot`                           |
| Revisión previa      | 81 (2019-01-11, `wikia:grimdawn>Pcjbot`) |

Fuente (API MediaWiki):

```text
GET https://grimdawn.miraheze.org/w/api.php?action=query&prop=revisions&titles=Project:Copyrights&rvprop=ids|timestamp|user|content&rvslots=main&format=json
-> {"pages":{"7":{"title":"Project:Copyrights","revisions":[{"revid":82,"parentid":81,
   "user":"Rostiger Bot","timestamp":"2020-05-21T16:52:07Z", ...
GET ...api.php?action=query&prop=revisions&titles=Project:Copyrights&rvprop=ids|timestamp|user&rvlimit=5&format=json
-> revids 82, 81, 80, 79, 78 (82 es la más reciente)
```

### Cita literal — cuerpo de la página (wikitext de `oldid=82`)

> All textual and graphical content on {{SITENAME}} that we may lawfully license is licensed
> to you under the Creative Commons [Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)]
> license.

(enlace a `https://creativecommons.org/licenses/by-sa/3.0/`). Las otras frases de la página:
el contenido del juego es propiedad intelectual de sus titulares; el contenido que aporta un
usuario se licencia a la wiki bajo los Terms of Service de Fandom.

### Cita literal — pie de página (`$wgRightsText`)

```text
GET https://grimdawn.miraheze.org/w/api.php?action=query&meta=siteinfo&siprop=rightsinfo&format=json
-> {"query":{"rightsinfo":{"url":"","text":"Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)"}}}
```

> Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)

Limitación: el HTML renderizado (`?oldid=82`) devuelve HTTP 403 (desafío anti-bot) a clientes
no interactivos, así que el texto exacto del pie («Content is available under … unless
otherwise noted») no se pudo volver a leer hoy; sí se confirmó su licencia vía `rightsinfo`.
`url` está vacío (el pie no enlaza a la licencia por API).

### Política general de Miraheze

Terms of Use de Miraheze, sección 2 («Copyright»), revisión `oldid=492660` (2025-09-24):
<https://meta.miraheze.org/wiki/Terms_of_Use>

> By default, wikis have contents licensed under the Creative Commons Attribution-ShareAlike
> 4.0 License. Wiki owners can change this; see Help:Changing your wiki license.

(Fuente: `https://meta.miraheze.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Terms_of_Use&format=json`.)
Esto explica el 4.0 del pie (valor por defecto de la plataforma) frente al 3.0 de la página
de derechos (texto heredado de Fandom, 2020).

### Contradicción

Se **confirma** lo registrado en `spec.md` §0.1: `oldid=82`, cuerpo **CC BY-SA 3.0**, pie
(`$wgRightsText`) **CC BY-SA 4.0**. Sin diferencias respecto a la comprobación del 2026-11-12
(mismo `oldid`, mismas licencias).

### Decisión aplicada (SC-006)

Paco **aún no ha respondido** Q1 (`spec.md` §6). Resolución propuesta vigente, aplicada con
carácter **provisional**:

1. Aplicar **CC BY-SA 3.0** (la del cuerpo; más explícita para el contenido).
2. **No copiar nada de la wiki** (ni texto, ni imágenes, ni coordenadas) hasta confirmación
   escrita de Paco.
3. El catálogo derivado de los `.dbr` no depende de esta licencia (FR-002–FR-006).

Estado: pendiente de confirmación escrita de Paco.
