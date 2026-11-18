# Deuda aplazada en la ronda 2 de la puerta T018 (spec005)

Decisión de Paco (2026-11-17, opción A, vía el principal): de los hallazgos de la ronda 2 se corrigen B-06 a B-09 (T040) y C-101/F-001 (T041); los dos LOW siguientes se aplazan con su motivo. Esta lista vive en `reviews/` para no dejar tareas abiertas en el snapshot de la puerta. Al planificarla, cada entrada se convierte en una tarea SDD. Tarea de referencia de ambas: T018.

1. **F-002**, poda de nodos obsoletos antes de reescribir las guías (T-136 r2, LOW, `apps/api/src/db/write-content.mts:417`). Para una maestría que se conserva, `writeCatalogRows` borra los nodos ausentes del fixture (`DELETE FROM catalog_skill_nodes WHERE mastery_id = $1 AND id <> ALL($2)`) antes de que `writeContentRows` reescriba los `build_skill_nodes`; la FK `build_skill_nodes.skill_node_id` es `ON DELETE RESTRICT`.
   - **Motivo del aplazamiento**: defecto heredado de spec003 (T031), de bajo riesgo: solo afecta a desarrollo y test, falla cerrado sin cambios parciales y exige que una regeneración de fixtures quite un nodo que una guía usaba en la misma siembra.
   - **Riesgo residual**: esa siembra falla con 23503 y sale como `seed failed: database-failed`, sin el id del nodo ni de la maestría.
   - **Plan**: separar la poda de nodos del upsert y ejecutarla después de `writeContentRows`, o traducir el 23503 a `SeedError('reference', <id de la maestría>)`; añadir el caso a `seed.int.spec.ts`.
   - Aplazado por decisión de Paco 2026-11-17 (ronda 2 de T018). Tarea de referencia: T018.
2. **S-001**, el repositorio sigue legible dentro del contenedor de las referencias visuales (security r2, LOW, `scripts/visual-baselines-docker.sh` y `CONTRIBUTING.md:257`). T038 filtra la copia `/src` a `/work`, pero el comando documentado monta todo el repositorio con `-v "$PWD:/src:ro"`, así que `.env`, `.env.*` e `infra/docker/secrets/` siguen visibles en `/src` durante el contenedor (incluido `pnpm install --frozen-lockfile`); además, las rutas se pasan a `tar -X` como patrones con comodines y un nombre con `[`, `]`, `*` o `?` no se excluye.
   - **Motivo del aplazamiento**: equivale a un `pnpm install` en el host; uso manual y local con `ASSET_SOURCE=own` y `CONTENT_SOURCE=fixture`; no afecta a CI ni al producto.
   - **Riesgo residual**: la frontera que documenta `CONTRIBUTING{,.es}.md` («neither local secrets … enter the container») no existe del todo; un desarrollador puede confiar en ella.
   - **Plan**: enviar al contenedor solo los archivos seguros por stdin (`git ls-files -co --exclude-standard | tar -cf - -T -`) o montar una copia ya filtrada, y usar `--no-wildcards` en el filtro; si se mantiene el montaje, corregir `CONTRIBUTING{,.es}.md` y el comentario del script.
   - Aplazado por decisión de Paco 2026-11-17 (ronda 2 de T018). Tarea de referencia: T018.

## Ronda 3 de la puerta T018 (decisión del principal, 2026-11-17, opción B)

La ronda 3 dio 0 CRITICAL, 0 HIGH y 0 MEDIUM. Los LOW abiertos L1 a L4 se aplazan con su motivo y la puerta se cierra como `passed`. Tarea de referencia: T018. Al planificarla, cada entrada se convierte en una tarea SDD.

1. **L1 / S5-D1**, id de descripción de `build-card` desde un contador de módulo (F-301 = B-11 = A-101, LOW, `apps/web/src/app/shared/ui/build-card/build-card.ts:5,81`). El HTML prerrenderizado deja de ser determinista: el número depende del orden y del reparto de rutas entre workers.
   - **Motivo del aplazamiento**: sin impacto en accesibilidad (los ids siguen siendo únicos por página y la hidratación es coherente); `compare:builds` no está en CI ni en `pnpm verify`.
   - **Plan**: derivar el id de datos estables de la tarjeta (p. ej. el slug o el href) o usar `inject(APP_ID)` o un contador por instancia de render; corregir el docstring «sin estado»; añadir una prueba que renderice dos veces la misma tarjeta y espere el mismo id.
2. **L2 / S5-D2**, comentarios de `srCombination` desfasados y rama sin enlace muerta (C-201 = A-102, parte de B-12, LOW, `build-card.labels.ts:66` y `build-card.model.ts:69-70`).
   - **Motivo del aplazamiento**: solo comentarios y una rama sin efecto observable.
   - **Plan**: actualizar los comentarios al comportamiento actual y retirar la rama muerta.
3. **L3 / S5-D3**, falta el e2e de la descripción accesible (`aria-describedby`) en `e2e/a11y.spec.ts` (resto de B-12, LOW).
   - **Motivo del aplazamiento**: el comportamiento está cubierto por pruebas unitarias; falta la comprobación en navegador.
   - **Plan**: añadir el caso a `e2e/a11y.spec.ts`.
4. **L4 / S5-D4**, nota `[x]` de T040 contradictoria en `tasks.md:141` («Pendiente: fallo preexistente T052» frente a «resuelta») (B-10, LOW).
   - **Motivo del aplazamiento**: editar `tasks.md` cambia el snapshot de la puerta ya cerrada.
   - **Plan**: unificar la nota en la próxima tarea SDD que toque `tasks.md`.
5. **Base de `/tier-list`**: Paco aceptó el 2026-11-17 **111 403 B** (margen 597 B) como base de SC-008 y P32. El texto «pendiente de confirmación de Paco» de `spec.md`, `plan.md`, `quickstart.md` y `tasks.md` queda superado por esta decisión y se actualizará en la próxima tarea que toque esos archivos.
6. **Nota**: la fila de spec005 en `specs/README.md` dice «puerta T018 en curso»; se actualiza fuera del snapshot (próxima tarea SDD).
