# Grim Dawn Builds

[English](README.md) · **Español**

Guías de builds de Grim Dawn rápidas, accesibles e interactivas: árboles de
habilidades, rutas de devoción, equipo, filtros de botín y tier list con
procedencia editorial.

[![CI](https://github.com/frxncismor/grim-dawn-builds/actions/workflows/ci.yml/badge.svg)](https://github.com/frxncismor/grim-dawn-builds/actions/workflows/ci.yml)

> **Estado**: MVP en desarrollo local. El contenido solo se publica después de
> validar autoría, derechos, fuentes y revisión editorial. La guía migrada
> permanece en `borrador` con `rights_status: pending`, así que el build público
> se entrega sin guía publicada.

## Objetivo

El proyecto ofrece una alternativa moderna a los directorios estáticos de
builds. Cada guía se representa desde datos estructurados y puede incluir:

- Prioridades y orden de puntos de habilidades.
- Árboles de habilidades y devociones renderizados como SVG accesible.
- Equipo, notas, filtro de botín y video opcional.
- Autor, fuentes, versión del juego y estado de revisión.

La tier list cubre todas las combinaciones de maestrías mediante ranuras
informativas. Una ranura no implica que exista una guía, ni que tenga tier: las
entradas sin una evaluación editorial documentada permanecen como
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

- **Web**: Angular 21 con SSR/prerender estático, TypeScript estricto, i18n y CSS
  con tokens propios.
- **Dominio**: `@gd/domain` — Zod y reglas puras compartidas por web, API y
  scripts. Sin dependencias de Angular, HTTP ni base de datos.
- **Backend**: Fastify + Drizzle ORM sobre Node.js 22 y PostgreSQL 17, en Docker
  Compose. PostgreSQL es la única fuente de verdad del contenido editorial.
- **Calidad**: Vitest, Playwright, axe-core, Lighthouse y markdownlint.
- **Estilo visual**: paleta Cairn inspirada en Grim Dawn (hierro, bronce y
  ascua), verificada con contraste WCAG 2.2 AA.

## Requisitos

- Node.js 22.12.0 (ver `.nvmrc`).
- pnpm 12.18.0, activado con Corepack: `corepack enable`.
- Docker Desktop solo para el backend local y el build de release.

## Desarrollo local

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm setup:gitleaks
pnpm setup:hooks
pnpm start
```

Abre `http://localhost:4200/`.

Sin Docker, la web funciona con fixtures (`CONTENT_SOURCE=fixture`). Para el
backend real:

```bash
pnpm setup:env
docker compose -f infra/docker/compose.yaml up -d --wait
```

`pnpm setup:env` crea credenciales locales ignoradas por git. **Nunca** se
commitean secretos: los detalles están en [`CONTRIBUTING.md`](CONTRIBUTING.md) y
en [`docs/security/secrets.md`](docs/security/secrets.md).

## Verificación

Antes de abrir un pull request:

```bash
pnpm verify
```

`pnpm verify` encadena, y se detiene en el primer fallo: `check:scope`,
`check:boundaries`, `check:secrets`, typecheck, lint, `lint:md`, formato, tests
del dominio, tests de la web, tests de scripts, `assets:check` y `build`.

Comandos focalizados durante el desarrollo:

| Comando                                    | Qué comprueba                                 |
| ------------------------------------------ | --------------------------------------------- |
| `pnpm test`                                | Pruebas unitarias de la web                   |
| `pnpm --filter @gd/domain test`            | Pruebas del dominio                           |
| `pnpm test:scripts`                        | Pruebas de los scripts de verificación        |
| `pnpm lint`                                | ESLint                                        |
| `pnpm lint:md`                             | markdownlint en todo el Markdown rastreado    |
| `pnpm format:check`                        | Prettier                                      |
| `pnpm content:validate -- --dir <carpeta>` | Esquema de contenido                          |
| `pnpm check:contrast`                      | Contraste de los tokens de color              |
| `pnpm check:initial-js`                    | Presupuesto de JavaScript inicial             |
| `pnpm check:public-build`                  | Ausencia de secretos y de contenido pendiente |

Build de release (exige la API arriba y `CONTENT_SOURCE=api`):

```bash
pnpm build:release
pnpm check:release
```

## Estructura

```text
apps/api/         API Fastify + Drizzle (solo lectura pública)
packages/domain/  Esquema Zod, tipos y reglas puras compartidas
src/              Aplicación Angular (web)
content/          Fixtures de desarrollo y material de importación
infra/docker/     Compose, secretos locales y aprovisionamiento de roles
scripts/          Validadores, generadores y puertas de verificación
e2e/              Pruebas Playwright
docs/             Documentación operativa y editorial
specs/            Especificaciones, planes y tareas SDD
.specify/         Constitución y memoria de la metodología SDD
.agents/skills/   Skills de revisión, cierre de spec e Impeccable
```

La guía HTML original se conserva como fixture local de migración. No se
considera contenido publicable mientras sus derechos estén pendientes.

## Método de trabajo

El proyecto sigue **Spec-Driven Development con GitHub Spec Kit** y **GitFlow**:

- `main`: versiones estables.
- `develop`: integración de la próxima versión.
- `mvp/1`: rama de integración del MVP.
- `feature/*`, `release/*` y `hotfix/*`: ramas de trabajo.

Todo cambio llega mediante pull request; no se integra directamente en `main`,
`develop` ni `mvp/1`. Las reglas completas están en
[`CONTRIBUTING.md`](CONTRIBUTING.md) y la metodología multiagente en
[`AGENTS.md`](AGENTS.md).

### Hitos de entrega

La spec se entrega por hitos revisables, no en un bloque único. El detalle, y la
correspondencia entre hitos, tareas y PRs, está en
[`specs/001-mvp-guias-builds/milestones.md`](specs/001-mvp-guias-builds/milestones.md).

1. **Fundación SDD y dominio** — reglas, tooling, dominio tipado y contenido
   validado.
2. **Backend contenido** — API, PostgreSQL, migraciones con puertas y secretos.
3. **Web y experiencia** — portada estática, catálogo, SVG interactivos y
   estética Cairn.
4. **Cierre de calidad** — e2e, accesibilidad, rendimiento y puerta de revisión.

## Documentación

- [Constitución](.specify/memory/constitution.md): principios y restricciones.
- [Especificación del MVP](specs/001-mvp-guias-builds/spec.md).
- [Plan](specs/001-mvp-guias-builds/plan.md) y
  [tareas](specs/001-mvp-guias-builds/tasks.md).
- [Hitos](specs/001-mvp-guias-builds/milestones.md).
- [Revisiones de cierre de spec](specs/002-spec-completion-reviews/).
- [Cómo contribuir](CONTRIBUTING.md).

## Licencia

El código se distribuye sin licencia declarada por ahora: todos los derechos
reservados hasta que el mantenedor elija una. El contenido editorial de terceros
se rige por sus propias licencias y permisos registrados en `content/sources/`.

## Idioma

El inglés es el idioma principal del repositorio: README, pull requests, commits y
la configuración regional por defecto del sitio. El español es una opción de
primera clase, no un añadido: consulta [`README.md`](README.md) y la configuración
regional `es` del sitio web. Las cadenas de interfaz pasan por el sistema i18n de
Angular para que ambas configuraciones permanezcan completas.
