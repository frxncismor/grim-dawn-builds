# CLI editorial local

La API pública solo permite lectura. Edita guías completas o listas por slug con
el rol PostgreSQL `editor`, desde una herramienta local en Docker. No hay cuentas,
CMS ni endpoints de escritura.

## Preparar una edición

Prepara un JSON local con esta envolvente. `document` contiene el documento
canónico íntegro de la guía o lista, según `packages/domain/src/schema.ts`;
el ejemplo representa la forma de la envolvente y requiere completar el documento.

```json
{
  "document": {},
  "dependencies": {
    "authors": [],
    "sources": [],
    "masteries": [],
    "assets": []
  },
  "createMissingDependencies": false
}
```

`dependencies` y `createMissingDependencies` son opcionales. El archivo no admite
otras guías/listas ni campos desconocidos. Solo puedes incluir dependencias que
referencia el documento; deben ser canónicas y coincidir con sus datos anidados.
Las guías incluyen su autor y fuentes completos dentro de `document`. Una lista
puede usar el autor existente por slug o declararlo en `dependencies.authors`.
Las referencias a guías de una lista se resuelven desde PostgreSQL, sin volver
a importar sus cuerpos; sus estados deben coincidir con los de las entradas.

Las dependencias compartidas existentes se comparan y conservan sin cambios ni
alteración de `origin`. Si hay diferencias, la operación completa falla con
`dependency-conflict`. Esto incluye nombres/parent de habilidades, constelaciones,
autores, fuentes, maestrías, combinaciones y activos. La edición de un target no
autoriza sobrescribir otros recursos. Para crear dependencias ausentes, declara
sus datos completos y pon `createMissingDependencies: true`; sin ese permiso falla
con `dependency-missing`. Una maestría nueva necesita su definición canónica en
`dependencies.masteries`; no se inventan color, icono ni datos del juego.

El JSON editorial puede contener evidencia privada y notas internas. Guárdalo en
una ruta local ignorada o fuera del repo; nunca añadas contraseñas, tokens o
secretos al documento ni lo publiques como artefacto web.

## Ejecutar desde la raíz

El entorno local debe tener la imagen API actualizada, las migraciones aplicadas
y su archivo secreto editor ignorado, generado mediante `pnpm setup:env`.
El rol sigue `NOLOGIN` hasta su activación explícita por el gestor local:

```powershell
pnpm secrets:rotate editor --activate
$env:APP_ENV='development'
pnpm db:edit --kind build --slug mi-guia --file C:/ruta/local/edicion.json
```

Para una lista usa `--kind tier-list`. El slug debe coincidir con el documento.
No pases contraseñas en argumentos. La herramienta monta solo el JSON y el archivo
secreto `db_password_editor.txt`, ambos de lectura; no carga el `.env` completo ni
expone un puerto de PostgreSQL. Usa `APP_ENV=development|test` explícito; otro
entorno falla antes de leer entrada o credenciales. En Linux conserva el UID/GID
no root del usuario para leer archivos locales con permisos de propietario;
en Docker Desktop usa el usuario no root de la imagen.

La salida de éxito contiene únicamente cantidades de targets guardados. Los
errores muestran códigos fijos, sin contenido, rutas internas, SQL o credenciales.
Corrige `invalid-content`, `dependency-conflict` o `dependency-missing` en el archivo
de entrada antes de reintentar. Un error revierte también las dependencias nuevas.

## Publicación y bootstrap

Los documentos se validan antes de conectar y se guardan en una transacción
parametrizada con el rol real `editor` sin privilegios administrativos. La guía
conserva todas sus secciones y referencias; la raíz editada queda `origin=editor`.
No se rellenan autor, revisor, fechas ni confirmaciones de derechos automáticamente.
Un borrador con derechos pendientes puede editarse, pero continúa fuera de la API.
Publicar exige las puertas canónicas de dominio y PostgreSQL.

La CLI funciona después del bootstrap. El editor solo puede leer el marcador de
bootstrap que requieren los triggers existentes; no puede insertarlo, modificarlo,
borrarlo, ejecutar DDL ni administrar roles. Después del marcador, el importador
no puede modificar ninguna tabla de contenido, aunque intente cambiar `origin`
o borrar hijos. La API conserva su rol de lectura y no recibe el secreto editor.

Las puertas adicionales para adaptaciones se completan en T-104/T-107/T-108 antes
de permitir su publicación. La guía migrada real continúa como borrador `pending`.
