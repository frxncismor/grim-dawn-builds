# Orchestrator hierarchy by domain

**English** · [Español](hierarchy.es.md)

This document describes the orchestration hierarchy the project uses. It is an
operational summary of `ORCHESTRATION.md` §12 (`C:/Users/paco_/.copilot/sdd/ORCHESTRATION.md`),
which is the source of truth. It adds no levels and no new rules: if anything
differs, the methodology wins.

Origin: task T-139 of the plan (`specs/001-mvp-guias-builds/plan.md`, §17.49). The
agent rules that apply it live in `AGENTS.md` and in
`~/.copilot/agents/sdd-orchestrator-domain.agent.md`.

## Shape

```text
Orquestador de programa (nivel 0)
  ├── Orquestador de dominio A  →  subagentes  →  tareas
  ├── Orquestador de dominio B  →  subagentes  →  tareas
  └── Orquestador de dominio C  →  subagentes  →  tareas
```

There are only two levels. A domain orchestrator does not create another level
below itself: its subagents are executors (`sdd-implement`, `sdd-ui`) or auxiliaries
(`sdd-escalation`, `sdd-second-opinion`).

## Level 0: program orchestrator

- It decides the scope and splits the task by domain.
- It arbitrates conflicts between domain orchestrators.
- It is the only one that talks to the user.
- **It does not execute.** If it is caught implementing, the standard has failed.

## Domain orchestrators

- They execute and verify within their domain.
- They break their task into self-contained sub-tasks and dispatch them to **their
  own subagents**.
- They do not implement what can be delegated either.

### Default domains

| Domain                    | Typical work                                                      |
| ------------------------- | ----------------------------------------------------------------- |
| UI                        | Components, pages, accessibility and screenshots (`sdd-ui`).      |
| Tests and quality         | Tests, properties, mutation and gate verification.                |
| Backend                   | Domain logic, API and database (`sdd-implement`).                 |
| Infrastructure and CI     | Pipelines, containers and secrets.                                |
| Content and rights        | Editorial content and publication and rights rules.               |
| Tooling and DX            | Herdr, Over9k and the developer workflow.                         |
| Remote access             | Access to machines and services outside the local machine.        |

## Report contract

Every agent returns **one** block with this exact shape and **at most 12 lines**
(`ORCHESTRATION.md` §3):

```text
[REPORTE] <rol> · <task-id> · <estado: OK | BLOQUEADO | PARCIAL>
Alcance:      <qué se hizo, 1-3 líneas>
Archivos:     <rutas tocadas>
Verificación: <comando> → <resultado> · <ruta del log o artefacto>
Desviaciones: <ninguna | lista con motivo>
Bloqueos:     <ninguno | qué falta y de quién depende>
Siguiente:    <acción concreta para el orquestador>
```

Rules:

- `Verificación` cites **commands executed**, not intentions. If a check was not
  executed, it does not exist.
- `Desviaciones` compares what was executed with what was planned.
- `Bloqueos` names the owner of the blocker: the user, the provider or the
  environment.

A domain orchestrator does not forward its subagents' reports as they are. It
**aggregates them per task** into another block with the same shape, whose own state
is `OK`, `PARCIAL` or `BLOQUEADO`. That aggregated block is the one level 0
receives.

A dispatch announcement (the agent has been launched) **does not** prove execution.
Neither does a green result without quotable output. Only a report with a command
and its output counts.

## File ownership and parallelism

- Work in parallel only with `[P]` tasks from `tasks.md` and with **disjoint
  files**.
- If two domains need the same file (`package.json`, `angular.json`, `tasks.md`,
  `handoff.md`), level 0 **serialises** or assigns the edit to a single domain.
  Never edit in parallel.
- **No cross-delegation**: a domain orchestrator does not dispatch to another
  domain. If it needs something from another domain, it escalates to level 0, which
  arbitrates.

## Herdr windows

- **One window (space) per domain, and never a tab in the level 0 instance.** Each
  domain orchestrator opens in a **new space** named `<proyecto>/<especialidad>`
  (lowercase and hyphens: `grim-dawn-builds/ui`, `grim-dawn-builds/tests`), with its
  own interactive orchestrator agent and the prompt inside `argv`. The tool is
  `pnpm herdr:space` (see [herdr.md](./herdr.md)); `--print` shows the command
  without launching anything.
- **At most 2 terminals per space**. A third one opens another space of the same
  domain, not one more tab in the current one.
- Each terminal carries **both labels**: `herdr.space` and `herdr.tab`. With only
  `herdr.space` the terminal does not appear in the app.
- The harness must be **interactive** (for example `opencode --auto --prompt "…"`).
  A non-interactive mode is not recognised as an agent.
- After launching, `herdr-app ls` must show `app` and `status` **non-null** for that
  terminal. If `status` is `null`, it is not a visible agent and it has to be
  relaunched.

