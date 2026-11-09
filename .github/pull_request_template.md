# Pull request

## Resumen

<!-- Qué cambia y por qué. Enlaza la especificación o tarea SDD si aplica. -->

Tareas SDD: <!-- p. ej. T-076 -->

## Rama de destino

- [ ] `mvp/1` (trabajo de feature, release o hotfix; commits de cierre de spec)
- [ ] `develop` (PR desde `mvp/1`)
- [ ] `main` (PR de release desde `develop`)

Ver [CONTRIBUTING.md](../CONTRIBUTING.md#flujo-de-ramas-gitflow) para el flujo completo.

## Verificación local

Comandos ejecutados y resultado (incluye los que no aplican y por qué):

- [ ] `pnpm verify` pasa en local
- [ ] `pnpm test` y `pnpm test:scripts` pasan (o no aplican: explicar)
- [ ] `pnpm lint` y `pnpm lint:md` pasan sin errores
- [ ] `pnpm format:check` pasa
- [ ] Pruebas escritas antes del código cuando el plan o la tarea lo piden (TDD), o no aplica (explicar)

## Contenido y derechos

- [ ] No aplica: el PR no añade ni modifica contenido editorial
- [ ] Cada guía, tier o dato nuevo tiene autor, fuente(s), estado de revisión, estado de contenido y `rights_status`
- [ ] No se publica contenido con derechos `pending` o no aprobados
- [ ] No hay texto, imágenes ni activos copiados de terceros sin permiso registrado; no hay scraping
- [ ] Las adaptaciones de terceros tienen licencia o permiso que cubre la adaptación, con atribución visible
- [ ] `pnpm content:validate` pasa para el contenido afectado

## Activos

- [ ] No aplica: el PR no añade activos
- [ ] Ningún icono, textura ni arte oficial de Grim Dawn sin entrada `approved` en el manifiesto (origen, titular, licencia o permiso y prueba)
- [ ] `pnpm assets:check` pasa

## Alcance y fronteras

- [ ] El cambio se limita a lo que piden la tarea y los archivos listados en `tasks.md`
- [ ] No hay refactorizaciones, funcionalidades extra ni dependencias sin justificar
- [ ] `pnpm check:scope` y `pnpm check:boundaries` pasan
- [ ] Justificación de cualquier dependencia nueva (tamaño y alternativa descartada): <!-- o "ninguna" -->

## Secretos

- [ ] No se añaden secretos, credenciales ni URLs con contraseña
- [ ] No se commitean `.env*` (salvo `.env.example` sin valores secretos) ni archivos de `secrets/`
- [ ] `pnpm check:secrets` pasa

## CI

- [ ] El job `Verify pull request` está en verde
- [ ] No se han saltado ni desactivado checks para que el PR pase

## Revisión de Copilot

- [ ] Revisión de Copilot solicitada y comentarios atendidos
- [ ] Nota: la regla de rama que exige esta revisión es configuración manual del mantenedor

## DAST

- [ ] Pendiente: el escaneo DAST aún no existe en el CI (tarea T-077). No se considera cubierto por este checklist.

## Accesibilidad y rendimiento (si el PR cambia la interfaz)

- [ ] No aplica
- [ ] Textos en español vía i18n; foco visible y navegación por teclado
- [ ] Contraste y alternativas textuales para SVG interactivos (WCAG 2.2 AA)
- [ ] Sin impacto en los presupuestos de `plan.md` §6 (o justificado)

## Documentación

- [ ] `tasks.md` marca `[x]` solo las tareas cuyas comprobaciones pasan en este PR
- [ ] La documentación afectada se actualiza (README, CONTRIBUTING o specs)
