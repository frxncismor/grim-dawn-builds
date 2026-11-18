# T-136: revisión final de código de spec008 (ronda 2)

Revisión final independiente con el modelo más potente disponible (Claude Opus 5.5, `claude-opus-5-5`, Claude Code), adicional a las cuatro revisiones de la puerta spec002 de `completion-review.json`. Snapshot `a68e6bc979334aa379e6fc044d3225503be9db9cddf09e8d6c78c90238c8c7c5`, HEAD `48f4eec`. Resultado de la ronda 2: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 2 LOW (F-101 y F-102, ambos aplazados).

Alcance: la huella completa de spec008 (`git diff 1375dda..48f4eec`, 17 archivos), con prioridad al código ejecutable (`scripts/artifact-pages.mts`, `scripts/check-assets.mts`, sus pruebas y `tsconfig.e2e.json`) y la corrección de la ronda 1 (T005: `git diff 2de418f..48f4eec`).

Ronda anterior: ronda 1 (F-001 y F-002, ambos LOW); F-001 se corrigió en T005 y F-002 se aplazó (entrada 1 de `reviews/deuda.md`). Reporte de la ronda 1: `C:/Users/paco_/.config/orquestacion/runs/11111619/11111619-revisor-cierre-s8-t136-reporte.md`. Reporte de la ronda 2: `C:/Users/paco_/.config/orquestacion/runs/11111619/11111619-revisor-cierre-s8-t136-r2-reporte.md`.

## Estado de la ronda 2

- **F-101 (LOW), aplazado**: `scripts/check-assets.mts` y `scripts/check-legacy-brand.mts` no entran en ningún `tsc`, así que la barrera `RawEntries`/`ValidatedEntries` no se comprueba en el consumidor. Hoy no hay mal uso. Seguimiento: entrada «C-101 = A-101 = F-101 = S-101» de `reviews/deuda.md`.
- **F-102 (LOW), aplazado**: igual que F-002 de la ronda 1 (comparación sensible a mayúsculas en `entriesUnder`); entrada 1 de `reviews/deuda.md`.

## Comprobaciones ejecutadas por el revisor

- `npx tsc -p tsconfig.e2e.json (HEAD 48f4eec, sin HTTP_PROXY/HTTPS_PROXY)`: exit 0 sin errores: la directiva @ts-expect-error de scripts/artifact-pages.test.mts se consume, luego htmlPagesOf(RawEntries) sí es un error de tipos.
- `node --import tsx --test scripts/artifact-pages.test.mts scripts/check-assets.test.mts scripts/check-legacy-brand.test.mts`: tests 37, pass 36, fail 0, skipped 1 (enlace simbólico de archivo, EPERM en esta máquina).
- `npx tsc -p tsconfig.e2e.json --listFilesOnly | grep scripts/`: solo artifact-pages.mts, artifact-pages.test.mts, run-svg-e2e.mts, serve-svg-preview.mts, svg-preview.test.mts; check-assets.mts y check-legacy-brand.mts no están en ningún programa de tsc.
- `tsconfig temporal en el scratchpad (extends tsconfig.e2e.json, include check-assets.mts + un archivo con htmlPagesOf(readArtifactEntries('x')))`: check-assets.mts compila sin errores; el mal uso da TS2345 (RawEntries no asignable a ValidatedEntries) solo cuando el archivo entra en el include.
- `node scripts/spec-review.mjs prepare --feature specs/008-deuda-spec007`: status ready, snapshot a68e6bc979334aa379e6fc044d3225503be9db9cddf09e8d6c78c90238c8c7c5 (coincide con el del encargo), pendingTasks [].
- `git status --short tras las comprobaciones`: limpio; no se modificó ningún archivo versionado.

## Informe (Review)

