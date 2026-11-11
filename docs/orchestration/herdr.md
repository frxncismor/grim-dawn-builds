# Herdr: contexto operativo para el orquestador

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

```powershell
$hc = 'C:\Users\paco_\AppData\Local\Programs\herdr-core\hc.exe'
& $hc run --bg --name codex-t035 `
  --cwd 'C:\Users\paco_\Documents\GitHub\grim-dawn-builds' `
  --label "herdr.space=$space" `
  --parent t5 --outlive-parent `
  codex $prompt
```

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
