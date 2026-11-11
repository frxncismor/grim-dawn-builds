# Quickstart: Verificar revisores y puerta

## Prerrequisitos

Node 22, dependencias existentes para lint y skills de Spec Kit instalados.
El hook local registra el coordinador; cada harness debe verificar que puede
despacharlo o cargar su `SKILL.md` explícitamente.

## Validación local

```text
node --test scripts/spec-review.test.mjs
pnpm exec markdownlint-cli2 ".agents/skills/review-*/SKILL.md" ".agents/skills/speckit-review-complete/SKILL.md" "specs/002-spec-completion-reviews/**/*.md" AGENTS.md CONTRIBUTING.md .github/copilot-instructions.md
```

Validar cada uno de los cinco directorios con `quick_validate.py` del
skill-creator instalado. No añadir metadata específica de proveedor si no aporta
valor. No cambiar el skill generado `speckit-implement` para integrar el hook.

## Escenarios de helper en repositorios temporales

1. Crear spec/plan/tasks con tarea pendiente, también legacy `- **T-001**` y sufijo
   `T-066a` sin checkbox: prepare devuelve pending-tasks;
   comprobar que el coordinador no despacha revisores.
2. Completar y verificar tareas: prepare devuelve ready/snapshot. Sin informe,
   check devuelve pending-review. Un fixture con cuatro resultados válidos sobre
   esa huella permite probar passed sin fingir que hubo revisiones reales.
3. Probar ausencia de especialidad, status failed/not-run, identidad vacía,
   independencia falsa, secreto de ejemplo redactado y severidad no permitida:
   nunca pasa por evidencia inválida. No usar secretos reales en fixtures.
4. CRITICAL/HIGH abierto bloquea; HIGH deferred se rechaza; MEDIUM/LOW requiere
   resolución o deferReason. Informes resueltos sin evidencia SDD no pasan.
5. Editar, crear sin seguimiento y borrar archivos: el informe pasa a obsoleto;
   escribir solo en reviews no cambia huella. Rechazar rutas fuera de raíz.
6. Spec/plan/tasks ausentes, tasks vacío/mal formado/IDs duplicados: invalid.
   Tarea reemplazada/diferida/opcional no seleccionada solo se excluye con
   disposición explícita y motivo SDD; sin ella sigue pendiente. Una sección
   titulada futura no excluye silenciosamente sus tareas.

## Escenarios conductuales de agentes

En espacio temporal, proporcionar spec pequeña, reglas y cambios con defecto de
control de acceso y una importación contra frontera. Invocar el coordinador y
los revisores reales sin indicar la solución esperada. Verificar evidencia,
severidad, cuatro resultados, no modificación de aplicación y ausencia de valores
secretos. Usar subagente independiente si hay capacidad; repetir modo sin
subagentes registrando su limitación. Documentar resultados reales y límites.

Verificar también un cambio documental sin defectos: cada especialidad describe
su cobertura sin inventar hallazgos. El hook registrado se carga realmente desde
la configuración y conduce al coordinador; emitir `EXECUTE_COMMAND` solo no es
evidencia. Si el harness no tiene router, cargar SKILL.md explícitamente y
registrar fallback; si no puede revisar, conservar pending-review.

## Evidencia de implementación

2026-11-09: `node --test scripts/spec-review.test.mjs` pasó 13/13 pruebas.
`quick_validate.py` pasó individualmente en `review-code`,
`review-architecture`, `review-security`, `review-best-practices` y
`speckit-review-complete` (`Skill is valid!` en los cinco casos).

Markdown focalizado, ejecutado con el binario local ya instalado:

```text
node_modules/.bin/markdownlint-cli2.cmd '.agents/skills/review-*/SKILL.md' '.agents/skills/speckit-review-complete/SKILL.md' 'specs/002-spec-completion-reviews/**/*.md' AGENTS.md CONTRIBUTING.md .github/copilot-instructions.md
```

Resultado: 38 archivos, 0 problemas. El intento equivalente con
`corepack pnpm exec` no pudo iniciar por un error local de
verificación de firma de Corepack (`Cannot find matching keyid`); se ejecutó el
binario local ya instalado de markdownlint-cli2 sin resolver paquetes ni acceder
a la red.

Estas comprobaciones cubren el helper y los cinco skills. La validación
conductual real de agentes, dispatch por harness y revisión de cierre de esta
spec sigue pendiente en T013/T014; los fixtures de pruebas no son informes de
revisión reales.

## Corrección T012a verificada

El principal reanudó la verificación tras interrumpirse el agente por límite de
uso. La suite actual tiene 16 pruebas y todas pasan. Se copió esa misma suite a
un directorio temporal con el helper anterior preservado por la evaluación:
fallaron exactamente dos casos (checked-bold/reemplazos con `/`, y privacidad
ante JSON inválido), mientras los otros 14 pasaron. El helper corregido pasó
los 16: las regresiones distinguen la versión defectuosa de la corregida.

Los cinco skills pasaron `quick_validate.py`, Markdown completo pasó sin errores
y ambos archivos JavaScript pasaron `node --check`. El principal comprobó que
todos apuntan al contrato y modelo de revisión canónicos de 002, que existen,
y que 001 no contiene un contrato Review propio: su modelo sigue siendo el de
contenido. `prepare` sobre 001 devuelve `pending-tasks`, sin rechazar los formatos
heredados ni declarar completa esa spec. No se amplió el parser para excluir
documentación local activa por una etiqueta de hosting diferido.

## Evidencia conductual histórica previa a T012a

El evaluador independiente `/root/review_behavior_evaluation` ejecutó cuatro
pases reales sobre un fixture de publicación, sin recibir los defectos esperados.
Identificó dos HIGH (predicado que impedía publicar y dependencia web→API) y un
MEDIUM de cobertura insuficiente; `check` devolvió `blocked`, salida 1. Seguridad
no inventó un defecto adicional.

Un segundo fixture documental se evaluó con delegación prohibida por el modo de
prueba: cuatro pases self-review, limitación registrada y cero hallazgos;
`check` devolvió `passed`, salida 0. Un tercer fixture con tarea pendiente devolvió
`pending-tasks`, salida 1: no despachó revisores ni creó un informe. Se cargaron
los skills explícitamente porque el harness no exponía un router de comandos.

Los informes reales permanecieron en los espacios temporales de evaluación;
no son informes de cierre de esta spec. Esa evidencia corresponde a la versión
anterior a T012a y no marca por sí sola T013/T014 ni acredita un cierre actual.

## Uso sobre una spec real

Antes de T013, validar la remediación T012a con formatos reales: checked bold con
X/x y sufijo, y reemplazo por IDs separados con `/`. Las variantes pendientes y
mal formadas deben seguir sin habilitar cierre. Ejecutar prepare sobre 001 y
comprobar que no devuelve invalid por esos formatos, sin inferir tareas completas.
Validar los cinco skills con una feature cuyo data-model es de dominio y no tiene
contrato Review propio: resuelven el modelo/contrato canónicos de 002 como fuente
del formato de informe. Para un JSON de informe mal formado, capturar stdout y
stderr y verificar que no contienen la cadena privada sintética de entrada;
check mantiene pending-review y causa fija saneada. Registrar los nuevos
resultados por separado de la evidencia T001–T012; las pruebas previas no marcan
automáticamente T012a, T013 ni T014.

Tras terminar y verificar todas las tareas, ejecutar el coordinador desde el
hook o su SKILL.md y esperar los pases. No reutilizar el fixture de tests como
informe real. Cualquier hallazgo que exija cambios vuelve primero a SDD.
