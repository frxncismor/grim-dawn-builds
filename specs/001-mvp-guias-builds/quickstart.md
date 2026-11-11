# Validación del cierre — spec 001

Este documento define verificaciones de aceptación; los comandos de tareas pendientes no se presentan como existentes ni ejecutados.

1. Instalar Node 22 y pnpm fijado; `pnpm install --frozen-lockfile`, `pnpm verify`. Al cerrar tareas, verify incluye contenido fixture completo, builds público y local de borradores, e2e, axe y presupuestos; hoy su éxito por sí solo no acredita spec completa.
2. `pnpm setup:env` crea solo archivos locales ignorados, sin imprimir secretos. Con T-056b/T-057 implementadas: `docker compose -f infra/docker/compose.yaml up -d --wait`; BD/API healthy, migrate terminado correctamente. BD sin puerto host; API loopback.
3. Reejecutar migrate sin alterar journal; probar readiness con BD caída/migración pendiente → 503 y health → 200. Ejecutar pruebas PostgreSQL de puertas, roles, seed y contrato. Usar proyecto/volumen efímero separado; nunca borrar la BD editorial para validar.
4. Seed de desarrollo idempotente, rechaza producción/bootstrap previo. Fixture local con borradores muestra guía noindex y JSON-LD local; build público/release carece de esa ruta y datos. E2E verifica tier list/URL, SVG/teclado, progreso y botín a 375/768/1280.
5. `CONTENT_SOURCE=api` con `pnpm build:release` solo después de T-074: genera build-info con fuente/migración/hash. Fuente fixture, API caída o migración incompatible → fallo; fixture/API con mismos datos → HTML/sitemap/JSON-LD equivalentes.
6. CLI editorial validada antes de bootstrap; derechos pending no publicables. Bootstrap segunda vez/seed posterior fallan; editor puede actualizar transaccionalmente y api_ro no escribe ni lee tablas base.
7. CI e2e/axe/Lighthouse/SQL/containers/DAST verde, DAST e imagen sin hallazgos MEDIA o superiores. Revisión manual teclado/NVDA/contraste registrada por quien realmente la ejecuta. Conservar informes y limitaciones; no marcar tareas por mera presencia de archivos.
8. Solo después del cierre integral y evidencia: acciones git/PR autorizadas por usuario mediante agente de implementación. Publicaciones externas bloqueadas y futuras conservan disposición explícita, sin fingir derechos ni implementar alcance prohibido.

## Evidencia ejecutada — Infraestructura y migración, 2026-11-09

Esta evidencia cierra únicamente las tareas indicadas, no toda la spec.

- **T-054**: imagen `gd-api:t057-review` construida con el Dockerfile multi-etapa;
  82 195 551 bytes (78.4 MiB), por debajo del objetivo de 200 MB; runtime UID/GID
  `10001:10001`. Historial sin ARG/ENV secretos y COPY runtime solo desde build,
  incluidos SQL y journal. El contexto usa `.dockerignore` de la raíz, donde se
  ejecuta la build; no un archivo distinto dentro de `apps/api`.
- **T-056/T-056b/T-057**: Compose normalizado en proyecto aislado
  `gd-db-validation`, mismos servicios/configuración de ejecución, imagen API
  anterior y PostgreSQL 17 fijado. Solo se sustituyeron secretos por valores
  aleatorios temporales, nombre del volumen y puerto API por uno efímero loopback.
  Primero se probó tmpfs; después un volumen nombrado propio. DB/API healthy,
  migrate terminado con 0 y `/ready` HTTP 200.
- Tras detener y recrear esos contenedores sin borrar su volumen de prueba, una
  fila centinela persistió. Reejecutar el aprovisionamiento conservó la fila y la
  disponibilidad. Repetir migrate conservó IDs, hashes y fechas del journal.
  Reiniciar solo API tampoco modificó el journal.
- `/health` HTTP 200 y `/ready` HTTP 503 con PostgreSQL detenido. Eliminar solo
  el último registro del journal en la base desechable produjo `/ready` 503;
  restaurarlo produjo 200. La comparación incompatible ya fue verificada con
  salida 1 sin aplicar migraciones pendientes en la misma imagen.
- `api_ro` rechazó CREATE TABLE y SELECT de tablas base con SQLSTATE 42501.
  `migrator` y `api_ro` tienen LOGIN, pero no SUPERUSER/CREATEROLE/CREATEDB;
  importer/editor permanecen NOLOGIN hasta sus tareas respectivas. La API montó
  exclusivamente su archivo secreto y migrate exclusivamente el suyo.
- **T-125**: errores reales de división por cero y unicidad registraron SQLSTATE
  22012/23505 con metadatos de sesión. El centinela privado de la fila, texto SQL,
  DETAIL y las contraseñas aleatorias no aparecieron en logs de los contenedores.
  Dos sesiones provocaron una espera real de bloqueo y el log identificó a la
  aplicación esperando. Driver local con tres archivos de 10 MB, stderr y UTC.
- Las 20 pruebas actuales de Compose pasan, incluida la protección de logging;
  configuración Compose, sintaxis shell, tipos API y comprobaciones de formato
  pasan. Markdown de todo el repo pasa. La recuperación T-124 conserva la
  constitución y los nueve hashes oficiales según `tooling-provenance.md`.

Se eliminaron los contenedores, la red y el volumen **exclusivos de la prueba**.
El volumen `grim-dawn-builds-pgdata` del usuario no se usó ni borró para estas
pruebas. Las credenciales temporales no se escribieron en el repo ni en argv,
informes o documentación. Los cambios de puerto al reiniciar con published=0
requieren consultar de nuevo `compose port api 3000` en el harness de prueba.

## Evidencia ejecutada — Puertas SQL T-073

Desde `apps/api`, con la imagen PostgreSQL fijada en Compose ya disponible:

```powershell
$env:RUN_DB_TESTS = '1'
pnpm exec vitest run test/gates.int.spec.ts
```

Resultado: 9 pruebas aprobadas con PostgreSQL 17 real. Incluyen una matriz de los
ocho CHECKs de `0001_gates.sql`: cada fila inválida falla con SQLSTATE 23514 y el
nombre del CHECK; quitar solo ese CHECK dentro de una transacción permite la
misma fila, y ROLLBACK restaura el esquema. Se prueban publicación válida,
rechazos por derechos/revisor/fuente/autor placeholder, activos, los tipos de
entradas tier, vistas públicas y permisos de api_ro. Las migraciones se aplican
como migrator no-superusuario, tras preparar roles en el fixture.

El contenedor es efímero, sin red externa ni puertos publicados, con tmpfs,
512 MiB de memoria y 0.5 CPU. Las filas son sintéticas y no hay contraseñas reales.
El mismo suite corre con `CI=true`, sin omitir pruebas; el job de CI debe tener
disponible previamente la imagen fijada. En verificación local sin activar las
integraciones, aparecen nueve pruebas omitidas explícitamente, no aprobadas.
Esto no acredita todavía T-065 ni una ejecución remota de GitHub Actions.

## Evidencia ejecutada — Contrato íntegro T-005/T-006

La primera ejecución de las pruebas nuevas falló con el esquema previo: perdía
secciones de la guía y aceptaba referencias incoherentes; no existía el DTO
público separado. Se completó el contrato en lugar de introducir defaults que
simularan contenido ausente. Las pruebas de ciclos y los consumidores de dominio,
web, paridad y scripts se actualizaron con documentos sintéticos completos.

`BuildDocumentSchema` conserva las secciones, nombres ES/EN y referencias.
`PublicBuildSchema`, autores/fuentes públicos y tier lists derivan del mismo
contrato y rechazan metadatos privados inesperados. El esquema público de guía
también rechaza `link_only`: ese estado permite tarjetas con enlace, no el cuerpo
completo de una guía. Una prueba en rojo confirmó ese caso antes de corregirlo.

Resultado actual: 59 pruebas de dominio aprobadas; cobertura de líneas 97.86 %,
ramas 94.90 %, funciones 100 %. Tipos, lint y `pnpm verify` completo pasan sobre
el estado corregido: 204 pruebas API, 47 web, 178 scripts aprobadas. Se omiten
explícitamente las nueve integraciones SQL en verify local y dos pruebas de
gitleaks sin su binario; las SQL ya se ejecutaron separadamente según T-073.
La puerta de revisores tiene otras 16 pruebas aprobadas mediante su comando
propio; no se presentan como parte del listado actual de `test:scripts`.

Esta comprobación no acredita todavía contenido real T-014, catálogo T-016,
adaptadores completos T-010/T-060/T-062, UI, e2e, Lighthouse ni cierre integral.

## Evidencia T-010 — repositorio fixture y proyección pública

2026-11-09: 24 pruebas web del adaptador/cargador y 4 pruebas Node del lector
servidor. Se leen archivos reales de las cuatro colecciones, incluida atribución
normalizada. El modo público omite borradores/pending, cuerpos link_only,
referencias a guías ocultas y campos editoriales anidados. El modo local conserva
el documento completo; duplicados y referencias incoherentes fallan. El lector
rechaza release y no hace fallback si se solicita API. `ng build` prerenderiza
la ruta inicial; los JS/HTML del navegador no contienen el lector ni campos de
atribución privada. La ampliación común de contrato sigue pendiente en T-063a.

Durante la verificación apareció un worker instalado de Angular de 611 bytes que
solo contenía una inyección de Console Ninja, sin su implementación. Se restituyó
únicamente ese archivo ignorado desde el tarball oficial de @angular/build
21.2.29, verificando SHA-512 contra pnpm-lock.yaml; quedó en 7255 bytes. No cambió
la versión ni el lockfile. El build posterior pasó con NG_BUILD_MAX_WORKERS=2.
Esta reparación local no desactiva la extensión ni acredita las puertas UI,
e2e, Lighthouse o la finalización de la spec.

## Evidencia T-063a — contrato ampliado

2026-11-09: la ampliación detectó tres fallos reales en la referencia mínima
(DTO privado, autor privado y tier sin filtrado) antes de corregirla. Una prueba
adicional falló contra FileContentRepository cuando un enlace externo incluía
una referencia a una guía oculta; el filtro ahora comprueba cualquier build_slug.
El contrato pasa contra referencia y archivo: 63 pruebas de dominio, cobertura
de líneas 97.86 %, y 28 pruebas web de contenido (24 adaptador + 4 cargador).
Lint de dominio/web y markdown pasan. Ambos adaptadores declaran capacidad local
de borradores; T-062 debe declarar que API carece de ella, probar rechazo explícito
y ejecutar el contrato público contra PostgreSQL real. No se acredita aún API.
T-010 además quedó verificada con pnpm verify completo, exit 0.

## Verificación prevista T-130

Pruebas de esquema antes de implementar: round-trip puntos/tier desconocidos;
rechazo de negativos, tiers fuera de rango, binding por nombre vacío o paso
verificado; una referencia no null inexistente continúa fallando. Verificar además
la misma guía publicada con DTO derivado sin pedir campos editoriales privados.

Evidencia T-130 (2026-11-09): prueba roja con los tres valores desconocidos,
después 67 pruebas de dominio verdes; líneas 97.90 %, branches 95.09 %, funciones
100 %. Lint dominio, typecheck de API y markdown verdes. La variante por nombre
no admite verificado ni un slug no null roto, tampoco campos desconocidos en la
variante de nodo. No se han ejecutado aún migraciones SQL T-127 para este cambio.

## Evidencia T-009/T-014 — fixture local completo

2026-11-09: content:validate pasa con la build real transcrita del HTML local;
las pruebas existentes del validador cubren fixture válido, inválido y publicación
pending (ver ejecución verify T-010). Autor por-confirmar, fuente sin licencia
asumida y rights_status=pending; cambiar solo review_state a publicado se rechaza.
Round-trip completo por el lector servidor local coincide con el documento;
modo público devuelve cero slugs y ningún autor placeholder. 14 habilidades ES/EN,
11 prioridades, 6 compras, 4 columnas de botín, 4 NPC más notas Coste/Aviso,
11 pasos de devoción y 13 constelaciones mencionadas. Las cifras corregidas
provienen del HTML; no se atribuye autoría, permiso ni verificación de juego.
T-015 debe convertir la paridad con la fuente en una prueba permanente.

## Evidencia T-015 — paridad permanente con el HTML

2026-11-09: snapshot independiente extraído del HTML en
`e2e/fixtures/original-guide.json`, con SHA-256 normalizado a LF para reproducirlo
en Windows/Linux. Cuatro pruebas Node pasan, incluidas 12 mutaciones que retiran
o alteran habilidades, traducciones, prioridades, compra/devoción, botín, NPC,
grupo omitido, Coste, introducción, callout y descargo. Comparación exacta de todos
los bloques textuales de spec §4, sin derivar el esperado del JSON importado.
La prueba además bloquea publicación pending y verifica ausencia pública.
`pnpm verify` completo exit 0: dominio 67, API 204 (9 integración omitidas aquí),
web 61; scripts 188 en total, con 2 omitidas por gitleaks no instalado. La prueba
SQL real previa de T-073 sigue siendo evidencia separada. Build inicial solo una
ruta de andamiaje; esta verificación no acredita UI ni cierre integral.

## Evidencia T-016 — catálogo completo de pares

2026-11-09: 10 maestrías de la fuente primaria citada en research.md; 45 pares y
45 ranuras únicas, sin tiers ni guías inventadas. Nombres EN factuales y rótulos
ES editoriales diferenciados en la atribución pública; rama 1.3.x, sin afirmar el
último parche. El autor de la estructura generada es el proyecto Grim Dawn Builds,
no un revisor humano ficticio. La build migrada conserva versión Sin confirmar,
borrador/pending/sin_verificar y fuente propia; entrada número 46 solo en local.

Siete pruebas del generador y cinco del lector servidor pasan. Se comprueban
cobertura total, orden de entrada invertido, ausencia de mutación, duplicados,
fuentes contradictorias, rechazo de cuerpos link_only, dos ejecuciones idénticas
y --check sin sobrescribir diferencias. Adaptador real: 45 placeholders públicos,
sin campos internos, guía pendiente ni su fuente; 46 entradas locales. Comandos:
`pnpm catalog:generate`, `pnpm catalog:check`, `pnpm content:validate`.
`pnpm verify` completo pasó (exit 0); no acredita todavía la UI, API de contenido,
Lighthouse/e2e, CI ni el cierre de la spec.

## Evidencia T-047 — controles de activos ya existentes

2026-11-09: verificado código existente en sus rutas vigentes tras T-051,
sin recrear validadores. assets:check pasa con manifiesto inicial vacío (0
entradas). Las seis pruebas checkAssetManifest pasan: activo aprobado sin licencia
rechazado, archivo de arte sin aprobación rechazado, aprobación sintética completa
aceptada y duplicados rechazados. La suite de esquema incluye las puertas de
procedencia. No hay activos de juego aprobados ni se añadieron imágenes oficiales.
T-048 sigue pendiente para glifos propios y resolución segura en la UI.

## Evidencia T-017 — base visual y fuentes

2026-11-09: tokens de spec §5/plan §7 aplicados, sin sustituir paleta/familias.
Cinco WOFF2 locales, tres familias, 116308 bytes, licencias OFL-1.1 conservadas;
procedencia y hashes de tarballs/binarios en docs/fonts.md, comprobados contra
archivos descargados. Cuatro pruebas de contraste pasan, incluidos rechazo de
bajo contraste/entrada inválida y umbral sin redondear. Los doce pares de texto
reales pasan; mínimo ash/panel-2=4.556..., sin añadir un color alternativo.

Verificación real temporal con Playwright 1.65.0, Chromium 158.0.8127.18 y axe-core
4.14.0: capturas inspeccionadas a 375/768/1280, sin overflow, errores JavaScript,
solicitudes externas ni violaciones axe en la ruta de andamiaje. Cuerpo Karla 16px;
h1 Oswald 40/61.44/96px. Al inicio se solicitan dos fuentes latinas locales;
una prueba explícita de cobertura solicita los cinco archivos (ñ/Ő/ASCII).
Las pruebas de teclado/reduced-motion insertan controles temporales después de
capturar la página real: foco 2px solid storm, Tab omite el botón desactivado,
animación/transition none al reducir movimiento. No son evidencia de flujos del
producto todavía no implementados. El servidor de pruebas se detuvo al acabar.

