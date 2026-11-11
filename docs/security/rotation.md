# Rotación local de credenciales PostgreSQL

T-082, plan §17.15. Solo desarrollo local; no configura un proveedor de secretos
de producción. Conserva las tablas y el volumen. Requiere Docker Compose, la BD
iniciada, roles de T-056b aprovisionados y archivos creados por `pnpm setup:env`.
Para `api_ro`, la imagen API debe contener las migraciones actuales y poder
alcanzar `/ready` después de recrearla.

## Comandos

```bash
pnpm secrets:rotate api_ro
pnpm secrets:rotate migrator
pnpm secrets:rotate importer --activate
```

Solo se aceptan `migrator`, `api_ro`, `importer`, `editor`. Sin `--activate`, un
rol NOLOGIN permanece deshabilitado y el comando aborta antes de cambiarlo.
`--activate` habilita explícitamente el rol seleccionado con una contraseña nueva
propia; no cambia sus permisos. `editor` necesita además los permisos de T-129.
No se activa ningún rol adicional por arrancar la API ni por ejecutar seed.

Cada contraseña reside en `infra/docker/secrets/db_password_<rol>.txt` y su campo
correspondiente de `.env`, ambos ignorados por Git. No se acepta una contraseña
por argumento. No mostrar esos archivos ni adjuntarlos a issues, PRs o artefactos.
El gestor valida que ambos coinciden y que Git los ignora antes de mutar la BD.

## Secuencia y recuperación

El gestor usa la conexión administrativa Unix dentro del contenedor para cambiar
el rol con `psql`/`\password`. El valor viaja por stdin. Las sondas usan el host
`db`, donde se exige SCRAM: localhost puede usar trust y no demuestra validez de
contraseñas. Una sesión previa debe autenticar antes de rotar un rol LOGIN; al
terminar se comprueba aceptación del nuevo valor y rechazo del anterior. Un error
de red no cuenta como rechazo de contraseña.

Un bloqueo global serializa los cambios a `.env`. Antes de cambiar PostgreSQL se
crea `.rotation-<rol>.json` dentro de la carpeta de secretos ignorada. Este archivo
contiene las credenciales necesarias para compensar: se trata como secreto, nunca
se imprime ni se versiona. Los archivos nuevos usan modo 0600 donde la plataforma
lo soporta; Windows conserva las ACL del directorio local del usuario.

Se conserva el inode del archivo secreto para que los bind mounts de `db` vean
también su contenido nuevo. `.env` se reemplaza atómicamente. Para `api_ro`, se
recrea únicamente la API y se espera su readiness; puede haber una interrupción
breve local. Los demás roles no reinician la API. No se recrea ni elimina el
volumen de PostgreSQL para rotar.

Ante error, se intenta restaurar contraseña, estado LOGIN, archivos y consumidor.
Si la compensación falla o el proceso termina abruptamente, conservar los archivos
de recuperación y ejecutar explícitamente, una vez terminado el proceso anterior:

```bash
pnpm secrets:rotate api_ro --recover
```

Usar el rol que figura en el error operativo. `--recover` restaura la credencial
configurada anterior y el estado LOGIN previo; no genera otra contraseña. Rechaza
un bloqueo cuyo PID siga activo. No borrar manualmente el bloqueo mientras exista
un proceso vivo ni mostrar el registro de recuperación. Si la recuperación falla,
el registro permanece y la salida solo informa `recovery-required`. Resolver la
disponibilidad de Docker/BD o permisos locales y repetir el mismo comando.

`cleanup-required` significa que la credencial nueva ya fue verificada, pero no
se pudo completar la limpieza. Conservar los archivos locales y usar recuperación
explícita si quedaron pendientes. No interpretar un error como permiso para
imprimir secretos o ejecutar `down -v` sobre la instancia del usuario.

Si solo queda `.rotation.lock` y el registro ya no existe tras un fallo de
limpieza, comprobar que su PID terminó y que no hay otra rotación activa antes
de retirar únicamente ese bloqueo. La credencial configurada debe seguir
autenticando; el gestor no elimina bloqueos de procesos vivos automáticamente.

## Verificación

```bash
node --import tsx --test scripts/rotate-secret.test.mts
docker build -f apps/api/Dockerfile -t gd-api:t082-review .
```

La integración `scripts/rotate-secret.int.spec.mts` se ejecuta con
`pnpm test:rotation` y se activa mediante
`RUN_ROTATION_TESTS=1`. Requiere la imagen anterior o `ROTATION_API_IMAGE` con una
imagen local equivalente; no hace pull/build implícitos. Crea un proyecto Compose
aislado sin puertos host, secretos efímeros y PostgreSQL con SCRAM; comprueba API,
contraseña anterior rechazada, activación explícita de importer y recuperación
tras fallo de compensación, conservando una fila canaria. Destruye exclusivamente
ese proyecto de prueba y su directorio temporal.

La ejecución local de esta integración no acredita CI: T-065/T-126 deben preparar
las imágenes y activar la misma puerta en el runner antes de cerrar la spec.
