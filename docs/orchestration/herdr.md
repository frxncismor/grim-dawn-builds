# Herdr: operational context for the orchestrator

**English** · [Español](herdr.es.md)

Herdr is the terminal multiplexer this project uses to run agents in parallel and
supervise them. This note exists because the orchestrator needs its own context on
the tool: without it, a blocked agent is mistaken for a slow agent and turns are
lost.

## Binary and commands

```text
C:\Users\paco_\AppData\Local\Programs\herdr-core\hc.exe
```

| Command                     | What it is for                                  |
| --------------------------- | ----------------------------------------------- |
| `hc run <cmd> [task]`       | launches a program or template; `--bg` does not wait |
| `hc ls [--all]`             | lists live terminals (or all of them)           |
| `hc get <t>`                | state of a terminal in JSON                     |
| `hc read <t>`               | prints the screen and the history               |
| `hc send <t> <texto>`       | pastes text and presses enter                   |
| `hc keys <t> <teclas>`      | single keys: `enter`, `esc`, `up`, `ctrl+c`     |
| `hc wait <t>`               | waits until it stops working                    |
| `hc interrupt <t>`          | presses the stop key                            |
| `hc attach <t>`             | takes over the terminal (detach with `ctrl+\`)  |
| `hc kill <t>` / `hc rm <t>` | terminates / deletes                            |
| `hc exec [--on m] <cmd>`    | runs without a terminal and returns the output  |

## Concepts

- **Address**: `t1`, `t2`… or a name (`--name`). Terminals on another machine are
  addressed as `machine/t7`.
- **`space`**: logical grouping of terminals. It is set with
  `--label herdr.space=<id>`; it is what makes an instance belong to the same
  workspace as the orchestrating session.
- **`parent`**: the terminal it depends on. By default it is the terminal it is
  launched from. `--outlive-parent` prevents it from dying when the parent ends.
- **`keep`**: if the program dies, the terminal keeps a shell in its place. That
  is why a finished agent shows up as `agent: pwsh.exe`, not as dead.
- **`blocked`**: the program is waiting for an answer in a dialog. It is the state
  that costs the most turns when it is not detected.

## Launching an agent

An agent launched in Herdr **must be visible in the app**, and a domain
orchestrator **never opens as a tab of the current space**: that mixes domains in
the same instance. Each specialty gets a **new space** named
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

`--print` (or `pnpm herdr:space ... --print`) shows the command and the space name
without launching anything. The prompt goes **inside `argv`**: `space.new --task`
and `tab.new --task` are appended as a positional argument and `opencode`
interprets it as a **directory**.

### Mistakes we have already made

| Error                                              | Symptom                                                                                                         | Fix                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Opening `tab.new` in the current space             | Two domains share instance, authorship and focus; level 0 and the domain step on each other                     | `space.new --name <proyecto>/<especialidad>`                 |
| Naming the space with only the specialty           | It is not clear which project it belongs to                                                                     | `<proyecto>/<especialidad>` in lowercase                     |
| Omitting `--label herdr.tab=<id>`                  | The terminal shows up in `hc ls` but **not** in `herdr-app ls`: invisible in the app                            | Always pass both labels                                     |
| Using `opencode run` (non-interactive)             | `app` and `status` stay `null`; Herdr does not recognise it as an agent                                         | Use the interactive harness: `opencode --auto --prompt "…"` |
| Prompt with line breaks                            | `{"kind":"spawn_failed","message":"… is a batch file: it can't take an argument with a line break"}` on Windows | Join the prompt onto **a single line**                      |
| Launching from `~` with a harness that asks for trust | Empty screen, `turn: 0`                                                                                    | Launch with `--cwd` in an already trusted directory         |

### Adopting an already launched terminal

If an agent is already running without labels, there is no need to kill it:

```powershell
& $hc label t11 "herdr.tab=<tab-id>"
```

Adoption turns on `keep` and puts it inside that tab. Even so, if the process is
non-interactive it will still have no `status`: the only fix for that is to
relaunch it with the interactive harness.

## Supervising a blocked agent

`hc send` **refuses** while the terminal is blocked:

```text
{"error":{"kind":"blocked","message":"t7 is blocked (permission)"}}
```

Correct sequence:

1. `hc read t7` → read the dialog and decide.
2. `hc send --force t7 "2"` → the option that stops asking again when the pattern
   repeats within the same task.
3. Record the approval. **An approval is not a result.**

## Detecting a hang

An agent can end up waiting for a child process that never finishes. The symptom is
a log that stops growing and an `hc get` that keeps saying `working`.

```powershell
Get-CimInstance Win32_Process -Filter "ProcessId=<pid>" | Select-Object ProcessId, CommandLine
```

Rule: **identify the PID and its command line before killing it**. Never kill by
generic name (`node`, `python`): the OpenCode server is also `node`.

## Known limits

- `hc read` shows screen text, not events: it is useless for measuring time.
- The note messages herdr writes to the parent can be disabled with
  `notes = false` in `~/.config/herdr-core/config.toml`.
- A terminal in `keep` that lost its program **does not** reattach the agent: it
  has to be relaunched.
- The model quota is independent of herdr: an agent can be `working` while its
  provider returns 503 or 429.
- **The app inherits the environment of the process that launches it, not the one
  in the registry.** If a mod runs system programs (`ls`, `sh`, `git`, `python`),
  those binaries must be in the PATH **of the app process**. Launching it with
  `Start-Process` from a terminal with an old PATH leaves the mods blind even if
  the user's PATH is already fixed.

## Mods that run programs

A third-party mod may depend on POSIX binaries. Over9k, for example, lists its
lists folder with `exec("ls", ["-1", …])` and reads remote lists with `sh -c`. On
Windows this fails silently: the panel shows «0 open» and reports no error.

Symptom and check:

```powershell
# El core sí puede; la app puede que no.
& hc exec ls -1 "$env:USERPROFILE\.local\share\over9k\todos"
```

If the core resolves it and the mod does not, it is the PATH of the app process.

Fix (once, and then relaunch the app with the fresh PATH):

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

Rule: **when relaunching the app from an agent or a script, refresh `$env:PATH`
from the registry first.** `Start-Process` does not read the registry.

Check: `herdr-app shot <png>` and open the image. A panel that should have data and
shows empty is an environment failure, not a mod failure.

## Two programs, not one

Herdr is two binaries with separate responsibilities:

| Program                 | What it controls                                                          | How it is used                        |
| ----------------------- | ------------------------------------------------------------------------- | ------------------------------------- |
| **`herdr-app`**         | the **window**: spaces, tabs, layouts, panels and mods                    | `herdr-app status`, `ls`, `do`, `shot` |
| **`herdr-core` (`hc`)** | **runs** each terminal and each agent; survives closing the window        | `hc run`, `read`, `send`, `wait`       |

An agent stays alive when you close the window: the window is just another client.

```text
C:\Users\paco_\AppData\Local\Programs\herdr-app\herdr-app.exe
```

## Inspecting the window

| Command                        | It returns                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `herdr-app status`             | shown layout, active space and tab, focused pane, overlays and **file or mod errors**                |
| `herdr-app ls`                 | spaces → tabs → terminals, with agent and subagent state                                             |
| `herdr-app do <comando>`       | runs an app command and returns what was created or `{error}`                                        |
| `herdr-app shot [archivo.png]` | captures the rendered frame; useful for debugging a panel                                            |

`status` is the first stop when something does not show up: layout or mod errors
appear there, not in the terminal.

## Agent states

An agent reports over OSC 7501 and can only be in four states:

```text
working  >  blocked  >  done  >  idle      (urgencia de un espacio o pestaña)
```

- **`blocked`** demands the user: it is the one that interrupts the work.
- **`done`** means it finished while you were not looking; it turns into `idle`
  when you look at it.
- A **subagent** is a terminal the agent launched with `hc run`: the core records
  the `parent` and the agents panel shows it under its parent, with no panel of
  its own.

Rule for the orchestrator: **`blocked` is attended to; `working` is waited on;
`done` is read; `idle` requires nothing.** Confusing `blocked` with a slow agent
is the mistake that costs the most turns.

## The interface is files

Everything visible in the window is described in `~/.config/herdr-app/` and
reloaded live:

| File                    | It decides                                                     |
| ----------------------- | -------------------------------------------------------------- |
| `layouts/<nombre>.json` | the whole window: blocks, theme, fonts, frames                 |
| `keys.json`             | what each key does                                             |
| `settings.json`         | zoom, sounds, fonts, contrast, telemetry                       |
| `mods/<nombre>/`        | panels: small programs in gpui-kit (no HTML, CSS or DOM)       |
| `programs.json`         | names and icons of the programs                                |

Warnings that matter:

- `AGENTS.md` inside `~/.config/herdr-app/` **is rewritten by the app on every
  start**: it is not edited.
- The layouts and mods that Herdr ships with are read-only. To change structure or
  code they are **cloned** (`layout.clone`, `mod.clone`).
- An invalid file does not break the app: it writes `<nombre>.error` and keeps the
  last good version. That file must be checked after every edit.
- `ctrl-alt-shift-escape` always works: it sets aside `keys.json` and the shown
  layout and returns to the `main` layout. It is the emergency exit.

## What it could contribute to orchestration

A panel of its own (a _mod_) could show the tasks in progress, the state of each
domain orchestrator and the consumed model budget, reading `hc` and `herdr-app`.
It is registered as future work in `T-139`; today supervision is done with
`hc read`, `hc get` and this document.

## Source of truth

`~/.config/herdr-app/AGENTS.md` documents the whole app (layouts, mods, commands,
settings) and is regenerated on every start. This document is the operational
summary for the orchestrator; if anything differs, the app's one wins.