Revisión visual acotada por el agente principal: fuente/paleta/jerarquía dentro de
la spec y escala responsiva sin recorte. El contenido sigue siendo el h1 del
andamiaje, sin header/nav/cuerpo editorial/footer: T-019/T-038 siguen pendientes.
No se ejecutó la crítica formal con dos subagentes independientes ni se acredita
la revisión de cierre de ninguna spec. El detector manual Impeccable para los
archivos cambiados devolvió [] y exit 0; no se interpreta como auditoría completa.
Capturas/reporte locales en TEMP, apuntados por gd-t017-visual-path.txt.

pnpm verify completo exit 0, con check:contrast integrado antes del build. El
build emite advertencia de tamaño inicial raw 251.25kB frente a warning 250kB;
permanece bajo el límite bloqueante de 260kB. Transferencia estimada 72.65kB y CSS
4.33kB raw/1.19kB estimados. No es medición gzip/Lighthouse: T-042 sigue pendiente.
Los checks de gitleaks ausentes continúan omitidos y no acreditan el escaneo final
antes de push. No se han añadido dependencias UI de runtime ni hooks nativos.

## Evidencia T-018 — SEO en prerender e hidratación

2026-11-09: nueve pruebas pasan para URL/TransferState, title/description/canonical,
OG/Twitter, robots, limpieza de imagen/JSON-LD al navegar, escape de cierre de
script y rechazo de claves editoriales conocidas anidadas/ciclos/BigInt. Se
probaron URL con userinfo/query/fragmento, rutas externas o que escapan al prefijo
de la URL base. Los datos de prueba son sintéticos; no hay URLs con contraseñas
literales en el código. La validación ocurre antes de cambiar el head.

Build real con BASE_URL=<https://example.test/grim/>; verificación con Chromium
158.0.8127.18 sin JS y con JS: title/description/canonical/OG/Twitter y WebSite
presentes en el HTML, canonical único correcto en ambos casos. Un observer
registró la reasignación real del canonical durante hidratación y conservó la URL
configurada. Única clave pública gd transferida: gd:site-base-url, sin entorno
completo; cero errores JS/solicitudes externas. Servidor de pruebas detenido.
Reporte temporal apuntado por gd-t018-browser-path.txt. No acredita aún SEO de
rutas/guías que no existen; T-025/T-037 generan sus datos estructurados específicos.

pnpm verify completo exit 0, artefacto final reconstruido con default local-first
(canonical/WebSite verificados como localhost:4200). Advertencia raw inicial
252.88kB frente a warning 250kB, bajo error 260kB; transferencia estimada 72.94kB,
no medición gzip/Lighthouse. El guard local de secretos se ejecutó además sobre
los 210 archivos elegibles, rastreados y nuevos, con 0 hallazgos; no sustituye a
gitleaks real antes de push (sigue pendiente). Imagen social propia pendiente
T-038; el servicio admite sus metadatos, sin emitir un archivo inexistente.

## Evidencia T-019 y T-132 — layout y presupuesto real

2026-11-09: cabecera/nav/pie compartidos, único main proyectado y skip link nativo;
Home elimina su main duplicado. UI/aria etiquetados con i18n; marca textual propia,
aviso no afiliación y navegación sin menú oculto. Tres pruebas del layout y smoke
App pasan; estado activo Inicio/Catálogo/query conserva aria-current único. Prefijo
gd de componentes compartidos añadido a la regla ESLint junto con app, sin
eliminar la regla. Los destinos Catálogo/Acerca/Legal aún dependen de sus tareas;
no se han declarado funcionales esas páginas por existir sus enlaces.

Gzip real inicialmente 90967 bytes: la nueva puerta rechazó el exceso de 967,
aunque la estimación Angular parecía suficiente. Sustituir RouterLinkActive por
estado de navegación con suscripción NavigationEnd/signal y teardown DestroyRef,
conservando RouterLink y los comportamientos probados, redujo a 87744 bytes.
No cambió el presupuesto aprobado 90000. Guard raw aproximado final 280/300kB;
pnpm build ejecuta obligatoriamente la segunda puerta gzip. Tres pruebas del
checker cubren imports compartidos/lazy Home, metadatos incompletos, scripts
externos, archivos ausentes y exceso real en CLI. Stats queda fuera de browser.

Playwright 1.65.0/Chromium 158.0.8127.18/axe-core 4.14.0: a 375/768/1280, JS y
no-JS, un main, aria-current correcto, sin overflow, enlaces con href y objetivos
mínimos 24px; Tab muestra skip con outline 2px y Enter enfoca main nativamente.
Axe ejecutado con JS en las tres anchuras: cero violaciones. Sin errores de página
ni solicitudes externas. Los cuatro JS solicitados con JS coinciden exactamente
con los que mide el checker (incluida Home lazy). Capturas JS inspeccionadas; el
contenido sigue siendo el andamiaje. Servidor de prueba detenido, reporte/capturas
locales apuntados por TEMP/gd-t019-browser-path.txt. No se usa la lista vacía del
reporte no-JS para afirmar que axe se ejecutó sin JS.

Detector Impeccable manual para markup cambiado: [] y exit 0. Revisión visual
acotada por agente principal; no es crítica formal con dos subagentes ni la puerta
de cierre de spec. pnpm verify completo exit 0, incluido gzip 87744/90000. T-042 y
T-126 conservan los presupuestos de otras rutas, CSS/HTML y Lighthouse; no hay
cierre global de rendimiento todavía ni push/PR.

### T-022/T-023: filtros puros y estado compartible

2026-11-09: funciones/pruebas heredadas de 38f2f8e, sin modificaciones de runtime
necesarias para la aceptación actual. Se agregaron tres casos: búsqueda ES/EN,
inmutabilidad con entradas congeladas y round-trip canónico de todos los grupos
con tildes/espacios y caracteres reservados. `pnpm test --include
src/app/features/tier-list/filter.spec.ts`: 19/19 pasan; ESLint de ambos archivos,
markdownlint y git diff --check: exit 0. No se acredita un ciclo rojo anterior al
código heredado: desviación del criterio histórico de T-022 registrada, no prueba
retroactiva. La integración visual de filtros y recarga real sigue en T-025.

### T-026/T-027: layout y navegación puros

2026-11-09: implementación heredada conservada. Se agregaron pruebas para bosque
vacío, desempates con nodos congelados, ciclo desconectado/autociclo y cadena
de 120 niveles con aristas, coordenadas únicas y navegación padre/hijo completa.
`pnpm test --include src/app/shared/svg/layout.spec.ts`: 20/20 pasan, incluida
la prueba de humo de layout de 120 nodos <16ms. ESLint de los tres archivos:
exit 0. No se acredita el rojo histórico anterior a la implementación existente.
No prueba los futuros componentes SVG, objetivos táctiles, lectores de pantalla
ni capturas de T-028–T-030.

### T-127: proyecciones públicas PostgreSQL completas

2026-11-09: migración 0002_public_content y snapshot generados con Drizzle;
backfills/vistas agregados a la nueva migración. Sin cambios en 0000/0001.
sources.slug, prioridad con posición, relación build_constellations y tier nullable
preservan el contrato. v_public_build_documents reconstruye todas las colecciones
con lista permitida de campos y referencias por slug; API todavía pendiente T-060.

Prueba de paridad nueva falló primero por tier not-null; después pasa con el cambio.
PostgreSQL 17 aislado (imagen fijada de Compose), migraciones aplicadas como
migrator por TCP: documento completo leído como api_ro valida PublicBuildSchema;
conserva valores desconocidos, menciones sin paso y JSON canónico, excluye campos
extra canarios de highlights/bindings/layout y evidencia editorial. Fuentes y
autores no referenciados quedan ocultos; link_only no entrega cuerpo; despublicar
retira sus proyecciones. Tier entries comprueba estados y referencias mientras
lista/entrada son públicas. Api_ro sin permisos de lectura/escritura en ninguna
tabla editorial base; vistas nuevas solo SELECT. Prueba ACL independiente de
rechazo 55000 de vistas no actualizables, para no confundir ese error con permisos.

Upgrade con fuente legacy y marca bootstrap se prueba dentro de rollback antes
de aplicar permanentemente la migración al fixture aislado. Solo se desactiva y
reactiva gates_sources_fixture durante backfill por el propietario. Readiness
deriva hashes del journal y detecta la migración pendiente sin hashes duplicados.
Drizzle generate: sin cambios; db:check/typecheck: pasan. Escalamiento acotado
identificó dos tests de inventario/journal obsoletos; alcance registrado antes
de corregirlos, conservando sus controles exhaustivos y generación sin diff.

`RUN_DB_TESTS=1 pnpm verify`: exit 0; dominio 67, backend 219 (incluye 13 pruebas
reales PostgreSQL), web 80, scripts 201 pasan/2 omitidas (Gitleaks no instalado
todavía). Build y puerta gzip: 87744/90000. Log local TEMP/gd-t127-verify.log.
Guard de secretos adicional sobre los 218 archivos elegibles tracked/untracked:
cero hallazgos; no sustituye el escaneo Gitleaks pendiente antes de push.
Contenedores de prueba eliminados, sin modificar el volumen PostgreSQL del usuario.

### T-059: seed implementado y probado; cierre operativo pendiente

2026-11-09: seed.mts valida recursos canónicos completos antes de conectar,
solo permite APP_ENV development/test y usa credencial propia importer mediante
SecretSource. Transacción con bloqueo de content_origin, rechazo de bootstrap,
UPSERT parametrizado por slug, sustitución de hijos y protección de origin
editor/bootstrap. Una prueba real reprodujo la carrera entre comprobación de
existencia y creación por editor; ON CONFLICT ahora comprueba origin de forma
atómica y conserva la fila del editor. Sin migraciones ni cambios de roles en seed.

Migración 0003_unknown_catalog_playstyle generada por Drizzle: solo elimina
NOT NULL de tier_entries.playstyle. Una prueba falló con 45 estilos hibrido
inventados; ahora los placeholders conservan null y builds.playstyle sigue
obligatorio. No se cambió 0000–0002; T-129 renumerada a 0004_editor_permissions.
Escalamiento diagnóstico y ampliación SDD registrados antes de corregir esquema.
ESLint amplía su selector a .mts: el entrypoint ya pasa api:lint con las mismas
reglas, sin exclusiones nuevas.

Pruebas reales en PostgreSQL 17 desechable, puerto aleatorio solo loopback y rol
importer sin privilegios: migrate desde vacío → seed dos veces mantiene conteos,
14 habilidades/13 constelaciones de la guía local y 46 entradas; vistas muestran
45 placeholders, ninguna guía pending. Documento publicado adicional enteramente
sintético conserva exactamente su DTO público completo. Fallo tardío revierte
también escrituras anteriores; origin editor y marca bootstrap abortan. Fixture
usa trust solo en ese contenedor de prueba efímero; esto no acredita el flujo
operativo con archivo secreto/contraseña del entorno real.

CLI compilada `APP_ENV=production pnpm db:seed`: rechaza con exit 1 y mensaje
constante seed failed: environment antes de lectura de contenido/credenciales.
El lector resuelve content relativo al módulo para que funcione desde el workspace
API y desde la raíz. Credenciales no se aceptan por argv ni se imprimen.

`RUN_DB_TESTS=1 pnpm verify`: exit 0; dominio 67, backend 235, web 80 y scripts
201 pasan/2 omitidas (Gitleaks pendiente). Typecheck, lint, formato, build y
gzip 87744/90000 pasan. Drizzle generate: sin diff. Log TEMP/gd-t059-verify.log.
Contenedores de prueba retirados. La instancia del usuario consultada en modo
lectura conserva cero tablas públicas y no tiene importer/editor provisionados;
no se migró ni sembró ese volumen durante estas pruebas. T-059 queda sin marcar
hasta completar habilitación de importer con archivo propio y comprobar el flujo
operativo; coordinar con T-082 antes de habilitar seed en la instancia local.

### Cierre T-082 y T-059: operación real con secretos por rol

2026-11-09: resuelta la dependencia operativa registrada arriba. Gestor de
rotación/activación local implementado con registro ignorado de recuperación,
contraseñas por stdin, protección de archivos y bloqueo global de .env. Trece
pruebas de protocolo más tres integraciones reales con imagen gd-api:t082-review
pasan: SCRAM, rechazo de contraseña anterior, API recreada y ready, activación
explícita de importer y recuperación tras fallo simulado de compensación con PID
anterior confirmado terminado. Fila canaria conservada. Ningún valor secreto en
salida/argv; comparaciones de secretos en pruebas producen solo booleanos.

La primera integración identificó localhost trust; las sondas ahora usan db por
bridge y rechazan fallos de red como prueba de revocación. Se corrigió la ubicación
de la integración tras check-boundaries: scripts/rotate-secret.int.spec.mts, sin
excepción api→scripts; escalamiento diagnóstico y ampliación SDD antes del cambio.
`test:rotation` integra esa puerta en verify, activada con RUN_ROTATION_TESTS=1.
Runbook en [rotation.md](../../docs/security/rotation.md).

Instancia del usuario: comprobado volumen grim-dawn-builds-pgdata y PostgreSQL
17.11 antes de recrear solo el contenedor; volumen conservado. En volumen existente
se ejecutó el hook de reprovisión, luego Compose inició el migrador one-shot y API.
Journal con cuatro migraciones, nueve vistas públicas y /ready 200. Logging real:
prefix SQLSTATE/usuario/db/app/cliente/sesión, verbosity terse, statement de error
panic (sin dump SQL normal). Docker mantiene MemTotal 4104323072 bytes.

`pnpm secrets:rotate importer --activate` pasó con archivo propio. Dos ejecuciones
del seed compilado en contenedor efímero, sin puerto host, sin credenciales ajenas
y mounts readonly: 1 build, 46 entradas, 45 públicas, ninguna build pública;
guía conserva borrador/pending. Después se verificó dos veces el comando raíz:

```powershell
$env:APP_ENV='development'
pnpm db:seed
```

El lanzador obtiene solo nombre de BD y red mediante metadatos del contenedor,
no lee .env completo ni valores secretos. Usa gd-api:local ya construida, sin pull
implícito y con límites 256MB/0.5 CPU, filesystem readonly y sin capacidades.
Solo recibe content y el archivo importer. APP_ENV=production se comprobó con el
comando real: exit 1, sin lanzar Docker. La entrada directa del workspace API se
conserva para entornos con su propia inyección de conexión/credencial.

Verificación final `RUN_DB_TESTS=1 RUN_ROTATION_TESTS=1 pnpm verify`: exit 0;
dominio 67, backend 235, rotación 3, web 80, scripts 219 pasan/2 omitidas (Gitleaks
local pendiente). Build/gzip 87744/90000. Log TEMP/gd-t082-t059-verify.log.
La imagen de prueba quedó local; proyectos/secretos temporales de integración
retirados. Stack del usuario healthy, volumen conservado; sin push/PR. Esto cierra
T-059/T-082, no la spec: API de contenido, interfaz y puertas finales siguen pendientes.

### T-060: API pública de contenido validada

2026-11-09: cinco GET /api/v1 implementados con consultas parametrizadas sobre
vistas públicas; dominio valida todos los DTO y publicFilter se aplica como
segunda defensa. Guías link_only no entregan cuerpo. Tier list usa un snapshot
SQL con catálogos, pares normalizados por slug, entradas y atribución pública.
Estados ocultos, referencias a guías no públicas y fuentes no utilizadas se
filtran; claves privadas inesperadas en contenido visible fallan cerrado.

Pool perezoso api_ro, cuatro conexiones máximas, timeouts, sesiones readonly y
verificación del rol antes de lectura. /health conserva independencia de BD;
rutas de contenido exigen readiness. Slug inválido se rechaza antes de E/S con
400; ausente/no público devuelve 404; configuración/SQL/DTO inválido → 503 sin
SQL, documento ni traza. Cierre de Fastify cierra el pool. No escritura ni fixture
de runtime en API; CORS y endurecimiento HTTP siguen pendientes de T-061.

Pruebas de mappers/rutas fallaron primero por módulos/rutas ausentes; después
pasan junto con la regresión de app. PostgreSQL 17 aislado ejecuta el contrato
compartido vía HTTP inject y el adaptador de pool real, con rol api_ro y readiness
real. Quince pruebas de integración pasan: guía completa/atribución/privacidad,
autores visibles, catálogo real de 45 combinaciones, enlace externo, ausencia de
borrador/pending, determinismo, retirada inmediata al cambiar derechos/estado,
denegación de tablas base/escritura y 503 tras retirar una migración, con health 200. Recursos privados anidados de la misma fuente se normalizan solo en fixtures
de test conservando campos públicos y canarios; prepareSeed productivo no se relajó.

