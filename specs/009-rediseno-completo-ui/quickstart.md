# Quickstart: validar spec009

Comandos desde la raíz del worktree, con `pnpm` global y sin `HTTP_PROXY`/`HTTPS_PROXY`. Las capturas antes/después van fuera del repo, en `runs/11111619/capturas-s9-antes/` y `runs/11111619/capturas-s9-despues/`, con `ASSET_SOURCE=game` (lo que publica la CI) y, para comparar, `own`. Anchos: 375, 768 y 1280. Rutas: `/builds/chaman-demoledor-golpe-primigenio`, `/es/builds/chaman-demoledor-golpe-primigenio`, `/`, `/es`, `/tier-list`, `/maestrias`, `/maestrias/soldier`.

## US4 — Árbol y mapa visibles (T001)

1. `pnpm start` y abrir la guía: el árbol y el mapa se dibujan con estilos; en DevTools → Red, `/assets/deferred.css` y `/assets/mastery-trees/<id>.json` responden 200.
2. `pnpm build` (con `ASSET_SOURCE=own` y con `game`) y `tsx scripts/serve-artifact.mts`: mismo resultado.
3. JS desactivado: listas de respaldo con aviso de que la vista interactiva requiere JS.

## Base visual — propuestas y aprobación (T003, T004)

En `runs/11111619/propuestas-009/`: 2–3 carpetas con capturas a 375/768/1280 (cabecera de build, una sección, tooltip abierto y tarjeta, con `ASSET_SOURCE=game`) y una nota por propuesta. La elegida consta en «Clarifications» de `spec.md` y en `DESIGN.md`; antes de esa fecha no hay commits de tareas de página.

## US1 — Cabecera (T011)

A 1280 px, sin desplazarse: portada, breadcrumb, chips (maestrías, rol, etapa, versión), título, fecha de actualización, acceso al changelog (si hay), autor e intro; el checklist antes de la primera sección. Con `ASSET_SOURCE=own`, la portada es el fallback propio, con el mismo tamaño.

## US2 — Índice (T012)

Desplazarse a 768 y 1280 px: el índice sigue visible y marca la sección (`aria-current` y marca no cromática). A 375 px, un control compacto lo abre y lleva el foco al título elegido. Sin JS: lista de enlaces.

## US3 — Build final (T014)

Skills de barra en orden con icono y tooltip; devociones clave; pros y contras. Con teclado: Tab llega a cada elemento, el tooltip aparece junto a él y Escape lo cierra. Una guía sin pros/contras no muestra la tarjeta.

## US5 — Loot filter y notas (T015, T016)

Orden del índice: … → loot filter → notas → fuentes. Las notas tienen letra menor que el contenido. Cada regla del loot filter muestra un rótulo corto con el detalle a demanda.

## US6 — Idioma (T017, T018)

`/es/builds/<slug>`: ningún nombre de juego en inglés a la vista; `/builds/<slug>`: ninguno en español (el texto editorial sigue en español con `lang="es"` y el aviso «only available in Spanish»). La prueba automática de T018 lo comprueba sobre el HTML prerenderizado.

## Puertas

```text
pnpm test && pnpm test:scripts && pnpm lint && pnpm lint:md && pnpm check:scope
pnpm check:contrast && pnpm check:locale-parity && pnpm content:validate
pnpm build && pnpm e2e:a11y && pnpm e2e:journeys
pnpm check:initial-js && pnpm check:performance   # informativos en 009 (P43): se registran, no bloquean
```

Regresión visual: procedimiento Docker de `CONTRIBUTING.md` (misma imagen de Playwright que la CI); las 30 referencias se regeneran en T019 tras la revisión visual de Paco.

## Evidencia de cierre (T021)

Se rellena al cerrar: tabla de comandos con su salida, cifras de presupuestos (informativas) y resultado de la puerta spec002 + T-136.