The use of the commands, the known errors and the supervision of blocked agents are
in [herdr.md](./herdr.md).

## Escalation to level 0

A domain orchestrator stops and escalates to level 0 when:

- The specification is ambiguous or two SDD artifacts contradict each other.
- The task requires touching files that `tasks.md` does not authorise.
- The scope, the contract or the constitution changes.
- There is a business decision or it depends on a third party.
- The verification requires credentials, access or a machine that does not exist in
  the environment.
- There is a risk that only level 0 can accept.

Limits: at most **5 total attempts** per sub-task and **3 iterations** before
escalating to the user. The escalation carries the exact list of what is missing.

## Model budget

- Each domain orchestrator declares the model it works with.
- Level 0 applies the `AGENTS.md` fallback chain when the primary fails.
- The model **actually used** is recorded in `handoff.md`, not the planned one.
- The orchestrator's model is not changed without notice; the change affects the
  subagents.

## Record

- `tasks.md` is the truth of the tasks. Only level 0 or the orchestrator that owns
  that file writes it.
- The Over9k to-do list (`~/.local/share/over9k/todos/<slug>.md`) reflects the same
  thing: a closed task is marked `[x]` there too.
- `handoff.md` records the state, the models used and the environment limits.

## Proof that the standard is met

Level 0 proves compliance with three facts, not with intentions:

1. Each active domain has its own Herdr window and an identifiable orchestrator.
2. Each domain orchestrator dispatched at least one sub-task to a subagent of its
   own, with a report.
3. Level 0 verified those reports with commands and real output.

## Summary: level 0 versus domain orchestrator

| Aspect                       | Level 0 (program)                             | Domain orchestrator                                                   |
| ---------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| Decides / executes           | Decides scope and split. **Does not execute.** | Executes and verifies its domain. Does not implement the delegable part either. |
| Delegates                    | Splits by domain.                             | Dispatches self-contained sub-tasks to **its own subagents**.         |
| Talks to the user            | Yes, it is the only one.                      | No. It escalates to level 0.                                          |
| Verifies                     | The aggregated reports from each domain.      | Its subagents' reports, with commands and output.                     |
| Closes the task in `tasks.md` | Yes, after verifying the aggregated report.  | It does not mark it in `tasks.md`; it reports to level 0.             |
| Model                        | Applies the `AGENTS.md` fallback chain.       | Declares the model it works with.                                     |

## Real trial with domain orchestrators (2026-11-11)

This section records the real trial that meets the test of the section
[Proof that the standard is met](#proof-that-the-standard-is-met). It ran with five
domain orchestrators in parallel, in separate Herdr windows and sessions, with
disjoint files:

| Domain (window)   | Files it owns                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| derechos2         | `packages/domain` (rights/adaptations contracts) and `scripts/check-scope.*`                                   |
| calidad           | `packages/domain/src/*.property.spec.ts`, `docs/orchestration/**`, `specs/001-mvp-guias-builds/{quickstart,handoff,tasks}.md` |
| i18n              | `angular.json` and `src/app/**`                                                                                |
| ci                | `.github/workflows/**` and `playwright.config.ts`                                                              |
| rendimiento       | Closed with T-145 (performance gate).                                                                          |

Facts recorded:

1. **Identical report contract at both levels.** The same `[REPORTE]` block from §3
   that a subagent returns is the one the domain orchestrator aggregates, with its
   own state.
2. **Two real serialisations, arbitrated by level 0:**
   - `scripts/check-scope.mts` and `scripts/check-scope.test.mts`: the edit was
     assigned to **derechos2**; the quality/docs domain did not touch them.
   - `package.json` (root): the edit was assigned to **ci**; quality did not touch
     it. The test dependency (`fast-check`) was declared in
     `packages/domain/package.json`, verified with an empty
     `git diff -- package.json`.
3. **Zero cross edits.** The final diff of the quality domain contains no file from
   `src/app`, `apps/api`, `.github`, `angular.json`, `scripts/check-scope.*` or the
   performance gate.
4. **Verification by level 0.** The verification was done by level 0 on the
   aggregated reports, not on the agents' claims.

With these three facts from §12 the standard is met: each domain has its window and
its orchestrator, each orchestrator dispatched to its subagents with a report, and
level 0 verified those reports with real output. With this evidence, T-139 is
closed.

## References

- Plan, §17.49 (T-139): `specs/001-mvp-guias-builds/plan.md`.
- Methodology, §12 (parallel delegation standard): `C:/Users/paco_/.copilot/sdd/ORCHESTRATION.md`.
- Repository rules: `AGENTS.md`, sections «Orquestación y reporte al orquestador»,
  «Correspondencia de modelos y cadena de fallback» and «Uso».
- Herdr operation: [herdr.md](./herdr.md).