Instrumentación real de pg.Client.query: 37 lecturas HTTP, máximo 3 consultas por
lectura (límite aprobado 6), incluido control de rol y readiness. Registro de
contadores sin datos/SQL en TEMP/gd-t060-query-budget.json. Suite enfocada final:
15/15 pasan. API typecheck, lint, lint adicional de integración y markdownlint pasan.

`RUN_DB_TESTS=1 RUN_ROTATION_TESTS=1 ROTATION_API_IMAGE=gd-api:t060-review pnpm verify`:
exit 0, dominio 67, backend 260, rotación 3, web 80, scripts 219 pasan/2 omitidas
(Gitleaks local pendiente). Build/gzip 87744/90000. Log TEMP/gd-t060-verify.log;
build de imagen local TEMP/gd-t060-image.log.

Imagen comprobada aplicada a API local conservando PostgreSQL/volumen. Prueba
HTTP real en 127.0.0.1:3000: health/ready 200, builds/slugs vacíos, tier-list/principal
200 con 45 entradas, autor grim-dawn-builds 200, por-confirmar y guía pendiente 404;
sin claves privadas en las respuestas. Después se precalentó el pool con una
lectura, se rotó api_ro con el comando real y se verificó catálogo 200/45 entradas
antes y después: nuevo proceso vuelve a autenticar y conserva datos. Ningún valor
secreto apareció en argv/salida ni se versionó. Sin push/PR; la spec sigue abierta.

### T-061: CORS y límites HTTP locales

2026-11-09: configuración valida solo el origen aprobado, límites numéricos y
valores por defecto; Compose pasa únicamente esas opciones públicas a API.
Hooks Fastify nativos, sin dependencias nuevas: GET/HEAD/OPTIONS, rechazo de otros
orígenes/métodos/cuerpos, cabeceras de seguridad/no-store, 404 y errores constantes.
Logs conservan método/ruta registrada e identificador generado por servidor,
sin URL cruda, query, headers, cuerpo ni mensaje/stack del error original.

Límites operativos: cuerpo 16384 bytes (API_BODY_LIMIT_BYTES entre 1024–65536),
120 solicitudes/minuto/IP (API_RATE_LIMIT entre 1–10000), ventana fija monotónica,
1024 IPs máximas en memoria, limpieza al expirar y rechazo si se llena. Incluye
health/ready y solicitudes inválidas. trustProxy false: X-Forwarded-For no permite
cambiar de cuota. 429 incluye Retry-After; conexión/petición configuradas a 10s,
keep-alive 5s. API no acepta cuerpos en sus métodos de lectura; cierra conexión
al rechazar cuerpo. No HSTS en HTTP local. CORS no concede credenciales y solo
permite Accept/Content-Type en preflight. No representa autorización para publicar
contenido ni sustituye las puertas de PostgreSQL/dominio.

Pruebas iniciales rojas por módulo/configuración ausentes; después ocho pruebas
HTTP pasan, más regresión de configuración/app/secretos. Escalamiento diagnosticó
un AppConfig antiguo en secrets.spec.ts y tipos de serializers; alcance ampliado
antes de corregir consumidor, sin desactivar strict ni quitar campos de seguridad.
Error serializado usa mensajes/stack constantes; unknown se estrecha antes de uso.
Los canarios en URL, query, request-id, x-request-id y errores no aparecen en logs
ni respuestas. Documentación Fastify instalada confirma requestIdHeader false.

`RUN_DB_TESTS=1 RUN_ROTATION_TESTS=1 ROTATION_API_IMAGE=gd-api:t061-review pnpm verify`:
exit 0, dominio 67, backend 269, rotación 3, web 80, scripts 219 pasan/2 omitidas
(Gitleaks local pendiente). Build/gzip 87744/90000. Log TEMP/gd-t061-verify.log.
Imagen construida y aplicada a API local conservando BD/volumen.

HTTP real: catálogo 200 con origen localhost:4200; 127.0.0.1:4200/null reciben 403;
preflight GET 204, preflight POST 403, POST real 404, exceso de cuerpo 413,
cuerpo de lectura 400 y HEAD 200 sin cuerpo; respuestas con nosniff/DENY/no-store.
Contenedor de prueba aislado sin red ni credenciales, cuota dos: 200/200/429,
Retry-After 60. Fixture retirado; no se agotó la cuota de la instancia del usuario.

Chromium real desde página temporal en localhost:4200: GET y preflight Content-Type
legibles con 200; credentials include bloqueado; origen 127.0.0.1:4200 bloqueado.
POST JSON en contexto nuevo bloqueado por preflight; con permisos de encabezados
ya cacheados puede llegar al servidor como método CORS safelisted y recibe 404.
La defensa de métodos está en el servidor: no se atribuye ese bloqueo a CORS solo.
Reporte sin datos sensibles en TEMP/gd-t061-browser-report.json; navegador y servidor
temporal cerrados. No cambios a reglas de publicación ni secretos en repo/argv/salida.

## T-062: adaptador HTTP de prerender

Pruebas Node primero fallaron por módulos aún inexistentes; luego 7 pasan,
incluyendo HTTP nativo que rechaza redirecciones y aborta una respuesta atascada
en 5 s, DTO privado/no publicado inválido y errores sin causa/cuerpo/URL.
El selector rechaza fuente/modo inválido, release implícito/fixture y drafts API;
fixture local conserva la revisión de borradores, API pública no la habilita.
Initializer SSR espera ready y slugs y transfiere exclusivamente source/flag.

`RUN_DB_TESTS=1 pnpm test:api-adapter`: 12 pruebas compartidas T-063 pasan con
ApiContentRepository real por HTTP TCP hacia imagen `gd-api:local` y PostgreSQL
17.11 fijado en contenedores aislados. Sin imports web→api/api→web ni cambios de
la guardia; orquestación de prueba explícita en tests/integration. Recurso de
prueba sin volumen persistente, PostgreSQL 512 MB y API 256 MB; todos sus
contenedores/red retirados al terminar. Trust solo en fixture efímero; no acredita
SCRAM, que tiene su evidencia independiente en T-082.

Regresión backend activada: 21 archivos, 269 pruebas pasan tras extraer la
normalización compartida de fixtures sin relajar prepareSeed. Build fixture
pasa; build con BUILD_MODE=release y CONTENT_SOURCE=api hacia API local pasa y
HTML contiene gd-content-source con source api e includeDrafts false. Con API
inaccesible en loopback puerto 1 el build sale 1 durante extracción de rutas:
«API de contenido no disponible o respuesta inválida», sin fallback. Logs en
TEMP/gd-t062-build-fixture.log, gd-t062-build-api.log y gd-t062-build-down.log.
JavaScript inicial permanece 87744/90000 bytes gzip. El informe final de release,
equivalencia de páginas y TransferState de contenido por página siguen T-074,
T-068 y T-020; no se atribuye a esta tarea su implementación.

Cierre T-062: pnpm verify sin activar pruebas Docker pasa; dominio 67, backend
(unitarias activas) 236 con 33 integraciones omitidas explícitamente, web 80 y
scripts 226 pasan con 2 omisiones porque Gitleaks aún no está instalado.
Las 3 pruebas de rotación también se omiten explícitamente en este modo.
La regresión backend con RUN_DB_TESTS=1 anterior sí ejecutó las 269, y el contrato
contenedorizado adicional ejecutó las 12. Log general TEMP/gd-t062-verify-fixture.log.
Marcador fixture comprobado en HTML final. Guardia adicional sobre los 243
archivos elegibles tracked/untracked: 0 hallazgos; no sustituye al escáner Gitleaks.
Se construye en memoria la URL sintética inválida con userinfo del test para
comprobar su rechazo sin introducir una URL literal que active la guardia.

## T-074: puerta de release

Uso desde PowerShell, con API actualizada y lista:

```powershell
$env:CONTENT_SOURCE='api'
pnpm build:release
pnpm check:release
```

API_BASE_URL pública opcional (default loopback puerto 3000); BASE_URL configura
la URL pública del sitio. No se entregan credenciales al build. El proceso hijo
Angular solo recibe esas variables públicas, source api, modo release, drafts
false y variables mínimas del sistema; NODE_OPTIONS y secretos se excluyen.
La comprobación de centinelas completa sigue siendo T-084.

La API devuelve X-Content-Migration solo en readiness exitosa. Identidad v1 =
SHA256 de JSON del array de hashes SQL Drizzle ordenados por journal, sin
normalizar bytes/saltos. API y script tienen el mismo vector conocido probado;
no se toma el valor remoto como expectativa. Se verifica antes y después del
prerender. El API no migra ni necesita otros secretos para calcular esa identidad.

Angular construye en dist/.release-* aislado. Antes de promoverlo comprueba
presupuesto inicial gzip, marcador público api/sin drafts y huella de archivos.
contentHash v1 cubre pares ruta relativa POSIX/hash SHA256 de todos los archivos
regulares del directorio browser en orden lexicográfico; rechaza symlinks.
Solo tras éxito se promueve a dist/grim-dawn-builds y se escribe atómicamente
el informe dist/build-info.json con source, migration, builtAt UTC y contentHash.
Cada intento invalida antes el informe viejo. check:release recomputa identidad
local, fecha y hash del artefacto, y vuelve a exigir API lista sin redirects.
No acredita todavía equivalencia de páginas/sitemap T-068 ni cierre de la spec.

Pruebas iniciales: 3 fallos API y módulos de scripts ausentes antes del código.
Después pasan 18 pruebas focalizadas API (incluyen header solo ready, fallo
saneado de huella y vector/orden/bytes) y 6 pruebas Node de scripts con fuente,
fecha, drift, archivo alterado, symlink, fallo antes/después de build y reporte
previo. Se corrigió el test toReversed por copia+reverse para conservar ES2022.
Sin relajar tipos/lint/fronteras. Imagen gd-api:t074-review construida, manifiesto
sha256:0a24c6ebe8593645ac24d5831a7e3dcb5e4b14c58feceb72e8ae4af7413ab48e;
recreada solo API local, sin cambios al volumen PostgreSQL. Release real y
check:release pasan. Casos CLI reales fixture, API inaccesible y servidor temporal
con huella distinta devuelven 1 e invalidan el informe anterior; el servidor
solo de prueba se cerró. Logs TEMP/gd-t074-image.log y gd-t074-build-release.log.

Cierre T-074: RUN_DB_TESTS=1 RUN_ROTATION_TESTS=1 con
ROTATION_API_IMAGE=gd-api:t074-review pnpm verify pasa. Dominio 67, backend 272,
rotación real 3, web 80 y scripts 232 pasan (234 totales, 2 omisiones explícitas
por Gitleaks no instalado). Log TEMP/gd-t074-verify.log. Después se reconstruyó
release y check:release volvió a pasar: TEMP/gd-t074-build-release-final.log.
Artefacto final API validado; memoria Docker aún 4104323072 bytes, sin incremento.
Guardia adicional sobre 247 archivos elegibles tracked/untracked: 0 hallazgos.
El cierre completo de spec y sus cuatro revisiones siguen pendientes.

## T-129: CLI editorial local

Contrato y uso en docs/content/editorial-cli.md. Pruebas antes de implementar:
editor.spec falló por módulo ausente; seis integraciones fallaron sin permisos;
launcher Node falló por módulo ausente. Mapping completo extraído a
write-content.mts sin cambiar las políticas de seedData: sus 10 unitarias y 5
integraciones originales pasan. Entrada estricta por target/slug y dependencias
canónicas, antes de conectar; APP_ENV local explícito y solo archivo secreto editor.

Editor tiene su propia transacción y verifica current_user/no privilegios; conserva
UUID del target y contenido completo, marca origin editor, compara dependencias
existentes sin cambiarlas y permite crear ausentes solo con declaración explícita.
Las referencias de una lista se resuelven desde BD sin incluir guías ajenas en
el input. Siete pruebas PostgreSQL nuevas pasan: guía completa pending sin publicar,
catálogo con referencias existentes, round-trip público sintético y firmantes
independientes, conflicto compartido, rollback tardío, creación declarada,
editor sin DDL/escritura al marker, importer bloqueado tras marker y conflicto de
parent skill con rollback de dependencias nuevas.

Drizzle generó 0004_editor_permissions.sql/snapshot; generate posterior sin diff y
check pasan. El primer intento de integración tras GRANT DML seguía fallando por
triggers invoker existentes que leen content_origin: se añadió SELECT del marcador
antes de reintentar y se registró el ajuste en plan, sin permisos mutables sobre él.
No se modificó historial previo ni se habilitó LOGIN desde SQL de migración.

Imagen gd-api:t129-review, manifiesto
sha256:5c1e429e1dd4b4842166f6a40b32a4034be6706f4097b718a2a748400b1e9fc3.
Migrador real con su propio rol aplicó 5/5; recreada solo API. Se activó editor
mediante secrets:rotate editor --activate, sin imprimir credenciales. Comando raíz
real db:edit guardó el documento pendiente original sin alterar contenido ni
estados; quedó origin editor, review borrador, rights pending. API sigue con cero
guías públicas y catálogo 45. Input temporal fuera del repo; ningún secreto nuevo
rastreado. Launcher solo monta input/credencial editor readonly, no usa puerto DB
ni carga secretos ajenos. Sus 3 pruebas Node pasan; lint/tipos/fronteras/alcance pasan.
Logs en TEMP/gd-t129-editor-db.log y gd-t129-image.log. La spec aún no está cerrada.

Cierre T-129: verificación completa con RUN_DB_TESTS=1,
RUN_ROTATION_TESTS=1 y ROTATION_API_IMAGE=gd-api:t129-review pasa. Dominio 67,
backend 285, rotación real 3, web 80 y scripts 235 pasan; scripts total 237 con
2 omisiones explícitas por Gitleaks todavía no instalado. Logs
TEMP/gd-t129-verify.log. build:release y check:release pasan con quinta migración
(TEMP/gd-t129-release.log), 87744/90000 bytes gzip iniciales. Input editorial
temporal eliminado; solo permanecen contenedores db/api normales. Guardia
adicional de secretos sobre 256 archivos elegibles: 0 hallazgos. Las cuatro
revisiones formales y el resto de tareas de la spec siguen pendientes.

## T-072: bootstrap en base vacía

Plan §17.22 y uso en docs/content/bootstrap.md. Unitarias antes del módulo y
launcher antes de existir fallaron; la suite PostgreSQL inicial falló por lectura
del journal no concedida aún. Drizzle generó 0005_bootstrap_permissions con solo
USAGE drizzle/SELECT journal importer. generate posterior sin diff y check pasan.
No DDL/roles/secreto ajeno desde bootstrap. El número de migraciones se deriva del
journal; seis actualmente, sin duplicarlo en runtime.

Ocho unitarias de bootstrap y siete integraciones reales pasan: carga pendiente
completa, marker/hash/migración/fecha, rechazo de cualquier contenido existente,
drift, rollback tardío sin marker, dos bootstrap simultáneos con un único éxito,
seed esperando al lock y rechazado tras commit, editor esperando y permitido tras
commit. Pruebas leen vistas con api_ro y catálogo suelto usa un activo pending
canónico; se corrigieron esos dos fixtures sin ampliar permisos del importer a
vistas ni relajar columnas obligatorias. Autoría/derechos de la guía sin cambios.

Launcher comparte código de Docker con seed pero conserva entrypoints fijos;
contadores o códigos de lista permitida, sin stderr crudo. Siete pruebas Node
focalizadas (tres bootstrap y cuatro seed originales) pasan antes del caso
adicional de error bootstrapped; se corrigió un reemplazo mecánico de texto del
helper antes de esa verificación, sin atribuirle un rojo funcional histórico.
UID/GID no root en Linux para archivos owner-only y límite swap igual a memoria.

