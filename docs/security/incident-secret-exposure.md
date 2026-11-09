# Incidente por exposición de secretos

Runbook operativo. Base: plan §13.8, constitución XII y [gestión de secretos](secrets.md).
Categorías C1–C4 según la tabla de [secrets.md](secrets.md).

**Regla principal:** tratar el secreto como comprometido. Revocar o rotar **antes**
de limpiar el historial. No copiar el valor en issues, chats, logs, commits ni en la
plantilla de incidente.

## 1. Responsables

| Rol | Responsable | Función |
| --- | --- | --- |
| Propietario del incidente | Mantenedor (usuario) | Coordina, decide, registra y cierra |
| Ejecutor de rotación | Mantenedor | Revoca o rota en origen |
| Revisor del postmortem | Pendiente de definir | Sin equipo definido, el propietario documenta la revisión y lo marca como pendiente |

## 2. Contención (minutos)

1. Anotar la hora de detección y la ubicación: archivo, rama, SHA, workflow o
   artefacto. Nunca el valor.
2. Tratar el secreto como comprometido aunque el commit sea local o reciente.
3. No esperar a la limpieza del historial: pasar a la sección 3 de inmediato.
4. Si el rol o servicio afectado debe rotarse sin riesgo de uso, detener el
   consumidor mientras dura la rotación (por ejemplo, `api` para `api_ro`).
5. No hacer `push` de la rama afectada hasta cerrar la contención.

## 3. Revocar y rotar (antes de limpiar)

| Categoría | Acción en origen | Verificación |
| --- | --- | --- |
| C1 credencial de BD | `ALTER ROLE <rol> PASSWORD` con un valor nuevo aleatorio (≥ 24 bytes) generado fuera del repositorio, o `NOLOGIN` si el rol no se necesita | La conexión con la credencial anterior falla |
| C2 credencial de CI | Eliminar el secreto de GitHub Actions, crear uno nuevo y revocar el original en el proveedor | El workflow no usa el valor antiguo |
| C3 despliegue o nube | Revocar el rol o token en el proveedor (diferido) | La credencial antigua devuelve error de autorización |
| C4 secreto de aplicación | Rotar y reiniciar los procesos que lo usan | Los procesos arrancan solo con el valor nuevo |

Escribir el valor nuevo únicamente en el archivo de secreto ignorado por Git
(`infra/docker/secrets/`, montado en `/run/secrets`) o en el secreto del proveedor.
Cuando exista T-082, la rotación de BD se hará con `pnpm secrets:rotate <rol>`.

## 4. Evaluar alcance

Responder y registrar en la plantilla:

1. **Qué puede hacer la credencial:** categoría, rol y privilegios.
2. **Desde cuándo estuvo expuesta:** primer commit que la contenía. Buscar por
   nombre de variable, nunca por valor:
   `git log --all --oneline -S "<NOMBRE_VARIABLE>"`
3. **Dónde estuvo:** repositorio local, remoto, forks, artefactos de CI, logs,
   imágenes.
4. **Si hubo uso:** revisar los logs de conexión de PostgreSQL, los logs de la API
   y los logs de CI desde la primera exposición.

Si **no hubo uso**, el incidente es de exposición. Si **hubo uso**, es un incidente
de datos: detener el acceso, preservar evidencia (sección 7) y aplicar la sección 6.

## 5. Limpiar el historial (solo después de la sección 3)

1. Registrar los SHA y referencias afectados antes de reescribir (sección 7).
2. Coordinar con el propietario. Avisar a clones y forks: deberán rehacerse, no
   fusionarse.
3. Reescribir con `git filter-repo` y una lista de reemplazo que contenga solo el
   nombre del patrón o la variable, no el valor. Forzar el `push` solo con
   aprobación del propietario.
4. Eliminar cachés, artefactos de CI y logs que contengan la exposición.

La limpieza **no es una mitigación**: copias ya clonadas pueden conservar el valor.
Por eso la rotación de la sección 3 va primero.

## 6. Notificaciones y responsabilidades

| Cuándo | A quién | Qué comunicar |
| --- | --- | --- |
| Siempre | Propietario del incidente | Registro completo en la plantilla |
| La credencial afecta a una plataforma (GitHub, proveedor) | Soporte de esa plataforma | Solicitud de purga de caché o revocación, si es necesaria |
| Hay forks o clones externos | Mantenedores de esos forks, si se conocen | Aviso de rotación y de reescritura, sin el valor |
| Hubo uso o datos de personas | Responsable legal | Pendiente: el proyecto aún no define asesoría legal ni plazos |

