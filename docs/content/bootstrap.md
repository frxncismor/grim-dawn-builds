# Bootstrap de contenido

`db:bootstrap` carga material inicial validado en una base migrada y **vacía**.
Usa el rol `importer` y su propio archivo secreto. Registra una sola fila en
`content_origin`; después las importaciones de fixtures quedan bloqueadas y la
edición corresponde a la [CLI editorial](editorial-cli.md).

## Requisitos

- Imagen API actualizada y todas las migraciones aplicadas.
- Las 22 tablas de contenido vacías y ningún marcador anterior.
- Fixtures canónicos en `content/`, con su autoría, fuentes y derechos reales.
- Archivo secreto importer local ignorado y rol habilitado por el gestor local.
- CLI editorial verificada antes del cutover.

El comando no adopta una base que ya contenga datos. La base local de desarrollo
existente se conserva: un intento de bootstrap sobre ella devuelve `not-empty`.
No borres su volumen para conseguir que pase. La comprobación positiva del
bootstrap se ejecuta en PostgreSQL aislado, sin modificar esa base editorial.

## Ejecutar una carga inicial

Para una base nueva que cumpla los requisitos:

```powershell
$env:APP_ENV='development'
pnpm db:bootstrap
```

También admite `APP_ENV=test` explícito. Otro entorno falla antes de leer archivos
o credenciales. El launcher de Docker monta únicamente fixtures y el archivo
importer de lectura; no publica el puerto de PostgreSQL ni carga `.env` completo.
No pases contraseñas por argumentos. La imagen se usa localmente, sin pull implícito.

## Garantías de la transacción

El contenido se valida antes de conectar y se vuelve a validar en la función de
bootstrap antes de `BEGIN`. La transacción READ COMMITTED verifica el rol real,
adquiere primero el bloqueo de `content_origin` y luego los de todas las tablas
de contenido derivadas del schema, en orden estable. Comprueba vacío tras esos
bloqueos; otros escritores esperan o provocan rollback con un error saneado.
Hay límites locales de 5 s para locks y 15 s por sentencia.

El historial aplicado debe coincidir íntegramente con los hashes de migración de
la imagen. Importer solo tiene lectura del journal para comprobarlo. Después de
cargar se marcan las raíces/entradas como `origin=bootstrap` y se inserta el
marcador con fecha UTC, hash del payload canónico y fingerprint de migraciones.
El hash ordena recursivamente claves y conserva orden de arrays; no incluye IDs
ni fechas generados por PostgreSQL. Un fallo revierte contenido y marcador.

No se cambian derechos ni estados de revisión. Las guías `pending` permanecen
borradores, excluidas de vistas y API públicas. Tras el marcador, seed, un segundo
bootstrap y todo DML de importer sobre contenido se rechazan, incluso si intentan
cambiar `origin` o borrar hijos. El editor puede actualizar contenido permitido
sin modificar el marcador ni reabrir las importaciones.

## Diagnóstico

La salida de éxito contiene solo cantidades de guías/listas. Los errores contienen
códigos fijos, nunca contenido, SQL ni credenciales:

- `invalid-content`: corregir el material inicial, sin inventar derechos o firmantes.
- `not-empty`: conservar la base; usar la CLI editorial para su contenido existente.
- `already`: bootstrap ya registrado; no volver a importar fixtures.
- `migration`: actualizar imagen/migraciones antes de reintentar en la base vacía.
- `role` o `credentials`: revisar el rol/archivo importer mediante el gestor local.
- `database-failed`: revisar disponibilidad y logs redactados de PostgreSQL; no
  relajar bloqueos, permisos o validaciones para forzar la carga.