Imagen gd-api:t072-review, manifiesto
sha256:ef6a2e2a4dd7b257b7e863cadaa5bedd0ea628e98458bc34e1c299f3fc53be24.
Smoke completo en proyecto Compose temporal separado, red interna, sin puerto DB,
PostgreSQL tmpfs/512MB e imagen CLI endurecida con su único archivo importer.
Migrador propio aplicó seis; launcher raíz real con root temporal logró bootstrap,
rechazó repetición/seed, y launcher editor con credencial propia editó tras marker.
Resultado: marker 1, origen bootstrap antes de editar, rights pending/review borrador,
0 guías y 45 entradas públicas; edición posterior cambió origin a editor y seed
siguió bloqueado. Proyecto/red/archivos temporales retirados. Trust exclusivamente
en este fixture aislado; autenticación SCRAM tiene evidencia separada T-082.
Helper/reporte en TEMP/gd-t072-container-smoke.mts y .log, sin contraseñas en salida.

Base principal actualizada por migrador a seis migraciones y recreada solo API;
ningún borrado del volumen editorial. El entrypoint raíz real rechazó not-empty
en la principal: hash de las 22 tablas de contenido y marker idéntico antes/después,
23 tablas verificadas; marker sigue ausente. No se fuerza cutover sobre contenido
existente.

Regresión T-072: el fixture T-073 aplicaba SQL a mano sin crear la relación de
journal que prepara Drizzle antes de la primera migración; falló 0005 con 42P01.
Se amplió plan/tarea antes de editar gates.int.spec y se creó la estructura real
(id SERIAL, hash text NOT NULL, created_at bigint) como migrator, según dialecto
local Drizzle 0.45.4. No se omite SQL ni se conceden privilegios superiores. Sus
13 pruebas PostgreSQL pasan de nuevo (TEMP/gd-t072-gates.log). El launcher ahora
puede relatar también el código fijo seed failed: bootstrapped, con prueba de
redacción adicional, sin reenviar stderr crudo.

Cierre T-072: pnpm verify con RUN_DB_TESTS=1, RUN_ROTATION_TESTS=1 y
ROTATION_API_IMAGE=gd-api:t072-review pasa. Dominio 67, backend 300, rotación 3,
web 80 y scripts 239 pasan (241 totales, 2 omisiones explícitas por Gitleaks no
instalado). Log TEMP/gd-t072-verify.log. build:release y check:release pasan con
seis migraciones: TEMP/gd-t072-release.log; inicial 87744/90000 bytes gzip.
Guardia adicional sobre 264 archivos elegibles tracked/untracked: 0 hallazgos.
Bootstrap y edición real positivos se verificaron aislados; base principal sigue
sin marker y conserva exactamente sus datos. La spec completa/revisiones finales
siguen pendientes, sin push/PR.

## T-084: guardia del frontend público

Plan §17.23: whitelist compartida public-build-env con modos públicos fixture/local
y api/release, ambos sin drafts. runRelease sigue exigiendo api explícito y los
controles de T-074. La whitelist permite solo configuración pública/variables
mínimas del sistema y fuerza controles fijos; rechaza URLs no públicas o con
userinfo/query/fragmento. NODE_OPTIONS y claves desconocidas quedan fuera. Los
comandos locales de preview no se certifican como release por esta guardia.

check:public-build genera en memoria nueve canarios (C1 roles DB/superusuario,
C2 CI_TOKEN, C3 DEPLOY_TOKEN, C4 SIGNING_KEY y nombre desconocido); no se activan
proveedores ni se guardan valores en repo. También vigila valores sensibles del
entorno original y referencias `_FILE`, sin leer credenciales. Ejecuta Angular real
en fixture público, salida aislada y logs del hijo descartados. Verifica output
nuevo no vacío y todo dist, incluido build-info existente, sin exclusiones por
extensión. Analiza nombres/bytes de binarios/maps/server/stats y representaciones
raw/JSON/URL/base64/UTF16; patrones reutilizados con path neutro para impedir
exclusiones de Markdown/fixtures. Ilegibles/symlinks fallan cerrado; error solo
código, limpieza del output propio acotada a dist/.public-check-*.

runRelease usa la misma guardia antes de promover staging y sobre el JSON exacto
del informe aún no escrito. Ningún informe válido queda tras un rechazo.
verify exige check:public-build después de build, sin depender de Docker.

Antes del código, pruebas fallaron por módulos ausentes; antes de integrar,
fallaron dos pruebas al faltar guardia en release/verify. Después pasan las
15 focalizadas de scanner/release/verify. Canarios inyectados en bundle, map,
binario, filename, JSON de informe y archivo residual se detectan; patrón de token
sintético armado en memoria también, incluso en README.md. Sin imprimir valor ni
ruta contaminada; symlink y artefacto vacío rechazados. Se reubicó el caso de
residual después de preparar su fixture para conservar el orden de setup.

Comando real check:public-build pasó con output fixture aislado. Release real
runRelease con entorno centinela pasó; escaneo posterior de todo dist = 20 archivos,
source api, canarios ausentes. Log TEMP/gd-t084-api-canary.log. Ambos conservaron
runtime sin cambios y ninguna dependencia nueva al cliente. Guardia de repo y
regresión se registran al cierre; esta tarea no sustituye Gitleaks ni la revisión
formal de seguridad pendiente al cerrar toda la spec.

Cierre T-084: pnpm verify offline pasa (TEMP/gd-t084-verify.log), incluida la
comprobación Angular real con canarios al final: 39 archivos sin valores/patrones.
Dominio 67, API unitarias 253 pasan/47 integraciones omitidas explícitamente,
rotación 3 omitidas, web 80 y scripts 244 pasan (246 total, 2 omisiones por Gitleaks
no instalado). No hubo cambios backend en esta tarea; la ejecución completa de
300 backend/3 rotación tiene evidencia T-072. Se conservan ambas evidencias y no
se presenta la pasada offline como ejecución de integraciones.

Al cierre, se unificó la serialización del informe en una única cadena, analizada
antes de promoción y escrita sin regenerarla después. Las 6 pruebas focalizadas
scanner/release pasan otra vez; release real y check:release pasan
(TEMP/gd-t084-final-unit.log, gd-t084-release.log). Gzip inicial permanece
87744/90000, sin dependencia cliente nueva. Guardia de secretos de todos los
267 archivos elegibles: 0 hallazgos. Informe final source api/migración actual;
ningún valor centinela ni credencial se añadió al repo. Cierre de spec/revisiones
formales y otras tareas siguen pendientes, sin push/PR.

## T-083: escáner nativo y hook de commit

El hook/config/workflows/tests ya existían; no se acredita un rojo histórico.
Se planificó antes el instalador/portabilidad/validación pendiente (plan §17.24).
Cuatro pruebas de instalación fallaron inicialmente por módulo ausente y luego
pasan: pins/plataformas, hash antes de extracción/ejecución, promoción con versión
exacta y rechazo de symlinks. setup:gitleaks real descargó/verificó SHA e instaló
8.30.1 en .tools/gitleaks/8.30.1 ignorado, sin PATH global ni secretos/proveedores.
Proveniencia/hashes en tooling-provenance.md.

La primera ejecución real detectó config inválida: allowlist vacío rechazado por
Gitleaks. Se retiró el bloque, sin excepciones de proyecto. Los tokens sintéticos
repetitivos heredados no superaban entropía y una secuencia de alfabeto también
fue ignorada por los filtros predeterminados. Se usa generación aleatoria en
memoria, nunca un token emitido por GitHub ni un literal en fuente; no se modificó
la regla ni su umbral. Estos eran fallos del fixture, no hallazgos secretos reales.

Hook convertido de CRLF a LF, atributo específico y modo 100755. Prefiere nativo
local y luego PATH, versión exacta y fallo cerrado con setup:gitleaks. Pruebas
usan Git real sin depender de sh en PATH del host. Los 23 tests del escáner pasan,
0 omitidos: historial actual limpio, commit sintético detectado/redactado, repo
limpio, rangos PR, commit limpio aceptado y commit secreto bloqueado, falta de
herramienta y versión incorrecta bloqueadas. Cleanup de repos/informes sintéticos
valida rutas absolutas/prefijos. Log TEMP/gd-t083-detection.log; ningún token en
salida. Disponibilidad local/CI ahora se exige, no se omite.

Snapshot temporal solo de los 269 archivos elegibles tracked/untracked no ignorados
se escaneó con gitleaks dir --redact y config actual: 0 hallazgos; no se copiaron
credenciales/archivos ignorados, snapshot eliminado. Resumen/informe redactados en
TEMP/gd-t083-snapshot-summary.json y gd-t083-snapshot-report.json. El historial real
también pasó en la suite. No se añaden allowlists para forzar un resultado verde.

setup:hooks activó core.hooksPath=.githooks solo en este clon. Se hizo staging
únicamente del hook revisado con modo ejecutable; HEAD continúa 62cb319, sin commit,
push ni PR. git hook run pre-commit real pasó sobre ese staging (935 bytes), sin
hallazgos: TEMP/gd-t083-main-hook.log. CI PR e historial programado siguen definidos
con versión/SHA fijados y permisos de lectura; no se afirma ejecución remota aún.

Cierre T-083: pnpm verify pasa con Gitleaks nativo requerido y las 23 pruebas de
detección/config/hook activas (0 omitidas en esa suite). Global: dominio 67,
backend unitarias 253 pasan/47 integraciones omitidas, rotación 3 omitidas, web 80,
scripts 256 pasan de 257. La única omisión de scripts corresponde al test de
permisos POSIX ejecutado en Windows, no a Gitleaks. Aclaración de evidencia
histórica: las notas previas que atribuyeron todas las omisiones de scripts a
Gitleaks eran imprecisas; se conservan los conteos y logs, pero no esa atribución.

Log TEMP/gd-t083-verify.log. Release real y check:release pasan
(TEMP/gd-t083-release.log); guardia pública con canarios volvió a pasar en verify,
39 archivos y 87744/90000 bytes gzip iniciales. CLI, hook LF/100755, config sin
excepciones y herramientas locales listas; HEAD sin commits nuevos y solo hook
en staging. No se declara que CI remoto haya corrido ni se cierra toda la spec.

## T-048: SVG propios y gd-icon

Plan §17.25 y contrato server-only antes de implementar. Inicialmente pruebas
fallaron por módulos Icon/resolver aún ausentes. Cuatro pruebas Node ahora pasan:
registro completo de 29 SVG pasivos propios, paleta bone desde token existente,
24x24 intrínsecos, sin scripts/imagenes externas/filtros/animación; gate pending,
approved completo, incompleto y rutas hostiles; descriptor público sin prueba
privada. Tres pruebas Angular nuevas pasan (web total 83): semántica meaningful/
decorativa, slot 24/32 y error/cambio de fuente, desconocido inseguro sin request.
No arte oficial real ni modificación del manifiesto vacío.

Configuración Angular icon-preview con entradas browser/server propias y asset
sintético propio separado. Prerender 1 ruta, sin añadir rutas del producto.
Se eliminaron imports directos de localize/init al comprobar que el polyfill
existente cubre ambas entradas, quitando warnings sin alterar semántica.

Chromium real 158.0.8127.18: 33 instancias, 375/768/1280, todas 24/32 cuadradas,
0 imágenes rotas y 0 overflow. Hidratación/handler de fallo: request 404 de prueba,
cambio a fallback propio, slot sigue 32x32 y layout-shift acumulado 0. Solo requests
a servidor local; no API/servicios externos. Axe WCAG A/AA/2.1/2.2 = 0 violaciones
en 6 pasadas (JS aplicación activo o bloqueado). También verificación separada
con scripting del navegador deshabilitado estricto para tamaños/SSR/overflow.

Método no-JS explícito: axe quedó esperando en contexto con scripting totalmente
deshabilitado, incluso tras intentar habilitar solo el target principal por CDP.
Se interrumpieron esos dos helpers, sin atribuirles resultados. La pasada final
separa DOM/slots en contexto estrictamente deshabilitado y axe en otro contexto
con bundles de aplicación bloqueados, permitiendo solo herramientas de auditoría.
No se afirma que axe haya terminado con scripting global deshabilitado.
Tres capturas finales inspeccionadas visualmente en TEMP/gd-t048-{375,768,1280}.png;
reporte TEMP/gd-t048-browser-report.json. Navegador y servidor preview cerrados;
output temporal dist/icon-preview eliminado tras comprobar ruta absoluta.

Auditoría técnica Impeccable y revisión/polish visual propios, sin crítica dual
independiente: detector de source/src-assets devuelve [] (TEMP/gd-t048-detector.json).
Geometría consistente, textos completos, contraste de paleta existente, ninguna
interacción/foco ficticio en iconos pasivos. Auditoría acotada al componente:
a11y 3/4 (axe/semántica verificados; lector humano global sigue T-043), rendimiento
4/4 (sin librerías/animación/layout thrash), tokens 4/4, responsive 4/4, integridad
4/4: 19/20. Sin hallazgos P0–P3 en este alcance; no es auditoría de toda la web.
El cableado de activos aprobados API queda explícito en T-020 antes de cerrar
FR-16; esta tarea acredita componente y resolver, no esa integración pendiente.

Verificación local final: dominio 67, API 253 pasan/47 omitidas sin Docker,
rotación 3 omitidas sin opt-in; web 83; scripts 260 pasan/1 omisión de permisos
POSIX en Windows (261 total). Lint/format/assets/contraste pasan. La primera
ejecución se detuvo en dos MD049 del plan (globs sin backticks); corregidos y
retomada la secuencia desde lint:md hasta public-build, todos los pasos pasan.
Guard del build público: 97 archivos sin valores/patrones; guard de fuentes:
307 archivos elegibles sin hallazgos. Diff sin errores de whitespace.

Release real CONTENT_SOURCE=api y check:release pasan, manteniendo la guía
editorial pendiente fuera de la salida pública. Cuatro outputs JS del navegador
inspeccionados por inputs de stats y bytes: sin preview, resolver server ni Zod;
29 SVG fallback copiados. Ningún archivo del preview/fixture sintético en el
artefacto, ninguna ruta de diagnóstico (solo / en el scaffold actual), ningún
dist/icon-preview residual. Stats puede nombrar CSS analizado de componentes
no usados; no se entrega tal archivo al navegador. JS inicial 87744/90000 bytes
gzip; integración en páginas posteriores deberá volver a medir el presupuesto.
Evidencia TEMP/gd-t048-verify.log, gd-t048-verify-rest.log, gd-t048-release.log.
T-048 cerrada; la spec completa y sus revisiones finales siguen pendientes.

## T-024: componentes controlados del catálogo

Plan §17.26 registrado antes de código; sdd-escalation confirmó ampliar únicamente
angular.json y esta evidencia, conservando rutas reales para T-020/T-025.
Ocho pruebas Angular nuevas: placeholder honesto sin href/ranking, guía pública
coincidente y pending/mismatch sin enlace, link-only con autor/fuente/licencia y
aviso sin cuerpo/arte de guía, URL peligrosa/credenciales sin href, tres estados
con texto e icono decorativo, chip aria-pressed/disabled, filtros sin mutación
(búsqueda/selección/reset) y recuperación desde vacío. Paso rojo previo por módulo
ausente, luego compilación strict corrigió includes sobre unión de arrays tipados.

Lint señaló nombres de outputs nativos toggle/reset: renombrados a
selectionToggle/filtersReset sin desactivar reglas. Una sustitución PowerShell
dañó solo el archivo preview (array de un elemento desempaquetado); se reconstruyó
desde el contenido previsto, lint/build y ocho pruebas pasaron después. La
verificación general pidió además formatear ese cambio: corregido con Prettier.

Preview Angular tier-preview: prerender de una ruta, SSR/hidratación propios,
cuatro tarjetas sintéticas expresamente identificadas. Sin rutas producto ni
fetch ni paquetes nuevos. Chromium 158.0.8127.18, 375/768/1280: cuatro tarjetas
visibles sin scripting estricto; seis pasadas axe WCAG A/AA/2.1/2.2 con JS app o
bundles app bloqueados, cero violaciones, overflow e imágenes rotas. Trece
controles habilitados por pasada, tamaño mínimo 48px móvil/32px desktop y ancho
≥24px. Seleccionar Rayo con Espacio, buscar Chamán, limpiar y comprobar foco
visible pasa en cada ancho. Dos intentos del helper necesitaron esperar el ciclo
de render tras eventos antes de leer aria; corregido con waitForFunction, sin
alterar componentes para acomodar el helper. No requests externos ni errores JS.

