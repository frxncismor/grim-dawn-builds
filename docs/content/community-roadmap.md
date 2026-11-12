# Hoja de ruta comunitaria: roles, estados, moderación, SLA y decisiones (T-112)

> **Documentación de diseño de la etapa E0. No implementa nada.**

Este documento fija la matriz de roles y estados, el checklist de moderación, los
objetivos operativos (SLA) y el registro de decisiones pendientes (D-1 a D-6) de la
hoja de ruta de guías de autoría comunitaria. Es el complemento operativo de
[plan §16](../../specs/001-mvp-guias-builds/plan.md) y de
[spec FR-34 a FR-45](../../specs/001-mvp-guias-builds/spec.md).

Lo que **no** hace este documento:

- No implementa cuentas, autenticación, registro, editor público ni comentarios.
- No activa ninguna etapa E1 a E4. **Ninguna etapa comunitaria está activa.**
- No resuelve ninguna decisión D-1 a D-6.
- No es un contrato ni una licencia. Los términos del colaborador son un borrador en
  [`contributor-policy.md`](contributor-policy.md), a la espera de revisión legal.

En el MVP las capacidades comunitarias siguen fuera (constitución VIII, AC-24).

## 1. Estado y alcance

| Aspecto                  | Estado                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| Etapa actual             | **E0**: documentación de diseño                                                              |
| Cuentas y autenticación  | No existen. Proveedor de identidad pendiente (D-1)                                           |
| Editor público           | No existe                                                                                    |
| Comentarios              | No existen y no están previstos en E0–E3 (solo E4, si se decide aparte)                      |
| Canal de reporte/retirada | GitHub Issues: <https://github.com/frxncismor/grim-dawn-builds/issues>. Sin otro canal       |
| Términos del colaborador | Borrador en [`contributor-policy.md`](contributor-policy.md), requiere revisión legal (D-2)  |

Cualquier cambio de estado de una etapa exige su enmienda constitucional con versión
incrementada y su spec propio.

## 2. Etapas E0 a E4

Tomadas de [plan §16.2](../../specs/001-mvp-guias-builds/plan.md). No se fijan plazos
ni fechas.

| Etapa | Alcance                                                                                              | Precondiciones                                              | No incluye                                                                 |
| ----- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| E0    | Contenido editorial interno y documentos de política (T-111, T-112). **Etapa actual.**                | —                                                           | Cuentas, autenticación, editor público, comentarios, envíos de terceros     |
| E1    | Autores invitados dados de alta por el equipo (`authors` + rol). Envío manual por archivo de contenido validado con atestación firmada. Revisión editorial | D-2 y D-3 mínimas; plan §15 operativo; enmienda + spec E1 | Cuentas públicas, registro abierto, formulario público, editor estructurado en BD |
| E2    | Identidad (D-1) solo para invitados. Borradores en BD, editor estructurado, validación, versiones, auditoría y reportes. Publicación solo tras revisión | D-1, D-4, D-5; enmienda constitucional + spec E2; Fase 8 completa | Registro abierto, autoservicio sin invitación, comentarios                 |
| E3    | Altas por solicitud o aprobación; límites de tasa, cuarentena de cuentas nuevas, herramientas de moderación | D-6; capacidad de moderación (D-3) demostrada; enmienda + spec E3 | Apertura general, reputación, comentarios                                  |
| E4    | Registro más abierto, reputación o promoción de autores                                              | Métricas de abuso y SLA cumplidos; enmienda + spec E4       | Comentarios, salvo decisión aparte y spec propio                           |

Reglas de la hoja de ruta:

- **No se salta ninguna etapa.** Cada una depende de la anterior.
- **Cada etapa exige enmienda constitucional y spec propio.** Sin ambos, la etapa no
  empieza.
- **Nunca hay publicación abierta sin revisión.**

## 3. Matriz de roles

Roles de [FR-41](../../specs/001-mvp-guias-builds/spec.md) y
[plan §16.3](../../specs/001-mvp-guias-builds/plan.md): `autor`, `editor`, `moderador`
y `admin`. Las celdas siguientes son el diseño propuesto para E2; las acciones de
`editor` sobre contenido ajeno se confirmarán en el spec de E2.

### 3.1 Rol × acción