Cada comunicación indica qué se expuso (nombre y categoría), la ventana de
exposición, las acciones realizadas y lo que debe hacer el destinatario. Nunca
incluye el valor.

## 7. Evidencia y higiene de logs

- Registrar nombres de variables, categorías, rutas, SHA y fechas. No registrar
  el valor, fragmentos del valor ni huellas derivadas de él.
- Redactar capturas y extractos de logs antes de adjuntarlos (sustituir el valor
  por `***`).
- Guardar la evidencia fuera del repositorio, en una ubicación con acceso
  restringido. No commitearla.
- No crear copias del repositorio que contengan el commit expuesto. Basta con
  registrar SHA, referencias y extractos de logs.
- Conservar la evidencia según la retención que fije el propietario y eliminarla
  al cerrar el incidente.

## 8. Recuperación

1. Arrancar los consumidores con la credencial nueva. No pasar el valor por la
   línea de comandos, por `ARG`/`ENV` de imagen ni por logs.
2. Confirmar que la conexión nueva funciona y que la anterior falla.
3. Confirmar que `/ready` de la API responde correctamente con la configuración nueva.
4. Confirmar que el CI pasa sin el secreto antiguo.
5. Ejecutar el escaneo de la sección 9 y comprobar que no queda rastro del valor.
6. Reanudar los servicios y registrar la hora de cierre de la contención.

## 9. Verificación final

- Escanear el historial completo. Con T-083 (gitleaks en CI), usar el escaneo de
  historial; hasta entonces, repetir la búsqueda por nombre de variable de la
  sección 4.
- Confirmar que no quedan copias en cachés, artefactos ni logs (sección 5).
- Confirmar que el propietario ha revisado la lista de verificación de la
  plantilla.

## 10. Revisión posterior (postmortem)

1. Crear `docs/security/incidents/AAAA-MM-DD-<slug>.md` a partir de la
   [plantilla](incidents/plantilla.md).
2. Registrar causa, control que falló, forma de detección, cronología y acciones
   con responsable y fecha.
3. Añadir la regla o prueba que lo habría evitado (por ejemplo, un ajuste de
   gitleaks en T-083, una comprobación en `check:secrets` o una prueba de T-086).
   Documentar cualquier excepción de allowlist con su motivo.
4. Verificar que el documento no contiene valores.
5. El propietario cierra el incidente con fecha y firma.

## 11. Simulacro en seco (documentado)

El simulacro usa el valor sintético `SIMULACRO_NO_ES_UN_SECRETO_0001`. No es una
credencial, no existe en ningún sistema y no se ha usado contra ningún servicio.
Sirve para recorrer el proceso y comprobar que es ejecutable.

**Escenario:** un commit local incluye `SIMULACRO_NO_ES_UN_SECRETO_0001` como valor
de `DB_PASSWORD_API_RO` (C1). La rama no se ha subido al remoto.

| Paso | Acción simulada | Resultado del simulacro |
| --- | --- | --- |
| 2 | Tratar como comprometido; no esperar a la limpieza | Correcto |
| 3 | Rotar el rol `api_ro` y comprobar que la credencial antigua falla | Recorrido: el comando de rotación es manual (`ALTER ROLE`), porque T-082 aún no existe |
| 4 | Buscar el nombre de variable en el historial | Recorrido: `git log --all -S "DB_PASSWORD_API_RO"` localiza el commit simulado |
| 4 | Clasificar como exposición sin uso | Correcto; sin logs de uso que revisar |
| 5 | Reescribir la rama local antes del `push` | Recorrido; no necesario porque no hubo `push` |
| 7 | Registrar SHA y nombre de variable, sin valor | Correcto |
| 8 | Recuperar con la credencial nueva | Recorrido; no se arrancó ningún servicio real |
| 10 | Crear el postmortem con la plantilla | Correcto; el documento de simulacro no se guarda en `incidents/` para no confundirlo con un incidente real |

**Huecos detectados** (dependencias de otras tareas, no bloquean este runbook):
la rotación automatizada depende de T-082, el escaneo de historial en CI depende
de T-083 y las pruebas de no filtración dependen de T-085 y T-086.

**Estado del simulacro:** recorrido documental realizado el 2026-11-09 sobre el
valor sintético. No hay un incidente real asociado.