Tres capturas TEMP/gd-t024-{375,768,1280}.png inspeccionadas: composición del
catálogo 1/2/3 columnas, nombres largos ajustan, estados no dependen de color,
foco visible y fuente externa legible. Detector Impeccable [] y revisión visual
propia; sin crítica dual independiente. Auditoría acotada 19/20: a11y3 (lectura
humana global T-043 pendiente), rendimiento4, tokens4, responsive4, integridad4.
Sin hallazgos P0–P3 en el alcance. No implica integración de página o FR-16.
Servidor tier-preview detenido y output dist/tier-preview eliminado con comprobación
de ruta absoluta; navegador cerrado. TEMP/gd-t024-browser-report.json,
gd-t024-{red,green,lint,preview-build,verify,verify-rest}.log contienen evidencia.

Verificación final: dominio67, API253 pasan/47 omitidas sin opt-in Docker,
rotación3 omitidas; web91 pasan; scripts260 pasan/1 omisión POSIX en Windows.
Todos los pasos de verify pasan entre ejecución inicial y continuación desde
format tras corregir Prettier. Guard público97 archivos, gzip inicial87744/90000.
Escaneo adicional de313 fuentes elegibles señaló la URL de credenciales sintéticas
literal en una prueba nueva; ahora se construye con URL y contraseña aleatoria
solo en memoria. Sus ocho pruebas y formato repitieron verde. Sin excepciones de
escáner: guard313 archivos y Gitleaks nativo8.30.1 snapshot313 archivos pasan,
0 hallazgos; snapshot temporal eliminado con límites comprobados.

Release API real + check:release pasan. Cuatro outputs JS de navegador, inputs
stats y archivos revisados: sin tier-preview/fixtures sintéticos, resolver server
ni Zod; solo ruta / del scaffold vigente, sin output dist/tier-preview residual.
No se entrega fixture como contenido público. No cambios de imagen/BD necesarios.
T-024 cerrada; T-025/páginas y demás tareas/revisiones de la spec siguen pendientes.

## T-025: página real y puerta de rendimiento abierta

Plan §17.27 previo a código, una escalación de alcance. Ruta lazy /tier-list,
resolver y snapshot público server en cada documento para navegación desde home
sin API browser. Server revalida DTOs aun con INCLUDE_DRAFTS, filtra pending y
proyecta allowlists sin cuerpo/activos/evidencia. Cuatro pruebas Node pasan:
fixtures reales con drafts producen45 placeholders públicos; ausente/error falla
sin causa privada; publicación propia sintética en memoria conserva filtros sin
canarios privados/cuerpo; URL con credenciales generadas solo en memoria falla
antes de TransferState/JSON-LD. Import inicial de APPROVED_RIGHTS no era export
público: corregido usando publicFilter canónico, sin ampliar API del dominio.

Nueve pruebas web nuevas pasan (4 modelo,2 resolver,3 página); web total100.
Combinaciones completas, múltiples guías/orden, sin datos inventados de daño/
estilo/fecha para placeholders; búsqueda ES/EN; URL/contador/empty/reset, SEO e
ItemList público y snapshot conservado para navegación posterior. Lint pasa;
scripts264 pasan/1 omisión POSIX Windows (265 total), incluidos4 server nuevos.
No cambios de backend/imagen/volumen editorial.

Chromium158.0.8127.18 en375/768/1280, builds fixture y API: navegación desde home
funciona;45 tarjetas completas con JavaScript deshabilitado, incluso URL filtrada.
Con JS, Espacio en Rayo y click Chamán actualizan query/contador y muestran vacío
honesto porque la BD pública actual no tiene guías con daño conocido. Reload
conserva ambos chips; reset elimina query; atrás/adelante restaura selección.
Canonical base, ItemList45, cero requests API/externos, errores JS, violaciones axe,
overflow o claves privadas/slug de guía pendiente en HTML. Helper esperaba lectura
inmediata después del cambio de URL; se corrigió espera del DOM, sin cambiar app.
Prueba positiva de guía propia/Rayo ocurre en componente y servidor; e2e positiva
navegable aún requiere rutas T-020/T-037 y dataset propio aislado.

Capturas TEMP/gd-t025-{375,768,1280}-{filters,cards}.png inspeccionadas. Polish:
título text-heading (no hero gigante), eliminar repetición del nombre de combinación
cuando ya es el título. Tokens existentes, grilla1/2/3, fechas/versión reales o
desconocidas explícitas. Detector Impeccable []; auditoría propia, sin crítica dual.
La puerta de rendimiento impide declarar auditoría completamente verde.
Última pasada API sin recapturas para respetar límite de3 pasadas visuales móvil;
reporte TEMP/gd-t025-browser-report.json. No se atribuye axe al contexto estricto
sin scripting; axe corre en aplicación hidratada, DOM SSR en contexto separado.

Primer HTML134542 superaba120000; transferir CatalogInput y derivar viewmodel lazy
lo redujo a103647 (Home30750). JS inicial Home95098/90000 sigue fallando, tier102995/
110000 pasa. Cambiar loadChildren a loadComponent no resolvió; alternativa
whenStable tampoco y se descartó, restaurando afterNextRender. Build Angular
prerenderiza2 rutas fixture/API, pero pnpm build falla correctamente por gzip.
build:release contra API ready sale1 y no deja build-info.json; no hay release
aprobado. No se elevó límite ni se debilitó checker. Ver blockers.md.

Guard público110 archivos pasa; guard de324 fuentes elegibles y Gitleaks nativo
snapshot324:0 hallazgos, snapshot temporal eliminado. Outputs browser sin Zod,
resolver server ni fixtures/preview. Evidencia TEMP/gd-t025-{model-red,model-green,
page-red,page-green,server-green,lint,web,scripts,build,build-stability,render,
api-render,release,public-build}.log. T-025 sigue sin check: presupuesto Home e
integración positiva de enlaces pendientes; la spec completa sigue activa.

## T-133: entrega estática de Home e hidratación i18n real

FR-10a y plan §17.28 antes de código; análisis acotado del cambio de requisitos/
plan/tarea sin CRITICAL/HIGH, sin pretender análisis final de toda la spec. Segunda
opinión Terra limitada a extractos consideró viable la portada nativa si conserva
funciones, SEO y navegación; no leyó el árbol completo ni ejecutó pruebas. App
Angular SSG sigue única y lee API en release; solo Home omite bootstrap cliente.
No se aumentaron límites ni se retiraron funciones de usuario.

Finalizador con HtmlParser instalado, guardas de controles/roles/custom elements,
enlaces sin destino/JS, handlers, scripts remotos/inline desconocido, markup
inválido y marcador falso. Conserva contenido, CSS, SEO/JSON-LD y metadata pública
de fuente mínima. No snapshot innecesario en Home. Idempotente, modifica solo
index.html regular, rechaza symlinks/junction Windows y conserva destino intacto.
Pruebas mantienen ruta hidratada legacy y exceso gzip real; cero solo Home válido,
catálogo sin scripts/archivos falla. Presupuesto catálogo ahora también automático;
incluye scripts inline ejecutables, no JSON-LD/datos de TransferState.

Primer build detectó criticalCSS onload de Angular; se convierte solo patrón
exacto media=print/this.media='all' a stylesheet nativo media=all. Handlers distintos
fallan. Home también retira captura Angular únicamente si coincide con contrato
oficial instalado y llamada literal segura de click; código modificado/otro evento
fallan. Scripts de catálogo se conservan. Release escanea bytes antes y después
de transformar, mide, hashea bytes definitivos, comprueba API/migración dos veces
y publica reporte atómico. Una prueba añade canario al snapshot que se retiraría:
el release lo rechaza ANTES de la transformación, no oculta la fuga.

La prueba browser encontró una deuda previa: withEventReplay sin withI18nSupport
omitía2 componentes i18n,0jsaction y sin _ejsas. Tras activar soporte oficial, apareció
TypeError hasAttribute al hidratar p dentro de noscript: scripting cambia ese DOM
a texto. El aviso ahora es un p normal, veraz JS/no-JS. Se amplió alcance antes de
editar config/template. La escalación T-133 no produjo revisión por límite de uso;
el principal resolvió con evidencia de API instalada y prueba roja/verde, sin
sustituir modelo ni atribuir revisión independiente. La consola de Angular puede
capturar errores sin pageerror: el helper ahora comprueba también console.error.

Chromium158.0.8127.18,375/768/1280×JS/no-JS: Home solicita4 recursos (documento,
CSS/fuentes),0JS; estilos, título/canonical, texto, h1, sin overflow y navegación
nativa a catálogo pasan. Skiplink enfoca main; axe0 en3 pasadas con scripting,
DOM/no-JS comprobado aparte (no afirmar axe con scripting global desactivado).
Catálogo conserva45tarjetas SSR y controles hidratados, URL y contador. Replay
real probado reteniendo chunk lazy de página, pulsando Rayo en SSR y soltándolo:
aparece filtro/URL y vacío esperado; no errores de consola. Mismo helper sobre
release API real pasa, sin solicitudes API browser/externas. Reporte TEMP/
gd-t133-browser-report.json; capturas Home3anchos inspeccionadas, respetando máximo
3pasadas móvil. La portada aún es scaffold: su producto real sigue T-038.

pnpm verify final pasa: dominio67, API253 pasan/47 omitidas sin opt-in, rotación3
omitidas; web100; scripts273 pasan/1 omisión POSIX Windows (274 total). Prueba
junction Windows sí ejecutada; no se atribuye la omisión a Gitleaks. Prueba final
adicional del canario previo a transformación y release pasa. Release API y
check:release pasan: Home0/90000 gzip,9377 HTML; tier104185/110000 gzip,107976 HTML,
ambos HTML≤120000. Incluidos318+91 bytes gzip de captura inline en tier.
Guard de327 fuentes y Gitleaks nativo snapshot327:0 hallazgos; snapshot eliminado.
No Zod/resolver server/preview en outputs browser. Docs de comandos actualizadas.

Evidencia TEMP/gd-t133-{red,unit,focused,build,i18n-render,verify,verify-final,
release,release-tests}.log y helpers temporales. T-133 cerrada; se resuelve la
puerta Home de T-025, que conserva pendiente navegación de guía propia completa.
La spec y su revisión final siguen pendientes; sin commit/push/PR todavía.

## T-134: salto al contenido en rutas internas

Plan §17.31 registrado antes del cambio. Href nativo calculado con Location y
actualizado en NavigationEnd conserva ruta/query y sustituye fragmentos; respeta
baseHref sin handlers ni cambios visuales. Rojo inicial de dos expectativas de
destino, luego cuatro pruebas del layout pasan, incluido prefijo /project/.
Browser Chromium158 a375/768/1280, autor/acerca con y sin JS: doce combinaciones
enfocan main de la página correcta. El servidor estático puede redirigir a slash
canónico antes del foco; esa navegación se esperó explícitamente. Tres pruebas
adicionales JS de tier conservan m=chaman&d=rayo y enfocan main; SSR estático no
conoce filtros de futuras solicitudes sin JS. Reporte TEMP/gd-t134-browser-report.json.

Verificación compartida T-039/T-134: dominio67; API253 pasan/47 omitidas sin opt-in,
rotación3 omitidas; web111; scripts277 pasan/1 omisión POSIX (278 total). verify
se detuvo en MD037 de plan.md, corregido con código inline; reanudación desde
lint:md hasta public-build pasa. No se presentan los tests PostgreSQL omitidos
como ejecutados. Release API y check:release pasan después de la verificación;
artefacto actual restaurado desde API. Home0/90000 y tier105096/110000 bytes gzip.
Angular avisa291.42kB frente a280kB bruto; esa advertencia no sustituye presupuestos
gzip, HTML o Lighthouse. Guard de344 fuentes y Gitleaks nativo:0 hallazgos; sin
Zod/resolver server/preview en14 outputs JS browser. Snapshot de escaneo eliminado.
T-134 cerrada; ninguna revisión final de spec se atribuye a estos controles.

## T-039: evidencia parcial de autor y Acerca

Plan §17.30 y ampliación aprobada por sdd-escalation antes de código. Loader
server reutiliza tier/builds públicos, perfiles embebidos y como máximo una lectura
del dueño restante; registra2o3 peticiones constantes, sin afirmar igual conteo SQL.
Provider memoizado por contexto SSR comparte snapshot con getPrerenderParams;
solo slugs públicos y fallbackNone. Perfiles mínimos y metadatos ya existentes,
sin cuerpos privados, placeholder ni API browser. Cuatro pruebas server nuevas
pasan (reutilización, conflictos, proyección, URL hostil/errores saneados); cinco
pruebas web nuevas de resolver/página cubren vacío, positivo propio y desconocido.

Release prerenderiza Home, tier-list, acerca y autores/grim-dawn-builds. Doce
combinaciones375/768/1280×JS/no-JS de las dos páginas pasan metadatos, overflow,
teclado y navegación; axe0 en seis auditorías JS, comprobaciones DOM sin JS aparte.
About→autor nativo y autor→About SPA sin documento nuevo funcionan; sin API browser,
requests externos ni errores de consola. Autor privado no generado responde404 en
el servidor estático; esto no acredita aún 404 global T-020. Se inspeccionaron seis
capturas y detector Impeccable devuelve[]; no se atribuye crítica independiente.
Reportes TEMP/gd-t039-browser-report.json y gd-t039-detector.json; logs verify,
verify-rest y release-final. T-039 sigue abierta: legal espera canal real solicitado
al usuario; guía→autor y navegación positiva integral esperan T-020/T-037. No se
inventó contacto ni se publicó la guía original pendiente. Sin commit/push/PR.

## T-038: portada real y social propio

Plan §17.29 y ampliación SeoService/evidencia confirmados por sdd-escalation antes
de código. Selector puro de publicación más reciente con desempate por slug:
derechos aprobados sin link_only, publicado, fecha/slug válidos, sin mutar inputs
ni devolver cuerpo/evidencia privada. Home consume snapshot público existente;
ausencia falla, sin fetch/proveedores nuevos. Estado actual sin guías públicas
ofrece catálogo y criterios honestos; no publica el original pendiente.

Cinco pruebas nuevas de Home/selector pasan (web105 total): negativo de estados/
fechas/rutas, selección/inmutabilidad, vacío/links nativos, positivo propio con
fecha/versión sin canarios, falta de snapshot. Pruebas escritas antes de código,
rojo inicial por módulo ausente; luego verde. El positivo no acredita navegación
de guía aún pendiente T-020/T-037. SEO conserva override y restaura default propio
al navegar, respeta prefijo BASE_URL y evita duplicados/residuos. Alt preparado
para i18n; default OG/Twitter1200×630 y summary_large_image verificados.

Imagen original public/og/site.svg de1805bytes; geometría propia, fuentes locales
Oswald/Karla y paleta aprobada, sin arte del juego ni manifiesto oficial alterado.
PNG43991bytes exportado con Chromium158.0.8127.18, viewport1200×630/DPR1. Receta:
servir public, abrir /og/site.svg como documento; cargar explícitamente fuentes
80px Oswald y36px Karla, esperar document.fonts.ready y exportar page.screenshot
a public/og/site.png. Se comprobó1FontFace de cada familia y solo3requests locales
(SVG+2WOFF2); PNG1200×630 por IHDR y legibilidad inspeccionada. SVG es fuente
canónica. SHA256 SVG a3bad7e7c81a631b7708275d3352c2bc496afbda1378624da5769f0fd43710c3;
PNG925105c1292a7a40611ffa4118a6494f5ac36372741c59e12ec729e2c96fa884.

Browser real375/768/1280×JS/no-JS en fixture y release API: sin overflow, Home0JS,
teclado/skiplink/foco/ancla criterios y CTA catálogo funcionan; vacío sin enlaces
inventados de guía, sin campos privados. Axe0 en3 pasadas con scripting (no se
atribuye axe al contexto estrictamente sin JS). PNG responde200 y1200×630; metas
OG/Twitter/canonical correctos. Catálogo se hidrata y filtra; replay probado con
chunk retenido y botón SSR original reutilizado,0 console.error/pageerror.
Capturas Home3anchos y PNG inspeccionados; detector Impeccable[] y audit/polish
propios, sin crítica dual formal. Auditoría acotada19/20: a11y3 por lector humano
global pendiente T-043; performance/tokens/responsive/integridad4 cada uno.