| Acción                  | Autor                                                       | Editor                                                  | Moderador                                            | Admin                  |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- | ---------------------- |
| Crear borrador          | Sí, propio                                                  | No                                                      | No                                                   | No                     |
| Editar                  | Sí, solo su borrador o su versión devuelta (`cambios_solicitados`) | No (solicita cambios con motivo)                 | No                                                   | No                     |
| Enviar                  | Sí, propio, con atestación                                  | No                                                      | No                                                   | No                     |
| Revisar contenido       | No                                                          | Sí, guías ajenas                                        | Sí, si también es revisión de contenido (D-3)        | No                     |
| Verificar derechos      | No                                                          | No, salvo que no sea editor de esa adaptación (ver 3.2) | Sí, en adaptaciones (plan §16.3)                     | No                     |
| Aprobar                 | No                                                          | Sí, guías ajenas                                        | No                                                   | No                     |
| Publicar                | **No, nunca**                                               | Sí, equipo editorial (concreción en D-3)                | Sí, equipo editorial (concreción en D-3)             | No                     |
| Retirar                 | Sí, la propia                                               | No                                                      | Sí, cautelar o por solicitud                         | No                     |
| Suspender autor         | No                                                          | No                                                      | Sí (FR-43)                                           | No                     |
| Gestionar roles         | No                                                          | No                                                      | No                                                   | Sí                     |
| Dar de alta autor invitado | No                                                       | No                                                      | No                                                   | Pendiente (D-3)        |

Notas:

- «Pendiente (D-3)» significa que la asignación exacta la decide el equipo de
  moderación. No se fija aquí.
- Si el proyecto solo tiene una persona disponible, esa persona no puede cubrir los
  dos lados de una misma decisión (ver 3.2). La decisión queda pendiente hasta tener
  un revisor distinto.

### 3.2 Separación de funciones

- **Nadie aprueba su propia guía** (FR-41). El aprobador es distinto del autor.
- **El verificador de derechos es distinto del editor de la adaptación** (plan §16.3).
- **El observador de una fuente no es su aprobador**
  ([`source-change-review.md`](source-change-review.md)).
- **El autor no publica.** `publicado` lo ejecuta el equipo editorial.
- **Las acciones de admin no abren contenido.** Gestionar roles no concede aprobación
  ni publicación sobre guías concretas.

## 4. Máquina de estados

Estados de una guía comunitaria, según
[plan §16.3](../../specs/001-mvp-guias-builds/plan.md) y FR-36:

`borrador` → `enviada` → `en_revision_editor` → `cambios_solicitados` | `aprobada` → `publicado`

Estados terminales o alternos: `rechazada` y `retirada`.

### 4.1 Transiciones

| Desde                | Hacia                | Quién puede ejecutarla                         | Condición de entrada                                                                                              | Efecto                                                                  | Se audita                                                                       |
| -------------------- | -------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| —                    | `borrador`           | Autor                                          | Alta de autor invitado (E1 sin cuenta; cuenta solo en E2)                                                         | Borrador visible solo para el autor y el equipo                         | Creación, actor, fecha                                                          |
| `borrador`           | `enviada`            | Autor                                          | Atestación firmada; términos aceptados con versión, fecha y huella; tipo declarado; si es adaptación, evidencia registrada (FR-39) | Congela la versión N; no se puede editar                                | Envío, versión N, huella del contenido, actor, fecha, versión de términos       |
| `enviada`            | `en_revision_editor` | Editor distinto del autor                      | Validación Zod y CHECK superada                                                                                   | Asigna la revisión                                                      | Asignación, revisor, fecha                                                      |
| `en_revision_editor` | `cambios_solicitados` | Editor distinto del autor                     | Motivo escrito                                                                                                    | Vuelve al autor; el siguiente envío crea otra versión congelada         | Decisión, motivo, actor, fecha                                                  |
| `cambios_solicitados` | `enviada`           | Autor                                          | Nueva versión N+1 con cambios                                                                                     | Congela la versión N+1                                                  | Envío de la nueva versión, diff contra la anterior                              |
| `en_revision_editor` | `aprobada`           | Editor distinto del autor                      | Contenido revisado; si es adaptación, `rights_status` aprobado por un verificador distinto del editor             | Lista para publicar                                                     | Aprobación, revisor de contenido, verificador de derechos, actor, fecha          |
| `aprobada`           | `publicado`          | Equipo editorial (concreción en D-3). **Nunca el autor** | `rights_status` aprobado; aprobador ≠ autor; versión congelada; auditoría registrada                   | La versión concreta aparece en vistas públicas (FR-45)                  | Publicación, versión publicada, actor, fecha                                    |
| `en_revision_editor` | `rechazada`          | Editor o moderador                             | Motivo registrado                                                                                                 | Terminal; la guía no se publica                                         | Rechazo, motivo, actor, fecha                                                   |
| `publicado`, `aprobada`, `enviada`, `cambios_solicitados`, `borrador` | `retirada` | Autor (la propia) o moderador (cautelar o por solicitud) | Solicitud verificable o decisión de moderación; runbook de retirada | Terminal; despublicación; no se reutiliza el contenido                  | Retirada, motivo, origen, actor, fecha, invalidación de derivados               |

