# Herdr: contexto operativo para el orquestador

[English](herdr.md) · **Español**

Herdr es el multiplexor de terminales que usa este proyecto para correr agentes
en paralelo y supervisarlos. Esta nota existe porque el orquestador necesita
contexto propio sobre la herramienta: sin él, un agente bloqueado se confunde con
un agente lento y se pierden turnos.

## Binario y comandos

```text
C:\Users\paco_\AppData\Local\Programs\herdr-core\hc.exe
```

| Comando                     | Para qué sirve                                  |
| --------------------------- | ----------------------------------------------- |
| `hc run <cmd> [task]`       | lanza un programa o plantilla; `--bg` no espera |
| `hc ls [--all]`             | lista terminales vivos (o todos)                |
| `hc get <t>`                | estado de un terminal en JSON                   |
| `hc read <t>`               | imprime pantalla e historial                    |
| `hc send <t> <texto>`       | pega texto y pulsa enter                        |
| `hc keys <t> <teclas>`      | teclas sueltas: `enter`, `esc`, `up`, `ctrl+c`  |
| `hc wait <t>`               | espera a que deje de trabajar                   |
| `hc interrupt <t>`          | pulsa la tecla de parada                        |
| `hc attach <t>`             | toma el terminal (detach con `ctrl+\`)          |
| `hc kill <t>` / `hc rm <t>` | termina / elimina                               |
| `hc exec [--on m] <cmd>`    | ejecuta sin terminal y devuelve la salida       |

## Conceptos

- **Dirección**: `t1`, `t2`… o un nombre (`--name`). Los terminales de otra máquina
  se direccionan `machine/t7`.
- **`space`**: agrupación lógica de terminales. Se fija con
  `--label herdr.space=<id>`; es lo que hace que una instancia pertenezca al mismo
  espacio de trabajo que la sesión orquestadora.
- **`parent`**: terminal del que depende. Por defecto es el terminal desde el que
  se lanza. `--outlive-parent` evita que muera al terminar el padre.
- **`keep`**: si el programa muere, el terminal queda con un shell en su lugar. Por
  eso un agente terminado aparece como `agent: pwsh.exe`, no como muerto.
- **`blocked`**: el programa está esperando una respuesta en un diálogo. Es el
  estado que más turnos cuesta si no se detecta.

## Lanzar un agente

Un agente lanzado en Herdr **debe verse en la app**, y un orquestador de dominio
**nunca se abre como pestaña del espacio actual**: eso mezcla dominios en la misma
instancia. Cada especialidad recibe un **espacio nuevo** llamado
`<proyecto>/<especialidad>`.

```powershell
$app  = 'C:\Users\paco_\AppData\Local\Programs\herdr-app\herdr-app.exe'
$repo = 'C:\Users\paco_\Documents\GitHub\grim-dawn-builds'

# 1. Espacio NUEVO con su orquestador interactivo (prompt en argv, una línea).
#    La herramienta valida nombre y carpeta y falla cerrada.
pnpm herdr:space --specialty ui --folder $repo --task "<tarea del orquestador>"

# 2. Equivalente manual
& $app do space.new `
  --name 'grim-dawn-builds/ui' `
  --folder $repo `
  --tab 'ui' `
  --argv '["opencode","--auto","--prompt","Eres el ORQUESTADOR DE DOMINIO de ui..."]'

# 3. Verificar: el espacio y su terminal deben mostrar app y status no nulos
& $app ls | ConvertFrom-Json | ForEach-Object { $_.spaces } |
  ForEach-Object {
    $space = $_.name
    $_.tabs | ForEach-Object { $_.terminals } |
      Select-Object @{n='space';e={$space}}, terminal, app, status, name
  }
```

`--print` (o `pnpm herdr:space ... --print`) muestra el comando y el nombre del
espacio sin lanzar nada. El prompt va **dentro de `argv`**: `space.new --task` y
`tab.new --task` se añaden como argumento posicional y `opencode` lo interpreta
como **directorio**.

### Errores que ya cometimos

| Error                                              | Síntoma                                                                                                         | Corrección                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Abrir `tab.new` en el espacio actual               | Dos dominios comparten instancia, autoría y foco; el nivel 0 y el dominio se pisan                             | `space.new --name <proyecto>/<especialidad>`                 |
| Nombrar el espacio solo con la especialidad        | No se sabe a qué proyecto pertenece                                                                             | `<proyecto>/<especialidad>` en minúsculas                    |
| Omitir `--label herdr.tab=<id>`                    | El terminal sale en `hc ls` pero **no** en `herdr-app ls`: invisible en la app                                  | Pasar siempre las dos etiquetas                             |
| Usar `opencode run` (no interactivo)               | `app` y `status` quedan `null`; Herdr no lo reconoce como agente                                                | Usar el harness interactivo: `opencode --auto --prompt "…"` |
| Prompt con saltos de línea                         | `{"kind":"spawn_failed","message":"… is a batch file: it can't take an argument with a line break"}` en Windows | Unir el prompt en **una sola línea**                        |
| Lanzar desde `~` con un harness que pide confianza | Pantalla vacía, `turn: 0`                                                                                       | Lanzar con `--cwd` en un directorio ya confiado             |

### Adoptar un terminal ya lanzado

Si un agente ya corre sin etiquetas, no hace falta matarlo:

```powershell
& $hc label t11 "herdr.tab=<tab-id>"
```

La adopción activa `keep` y lo mete en esa pestaña. Aun así, si el proceso es no
interactivo seguirá sin `status`: eso solo lo arregla relanzarlo con el harness
interactivo.

## Supervisar un agente bloqueado

`hc send` **se niega** mientras el terminal está bloqueado:

```text
{"error":{"kind":"blocked","message":"t7 is blocked (permission)"}}
```

Secuencia correcta:

1. `hc read t7` → leer el diálogo y decidir.
2. `hc send --force t7 "2"` → opción «no volver a preguntar» cuando el patrón se
   repite dentro de la misma tarea.
3. Registrar la aprobación. **Una aprobación no es un resultado.**

## Detectar un cuelgue

Un agente puede quedarse esperando un proceso hijo que nunca termina. El síntoma es
un log que deja de crecer y un `hc get` que sigue diciendo `working`.

```powershell
Get-CimInstance Win32_Process -Filter "ProcessId=<pid>" | Select-Object ProcessId, CommandLine
```

Regla: **identificar el PID y su línea de comandos antes de matarlo**. Nunca matar
por nombre genérico (`node`, `python`): el servidor de OpenCode también es `node`.

## Límites conocidos

- `hc read` muestra texto de pantalla, no eventos: no sirve para medir tiempos.
- Los mensajes de nota que herdr escribe al padre pueden desactivarse con
  `notes = false` en `~/.config/herdr-core/config.toml`.
- Un terminal en `keep` que perdió su programa **no** reengancha el agente: hay que
  relanzarlo.
- La cuota del modelo es independiente de herdr: un agente puede estar `working`
  mientras su proveedor devuelve 503 o 429.
- **La app hereda el entorno del proceso que la lanza, no el del registro.** Si un
  mod ejecuta programas del sistema (`ls`, `sh`, `git`, `python`), esos binarios
  tienen que estar en el PATH **del proceso de la app**. Lanzarla con
  `Start-Process` desde una terminal con PATH antiguo deja los mods ciegos aunque
  el PATH del usuario ya esté corregido.

## Mods que ejecutan programas

Un mod de terceros puede depender de binarios POSIX. Over9k, por ejemplo, lista su
carpeta de listas con `exec("ls", ["-1", …])` y lee listas remotas con `sh -c`.
En Windows esto falla en silencio: el panel muestra «0 open» y no da error.

Síntoma y comprobación:

```powershell
# El core sí puede; la app puede que no.
& hc exec ls -1 "$env:USERPROFILE\.local\share\over9k\todos"
```

Si el core lo resuelve y el mod no, es el PATH del proceso de la app.

Corrección (una vez, y después relanzar la app con el PATH fresco):

```powershell
$gitUsr = 'C:\Program Files\Git\usr\bin'
$p = [Environment]::GetEnvironmentVariable('Path','User')
if ($p -notlike "*$gitUsr*") {
  [Environment]::SetEnvironmentVariable('Path', ($p.TrimEnd(';') + ';' + $gitUsr), 'User')
}
$env:PATH = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [Environment]::GetEnvironmentVariable('Path','User')
Stop-Process -Name herdr-app -Force
Start-Process 'C:\Users\paco_\AppData\Local\Programs\herdr-app\herdr-app.exe'
```

Regla: **al relanzar la app desde un agente o script, refresca primero `$env:PATH`
desde el registro.** `Start-Process` no lee el registro.

Verificación: `herdr-app shot <png>` y abrir la imagen. Un panel que debía tener
datos y muestra vacío es un fallo del entorno, no del mod.

## Dos programas, no uno

Herdr son dos binarios con responsabilidades separadas:

| Programa                | Qué controla                                                               | Cómo se usa                            |
| ----------------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| **`herdr-app`**         | la **ventana**: espacios, pestañas, layouts, paneles y mods                | `herdr-app status`, `ls`, `do`, `shot` |
| **`herdr-core` (`hc`)** | **ejecuta** cada terminal y cada agente; sobrevive al cierre de la ventana | `hc run`, `read`, `send`, `wait`       |

Un agente sigue vivo cuando cierras la ventana: la ventana es un cliente más.

```text
C:\Users\paco_\AppData\Local\Programs\herdr-app\herdr-app.exe
```

## Inspeccionar la ventana

| Comando                        | Devuelve                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `herdr-app status`             | layout mostrado, espacio y pestaña activos, pane enfocado, overlays y **errores de archivos o mods** |
| `herdr-app ls`                 | espacios → pestañas → terminales, con estado de agente y subagentes                                  |
| `herdr-app do <comando>`       | ejecuta un comando de la app y devuelve lo creado o `{error}`                                        |
| `herdr-app shot [archivo.png]` | captura el fotograma renderizado; útil para depurar un panel                                         |

`status` es la primera parada cuando algo “no se ve”: los errores de un layout o de
un mod aparecen ahí, no en el terminal.

## Estados de agente

Un agente reporta por OSC 7501 y solo puede estar en cuatro estados:

```text
working  >  blocked  >  done  >  idle      (urgencia de un espacio o pestaña)
```

- **`blocked`** exige al usuario: es el que interrumpe el trabajo.
- **`done`** significa «terminó mientras no mirabas»; pasa a `idle` al mirarlo.
- Un **subagente** es un terminal que el agente lanzó con `hc run`: el core registra
  el `parent` y el panel de agentes lo muestra bajo su padre, sin panel propio.

Regla para el orquestador: **`blocked` se atiende; `working` se espera; `done` se
lee; `idle` no requiere nada.** Confundir `blocked` con «lento» es el error que más
turnos cuesta.

## La interfaz es archivos

Todo lo que se ve en la ventana está descrito en
`~/.config/herdr-app/` y se recarga en caliente:

| Archivo                 | Decide                                                         |
| ----------------------- | -------------------------------------------------------------- |
| `layouts/<nombre>.json` | la ventana entera: bloques, tema, fuentes, marcos              |
| `keys.json`             | qué hace cada tecla                                            |
| `settings.json`         | zoom, sonidos, fuentes, contraste, telemetría                  |
| `mods/<nombre>/`        | paneles: pequeños programas en gpui-kit (sin HTML, CSS ni DOM) |
| `programs.json`         | nombres e iconos de los programas                              |

Advertencias que importan:

- `AGENTS.md` dentro de `~/.config/herdr-app/` **lo reescribe la app en cada
  arranque**: no se edita.
- Los layouts y mods que trae Herdr son de solo lectura. Para cambiar estructura o
  código se **clona** (`layout.clone`, `mod.clone`).
- Un archivo inválido no rompe la app: escribe `<nombre>.error` y conserva la última
  versión buena. Hay que comprobar ese archivo tras cada edición.
- `ctrl-alt-shift-escape` siempre funciona: aparta `keys.json` y el layout mostrado
  y vuelve al layout `main`. Es la salida de emergencia.

## Qué podría aportar a la orquestación

Un panel propio (un _mod_) podría mostrar las tareas en curso, el estado de cada
orquestador de dominio y el presupuesto de modelo consumido, leyendo `hc` y
`herdr-app`. Está registrado como trabajo futuro en `T-139`; hoy la supervisión se
hace con `hc read`, `hc get` y este documento.

## Fuente de verdad

`~/.config/herdr-app/AGENTS.md` documenta la app completa (layouts, mods, comandos,
settings) y se regenera en cada arranque. Este documento es el resumen operativo
para el orquestador; si algo difiere, manda el de la app.
