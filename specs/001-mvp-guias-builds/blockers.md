# Bloqueos de implementación

## Estado actual T-133 — 2026-11-10

Resuelto el presupuesto Home sin aumentarlo: entrega nativa estática con guardas
de estructura, interactividad y scripts; las rutas interactivas conservan replay
y soporte i18n. Release API validado: Home0/90000 gzip y9377 bytes HTML; catálogo
104185/110000 gzip (incluye409 bytes gzip inline),107976 bytes HTML. pnpm verify,
build:release y check:release pasan. La prueba browser retiene el chunk de página,
pulsa Rayo en SSR y comprueba replay al hidratar. El aviso noscript se corrigió
como texto estático normal para evitar DOM distinto con scripting activo.

El apartado T-025 inferior conserva el diagnóstico histórico, ahora resuelto por
T-133. T-025 sigue abierta únicamente por integración positiva con guías/rutas
T-020/T-037; la spec completa todavía tiene tareas activas y revisión final pendiente.

## T-025: presupuesto inicial Home pendiente — 2026-11-09

La página real /tier-list está implementada y verificada funcionalmente con
fixtures/API, pero la tarea permanece abierta. HTML ya está dentro del límite
tras transferir datos públicos sin repetir el viewmodel derivado; la guía pendiente
no se publica. Medición API actual: Home95098/90000 bytes gzip; tier102995/110000;
HTML30750/103647 de120000. El gate T-132 correctamente rechaza Home y build:release
sale1 sin emitir build-info.json. No elevar presupuesto ni declarar release verde.

Una escalación de alcance T-025 confirmó snapshot público anticipado y archivos
antes de código. Primer intento sobre JS: loadChildren→loadComponent no resolvió
el límite; segundo: ApplicationRef.whenStable no lo resolvió y se restauró
afterNextRender. No volver a intentar cambios cosméticos ni quitar funcionalidad
para acomodar una prueba. La siguiente intervención necesita analizar la entrega
de JavaScript por página y planificar cualquier ampliación de archivos antes de
implementarla. Pendiente además e2e positiva con guía propia sintética navegable
cuando T-020/T-037 existan (prueba de componente positiva sí pasa). Es una puerta
técnica pendiente, no falta de autorización del usuario para completar la spec.

## Estado actual tras validación Docker — 2026-11-09

Resueltos los bloqueos de T-056b/T-057. La autorización expresa del usuario se
materializó en secretos separados por servicio y aprovisionamiento externo al
migrador. El stack aislado arrancó desde cero, conservó datos al recrear
contenedores sobre un volumen de prueba y admitió reaprovisionamiento sin borrado.
`migrate` terminó con código 0; una segunda ejecución no alteró el journal. La API
no migró al reiniciarse; `/health` siguió en 200 con BD caída y `/ready` devolvió
503 con caída o migración pendiente, y 200 al restaurar el estado correcto.

T-124 y T-125 también se verificaron: tooling oficial íntegro, y errores/bloqueos
PostgreSQL visibles sin SQL, valores de filas ni credenciales. El detalle actual
está en `quickstart.md` y `tooling-provenance.md`. Los apartados históricos de
abajo conservan la secuencia de bloqueos anterior; no describen un bloqueo actual
de esas tareas. La spec completa sigue pendiente de las otras tareas activas.

## Actualización SDD autorizada — 2026-11-09

Se recuperaron scripts/plantillas/skills oficiales de Spec Kit; las fases setup-plan y setup-tasks se ejecutaron para la feature 001 explícita, preservando los artefactos existentes. Spec/plan/tasks incluyen la regularización retrospectiva de logging T-125 y tooling T-124; no se afirma planificación previa de lo ya realizado. El registro histórico de abajo se conserva.

El usuario autorizó expresamente T-056b: roles persistentes LOGIN, credenciales independientes por archivo secreto y servicio. La causa de falta de autorización descrita abajo ya no bloquea; resta implementar/verificar integración segura antes de marcar T-056/T-057/T-056b. B-5 cerrada: solo `http://localhost:4200`; B-7 cerrada: CLI local con rol editor y dominio. DAST/imagen bloquean desde MEDIA. T-061/T-072 activas, con dependencias T-060/T-129 respectivamente.

La contradicción constitucional CI de rendimiento/accesibilidad fue corregida documentalmente (AC-05/AC-06, plan §6/§17, T-041/T-042/T-126). El gate de planificación no equivale a comprobaciones de implementación aprobadas; la evidencia runtime pendiente sigue siendo necesaria.

## Registro histórico — Desviación SDD de logs de PostgreSQL

El cambio solicitado de logging en `infra/docker/compose.yaml` y su documentación
en `CONTRIBUTING.md` se implementaron antes de definir una spec, plan y tareas
para ese alcance. Se verificaron Compose, sus 14 pruebas existentes y errores
reales en PostgreSQL 17 efímero; después se aplicó al servicio `db`, que quedó
healthy. Esa evidencia técnica no sustituye las fases previas de SDD.

Pendiente: localizar la instalación de Spec Kit y regularizar ese alcance con
sus fases de planificación y análisis antes de ampliar el cambio. En la revisión
no se encontraron comandos, skills ni plantillas de Spec Kit en `.specify/`,
`.github/`, `~/.agents/skills`, `~/.codex/skills` ni `~/.copilot/sdd`.
No se ha marcado una tarea nueva como completada para estos logs.

## Registro histórico — T-057 antes de autorizar T-056b

T-057 queda parcialmente implementada y **sin marcar como completada**. El migrador, el build de
la imagen y la comprobación `/ready` están implementados y verificados. Falta integrar el servicio
`migrate` de Compose con una credencial `migrator` de inicio de sesión.

La migración T-055 crea `migrator` y `api_ro` como roles `NOLOGIN`. El servicio Compose actual no
monta la contraseña del migrador ni prepara ese rol para conectarse; por ello el comando one-shot
no puede ejecutarse con el Compose existente. No se sustituyó `migrator` por el superusuario.

El agente propuso añadir a Compose secretos para los roles de la API y del migrador y un script de
inicialización PostgreSQL que les asigne contraseñas. La revisión automática rechazó el cambio por
introducir roles persistentes con `LOGIN`, acceso por contraseña y secretos en servicios Compose,
riesgos de seguridad asignados a T-056b, sin autorización expresa para esa tarea. No se intentó
eludir el rechazo ni se cambió el Compose.

### Trabajo realizado y verificado

- `apps/api` lint, typecheck y pruebas: 14 archivos y 204 pruebas pasan.
- `pnpm verify` completo pasa: comprobaciones de alcance, fronteras y secretos, tipos,
  lint, formato, Markdown, pruebas de dominio/API/web/scripts, activos y build estático.
- La imagen Docker se construyó y se verificó con UID no-root `10001`.
- En PostgreSQL 17 efímero y aislado, el migrador ejecutado como `migrator` aplicó las dos
  migraciones; una segunda ejecución dejó idénticos los identificadores, hashes y tiempos del
  journal.
- `/ready` respondió 200 con migraciones al día y `api_ro`; respondió 503 con migraciones
  pendientes o PostgreSQL inaccesible. `/health` respondió 200 en todos esos casos.
- Un historial incompatible falló con salida no cero antes de aplicar migraciones pendientes.
- La prueba usó almacenamiento `tmpfs`, red `none` y ningún puerto publicado; no accedió al volumen
  persistente del proyecto.

Para cerrar T-057 hace falta resolver la integración segura del rol `migrator` de Compose bajo el
alcance de T-056b. Hasta entonces, no se debe marcar T-057 como terminada.
