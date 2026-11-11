# Hitos de entrega — spec001

División de la spec en hitos publicables, con su correspondencia a tareas,
ramas, PRs y estado de verificación. Sustituye la entrega monolítica por
entregas revisables.

**Origen**: petición del usuario (2026-11-10): «esta spec es muy grande, me
gustaría que dividiéramos la spec por hitos y subir las actualizaciones
pertinentes al repo, abriendo PRs si es necesario».

## Restricción que condiciona la división

Tres archivos son compartidos por todas las capas y no se pueden partir sin
romper el workspace:

- `package.json` (declara todos los scripts)
- `pnpm-lock.yaml` (una sola resolución de dependencias)
- `angular.json` (todas las configuraciones de preview)

Por eso los hitos **se apilan en orden**: cada rama parte de la anterior y los
PRs se fusionan en secuencia. Un hito no es independiente de los anteriores; es
una rebanada revisable, no un módulo aislado.

## Hitos

### Hito 1 — Fundación SDD y dominio

Base instalable del proyecto: reglas, tooling SDD, dominio tipado y contenido
fixture validado.

- Tareas: T-005, T-006, T-009, T-010, T-014, T-015, T-016, T-047, T-048,
  T-050, T-051, T-052, T-063, T-063a, T-069, T-124, T-127, T-129, T-130,
  T-132, T-133, T-134
- Rutas: `.specify/**`, `.agents/skills/speckit-*/**`, `packages/domain/**`,
  `content/**`, `scripts/fixtures/**`, `scripts/{validate-content,gen-catalog,check-assets,check-scope,check-boundaries,check-secrets,domain-runtime,verify-local,lint-md}*`,
  `pnpm-workspace.yaml`, `package.json`, `pnpm-lock.yaml`, `specs/**`,
  `AGENTS.md`, `CONTRIBUTING.md`, `.markdownlint-cli2.jsonc`, `.gitleaks.toml`,
  `.gitattributes`, `.gitignore`, `.githooks/pre-commit`, `docs/content/**`,
  `docs/fonts.md`
- Rama: `feature/hito-1-fundacion-dominio`
- Base del PR: `mvp/1`
- Verificación mínima: `pnpm --filter @gd/domain test`, `content:validate`,
  `check:scope`, `check:boundaries`, `check:secrets`, `lint:md`

### Hito 2 — Backend contenido

API de solo lectura, PostgreSQL, migraciones con puertas y gestión de secretos.

- Tareas: T-053 a T-062, T-064, T-065, T-066a, T-066b, T-071 a T-074, T-076,
  T-078 a T-085, T-124, T-125, T-129
- Rutas: `apps/api/**`, `infra/docker/**`, `tests/**`, `docs/security/**`,
  `docs/secrets-inventory.md`,
  `scripts/{setup-env,rotate-secret,seed-content,bootstrap-content,editor-content,check-release,build-release,check-public-build,public-build-env,compose.test,secret-scan,setup-gitleaks}*`
- Rama: `feature/hito-2-backend-contenido`
- Base del PR: `feature/hito-1-fundacion-dominio` (se reapunta a `mvp/1` tras
  fusionar el hito 1)
- Verificación mínima: pruebas de API, `docker compose config`, paridad de
  esquema, `check:secrets`

### Hito 3 — Web y experiencia

Aplicación completa: portada estática, catálogo, SVG interactivos, secciones de
guía y estética Cairn.

- Tareas: T-017, T-018, T-019, T-022 a T-025, T-026 a T-045 (las cerradas),
  T-038, T-135 y las de secciones de build
- Rutas: `src/**`, `public/**`, `angular.json`, `tsconfig*.json`,
  `eslint.config.js`, `playwright.svg.config.ts`, `e2e/**`,
  `scripts/{static-home,check-initial-js,check-contrast,serve-svg-preview,run-svg-e2e,svg-preview,spec-review}*`
- Rama: `feature/hito-3-web-experiencia`
- Base del PR: `feature/hito-2-backend-contenido`
- Verificación mínima: `pnpm build`, `check:initial-js`, `check:public-build`,
  pruebas de componente, axe y capturas a 375/768/1280

### Hito 4 — Cierre de calidad (pendiente)

No se abre hasta que las tareas de cierre estén verdes.

- Tareas pendientes: T-037, T-020, T-021, T-039, T-040, T-041, T-042, T-043,
  T-045, T-046, T-068, T-070, T-077, T-086, T-101 a T-113, T-123, T-126,
  T-128, T-136
- Requisito de cierre: puerta de spec002 (cuatro revisiones) y `T-136`
  (revisión de código por el modelo de pago más potente).

## Estado de publicación

| Hito | Rama | PR | Estado |
| --- | --- | --- | --- |
| Base | `mvp/1` | — | sin publicar: el remoto está vacío |
| 1 | `feature/hito-1-fundacion-dominio` | pendiente | preparado, no publicado |
| 2 | `feature/hito-2-backend-contenido` | pendiente | en árbol de trabajo |
| 3 | `feature/hito-3-web-experiencia` | pendiente | en árbol de trabajo |
| 4 | — | — | pendiente de implementación |

## Condiciones para publicar

1. `check:secrets` en verde y ningún `.env`/`secrets/` rastreado.
2. Tareas del hito verificadas; las no verificadas se declaran, no se ocultan.
3. Sin commits de trabajo en curso de otro agente (por ejemplo, una tarea con
   pruebas en rojo).
4. Autorización explícita del usuario para commit, push y PR.