Reglas de la máquina:

- **`publicado` nunca lo ejecuta el autor.**
- **Nunca hay autopublicación.** Ninguna guía pasa a `publicado` sin revisión.
- **Lo publicado es una versión concreta.** Revertir crea una versión nueva; no
  reescribe la anterior (FR-44).
- **Cada transición es append-only en auditoría**, con quién, cuándo y qué cambió.

### 4.2 Estados × rol permitido

Lectura: qué puede hacer cada rol con una guía en cada estado.

| Estado                | Autor                                         | Editor                                 | Moderador                                   | Admin     | Visible al público |
| --------------------- | --------------------------------------------- | -------------------------------------- | ------------------------------------------- | --------- | ------------------ |
| `borrador`            | Ver, editar, enviar, retirar                  | No                                     | Ver (derechos, abuso)                       | No        | No                 |
| `enviada`             | Ver, retirar                                  | Asignar revisión                       | Ver, retirar cautelar                       | No        | No                 |
| `en_revision_editor`  | Ver                                           | Revisar, aprobar, pedir cambios, rechazar | Ver, verificar derechos (adaptación), retirar | No      | No                 |
| `cambios_solicitados` | Ver, editar (nueva versión), retirar          | Ver                                    | Ver, retirar cautelar                       | No        | No                 |
| `aprobada`            | Ver, retirar                                  | Ver                                    | Ver, retirar cautelar                       | No        | No                 |
| `publicado`           | Ver, retirar                                  | Ver, publicar (D-3)                    | Ver, publicar (D-3), retirar cautelar, suspender autor | No | **Sí, solo la versión publicada** |
| `rechazada`           | Ver (motivo)                                  | Ver                                    | Ver                                         | No        | No                 |
| `retirada`            | Ver registro mínimo                           | Ver registro mínimo                    | Ver registro mínimo                         | No        | No                 |

## 5. Checklist de moderación

Operable por el equipo en cada momento. Cada punto se marca con evidencia (registro,
captura de la decisión o nota en el expediente), no con una confirmación verbal.

### 5.1 Al recibir un envío

- [ ] Atestación firmada presente y completa (FR-39). Sin firma o sin registro: se rechaza.
- [ ] Términos aceptados con versión, fecha y huella del texto aceptado.
- [ ] Tipo declarado: `original` o `adaptacion`. Nunca mezclados.
- [ ] Procedencia completa (FR-40): tipo, fuentes y referencias, autor, fecha, versión del
      juego, alcance de la transformación.
- [ ] Ausencia de material de terceros sin derechos registrados (texto, imágenes, tiers, activos).
- [ ] Ausencia de activos oficiales del juego sin estado `approved` (VII).

### 5.2 Revisión de contenido

- [ ] Datos contrastados con el juego; versión del juego citada.
- [ ] Referencias verificables; sin afirmaciones de ranking sin base.
- [ ] Ausencia de HTML, scripts o imágenes remotas en el texto (subconjunto seguro, FR-37).
- [ ] Tono y idioma según la política del proyecto. El idioma declarado coincide con el texto.
- [ ] Revisor de contenido distinto del autor.

### 5.3 Revisión de derechos (adaptaciones)

- [ ] Evidencia vigente y citable (URL, título, autor, sitio, fecha).
- [ ] La evidencia cubre expresamente la **adaptación**, no solo la cita ni el enlace.
- [ ] Atribución prominente prevista en la interfaz y en los datos estructurados (FR-28, FR-29).
- [ ] Verificador de derechos distinto del editor de la adaptación.
- [ ] Sin evidencia que cubra la adaptación: se rechaza o se reduce a _link-only_ (FR-30).

### 5.4 Antes de publicar

- [ ] `rights_status` aprobado (`own_original` para original; `licensed` o `permission_granted` para adaptación).
- [ ] Aprobador distinto del autor.
- [ ] Versión congelada; la versión publicada es la aprobada, sin cambios posteriores.
- [ ] Auditoría de la aprobación y de la publicación registrada.