```json
{
  "specialty": "code",
  "reviewer": "11111619-revisor-cierre-s8-t136-r2 (claude-opus-5-5, Claude Code)",
  "mode": "independent",
  "status": "completed",
  "coverage": [
    "git diff 1375dda..48f4eec completo (17 archivos); código ejecutable priorizado: scripts/artifact-pages.mts, scripts/check-assets.mts, sus pruebas y tsconfig.e2e.json",
    "Corrección de la ronda 1 (T005): git diff 2de418f..48f4eec (RawEntries/ValidatedEntries, assertRegularArtifact devuelve ValidatedEntries, htmlPagesOf solo acepta ValidatedEntries, entriesUnder crudo -> crudo, prueba @ts-expect-error)",
    "Consumidores: scripts/check-assets.mts:164-182 (assertNoGamePortraits) y :207 (puerta de crédito), scripts/check-legacy-brand.mts:33; ningún otro uso de readArtifactEntries/htmlPagesOf/entriesUnder/assertRegularArtifact (grep en *.mts/*.ts/*.mjs)",
    "Equivalencia con 1375dda: mensajes (basename(dir)/rel), orden de comprobaciones (browser/ enlaces -> páginas -> resto -> arte), filtro .html y orden de páginas, una sola lectura",
    "Alcance de la protección de tipos: qué archivos de scripts/ entran en algún programa de tsc (tsc -p tsconfig.e2e.json --listFilesOnly)",
    "Contexto SDD: specs/008-deuda-spec007/{spec,plan,tasks}.md, reviews/{analyze,deuda}.md, informes de ronda 1 (code t136 y architecture A-001)",
    "FR-010: git diff --name-only 1375dda..48f4eec -- specs/00[1-7]-* solo lista specs/007-deuda-revisiones-3/reviews/deuda.md"
  ],
  "checks": [
    {
      "name": "npx tsc -p tsconfig.e2e.json (HEAD 48f4eec, sin HTTP_PROXY/HTTPS_PROXY)",
      "result": "exit 0 sin errores: la directiva @ts-expect-error de scripts/artifact-pages.test.mts se consume, luego htmlPagesOf(RawEntries) sí es un error de tipos"
    },
    {
      "name": "node --import tsx --test scripts/artifact-pages.test.mts scripts/check-assets.test.mts scripts/check-legacy-brand.test.mts",
      "result": "tests 37, pass 36, fail 0, skipped 1 (enlace simbólico de archivo, EPERM en esta máquina)"
    },
    {
      "name": "npx tsc -p tsconfig.e2e.json --listFilesOnly | grep scripts/",
      "result": "solo artifact-pages.mts, artifact-pages.test.mts, run-svg-e2e.mts, serve-svg-preview.mts, svg-preview.test.mts; check-assets.mts y check-legacy-brand.mts no están en ningún programa de tsc"
    },
    {
      "name": "tsconfig temporal en el scratchpad (extends tsconfig.e2e.json, include check-assets.mts + un archivo con htmlPagesOf(readArtifactEntries('x')))",
      "result": "check-assets.mts compila sin errores; el mal uso da TS2345 (RawEntries no asignable a ValidatedEntries) solo cuando el archivo entra en el include"
    },
    {
      "name": "node scripts/spec-review.mjs prepare --feature specs/008-deuda-spec007",
      "result": "status ready, snapshot a68e6bc979334aa379e6fc044d3225503be9db9cddf09e8d6c78c90238c8c7c5 (coincide con el del encargo), pendingTasks []"
    },
    {
      "name": "git status --short tras las comprobaciones",
      "result": "limpio; no se modificó ningún archivo versionado"
    }
  ],
  "limitations": [
    "No se ejecutaron pnpm verify, test:scripts completo, builds, e2e ni check:performance, por instrucción (evidencia en quickstart.md y en el registro del orquestador)",
    "La prueba de enlace simbólico de archivo (.html enlazado) se omite en esta máquina por EPERM; solo se ejercitan junctions de carpeta",
    "No se reprodujo el rojo TS2578 previo a T005; se confía en la evidencia de tasks.md T005 y en que la directiva se consume hoy",
    "El texto SDD solo se leyó para coherencia con el código; el foco fue el código ejecutable"
  ],
  "findings": [
    {
      "id": "F-101",
      "severity": "LOW",
      "path": "tsconfig.e2e.json",
      "line": 14,
      "evidence": "La corrección de A-001 es solo de tipos (en ejecución htmlPagesOf sigue filtrando isFile y descarta en silencio los enlaces), pero el único programa de tsc que mira scripts/ es tsconfig.e2e.json, que incluye scripts/artifact-pages.mts y su prueba y no incluye scripts/check-assets.mts (:171-175, consumidor directo de readArtifactEntries/htmlPagesOf) ni scripts/check-legacy-brand.mts. Las puertas corren con tsx, que no comprueba tipos. Comprobado: con un tsconfig temporal que incluye check-assets.mts y un archivo con htmlPagesOf(readArtifactEntries('x')), tsc da TS2345; sin incluirlo, nada lo detecta.",
      "impact": "La garantía de T005 («una puerta nueva no puede listar páginas sin validar») solo vale para los archivos del include. Una puerta nueva en scripts/check-*.mts, o un cambio en assertNoGamePortraits, que llame htmlPagesOf sobre una lectura cruda compila y pasa verify, y vuelve el hueco opt-in de A-002. Hoy no se puede explotar: check-assets.mts usa bien la API y compila limpio.",
      "recommendation": "Añadir scripts/check-assets.mts y scripts/check-legacy-brand.mts al include de tsconfig.e2e.json (check-assets ya compila sin errores), o mejor, un glob que cubra las puertas de scripts/ que importan artifact-pages.mts. Una alternativa es un guardia en ejecución en htmlPagesOf que lance si recibe una entrada no regular.",
      "disposition": "deferred",
      "deferReason": "Hallazgo nuevo LOW aplazado por decisión del principal (solo MEDIUM o superior se corrige en esta puerta): no hay mal uso hoy, la corrección es de configuración y cabe en la próxima spec de deuda que toque scripts/artifact-pages.mts o tsconfig.e2e.json. Tarea de referencia: T005."
    },
    {
      "id": "F-102",
      "severity": "LOW",
      "path": "scripts/artifact-pages.mts",
      "line": 42,
      "evidence": "entriesUnder filtra con rel.startsWith(`${prefix}/`), que distingue mayúsculas, mientras assertBrowserDir usa lstat y en Windows no las distingue (carpeta 'Browser'). Es el F-002 de la ronda 1, que sigue igual tras T005.",
      "impact": "Caso marginal que falla cerrado («ninguna página .html»); el build siempre emite 'browser' en minúsculas.",
      "recommendation": "Comparar el prefijo sin distinguir mayúsculas o derivarlo del nombre real que devuelve la lectura.",
      "disposition": "deferred",
      "deferReason": "Ya aplazado en specs/008-deuda-spec007/reviews/deuda.md, entrada 1 (C-003 = A-002 = F-002): el artefacto lo genera el propio build con browser/ en minúsculas, no es entrada externa. Tarea de referencia: T004."
    }
  ]
}
```
