# Grim Dawn Builds

Guías de builds de Grim Dawn rápidas, accesibles e interactivas: árboles de
habilidades, rutas de devoción, equipo, filtros de botín y tier list con
procedencia editorial.

> Estado: MVP en desarrollo local. El contenido solo se publica después de
> validar autoría, derechos, fuentes y revisión editorial.

## Objetivo

El proyecto ofrece una alternativa moderna a los directorios estáticos de
builds. Cada guía se representa desde datos estructurados y puede incluir:

- Prioridades y orden de puntos de habilidades.
- Árboles de habilidades y devociones renderizados como SVG accesible.
- Equipo, notas, filtro de botín y video opcional.
- Autor, fuentes, versión del juego y estado de revisión.

La tier list cubre todas las combinaciones de maestrías mediante ranuras
informativas. Una ranura no implica que exista una guía, ni que tenga tier:
las entradas sin una evaluación editorial documentada permanecen como
`Sin clasificar`.

## Principios de contenido

- No se raspa ni copia contenido de terceros.
- Las guías propias o licenciadas requieren fuente, autor y estado de derechos.
- El contenido pendiente de derechos se mantiene como borrador local y no se
  genera en la salida pública.
- Los recursos oficiales de Grim Dawn solo se usan cuando el manifiesto de
  activos documenta su origen y permiso o licencia. Mientras tanto se usan
  iconos SVG propios como fallback.

El proyecto no está afiliado con Crate Entertainment ni con GrimTools.

## Stack

- Angular con SSR/SSG y TypeScript estricto.
- Datos locales versionados y validados con Zod.
- SVG nativo para las visualizaciones interactivas.
- Arquitectura preparada para PostgreSQL/Supabase, sin depender de servicios
  remotos durante el MVP local.

## Requisitos

- Node.js compatible con Angular 21.
- npm 11 o posterior.

## Desarrollo local

```bash
pnpm install
pnpm start
```

Abre `http://localhost:4200/`.

## Validación

Ejecuta estas comprobaciones antes de abrir un pull request:

```bash
pnpm test
pnpm test:scripts
pnpm lint
pnpm format:check
pnpm content:validate
pnpm assets:check
pnpm build
```

`pnpm verify` agrupa las validaciones locales disponibles.

## Estructura

```text
content/        Datos editoriales y catálogo versionados
scripts/        Validadores e importadores locales
specs/          Especificaciones y tareas SDD
src/            Aplicación Angular
.specify/       Constitución y memoria de la metodología SDD
```

La guía HTML original se conserva como fixture local de migración. No se
considera contenido publicable mientras sus derechos estén pendientes.

## Flujo de trabajo

Seguimos **GitFlow**:

- `main`: versiones estables.
- `develop`: integración de la próxima versión.
- `feature/*`, `release/*` y `hotfix/*`: ramas de trabajo.
- Todo cambio llega mediante pull request; no se integra directamente en
  `main` ni `develop`.

Los pull requests deben aprobar las pruebas, lint, formato y validaciones de
contenido. Las automatizaciones de seguridad (incluido DAST) y revisión con
Copilot se configurarán como controles gratuitos antes del primer despliegue.

## Documentación de producto

La especificación del MVP y sus criterios de aceptación están en
[`specs/001-mvp-guias-builds/`](specs/001-mvp-guias-builds/). La constitución
del proyecto está en [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