### 5.5 Después de publicar

- [ ] Seguimiento de la fuente según [`source-change-review.md`](source-change-review.md)
      (revisión periódica y disparadores).
- [ ] Reportes recibidos por GitHub Issues revisados según el [runbook de retirada](takedown-runbook.md).
- [ ] Retirada ejecutada si procede, con invalidación de derivados (build, sitemap, JSON-LD).
- [ ] Registro de cierre de cada reporte o retirada con fecha, decisión y evidencia.

## 6. SLA y objetivos operativos

Estos valores son **objetivos operativos del proyecto, no garantías legales**. No
constituyen compromisos frente a terceros.

| Concepto                                        | Valor                                                  | Estado         | Origen                                                                             |
| ----------------------------------------------- | ------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------- |
| Triaje de una solicitud de retirada             | 24 h                                                   | Objetivo operativo | [plan §15](../../specs/001-mvp-guias-builds/plan.md) (línea de retirada)         |
| Retirada efectiva desde que la solicitud es verificable | ≤ 72 h                                         | Objetivo operativo | [`takedown-runbook.md`](takedown-runbook.md) y [plan §16.1 (D-3)](../../specs/001-mvp-guias-builds/plan.md) |
| Revisión periódica de una fuente                | 90 días por defecto, ajustable con justificación       | Vigente en documentos existentes | [`source-change-review.md`](source-change-review.md)           |
| SLA de revisión editorial de una guía           | **Pendiente (D-3)**                                    | Pendiente      | El plan cita «p. ej. 7 d» solo como ejemplo. No se fija aquí                       |
| Cobertura de moderación (horario, personas)     | **Pendiente (D-3)**                                    | Pendiente      | —                                                                                  |
| Escalado entre moderadores                      | **Pendiente (D-3)**                                    | Pendiente      | —                                                                                  |

Notas:

- Ninguna de estas cifras es una promesa pública. Si se publicaran, requerirían
  actualizar la página `/legal` y el [runbook de retirada](takedown-runbook.md) en el mismo cambio.
- Las marcas «Pendiente (D-3)» no se resuelven por omisión: hasta que D-3 se decida, no
  se anuncia ningún SLA de revisión.

## 7. Decisiones pendientes D-1 a D-6

Tomadas de [plan §16.1](../../specs/001-mvp-guias-builds/plan.md). **Ninguna está
resuelta.** Todas bloquean la activación de alguna etapa; ninguna bloquea el MVP.

| ID  | Decisión                                          | Opciones / nota (plan §16.1)                                                                                                                          | Estado    | Bloquea                                 | Artefacto que la resuelve                                              |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------- | ---------------------------------------------------------------------- |
| D-1 | Proveedor de identidad                            | OIDC gestionado vs. autoalojado vs. cuentas propias con correo y MFA. Implica enmienda de VIII/XI y de XII (secretos)                                  | pendiente | T-114, E2 (y E1 solo en invitados)      | Decisión del usuario + enmienda de VIII/XI/XII + spec E2               |
| D-2 | Términos del colaborador y licencia               | Licencia que el autor concede al sitio; licencia pública de las guías; política de IA y plagio; edad mínima; privacidad. Revisión legal recomendada   | pendiente | T-111 (cierre), T-115 (E1), E2          | Decisión del usuario + revisión legal + enmienda + versión de términos  |
| D-3 | Equipo de moderación y SLA                        | Quién modera, cobertura, SLA de revisión y de retirada, escalado. Plazo de retirada ≤ 72 h ya usado como objetivo                                    | pendiente | T-115 (E1), T-119, T-120, T-121, E3     | Decisión del usuario + spec E1 (roster mínimo) y spec E2              |
| D-4 | Sanitización y formato del texto                  | Subconjunto Markdown vs. campos estructurados puros                                                                                                    | pendiente | T-117 (editor), E2                      | Spec E2 + enmienda si cambia FR-37                                    |
| D-5 | Almacenamiento y retención de evidencias          | Privado, acceso por rol, retención de atestaciones y evidencias de permiso                                                                             | pendiente | T-116, T-118, E2                        | Spec E2 + decisión del usuario (retención)                            |
| D-6 | Cuotas y umbrales de abuso                        | Valores iniciales de tasa, tamaño, cuarentena, tope de borradores y de envíos pendientes. **Sin valores fijados aquí**                                  | pendiente | T-121, E3                               | Spec E3 + decisión del usuario                                        |