Cinco muestras móviles frías CDP150ms,200000B/s down,93750B/s up, CPU4×,
375×812/DPR1, Chromium158 Windows, HTTP local sin compresión: LCP604/588/588/604/
580ms, mediana588ms, máximo604ms≤2000; CLS0 en todas. Caché desactivada/limpiada,
contexto nuevo por muestra y service worker omitido. Observadores solo del helper
de medición; sin JS de aplicación en Home. No es Lighthouse ni cierra T-126.

pnpm verify y release API/check:release pasan: dominio67; API253 pasan/47 omitidas
sin opt-in, rotación3 omitidas; web105; scripts273 pasan/1 omisión POSIX Windows.
Guard público117 archivos; fuentes334 y Gitleaks nativo snapshot334:0 hallazgos,
snapshot temporal eliminado. Home0/90000 gzip,14049HTML; tier104423/110000 gzip,
108495HTML. No Zod/resolver server/preview en outputs browser. Evidencia TEMP/
gd-t038-{red,focused,build,verify,release}.log y reportes browser, performance, OG
y replay. T-038 cerrada; el cierre integral y sus revisiones siguen pendientes.

## T-028: árbol SVG y alternativa textual

Plan §17.32 y tarea precisados por sdd-plan antes de código, con scripts oficiales
Spec Kit y análisis acotado sin CRITICAL/HIGH. Implementación sdd-ui dentro de los
siete archivos skill-tree y angular.json para preview aislado; sin nuevas
dependencias ni rutas públicas. Tipos PublicBuild solo como tipos; coordenadas
editoriales relativas, layout/aristas/teclado existentes, máximo120 nodos. Selección
local separada de activeIds, barra desconocida sin bloqueo supuesto, consejo de
barra insuficiente consultable, estados con forma/texto y datos completos ES/EN.
Detalle HTML no modal y lista details abierta en SSR, plegable nativamente sin JS.

Rojo inicial por módulo ausente confirmado por el agente (salida de su sesión,
sin log persistido); una errata TS inicial del test se corrigió antes de ese rojo.
Ocho pruebas de componente pasan: estructura SVG/relaciones/posiciones, estados,
barra/selección, teclado/cierre/foco, aislamiento de IDs/maestrías, vacío/error,
120 nodos e información larga. No se atribuye a JSDOM medición visual de Chromium.
La revisión real encontró tabstop inicial, foco SVG, superposición de etiquetas y
nombre accesible desalineado. Se corrigieron antes del cierre. SVG usa etiquetas
acotadas a dos líneas; lista y descripción aria por nodo conservan texto completo.
Espacios explícitos entre tspans evitan concatenación; title/desc del SVG base
permanecen, sin títulos individuales que duplicaban nombres en el diagnóstico.

Chromium158.0.8127.18,375/768/1280×JS/no-JS/app bloqueada: nueve combinaciones pasan
SVG/lista, textos y ausencia de overflow de página. Axe WCAG A/AA/2.1/2.2 devuelve
0 en seis auditorías (hidratado y app bloqueada). Contextos estrictamente sin JS
se comprueban aparte, sin atribuirles axe. Flechas/Home/End/Enter/Espacio/Escape,
click, hover sin robar foco, cierre con foco al origen y cambio independiente del
paso pasan. Figuras interactivas medidas44×44/42×36/44×44px; foco stroke4px storm,
transición0s con reduced-motion. IDs504 sin duplicación en preview con120 nodos.
Lista nativa se pliega/reabre sin JS. Touch CDP móvil375: tap selecciona y arrastre
horizontal nativo mueve scrollLeft121px (448px sobre área327px); no dispositivo
físico. Cinco muestras de cambio de activeIds con120 nodos:3.9/2.8/2.4/3.0/2.1ms,
medidas desde click hasta mutación DOM observada, máximo3.9ms≤16; no es Lighthouse.

Dos pasadas visuales por ancho inspeccionadas; nombres ya no se superponen y
raíz inicial legible en móvil, con ayuda visible de desplazamiento. Detector
Impeccable devuelve[]; audit/polish propios, sin crítica dual independiente.
Auditoría acotada19/20: accesibilidad3 por NVDA humano global pendiente T-043;
rendimiento/tokens/responsive/integridad4 cada uno. No cierra T-030 de ambos SVG.

