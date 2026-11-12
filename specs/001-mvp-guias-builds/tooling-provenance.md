# Procedencia y recuperación de Spec Kit — T-124

La recuperación empezó antes de registrarse T-124. Este documento conserva la
procedencia y permite reproducirla; no acredita planificación previa.

## Fuente

- Repositorio oficial: [github/spec-kit](https://github.com/github/spec-kit).
- Commit: `c43849408ac0de2ca6a52f14eaae71449776057b`.
- Versión del paquete en ese commit: `specify-cli 1.3.3.dev0`.
- Licencia MIT preservada en `.specify/LICENSE.spec-kit`.
- Integración: `codex`, scripts PowerShell, eventos nativos desactivados.

Se generó un proyecto vacío en una carpeta temporal mediante la CLI oficial.
Después se copiaron únicamente los 27 archivos que no existían en este checkout.
Se excluyó todo `.specify/memory/`: la constitución existente y las specs se
preservaron. No se ejecutó una reinicialización con `--force` sobre el proyecto.

## Archivos recuperados

Las nueve skills generadas se instalaron en
`.agents/skills/speckit-<comando>/SKILL.md`, para los comandos `analyze`,
`checklist`, `clarify`, `constitution`, `converge`, `implement`, `plan`, `specify`
y `tasks`. Sus hashes SHA-256 coinciden con
`.specify/integrations/codex.manifest.json`. Un intento inicial de autocorrección
Markdown cambió espacios; posteriormente se restauraron los nueve archivos a
los bytes originales verificados contra ese manifiesto.

Los otros 18 archivos son:

- `.specify/.gitignore`.
- `.specify/init-options.json`.
- `.specify/integration.json`.
- `.specify/integrations/codex.manifest.json`.
- `.specify/integrations/speckit.manifest.json`.
- `.specify/scripts/powershell/check-prerequisites.ps1`.
- `.specify/scripts/powershell/common.ps1`.
- `.specify/scripts/powershell/create-new-feature.ps1`.
- `.specify/scripts/powershell/resolve-template.ps1`.
- `.specify/scripts/powershell/setup-plan.ps1`.
- `.specify/scripts/powershell/setup-tasks.ps1`.
- `.specify/templates/checklist-template.md`.
- `.specify/templates/constitution-template.md`.
- `.specify/templates/plan-template.md`.
- `.specify/templates/spec-template.md`.
- `.specify/templates/tasks-template.md`.
- `.specify/workflows/workflow-registry.json`.
- `.specify/workflows/speckit/workflow.yml`.

Las skills oficiales son salida regenerable local: Git y markdownlint excluyen
solo los nueve directorios enumerados, con reglas por nombre exacto. Las skills
propias del proyecto, incluidos los revisores aunque usen el prefijo `speckit-`,
siguen versionadas y sujetas a markdownlint. No se modifican las
instrucciones upstream para satisfacer el lint.

## Reproducción

En una carpeta temporal, obtener el repositorio oficial y hacer checkout del
commit indicado. Crear un entorno virtual de Python e instalar allí ese checkout
con pip. La recuperación se ejecutó con Python 3.15 y `PYYAML_FORCE_LIBYAML=0`
para instalar PyYAML sin necesitar el compilador C++ de Windows. No se cambió la
instalación global de Python ni la configuración del proyecto para hacerlo.

Con la CLI de ese entorno, generar en otra carpeta temporal nueva:

```powershell
specify init <carpeta-temporal-nueva> --non-interactive --integration codex --script ps --ignore-agent-tools --integration-options='--events false'
```

Antes de copiar, comparar todos los destinos: abortar si alguno ya existe.
Copiar únicamente los archivos enumerados, nunca la constitución de ejemplo,
secretos ni contenido de `.specify/memory/`. Preservar la licencia upstream.
En una instalación existente, revisar primero las diferencias; no sobrescribir
personalizaciones ni actualizar la versión como efecto secundario.

## Verificación

Seleccionar la feature explícitamente, sin depender del nombre de la rama:

```powershell
$env:SPECIFY_FEATURE_DIRECTORY = (Resolve-Path 'specs/001-mvp-guias-builds').Path
./.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks
```

Los scripts oficiales `setup-plan.ps1` y `setup-tasks.ps1` ya se ejecutaron durante
la remediación SDD y conservaron el plan existente. Los prerequisitos reconocen
spec, plan, tareas, investigación, modelo de datos, contratos y quickstart.
`.specify/feature.json` es estado local ignorado por el propio Spec Kit.

Comparar el hash de `.specify/memory/constitution.md` con la versión de Git y
verificar que las nueve skills coincidan con el manifiesto antes de usar la
instalación recuperada. Los scripts, plantillas y manifiestos compartidos sí se
versionan; no contienen credenciales ni valores secretos.

## Impeccable requerido por sdd-ui (T-131)

Instalación 2026-11-09 con npx impeccable@4.8.1, providers=codex, scope=project,
no-hooks. Solo .agents/skills/impeccable; sin configuración global ni hooks de
proveedor nuevos. Caché npm y descarga del engine en TEMP; el instalador colocó
el binario en el payload ignorado, no en los artefactos de la aplicación.

- Paquete npm 4.8.1: [tarball oficial](https://registry.npmjs.org/impeccable/-/impeccable-4.8.1.tgz).
- Integridad npm: `sha512-Ivj58vndEIbcAA2+GbaHEXpZ4t0uSMHKz9leyH1uslxHntnq/CDpLLH9bUYqp7jrZmkU2ObSNmKw5vbDEKOFKQ==`.
- Payload SKILL.md: metadata.version 4.8.1; SHA-256 `ec5c81f17af6476cafd351875d9109b7d03329e05b3f845cb2d0bbbd4bc31b2c`.
- Engine efectivo: 0.1.19 windows-x64; SHA-256 `30427e0cfea383a0adbc5cc554481c3f18337eeabcc4eaf7d9bb48ad2e8b5676`, comprobado contra engine-checksums.txt instalado antes de ejecutarlo.
- Referencia de código inspeccionada: [pbakaus/impeccable f866ce13](https://github.com/pbakaus/impeccable/tree/f866ce13beb3a065fabfce90f8c784eedad84117), Apache-2.0. Es la referencia inspeccionada, no una afirmación de igualdad byte a byte con el paquete publicado: esa revisión ya referencia engine 0.1.20; la instalación efectiva anterior queda identificada por sus propios hashes.

El helper context sin target detectó api/domain y pidió selección; con target
src/styles.css resolvió la raíz web correctamente, exit 0. Producto/diseño propios
faltan en el formato de Impeccable; la directiva SCOPED_EXISTING_ALLOWED permite
refinar el sistema ya aprobado. Plan §7 y spec §5 son la autoridad para T-017,
sin usar el helper para rediseñar ni dar por aprobadas funcionalidades nuevas.
El detector requiere invocación manual al terminar UI porque no hay hook nativo.
No se afirma haber ejecutado init, critique, audit o polish todavía.

El payload es compilado/generado por proveedor y se regenera con el comando de
CONTRIBUTING; se ignora exactamente esa carpeta y se conserva upstream sin
modificarla para lint. Las cinco skills de revisión propias permanecen rastreables
y pasan markdownlint. Ningún ejecutable o referencia de Impeccable va al bundle.

## Gitleaks local — T-083

Instalador propio scripts/setup-gitleaks.mts, sin dependencia JS/productiva nueva;
versión fijada 8.30.1, misma que CI. Fuente primaria consultada:
[release oficial v8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1)
y metadata pública de assets de ese tag. La descarga se verifica antes de
extraer un solo binario y ejecutarlo. Solo Windows/Linux x64; otros entornos
usan instalación nativa compatible por PATH. Nada se instala globalmente.

| Asset | SHA-256 |
| --- | --- |
| gitleaks_8.30.1_windows_x64.zip | d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e |
| gitleaks_8.30.1_linux_x64.tar.gz | 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb |

Destino generado ignorado: .tools/gitleaks/8.30.1, archivos nativos separados por
nombre. Staging temporal dentro de ese destino, promoción por rename después de
SHA/version y limpieza con límites comprobados. Se rechazan directorios/binarios
symlink. El hook usa primero el nativo local y luego PATH, siempre versión exacta;
no descarga ni cambia PATH al hacer commit. Su archivo se conserva LF y modo
100755 para Git for Windows y Linux.

Se verificaron reglas en la
[configuración predeterminada del tag](https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml):
el bloque allowlist vacío heredado era inválido y se retiró; no se añadieron
excepciones ni reglas alteradas. Los datos sintéticos de pruebas se generan en
memoria/TEMP con entropía suficiente para ejercitar la regla PAT, sin un token
literal en el repositorio ni credenciales emitidas por un proveedor.