## 8. Seguridad y abuso

Resumen de [plan §16.5](../../specs/001-mvp-guias-builds/plan.md). Aplica desde E2;
en E0 no hay superficie de ataque comunitaria que proteger, porque no existe.

- **Autorización por rol y propiedad** en API y en BD. Nunca solo en la UI. Un autor no
  ve ni edita borradores ajenos (AC-25).
- **Validación en tres capas**: Zod de dominio, CHECK o trigger en BD y revisión humana (FR-38).
- **Sanitización del texto**: sin HTML crudo, sin scripts, sin imágenes remotas (XSS,
  seguimiento, derechos). Subconjunto seguro definido en D-4.
- **Límites de tasa y de tamaño** por identidad e IP. Valores pendientes de D-6.
- **Cuarentena de cuentas nuevas** y bloqueo o suspensión de autores (FR-43). Pendiente de D-6.
- **Reporte y retirada** por GitHub Issues, con el [runbook de retirada](takedown-runbook.md).
- **Auditoría append-only** de creación, edición, envío, decisiones, publicación, retirada
  y cambios de rol (FR-44).
- **Secretos de identidad** bajo [plan §13](../../specs/001-mvp-guias-builds/plan.md) y la
  constitución XII. Ningún secreto en el repositorio.
- **Datos personales mínimos**, con política de privacidad (parte de D-2).
- **DAST ampliado** en las puertas de PR, cuando exista la superficie de E2.
- **El editor se carga de forma diferida** (ruta lazy) y no afecta al bundle público. Las
  páginas públicas siguen siendo SSG/SSR.

## 9. Orden de implementación y bloqueos

Según [tasks.md](../../specs/001-mvp-guias-builds/tasks.md) (líneas de T-111 a T-122).
Solo T-111, T-112 y T-113 son implementables ahora. Todo lo demás está **diferido**.

```text
T-111 (política, documental, hecho)
  → T-112 (este documento, documental)
  → T-113 (guarda check-scope: falla ante auth, registro o edición pública; AC-24)
  → D-1 / D-2 / D-3 decididos + enmienda constitucional + spec E1/E2
  → T-114 (identidad y roles; D-1, E2)
  → T-115 (autores invitados y envío manual con atestación; E1)
  → T-116 (migración de contributors, build_versions, contributor_attestations,
           review_decisions, audit_log + CHECK/triggers; E2)
  → T-117 / T-118 (API de borradores y editor; atestación y puerta original/adaptación; E2)
  → T-119 / T-120 / T-122 (revisión con separación de funciones; reportes y retirada;
           vistas públicas de la versión publicada; E2)
  → T-121 (límites de tasa, cuarentena, antispam, suspensión; D-6; E3)
```

Nada de lo anterior ocurre en el MVP. El MVP no añade auth, cuentas, editor público
ni comentarios.

## 10. Base constitucional y documentos relacionados

Este documento se apoya en la constitución
([`.specify/memory/constitution.md`](../../.specify/memory/constitution.md), v1.9.0):

- **Principio I**: contenido verificable y atribuido; todo tiene autor, fuente, estado de
  revisión y estado de derechos. Nunca se publica con derechos `pending`.
- **Principio II**: sin scraping automático en el MVP; la importación es editorial.
- **Principio VII**: legalidad y activos. Los derechos no se presuponen; las adaptaciones
  exigen evidencia que cubra la adaptación y siguen sujetas a retirada.
- **Principio VIII**: simplicidad. La hoja de ruta comunitaria se documenta, no se
  implementa; activarla exige enmienda, spec propio y decisiones del usuario.

Documentos hermanos y de contexto:

- [`CONTRIBUTING.md`](../../CONTRIBUTING.md), secciones de contenido, derechos y
  procedencia, y de documentación Markdown.
- [`contributor-policy.md`](contributor-policy.md): borrador de términos del colaborador (T-111).
- [`source-policy.md`](source-policy.md)
- [`permission-request-template.md`](permission-request-template.md)
- [`takedown-runbook.md`](takedown-runbook.md)
- [`source-change-review.md`](source-change-review.md)
- [`forum-source-assessment.md`](forum-source-assessment.md)
- [Plan §16](../../specs/001-mvp-guias-builds/plan.md) (hoja de ruta futura, D-1 a D-6, etapas E0 a E4)
- [Spec FR-34 a FR-45 y AC-24/AC-25](../../specs/001-mvp-guias-builds/spec.md)