Medición propia reproducible: ngc full AOT de skill-tree.ts en directorio temporal,
esbuild bundle/minify ES2022 con @angular/* externo y ngDevMode/ngJitMode=false;
incluye plantilla, estilos, layout y keyboard-nav, excluye preview/bootstrap.
32050bytes brutos y7212gzip nivel6≤8000. Un primer diagnóstico sin flags de
producción retenía metadatos de desarrollo y daba9548gzip; no se usa como medida
de producción. Límite diferido combinado40k y carga real de ruta esperan T-037.

pnpm verify pasó; después del último ajuste aria se repitieron lint, Markdown,
formato, web119 pruebas, activos/contraste y build/guard público. Suites sin cambios
de la ejecución completa: dominio67, API253 pasan/47 omitidas sin opt-in, rotación3
omitidas; scripts277 pasan/1 omisión POSIX (278 total). No se atribuyen integraciones
omitidas como ejecutadas. Release desde API y check:release pasan al final; Home0
y tier105096gzip conservan límites. Angular avisa291.42kB inicial frente a280kB y
CSS del árbol4.74kB frente a4kB; errores máximos300/8kB no se superan. No se elevaron
límites. Guard de351 fuentes y Gitleaks nativo:0 hallazgos;14 outputs JS browser
sin Zod/server resolver/preview. Snapshot de escaneo eliminado; servidor4302
terminado y directorio dist/skill-tree-preview verificado/eliminado sin enlaces.
Artefacto vigente restaurado desde API, sin datos sintéticos del preview.

Evidencia TEMP/gd-t028-{browser-report,audit,own-bundle}.json; capturas initial y
final por ancho; helpers browser/audit/ngc/own-bundle y logs verify/recheck/release.
T-028 cerrada solo en su alcance; devociones, stepper y guía siguen pendientes.
La guía original sigue borrador/pending, sin commit/push/PR ni cierre de spec.

## T-029: mapa de devociones documentado y accesible

Plan §17.33 y tarea precisados antes de código mediante Spec Kit; análisis acotado
sin CRITICAL/HIGH. Tipos canónicos sin Zod browser; relaciones internas registradas
pueden cerrar figuras, y afinidades requeridas conocidas apuntan a la región de su
constelación. No se infieren dependencias entre constelaciones ni afinidades null.
Mapas vacíos y desconocidos son distintos; nombre EN sin ES no inventa traducción.
Bindings reales resuelven habilidades; menciones externas solo sin_verificar.
Pasos sin constelación y verificación/limpieza permanecen íntegros en la ruta.

Rojo inicial por módulo ausente en TEMP/gd-t029-red.log; luego nueve pruebas del
agente pasan. La revisión detectó panel sin poderes, truncado de palabra larga sin
elipsis, SVG reducido a texto≈4px móvil y destinos fuera de su grupo. Dos pruebas
rojas adicionales (panel y nombre) acreditan esos huecos antes de corregirlos;
una errata TS del test de click SVG se corrigió antes del rojo funcional del panel.
Once pruebas pasan ahora, junto a regresión T-028: SVG/coords relativas/figuras
cerradas, null/vacío, bindings y pasos completos, teclado/selección/foco, IDs por
instancia, referencias rotas separadas, vacío, límite120 y rechazo121, inmutabilidad.

La primera medición propia excedía8k gzip. Escalación intentada una vez; ambos
agentes alcanzaron límite de uso y no entregaron una solución verificada. El
principal continuó directamente sin sustituir modelos: comparte información de
panel/lista mediante templates nativos Angular, consolida IDs y elimina trabajo
duplicado. Ajuste de plan registrado antes de retirar layoutForest del mapa plano:
createKeyboardNav recibe orden lógico sin padres; Set conserva rechazo de IDs
duplicados. T-028 y utilidades siguen sin cambios. No se ampliaron presupuestos.

SVG final conserva escala1:1 con scroll interno, texto≥12px efectivo, rótulos
acotados y datos completos en panel/lista. Flechas de requisito llegan al contorno
de la región; bindings tienen dos líneas dentro del grupo. Aviso exacto «verifica
en GrimTools antes de gastar» junto al diagrama y en los pasos correspondientes;
no se declara verificada una constelación por el estado de otro paso. No hay slugs
crudos como sustituto de nombres legibles. Selección separada del paso activo;
detalle HTML no modal y lista details abierta/plegable sin JavaScript.

Chromium158.0.8127.18,375/768/1280×JS/no-JS/app bloqueada: nueve combinaciones pasan.
Axe WCAG A/AA/2.1/2.2:0 en seis auditorías JS (hidratado y bundles bloqueados);
DOM y details nativo comprobados aparte en scripting estrictamente desactivado.
Teclado/foco/Esc/cierre/hover y cambios externos del paso pasan, sin errores de
consola en modo hidratado ni solicitudes externas. Rects interactivos440×426 y440×300px; ningún texto
SVG se reduce bajo12px ni sale de su grupo, sin overflow horizontal de página.
Touch CDP375: tap selecciona y arrastre desplaza scrollLeft205px sobre SVG928/área327;
no dispositivo físico. Estrés120 objetos (grupo+118estrellas+umbral): cinco cambios
de paso5.1/1.3/0.8/0.7/0.6ms, desde click hasta mutación DOM, máximo5.1≤16; no LCP
ni Lighthouse. Escala y geometría verificadas con medidas reales de Chromium.

Capturas initial/final3anchos y detalle375 inspeccionadas; dos pasadas generales,
tres móvil incluyendo detalle. Detector Impeccable[]; audit/polish propios19/20
(a11y3 por NVDA global pendiente; performance/tokens/responsive/integridad4), sin
crítica dual independiente. No se atribuye a esto el e2e persistente T-030.

Contribución propia final: ngc full AOT+esbuild minify ES2022, Angular externo y
ngDevMode/ngJitMode=false; incluye plantilla/estilos y teclado, layout solo tipos,
excluye preview/bootstrap.35367brutos/7989gzip nivel6≤8000, sin localización inline
ni exclusión de contenido para cumplir. Candidato temporal de traducción inline
no se adoptó. Integración diferida combinada40k y ruta de guía esperan T-037.

pnpm verify pasa: dominio67; API253 pasan/47 omitidas sin opt-in; rotación3 omitidas;
web130; scripts277 pasan/1 omisión POSIX (278 total). Las omitidas no se presentan
como ejecutadas. Release desde API y check:release pasan al final; artefacto actual
restaurado desde API. Home0/tier105096gzip conservan límites; guard público127
archivos. Avisos Angular291.42kB inicial frente a280kB y CSS mapa4.38kB/árbol4.74kB
frente a4kB, bajo errores máximos300/8kB; ningún límite elevado. Guard351→358 fuentes
y Gitleaks nativo snapshot358:0 hallazgos;14 outputs JS sin preview/Zod/server
resolver. Snapshot eliminado; servidor4303 terminado y dist/devotion-map-preview
verificado/eliminado sin reparse points, sin tocar volúmenes Docker.

Evidencia TEMP/gd-t029-{browser-report,own-bundle}.json, capturas y logs red,
panel-red/name-red, root-test/web/root-lint/root-preview/verify/release. T-029
cerrada en su alcance; spec001, sus rutas/stepper y revisión final siguen pendientes.

## T-030: e2e SVG reproducible

Plan §17.34 registrado y analizado antes de código. Instalar dependencias con
`pnpm install --frozen-lockfile`; en un entorno sin navegador, ejecutar
`pnpm exec playwright install chromium`. Después, `pnpm e2e:svg` comprueba tipos y
construye dominio y ambos previews desde las fuentes actuales antes de ejecutar
Playwright. Un error de compilación impide probar un artefacto antiguo. Para
comprobar únicamente tipos: `pnpm typecheck:e2e`.

El informe local está en playwright-report/svg/index.html; puede consultarse con
`pnpm exec playwright show-report playwright-report/svg`. Contiene seis PNG de
ambos componentes a375/768/1280. playwright-report/ y test-results/ están ignorados;
no se añaden binarios ni capturas golden al repositorio. La ejecución local usó
Chromium158.0.8127.18 previamente instalado en caché, sin Docker ni API.

Resultado final:24 pruebas pasan en30.9s, sin reintentos; dos superficies por tres
anchos, con teclado/foco/hover/paso activo, geometría real, toque y arrastre CDP,
HTML con scripting desactivado y axe con app hidratada/bundles bloqueados.
Las12 auditorías axe no encuentran violaciones; el DOM sin scripting estricto
se comprueba aparte. Seis capturas adjuntas, incluidas ambas vistas móviles
inspeccionadas; sin atribuir dispositivo físico, lector humano ni CI remoto.
No cambian los componentes ni las rutas públicas en esta tarea.

Dos pruebas Node pasan: servidor GET/HEAD/MIME, rutas inválidas/traversal/enlaces
fuera de raíz y orquestador que corta tras un fallo previo. Rojo inicial por
módulos ausentes y rojo adicional de raíz mediante enlace antes de implementar
su rechazo. El servidor solo escucha127.0.0.1 y no expone directorios ni causas;
Playwright termina sus procesos. Tipos e2e y formato explícito pasan.

pnpm verify pasa: dominio67, API253/47 omitidas, rotación3 omitidas, web130 y
scripts279/1 omisión POSIX de280. Las pruebas omitidas requieren su opt-in y no se
presentan como ejecutadas. Build release desde API y check:release pasan al final;
Home0 y tier105096bytes gzip conservan presupuesto, guard público127 archivos.
Guard de364 fuentes y Gitleaks nativo:0 hallazgos;14 outputs browser sin preview,
Zod ni resolver de servidor. Los avisos de presupuesto Angular ya documentados
en T-029 permanecen bajo sus límites de error; no se elevó ningún límite.

Evidencia local: TEMP/gd-t030-{unit,e2e-final,verify,release}.log y el informe HTML.
T-030 cierra únicamente esta verificación; T-040/T-041/T-126 y el cierre completo
de spec001 siguen pendientes. No se hizo commit, push ni PR.

## T-031: validación pendiente de secciones estáticas

Plan §17.35 y tarea concretados antes de código mediante skills oficiales
speckit-plan y speckit-tasks. setup-plan.ps1 -Json conservó el plan existente;
setup-tasks.ps1 -Json resolvió la plantilla instalada. No hay hooks before/after
plan/tasks/analyze registrados; el hook after_implement conserva su alcance.
Esta sección es guía de validación, no evidencia de implementación terminada.

Primero escribir build-sections.spec.ts y registrar el fallo esperado por falta
del componente/comportamiento; después implementar únicamente T-031. Ejecutar:

```powershell
pnpm exec ng test --watch=false --include=src/app/features/build/sections/build-sections.spec.ts
pnpm --filter @gd/domain build
pnpm exec ng build --configuration build-sections-preview
pnpm lint
pnpm lint:md
pnpm build
pnpm check:initial-js
pnpm check:public-build
```

Aplicar formato/comprobación solo a archivos tocados según CONTRIBUTING. Usar
Playwright/axe ya instalados contra dist/build-sections-preview, con servidor
local temporal y comandos/rutas de evidencia documentados al verificar. Obtener
HTML SSR, DOM sin JS e hidratado y capturas375/768/1280; comprobar texto,
encabezados, visibilidad/vacíos, contraste, wrapping/zoom y ausencia de overflow.
Resultado esperado: equivalencia SSR/hidratación, cero errores de consola y
violaciones axe, cero peticiones API/externas. Inspeccionar visualmente los PNG.

Paridad de esta tarea: título/eyebrow/subtitle,2 párrafos del callout,
11 prioridades,6 notas tipificadas y omitidos, introducciones propias y
4NPC+Coste/Aviso. Las18 notes del fixture se contabilizan mediante el mapping
explícito de §17.35:11 consumidas por esta tarea y7 conservadas para sus secciones
futuras, sin duplicarlas. El oráculo original solo entra en spec.ts; el preview
usa contenido propio y no publica el borrador. Verificar stats/output público
sin preview, Zod ni texto pending y mantener guardias de release/API.

Al finalizar, añadir rojo/verde, comandos/resultados y rutas de capturas/axe,
SSR/no-JS, presupuestos y exclusión pública; solo entonces marcar T-031.
No atribuir a estas pruebas T-032–T-037, CI remoto ni cierre completo de spec001.

Análisis SDD acotado ejecutado con speckit-analyze tras check-prerequisites.ps1
-Json -RequireSpec -RequireTasks -IncludeTasks: los tres artefactos presentes;
6 requisitos considerados (FR-02/06/10, AC-02/06/09),1 tarea T-031 con cobertura
parcial explícita de página y100% del alcance estático definido. Sin tareas
huérfanas ni ambigüedades abiertas en este alcance;0 CRITICAL,0 HIGH,0 duplicados.
Constitución I/III/IV/V/VI/VII/IX/X/XI conservada. Antes del análisis se corrigió
una referencia provisional a presupuestos para remitir a §6 y sus excepciones
vigentes, sin relajarlos. No es auditoría global ni ejecución de pruebas UI.

### Evidencia de implementación T-031

Ocho pruebas de componente pasan: cabecera/callout,11 prioridades completas con
rank null sin numeración inferida, notas y omisión de la fuente, introducciones
múltiples,4 ubicaciones y Coste/Aviso completos; además orden estable, arrays
congelados/sin mutación, metadatos de visibilidad, vacíos y texto escapado.
El fixture editorial y su oráculo original se importan exclusivamente en el test.
Once de las18 notas están cubiertas aquí; las7 restantes siguen reservadas a sus
secciones T-032–T-037. El componente no consulta repositorios ni storage ni valida
derechos: recibe la proyección canónica tipada de su futuro padre.

Rojo por componente ausente registrado antes de implementación en
TEMP/gd-t031-red.log; verde en TEMP/gd-t031-green.log. Correcciones de revisión:
rangos explícitos sin numerar filas null, conservación de varios párrafos de una
introducción, selección por kind/label sin duplicar notas tipificadas y contexto
editorial sin kicker sobre el título. Preview usa contenido propio sintético,
con introducciones, Coste/Aviso y withI18nSupport para hidratar i18n.

Reproducción: `pnpm --filter @gd/domain build`,
`pnpm exec ng test --watch=false --include=src/app/features/build/sections/build-sections.spec.ts`
y `pnpm exec ng build --configuration build-sections-preview`. Servir únicamente
dist/build-sections-preview/browser en127.0.0.1:4304 para la inspección local.
No usar ese preview como artefacto de release.

Chromium158.0.8127.18 a375/768/1280: nueve combinaciones JS/no-JS/app bloqueada
pasan; seis auditorías axe WCAG A/AA/2.1/2.2 con0 violaciones. HTML completo y un
h1 con scripting desactivado; sin IDs duplicados ni overflow de página, también
al ampliar texto al200% en los tres anchos. Sin errores de hidratación ni requests
API/externos. Tres capturas inspeccionadas, una pasada por ancho. Detector
Impeccable[]; revisión propia audit/polish, sin crítica independiente ni atribuir
lector humano, dispositivo físico, Lighthouse o CI remoto.

Evidencia local: TEMP/gd-t031-browser.mjs, browser-report.json, browser.log y
gd-t031-{375,768,1280}.png. Lint web, markdownlint y Prettier de los ocho archivos
tocados pasan; logs gd-t031-{lint,lint-md,format-check,preview-build}.log.
Build release desde API y check:release pasan; Home0/tier105096bytes gzip y guard
público127 archivos. Guard de371 fuentes y Gitleaks nativo0 hallazgos;14 outputs
browser sin preview/Zod/resolver de servidor. No se modificaron presupuestos.
No se repitió la suite global ya pasada en T-030: la verificación se acotó al
cambio, además del release real y guardias finales.

Servidor4304 terminado y preview eliminado tras verificar su raíz absoluta y
ausencia de enlaces, sin tocar datos Docker. T-031 cerrada únicamente en este
alcance; rutas, componentes interactivos y cierre global siguen pendientes.
No se hizo commit, push ni PR.

## T-032: validación pendiente del orden de compra

Plan §17.36 y checkbox T-032 concretados antes de código mediante speckit-plan y
speckit-tasks; setup-plan.ps1 -Json conservó plan existente y setup-tasks.ps1 -Json
resolvió plantilla/documentos instalados. No hay hooks de esas fases/analyze;
el hook de cierre after_implement sigue vigente para su alcance global.

Escribir primero progress.spec.ts y purchase-stepper.spec.ts y registrar rojo
por falta del comportamiento. Después implementar únicamente archivos de §17.36.

```powershell
pnpm exec ng test --watch=false --include=src/app/features/build/purchase-stepper/*.spec.ts
pnpm exec ng test --watch=false --include=src/app/shared/svg/skill-tree/skill-tree.spec.ts
pnpm --filter @gd/domain build
pnpm exec ng build --configuration purchase-stepper-preview
pnpm lint
pnpm lint:md
pnpm build
pnpm check:initial-js
pnpm check:public-build
```

Verificar con runner temporal Playwright/axe ya disponible contra el preview
actual a375/768/1280: lista completa SSR/no-JS, selección cross-mastery y foco,
checklist sin opt-in solo en memoria, opt-in que restaura tras recarga, borrado,
aislamiento por guía y huella, storage corrupto/denegado sin error. Checkbox de
persistencia es explícito; payload solo version/revision/posiciones y clave estable
por guía. currentBar permanece undefined, sin derivarlo de etiquetas o requisitos.
Capturas inspeccionadas, cero axe/errores consola/requests externos, sin overflow;
DOM estricto sin scripting aparte. Registrar comandos, rojo/verde y artefactos
cuando se ejecute: esta guía aún no acredita esas pruebas.

Paridad local:6pasos con umbral/título/cuerpo/highlights y la introducción de
«Orden real de compra», desde original/draft solo importados en spec.ts.
Preview propio sintético con ambos árboles, sin contenido pending. Guardias/stats
públicas deben excluir preview/original/Zod y mantener §6 y excepciones vigentes.
T-032 sigue pendiente; no cerrar T-033–T-037 ni spec001 con esta evidencia.

Análisis speckit-analyze acotado ejecutado tras check-prerequisites.ps1 -Json
-RequireSpec -RequireTasks -IncludeTasks: artefactos presentes,9 requisitos
(FR-02/03/06/08/10, AC-02/03/06/09),1 tarea T-032, cobertura100% del alcance
definido (las páginas completas conservan sus tareas posteriores).0 CRITICAL,
0 HIGH,0 duplicados/ambigüedades abiertas y ninguna tarea huérfana en este alcance.
Constitución I/III/IV/V/VI/IX/X/XI conservada; no API, nueva dependencia ni derechos
implícitos. Antes del análisis se precisó el fallback ante position duplicada,
que el esquema actual permite, sin ampliar dominio. Esto no ejecuta pruebas UI.

## T-032: evidencia local parcial de implementación

Pruebas de componente y progreso escritas antes de la implementación. El rojo
inicial por módulos ausentes quedó en `TEMP/gd-t032-red.log`; el rojo independiente
del helper está en `TEMP/gd-t032-progress-red.log`. La suite Angular acotada pasa
18 pruebas en dos archivos con `pnpm exec ng test --watch=false
--include='src/app/features/build/purchase-stepper/*.spec.ts'`;
`TEMP/gd-t032-green.log` registra el resultado. La suite sin cambios de
`src/app/shared/svg/skill-tree/skill-tree.spec.ts` pasa 8 pruebas en
`TEMP/gd-t032-skill-tree.log`.

`pnpm --filter @gd/domain build` pasa. `pnpm exec ng build --configuration
purchase-stepper-preview` genera una ruta prerenderizada en
`dist/purchase-stepper-preview`; log `TEMP/gd-t032-preview-build.log`. El preview
usa tres pasos y dos árboles propios sintéticos; incluye controles diagnósticos
aislados para cambiar guía/revisión y metadato noindex. No importa el fixture
pending ni usa repositorio/API.

`pnpm lint`, `pnpm lint:md` (42 archivos, 0 problemas) y Prettier check sobre los
10 archivos permitidos pasan; logs `TEMP/gd-t032-lint.log`,
`TEMP/gd-t032-lint-md.log` y `TEMP/gd-t032-format-check.log`. El estado inicial de
SSR/no-JS, navegador a375/768/1280, axe, capturas y guardias de release/público
queda pendiente de la verificación final de esta tarea. Esta evidencia parcial no
acredita T-032 ni cierra la spec.

### Verificación final T-032

La suite final mantiene18 pruebas pasando (14 componente+4 helper), log
TEMP/gd-t032-final-unit.log. SkillTree permanece sin cambios y sus8 pruebas pasan.
La primera integración tenía cuatro fallos de expectativas/timing/aislamiento del
test, corregidos antes del verde, sin atribuirlos a errores de producto. El helper
se verificó también con Vitest directo; registro rojo anterior a implementarlo en
gd-t032-progress-red.log y verde en gd-t032-progress-green.log.

La revisión visual detectó que display:grid sobre li ocultaba números a768/1280
y Angular juntaba los nombres ES/EN. Se preservó el marcador nativo moviendo grid
a un contenedor interior y se añadió espacio explícito entre nombres. Prueba roja
gd-t032-spacing-red.log antes del cambio, luego18/18; posiciones no contiguas
también se comprueban como valores reales del ol. Capturas y geometría finales
acreditan números2/5/11 visibles y listas sin scroll horizontal de página.

Chromium158.0.8127.18,375/768/1280, JS/no-JS/bundles bloqueados:9 combinaciones
pasan. Seis auditorías axe WCAG A/AA/2.1/2.2:0 violaciones; HTML y controles disabled
con scripting estrictamente desactivado se comprueban aparte. Selección con
click/Enter/toque actualiza los dos árboles, incluso mastery_slug=null; conserva
selección del SVG y foco del botón. Barra permanece desconocida y puntos0/null
distintos. Checklist sin opt-in no escribe; tras consentir, persiste al recargar.
Borrar vacía memoria y elimina únicamente su clave, conserva selección/opt-in y
no recrea registro vacío; guías y revisiones no comparten progreso. Sin requests
externos/API ni errores de hidratación. Texto200% sin overflow en los tres anchos.

Cuatro casos adicionales de navegador a375 pasan: getter denegado, escritura/cuota
denegada, JSON corrupto y removeItem denegado. Lectura y selección siguen operativas;
un fallo de borrado conserva el registro y muestra mensaje explícito, sin declarar
borrado persistido. Registro corrupto se ignora sin escribir hasta acción explícita.
Foco de teclado≥2px y targets efectivos de botones/labels≥24px comprobados.

Runner TEMP/gd-t032-browser.mjs, resultado browser-report.json, log
gd-t032-browser-final.log; casos adversos en gd-t032-storage-browser.mjs,
storage-browser-report.json y storage-browser.log. Capturas finales
gd-t032-{375,768,1280}.png inspeccionadas; dos pasadas por ancho. Auditoría/polish
propios y detector Impeccable[], sin crítica independiente ni afirmar lector
humano, dispositivo físico, Lighthouse o CI remoto.

Preview final compilado desde fuentes actuales (gd-t032-final-preview.log).
ESLint y Prettier de los10 archivos de código/configuración pasan tras el ajuste;
Markdown pasa. No se formateó una línea preexistente de quickstart señalada por
Prettier fuera de esta sección; el comando global no incluye este Markdown anidado.
Build release desde API y check:release finales pasan (gd-t032-release-final.log),
Home0/tier105096bytes gzip conservan presupuesto y guard público127 archivos.
Guard380 fuentes/Gitleaks nativo:0 hallazgos;14 outputs JS sin preview/Zod/resolver
de servidor. No se repitió verify global ya pasado en T-030 ni e2e SVG sin cambios.

Servidor4305 terminado y preview eliminado tras verificar raíz absoluta y ausencia
de enlaces; release desde API conservado, sin tocar datos Docker. T-032 queda
cerrada en su alcance; T-033–T-037 y revisión final de spec001 siguen pendientes.
No se hizo commit, push ni PR.

## T-033: sección de devociones completada — 2026-11-10

Plan §17.37 y checkbox T-033 concretados antes de código mediante speckit-plan y
speckit-tasks. setup-plan.ps1 -Json conservó el plan existente; setup-tasks.ps1
-Json resolvió plantilla/documentos instalados. No hay hooks de estas fases/analyze;
after_implement conserva su puerta global. T-031/T-032 y sus evidencias no cambian.

Antes de implementar, se ejecutó el borrador de pruebas y falló por el módulo
`./devotion-section` todavía inexistente (rojo previsto; log
`$env:TEMP/gd-t033-red.log`). La primera invocación mediante Corepack no llegó a
pnpm por un fallo de verificación keyid; se usó el pnpm fijado ya preparado en
`$env:TEMP/gd-t057-tools`. Para el verde se usó el builder Angular, que prepara
TestBed y los recursos externos del componente. Las aserciones que esperaban un
atributo `[data-body]` no existente en el leaf se ajustaron para verificar el
contenido de las filas nativas reales, sin cambiar criterios ni modificar
DevotionMap.

```powershell
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') --filter @gd/domain build
./node_modules/.bin/ng.cmd test --no-watch --include src/app/features/build/devotion-section/devotion-section.spec.ts --include src/app/shared/svg/devotion-map/devotion-map.spec.ts
./node_modules/.bin/ng.cmd build --configuration devotion-section-preview
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') lint
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') format:check
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') lint:md
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') build
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') check:initial-js
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') check:public-build
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') check:secrets
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') check:contrast
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') check:scope
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') check:boundaries
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') build:release
& (Join-Path $env:TEMP 'gd-t057-tools/pnpm.cmd') check:release
```

Resultado unitario: 2 suites aprobadas, 20/20 pruebas (log
`$env:TEMP/gd-t033-green.log`). DevotionMap se probó sin modificar sus fuentes.
La paridad conserva los 11 pasos, 13 constelaciones, 5 bindings y 3 notas; el mapa
recibe las colecciones originales completas y el selector no duplica cuerpos ni
bindings. Se comprobaron pasos 10/11 con destino null, estado neutral, posiciones
duplicadas, entradas congeladas, visibilidad, vacío, IDs únicos, escape de texto,
foco y control del padre.

Playwright temporal con Chromium 158 y axe-core 4.14 contra el build prerenderizado,
servido solo en `127.0.0.1:4306` con `createPreviewServer` de
`scripts/serve-svg-preview.mts`. A 375/768/1280: axe WCAG 2.0/2.1/2.2 A/AA dio
0 violaciones en la página hidratada y con los bundles de la app bloqueados;
selección por click/Enter/Espacio y touch a 375, foco visible 2px y conservado,
targets ≥24px, aviso sin verificar persistente, y pasos null resaltan su fila sin
activar grupo SVG. La variante estricta `javaScriptEnabled:false` conserva h1,
notas, mapa/lista y pasos SSR; controles desactivados y sin overflow. Axe requiere
ejecución de JavaScript, por lo que el DOM estrictamente no-JS se verificó aparte
de las dos pasadas axe sin bundles de aplicación. Aumento de texto 200% sin scroll
horizontal, cero errores de consola y cero solicitudes externas/API.

Capturas inspeccionadas: `$env:TEMP/gd-t033-375.png`,
`$env:TEMP/gd-t033-768.png` y `$env:TEMP/gd-t033-1280.png`. El preview y servidor
temporales se detuvieron y `dist/devotion-section-preview` se eliminó. No se añadió
storage, dependencia, ruta, API ni cambio a DevotionMap.

`pnpm build` pasó con Home 0/90000 bytes gzip y tier-list 105096/110000; muestra
advertencias raw existentes (291.42 kB sobre warning 280 kB, bajo error 300 kB;
CSS de devotion-map 4.38 kB y skill-tree 4.74 kB sobre warning 4 kB, bajo error
8 kB). `check:public-build` pasó (175 archivos); `check:secrets` (126), contraste
(12 pares, mínimo 4.556:1), scope (170) y boundaries (199) pasaron. Release desde
API y `check:release` pasaron. El artefacto release tiene 20 archivos browser, no
emite ruta `/builds`, bundles JS de preview, contenido sintético ni cuerpos de la
guía pendiente; no contiene Zod. El `stats.json` registra 7 entradas virtuales de
CSS de componentes preview, incluida T-033, que no se emiten al browser; no hay
salida JS de preview. Esto es metadato del compilador Angular, no contenido del
artefacto. Impeccable 4.8.1 `detect --json` devolvió `[]`. Logs locales
`$env:TEMP/gd-t033-*.log`; no acreditan CI remoto ni revisión humana.

Se actualizó quickstart/handoff y T-033 se marca completa solo tras estos checks.
Esto no implementa T-034 ni cierra la spec001 o la puerta de revisión spec002.

Análisis speckit-analyze acotado ejecutado tras check-prerequisites.ps1 -Json
-RequireSpec -RequireTasks -IncludeTasks: spec/plan/tasks presentes,9 requisitos
(FR-02/03/06/07/10 y AC-02/03/06/09),1 tarea T-033,100% del alcance definido
cubierto y responsabilidades de página completa conservadas en tareas posteriores.
0 CRITICAL,0 HIGH,0 duplicados/ambigüedades abiertas, sin tareas huérfanas.
Constitución I/III/IV/V/VI/IX/X/XI conservada; FR-08 no se extiende a devociones.
La lista breve de controles y la ruta completa del leaf tienen funciones distintas;
ningún body/binding se vuelve a renderizar en el selector. No se ejecutaron pruebas
UI durante planificación. La implementación T-033 se completó posteriormente con
la evidencia de esta sección; no se ejecutó otra tarea.

El inventario documental solicitado se actualizó en `handoff.md` después de
verificar T-033: recuento derivado de `tasks.md`, IDs/categorías pendientes,
puerta spec002 aún pendiente, evidencias y límites sin secretos. No habilita
tareas posteriores ni declara cerrada spec001.

Reanálisis acotado tras incorporar el relevo expresamente solicitado: prerequisitos
oficiales pasan; los9requisitos anteriores y el requisito documental de inventario
y detención tienen cobertura explícita en T-033/§17.37.0 CRITICAL/HIGH. El relevo
final ahora registra T-033 completada y conserva pendientes restantes.

## T-135 y T-034: planificación y validación prevista — 2026-11-10

Plan §7, §17.38 (`T-135`) y §17.39 (`T-034`), junto con `spec.md` §5 y `tasks.md`,
se actualizaron antes de implementar mediante `speckit-plan`, `speckit-tasks` y
`speckit-analyze`. Además se normalizaron todos los checkboxes pendientes de
`tasks.md` al formato `- [ ] **T-xxx**` (verificado con
`node scripts/spec-review.mjs prepare --feature specs/001-mvp-guias-builds`:
estado `pending-tasks`, salida 1, 0 errores de formato).

Comandos de validación previstos para `T-135` (estética Grim Dawn):

```powershell
pnpm check:contrast
node --import tsx --test src/app/shared/ui/icon/resolve-icon.server.test.mts
pnpm test --watch=false
pnpm exec ng build --configuration build-sections-preview
pnpm lint
pnpm lint:md
pnpm build
pnpm check:initial-js
pnpm check:public-build
```

Comandos de validación previstos para `T-034` (`gd-loot-filter`, tras `T-135`):

```powershell
pnpm exec ng test --watch=false --include=src/app/features/build/loot-filter/loot-filter.spec.ts
pnpm --filter @gd/domain build
pnpm exec ng build --configuration loot-filter-preview
pnpm lint
pnpm lint:md
pnpm build
pnpm check:initial-js
pnpm check:public-build
```

Análisis `speckit-analyze` acotado tras `check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks`:
artefactos `spec.md`, `plan.md` y `tasks.md` presentes; 10 requisitos evaluados
(`US1.5`, `FR-02`, `FR-06`, `FR-10`, `spec §4`, `spec §5`, `AC-02`, `AC-05`,
`AC-06`, `AC-09`) cubiertos al 100 % en su alcance por `T-135` y `T-034`.
Resultado: **0 CRITICAL**, **0 HIGH**, **0 MEDIUM**, **0 LOW**, 0 duplicados y
0 ambigüedades abiertas. Constitución I/III/IV/V/VI/VII/VIII/IX/X/XI/XII
preservada. Esta sección registra la planificación y análisis previos; no
acredita la ejecución de las pruebas de implementación de `T-135` ni `T-034`.

## T-135: estética Grim Dawn completada — 2026-11-10

El paso rojo de `resolve-icon.server.test.mts` falló antes de implementar porque
`--color-bone` aún era `#e4dfd2` (esperado `#eadfca`); el log está en
`$env:TEMP/gd-t135-red.log`. Después del cambio, las cuatro pruebas Node pasan y
comprueban también `--color-soot: #0c0a08` y el stroke de los 29 SVG. No quedan
strokes `#e4dfd2` en `src/assets/icons/`.

Se aplicaron los 10 valores Cairn de plan §7/§17.38, sin ampliar el conjunto
`--color-*`, y los tokens de enmarcado indicados. Layout, portada, catálogo,
secciones de build, stepper, devociones y ambos diagramas usan placas cálidas,
filetes metálicos y bisel; no se cambiaron HTML, contratos ni dependencias.
`pnpm check:contrast` pasa los 12 pares sin redondear; mínimo observado
5.811:1. `pnpm exec ng test --watch=false` pasa 165 pruebas en 23 archivos.
`pnpm e2e:svg` pasa 24/24 pruebas.

Los previews `build-sections-preview` y `devotion-section-preview` y el build
principal se construyeron desde las fuentes actuales. Chromium + axe-core revisó
portada, catálogo y ambos previews en 375/768/1280: 12 combinaciones, 0
violaciones WCAG 2.0/2.1/2.2 A/AA, sin overflow horizontal ni errores de página.
Capturas finales inspeccionadas: `$env:TEMP/gd-t135-{375,768,1280}.png` y
`$env:TEMP/gd-t135-{tier,build,devotion}-{375,768,1280}.png`. Los servidores
temporales se cerraron y los cuatro directorios de preview se eliminaron después
de verificar sus rutas; el artefacto principal/release se conserva.

Impeccable 4.8.1 `context --target src/styles/tokens.css` terminó correctamente;
`detect --json` sobre las hojas cambiadas devolvió `[]`. `pnpm lint`,
`pnpm format:check`, `pnpm lint:md` y `pnpm check:secrets` pasan. El build pasa;
`check:initial-js` mide Home 0/90000 y catálogo 105259/110000 bytes gzip nivel 6.
`check:public-build` pasa (319 archivos). La salida Angular conserva avisos no
bloqueantes dentro de los topes de error: bundle inicial raw 292.47 kB frente a
warning 280/error 300 kB; CSS de skill-tree 4.94 kB y devotion-map 4.58 kB frente
a warning 4/error 8 kB. El CSS global inicial mide 5088 bytes raw y 1657 bytes
gzip nivel 6, por debajo del presupuesto de 20 kB gzip.

`build:release` requiere `CONTENT_SOURCE=api`: la llamada sin esa variable fue
rechazada, y al fijarla el release desde API terminó correctamente; después
`pnpm check:release` pasó con API y migración coincidentes. No se tocó la base de
datos ni se publicó la guía pendiente. La suite y verificación son locales; no
acreditan CI remoto, NVDA humano ni el cierre de spec001/spec002.

## T-034: filtro de botín controlado completado — 2026-11-10

`loot-filter.spec.ts` se ejecutó primero en rojo porque el componente aún no
existía (`$env:TEMP/gd-t034-red.log`); el fallo quedó limitado al import de
`./loot-filter`. Después pasan sus 12 pruebas (`gd-t034-green.log`): paridad de las
4 columnas/8 reglas, las tres acciones localizadas, introducción y nota final frente
a ambos fixtures locales, resumen de texto exacto y determinista, orden sin mutación,
visibilidad/vacío, `<details open>`, duplicados, IDs aislados, escape, SSR, y copia
exitosa, rechazada o sin Clipboard API.

`pnpm --filter @gd/domain build` y `pnpm ng build --configuration
loot-filter-preview` pasan. El preview usa solo contenido sintético propio,
prerenderiza una ruta y no importa la guía pendiente. El presupuesto de componente
4 kB se añadió a esa configuración; el CSS de `loot-filter` no genera advertencia
de presupuesto (los avisos existentes de `skill-tree` y `devotion-map` se mantienen
bajo su límite de error). No se añadieron dependencias.

Playwright local/axe-core 4.14 en `127.0.0.1:4314`: a 375, 768 y 1280 px se
comprobaron hidratación, bundles de la aplicación bloqueados y contexto con
JavaScript estrictamente desactivado. Las seis auditorías axe de los dos primeros
modos dieron 0 violaciones; el DOM no-JS se comprobó aparte. `<summary>` responde
a Enter/Espacio, «Copiar resumen» a Enter y el texto coincide con
`navigator.clipboard.writeText`. Aumento de texto 200 % sin overflow horizontal.
Capturas inspeccionadas: `$env:TEMP/gd-t034-{375,768,1280}.png`; reporte
`gd-t034-browser.log`. El proceso servidor se cerró al acabar y
`dist/loot-filter-preview` se eliminó.

`pnpm lint`, `pnpm format:check`, `pnpm lint:md` (43 archivos),
`pnpm check:secrets` (126 archivos), `pnpm build`, `pnpm check:initial-js`,
`pnpm check:public-build` (127 archivos), `CONTENT_SOURCE=api pnpm build:release`
y `pnpm check:release` pasan. Presupuestos gzip: Home 0/90000; tier-list
105259/110000 bytes. Los avisos Angular existentes (bundle inicial 292.47 kB,
`skill-tree` 4.94 kB y `devotion-map` 4.58 kB) permanecen bajo sus límites de error;
el CSS del filtro está bajo el warning 4 kB. Release API/migración verificados;
la salida pública no contiene el preview. Impeccable 4.8.1 `detect --json` devolvió
`[]` (`gd-t034-impeccable.log`). Logs detallados bajo `$env:TEMP/gd-t034-*.log`.

T-034 queda cerrada solo en su alcance; T-035 y el resto de spec001 siguen abiertas.
No se modificaron rutas, datos editoriales, backend, dependencias ni API del
navegador. La guía pendiente permanece sin publicar; no se hizo commit, push o PR.

## T-035–T-037/T-020: planificación y análisis — 2026-11-10

Se añadieron las secciones §17.40 (`T-035`, fachada de video), §17.41 (`T-036`,
atribución/fuentes y TOC), §17.42 (`T-037`, página ensamblada) y §17.43 (`T-020`,
rutas lazy, prerender, resolver y 404 con estado) a plan.md, y se sustituyeron en
tasks.md las cuatro líneas con listas exactas de archivos y aceptación. No se marcó
ningún checkbox: el inventario sigue en **67** tareas `[x]` y **41** activas.

La planificación se contrastó con `packages/domain/src/schema.ts`,
`content/builds/chaman-demoledor-golpe-primigenio.json`,
`e2e/fixtures/original-guide.json`, `app.routes*.ts`, `repository.ts`,
`catalog.server.ts`, `author-pages.server.ts`, `seo.service.ts` y
`site-layout.ts`. Correcciones respecto al resumen inicial, registradas para no
inventar contrato:

- El DTO público de autor no incluye `is_placeholder` ni existe `role_label`;
  `T-036` recibe `authorPlaceholder` desde el servidor y no inventa roles.
- No existe `updated_at` en `BuildContentSchema`; se muestra `published_at` o
  «Sin fecha».
- `SourceSchema` no tiene `site`; se deriva el hostname de la URL validada.
- La guía migrada no tiene nota «Descargo»; se usa `footer_disclaimer` cuando la
  nota no existe.
- Los `section_key` reales son `habilidades`, `filtro-de-botin` y
  `guia-espiritual`; los `id` son los canónicos de plan §2.

Análisis `speckit-analyze` acotado tras `check-prerequisites.ps1 -Json
-RequireSpec -RequireTasks -IncludeTasks`: artefactos presentes; 0 CRITICAL,
0 HIGH, 1 MEDIUM y 4 LOW. El MEDIUM es la ausencia de `updated_at` frente al
subrequisito de fecha de actualización de FR-02, acotado a `published_at`/«Sin
fecha» y remitido a una enmienda de T-006 si se exige; los LOW son `role_label`,
`site`, la nota «Descargo» ausente y los `section_key` reales. Todos quedaron
resueltos o explícitamente acotados en las secciones nuevas. `T-020` incluye el
cableado pendiente de FR-16 (descriptores públicos aprobados desde API sin
evidencia privada), que sigue siendo requisito para marcarla.

La fase se ejecutó con `opencode/deepseek-v4.1-flash-free#high`: los modelos de
pago de `opencode-go` devolvieron `OpenCode Go usage limit reached` y los de
`opencode` con saldo, `Insufficient balance`. `T-021` (sitemap/robots) NO se
planificó en esta fase: no existe §17.44 y su línea de tarea conserva la
redacción original. La implementación de T-035/T-036/T-037/T-020 no se inició.

Verificación de esta fase documental:

- `./node_modules/.bin/markdownlint-cli2.cmd`: 43 archivos, 0 incidencias.
- `node scripts/spec-review.mjs prepare --feature specs/001-mvp-guias-builds`:
  `{"status":"pending-tasks", ...}` con `reasons: ["active implementation tasks
  remain unchecked"]`, salida 1; es el resultado esperado porque T-035–T-037 y
  T-020 continúan abiertas.

Esta entrada acredita planificación y análisis, no implementación: no hay pruebas
de componente, preview, build, axe ni evidencia de rutas para T-035–T-037/T-020.

## T-035: fachada de video

Se ejecutó primero `ng test --watch=false --include
src/app/features/build/video-facade/video-facade.spec.ts`. Angular salió con
código 1 y TS2307 porque todavía faltaba `./video-facade`; los errores de tipo
derivaban del mismo import. Con el componente implementado pasan las 24 pruebas
de ausencia, validación, normalización, SSR, activación, bloqueo detectable,
reinicio por guía, escape y ausencia de acceso directo a red o almacenamiento.

El criterio de error confirmado para §17.40 cubre bloqueos observables desde la
página, como una infracción de CSP `frame-src`. El enlace externo sigue disponible
si el fallo del reproductor no es observable desde la página. La comprobación de
ausencia del host en la página ensamblada corresponde a T-037.

`ng build --configuration video-facade-preview` prerenderizó una ruta con datos
sintéticos. El CSS de la fachada (2215 bytes en fuente) quedó bajo el warning de
4 kB. Los avisos preexistentes de `skill-tree` y `devotion-map` siguen bajo 8 kB.

Playwright y axe-core 4.14, en Chrome local a 375/768/1280 px:

- Cero violaciones en las seis auditorías del preview hidratado y con los
  bundles de la app bloqueados. En el contexto con JavaScript desactivado se
  verificaron por separado DOM SSR, botón deshabilitado, enlace y foco.
- Foco de 2 px, Enter/Espacio, objetivos de al menos 24 px y texto al 200 %
  sin overflow. El enlace conservó su posición tras activar el reproductor.
- Cero solicitudes externas antes de activar. Después se interceptó una única
  solicitud al iframe normalizado de `www.youtube-nocookie.com`. El ensayo
  usó una respuesta sintética y no acredita reproducción remota.
- Con una cabecera real `frame-src 'none'`, la alerta apareció, el iframe se
  retiró, el enlace siguió disponible y axe dio cero violaciones. La consola
  estuvo limpia antes de activar; Chrome emitió después su advertencia por la
  combinación `allow-scripts` y `allow-same-origin` requerida en §17.40.
- Se inspeccionaron `$env:TEMP/gd-t035-{375,768,1280,blocked}.png`. El reporte
  quedó en `$env:TEMP/gd-t035-browser-verified.log`; el servidor se cerró y
  se eliminó `dist/video-facade-preview`. Impeccable `detect --json` devolvió `[]`.

Pasaron `pnpm lint`, `pnpm format:check`, `pnpm lint:md` (43 archivos),
`pnpm build`, `pnpm check:initial-js`, `pnpm check:public-build` (127 archivos
tras retirar el preview), `pnpm check:secrets` (126 archivos rastreados),
`CONTENT_SOURCE=api pnpm build:release` y `pnpm check:release`.
Los dos últimos verificaron API, migración y artefacto. El JavaScript inicial
comprimido quedó en 0/90000 bytes para Home y 105259/110000 para Tier List.
La salida pública no contiene el preview ni la guía pendiente. Angular y el
escáner de secretos se repitieron fuera del sandbox por errores de acceso del
entorno. Los logs de los checks se conservan en `$env:TEMP/gd-t035-*.log`.

Tras marcar T-035, `node scripts/spec-review.mjs prepare --feature
specs/001-mvp-guias-builds` devolvió `pending-tasks` (salida 1, 66 pendientes
según el coordinador). La spec001 sigue abierta.
