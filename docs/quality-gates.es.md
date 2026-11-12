# Puertas de calidad

[English](quality-gates.md) · **Español**

Esta matriz se deriva de `scripts/verify-local.mjs` (el orden de los pasos locales)
y de `.github/workflows/ci.yml` (el job `verify` de las pull requests); no sustituye
a ninguno de los dos archivos, que siguen siendo la fuente de verdad.

| Puerta | Comando | Local (`pnpm verify`) | CI (PR) | Bloqueante | Tarea de origen |
|---|---|---|---|---|---|
| Guardia de alcance | `pnpm run check:scope` | yes | yes | yes | T-046 |
| Límites del monorepo | `pnpm run check:boundaries` | yes | yes | yes | T-052 |
| Secretos rastreados | `pnpm run check:secrets` | yes | yes | yes | T-066a |
| Secretos del flujo de trabajo de CI (comando local) | `pnpm run check:ci-secrets` | yes | no | no | T-086 |
| Compilación del dominio | `pnpm --filter @gd/domain build` | yes | yes | yes | T-051 |
| Comprobación de tipos del dominio | `pnpm --filter @gd/domain typecheck` | yes | yes | yes | T-051 |
| Lint del dominio | `pnpm --filter @gd/domain lint` | yes | yes | yes | T-051 |
| Pruebas unitarias del dominio | `pnpm --filter @gd/domain test` | yes | yes | yes | T-051 |
| Comprobación de tipos de la API | `pnpm --filter @gd/api typecheck` | yes | yes | yes | T-053 |
| Lint de la API | `pnpm --filter @gd/api lint` | yes | yes | yes | T-053 |
| Pruebas de la API | `pnpm --filter @gd/api test` | yes | yes | yes | T-053 |
| Prueba de rotación de credenciales | `pnpm test:rotation` | yes | no | no | T-082 |
| Lint de la web | `pnpm lint` | yes | yes | yes | T-002 |
| Lint de Markdown | `pnpm lint:md` | yes | yes | yes | T-123 |
| Comprobación de formato | `pnpm format:check` | yes | yes | yes | T-002 |
| Pruebas unitarias de la web | `pnpm test` | yes | yes | yes | T-002 |
| Pruebas de scripts | `pnpm test:scripts` | yes | yes | yes | T-004 |
| Validación de contenido (contenido del repositorio) | `pnpm run content:validate -- --dir content` | yes | yes | yes | T-009 |
| Comprobación del catálogo | `pnpm run catalog:check` | yes | yes | yes | T-016 |
| Paridad de locales | `pnpm run check:locale-parity` | yes | yes | yes | T-138 |
| Manifiesto de activos | `pnpm assets:check` | yes | yes | yes | T-047 |
| Contraste | `pnpm check:contrast` | yes | no | no | T-135 |
| Build de la web | `pnpm build` | yes | yes | yes | T-001 |
| Guardia del artefacto público | `pnpm check:public-build` | yes | no | no | T-084 |
| Presupuestos de rendimiento | `pnpm check:performance` | yes | yes | yes | T-042 |
| Instalación de dependencias (lockfile congelado) | `pnpm install --frozen-lockfile` | no | yes | yes | T-064 |
| Secretos del flujo de trabajo de CI (comando de CI) | `pnpm exec tsx scripts/check-ci-secrets.mts` | no | yes | yes | T-086 |
| Instalación de gitleaks (fijada, comprobada con SHA-256) | `curl -sSfL …gitleaks_8.30.1_linux_x64.tar.gz; sha256sum --check --strict; tar -xzf` | no | yes | yes | T-083 |
| Escaneo de secretos (rango de commits del PR) | `gitleaks git --redact --exit-code 1 --config .gitleaks.toml --log-opts="$BASE_SHA..$HEAD_SHA" .` | no | yes | yes | T-083 |
| Imagen del fixture de PostgreSQL (digest fijado) | `docker pull <image pinned by digest in infra/docker/compose.yaml>` | no | yes | yes | T-065 |
| Configuración de Compose | `docker compose --env-file infra/docker/.env.example -f infra/docker/compose.yaml config --quiet` | no | yes | yes | T-065 |
| Build de la imagen de la API (sin push) | `docker build --file apps/api/Dockerfile --tag gd-api:ci .` | no | yes | yes | T-065 |
| La imagen de la API se ejecuta sin ser root | `test "$(docker run --rm gd-api:ci id -u)" != "0"` | no | yes | yes | T-065 |
| Validación de contenido (fixture) | `pnpm run content:validate -- --dir scripts/fixtures/content-valid` | no | yes | yes | T-064 |
| Build del artefacto de borradores (aislado) | `pnpm exec ng build --output-path dist/e2e-drafts` | no | yes | yes | T-126 |
| Instalación de Chromium de Playwright | `pnpm exec playwright install --with-deps chromium` | no | yes | yes | T-126 |
| Recorridos E2E | `pnpm run e2e:journeys` | no | yes | yes | T-040 |
| Puerta de accesibilidad (axe) | `pnpm run e2e:a11y` | no | yes | yes | T-041 |
| Informe de origen del artefacto | `test ! -f dist/build-info.json; echo "CONTENT_SOURCE=…"` | no | yes | yes | T-126 |

`pnpm verify` ejecuta 25 pasos en orden y se detiene en el primer fallo, así que los
pasos posteriores no informan mientras una puerta anterior está en rojo. El job
`verify` de CI ejecuta 35 comandos `run:`: los mismos 21 controles que la ejecución
local, salvo `pnpm verify` en sí, más 14 comandos que solo existen en el flujo de
trabajo (instalación de dependencias, la cadena de herramientas de gitleaks, la
imagen de PostgreSQL fijada, las comprobaciones de contenedores, la validación del
fixture, el artefacto de borradores, la instalación de Playwright, las suites E2E y
axe y el informe de origen del artefacto). La comprobación de secretos del flujo de
trabajo de CI aparece dos veces porque ambos runners invocan el mismo script
mediante comandos distintos.

## Política de idioma de los documentos

- **Regla.** Los documentos públicos son en inglés primario, con una contraparte en
  español llamada `*.es.md`.
- **Cobertura actual.** `README.md`, `CONTRIBUTING.md`, `docs/quality-gates.md` y
  todos los documentos bajo `docs/orchestration/` se entregan en ambos idiomas. Los
  documentos bajo `docs/content/` siguen solo en español y quedan fuera del alcance
  de T-158.
- **Artefactos internos de SDD** (`specs/**`, `handoff.md`, `plan.md`, `tasks.md`):
  solo en español, como permite la constitución; no se exige paridad.
- **Qué comprueba la automatización.** `pnpm check:locale-parity` compara los
  catálogos de i18n de Angular (`src/locale/messages.en.xlf` y `messages.es.xlf`). No
  comprueba Markdown, así que ninguna puerta aplica hoy la regla `*.es.md`.
- **Deuda de traducción.** Llevar los documentos públicos estables a ambos idiomas
  está registrado en T-158 (sin fecha). Mientras tanto, un documento público nuevo o
  se entrega en ambos idiomas o registra la deuda en su tarea.
