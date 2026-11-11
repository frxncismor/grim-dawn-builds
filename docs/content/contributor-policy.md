# Política de contribución y borrador de términos del colaborador (T-111)

> **Borrador — requiere revisión legal.**

Este documento es un borrador de trabajo. **No es un contrato**, no se ha publicado
ni activado ninguna etapa comunitaria y **no habilita** cuentas, editor público ni
comentarios. En el MVP estas capacidades siguen fuera (constitución VIII). Los
términos definitivos dependen de las decisiones pendientes D-1 a D-6 y de una
revisión legal que todavía no se ha hecho.

Referencias: [plan §16](../../specs/001-mvp-guias-builds/plan.md) (hoja de ruta
futura de autoría comunitaria) y [spec FR-34 a FR-45](../../specs/001-mvp-guias-builds/spec.md).

## 1. Alcance y etapas

Este documento pertenece a la **etapa E0** del plan §16.2: documentación de política,
sin cambios de aplicación. Las etapas E1 a E4 no empiezan con este documento. Cada una
exige:

- la decisión correspondiente de D-1 a D-6 (sección 11);
- una enmienda constitucional con su versión incrementada;
- una spec propia de la etapa.

No se anuncian fechas ni se promete activación de ninguna etapa.

## 2. Quién puede contribuir (etapa E1)

- Solo **autores invitados**, dados de alta por el equipo editorial en la tabla
  `authors` con su rol (FR-35).
- El envío es **manual**, por el canal del mantenedor (archivo de contenido validado),
  nunca por un formulario público.
- **No hay registro abierto, ni autoservicio, ni cuentas públicas.** La identidad de
  los invitados (proveedor, verificación de correo, MFA) queda pendiente de D-1.

## 3. Dos tipos de contribución

Las contribuciones se declaran **como original o como adaptación, nunca mezcladas**
(plan §16.4). Una guía que combine material propio y material de terceros se trata
como adaptación y cumple sus requisitos completos.

| Aspecto                     | Original                                                                                        | Adaptación                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Qué atestigua el autor      | Que es autor y titular, y que no incluye material de terceros ni activos del juego sin derechos | Lo mismo, y además que la fuente, el permiso o la licencia son reales y cubren la adaptación                                           |
| Evidencia que se exige      | Atestación firmada, aceptación de términos con versión, fecha y huella                          | Lo anterior, más fuente (URL, título, autor, sitio, fecha) y evidencia que cubra expresamente adaptación o republicación (plan §15)    |
| Quién verifica              | Editor de contenido y moderador, que comprueba indicios de plagio                               | Verificador de derechos **distinto del editor** de la adaptación, con la evidencia revisada                                            |
| `rights_status` resultante  | `own_original` propuesto                                                                        | Solo el que cubra la evidencia revisada (`licensed` o `permission_granted`); si no hay evidencia revisada, no se envía como adaptación |
| Qué se publica              | La guía, con autor y procedencia                                                                | La guía, con atribución prominente (FR-28, FR-29) y alcance de la transformación                                                       |
| Si falta evidencia revisada | No aplica                                                                                       | **No se puede enviar como adaptación.** Solo cabe `link_only`: título, autor, sitio, URL, fecha y datos factuales propios (FR-30)      |

## 4. Atestación explícita (FR-39)

Cada envío lleva una atestación firmada con las declaraciones literales siguientes.
Los elementos mínimos son:

1. Identidad o alias del autor, tal como figura en `authors`.
2. Declaración de que el autor es **autor y titular** de la guía (en original) o de
   sus aportaciones propias (en adaptación).
3. **Licencia de contribución** que el autor concede al sitio. Su contenido y alcance
   se fijan en D-2 (pendiente); este documento no define ninguna licencia.
4. Garantía de que la guía **no incluye material de terceros** (textos, imágenes,
   tiers, activos) sin derechos registrados, ni activos oficiales del juego sin
   estado `approved` (VII).
5. Aceptación de la **versión de los términos** vigente, con fecha y huella del texto
   aceptado.
6. Consentimiento para la **retirada**: el sitio puede despublicar la guía según el
   [runbook de retirada](takedown-runbook.md).

Reglas de la atestación:

- **El silencio no es atestación.** No se presume aceptación por enviar sin marcar.
- Una atestación **sin firma o sin registro** se **rechaza**.
- La atestación se conserva con la versión de los términos y la huella, para poder
  reconstruir qué se aceptó y cuándo.

## 5. Procedencia (FR-40)

Cada guía comunitaria registra:

- **tipo**: `original` o `adaptacion`;
- **fuentes y referencias**: en original, pueden citarse referencias sin copiarlas;
  en adaptación, las fuentes de la sección 3;
- **autor**, **fecha** y **versión del juego**;
- **alcance de la transformación**: qué se ha reexpresado y qué no.

Las adaptaciones heredan la atribución prominente de FR-28 y FR-29. Esa atribución
**nunca sustituye** al permiso (constitución I y VII).

## 6. Flujo de envío y revisión (plan §16.3)

Estados de una guía:

`borrador` → `enviada` → `en_revision_editor` → `cambios_solicitados` | `aprobada` → `publicado`

Estados terminales o alternos: `rechazada` y `retirada`.

| Estado                | Quién actúa                                              | Efecto                                                                                                    |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `borrador`            | Autor (solo el propio autor, y moderadores o editores)   | Visible solo para el autor y el equipo; no es público                                                     |
| `enviada`             | Autor, con atestación                                    | Congela una versión N inmutable; no se puede editar                                                       |
| `en_revision_editor`  | Editor de contenido, distinto del autor                  | Revisión de contenido y juego; si es adaptación, verificación de derechos por alguien distinto del editor |
| `cambios_solicitados` | Editor, con motivo                                       | Vuelve al autor. Un nuevo envío crea otra versión congelada                                               |
| `aprobada`            | Editor, distinto del autor                               | Lista para publicar; requiere `rights_status` aprobado (constitución I)                                   |
| `publicado`           | Equipo editorial, nunca el autor                         | Aparece en las vistas públicas solo como versión concreta aprobada (FR-45)                                |
| `rechazada`           | Editor o moderador                                       | Terminal. Motivo registrado; la guía no se publica                                                        |
| `retirada`            | Autor (la propia) o moderador (cautelar o por solicitud) | Terminal. Despublicación según el runbook; el contenido no se reutiliza                                   |

Reglas de separación y auditoría:

- **El aprobador es distinto del autor.** Nadie aprueba su propia guía (FR-41).
- **El verificador de derechos es distinto del editor de la adaptación.**
- **Cada transición se audita** con quién, cuándo y qué cambió (FR-44).
- **Nunca hay autopublicación.** Ninguna guía pasa a `publicado` sin revisión.

## 7. Retirada y reportes

- El **autor** puede retirar su guía en cualquier momento (FR-42).
- Un **moderador** puede despublicar cautelarmente una guía ante una denuncia creíble,
  sin esperar a la conclusión de la revisión.
- Toda retirada aplica el [runbook de retirada](takedown-runbook.md). Su objetivo
  operativo es despublicar en **≤ 72 h** desde que la solicitud es verificable. Es un
  objetivo del proyecto, **no una garantía legal**.
- El canal de reporte y retirada es **GitHub Issues**:
  [github.com/frxncismor/grim-dawn-builds/issues](https://github.com/frxncismor/grim-dawn-builds/issues).
  No hay correo, formulario ni SLA distintos de los que fije el runbook. Los SLA de
  revisión y de retirada siguen pendientes de D-3.

## 8. Derechos de terceros y activos

- **La atribución nunca sustituye al permiso.** «Adaptado de» es obligatorio, pero no
  concede derechos.
- No se copian textos, imágenes ni activos de terceros ni de Grim Dawn sin permiso
  registrado (constitución II y VII).
- No se elude ningún control de acceso: inicio de sesión, muros, captchas, límites de
  uso, `robots.txt` ni términos que lo prohíban.
- El **foro de Grim Dawn** sigue en estado `pending`: es fuente candidata, no
  habilitada. Su evaluación está en [forum-source-assessment.md](forum-source-assessment.md).
- Las fuentes y su estado se rigen por [source-policy.md](source-policy.md) y los
  cambios en las fuentes por [source-change-review.md](source-change-review.md).

## 9. Qué no se hace en el MVP

- No hay cuentas, autenticación ni autoservicio.
- No hay editor público ni comentarios.
- No hay importación automática ni scraping.
- No se prometen remuneraciones.
- No se garantiza la publicación de ninguna contribución.

## 10. Solicitud de permiso

Si una contribución necesita permiso de un tercero, la solicitud se hace con la
[plantilla de solicitud de permiso](permission-request-template.md). Nada se envía sin
autorización del mantenedor, y un permiso que no quede por escrito no cuenta.

## 11. Decisiones pendientes (D-1 a D-6)

Ninguna de estas decisiones está resuelta en este documento. Cada una afecta a una
parte concreta del borrador.

| ID  | Decisión                                 | Estado    | Efecto sobre este documento                                                                 |
| --- | ---------------------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| D-1 | Proveedor de identidad                   | pendiente | Sección 2: cómo se identifica a un invitado. Sin cuentas hasta decidirlo                    |
| D-2 | Términos del colaborador y licencia      | pendiente | Sección 4: contenido y alcance de la licencia de contribución y de la licencia de las guías |
| D-3 | Equipo de moderación y SLA               | pendiente | Secciones 6 y 7: quién modera, SLA de revisión y de retirada, escalado                      |
| D-4 | Sanitización y formato del texto         | pendiente | Sección 5: formato de la guía. El texto se mantiene dentro de un subconjunto seguro         |
| D-5 | Almacenamiento y retención de evidencias | pendiente | Sección 4: dónde y cuánto tiempo se guardan la atestación y la evidencia de permiso         |
| D-6 | Cuotas y umbrales de abuso               | pendiente | Sección 9 y etapa E3: límites de envío y cuarentena. Sin valores fijados                    |

## 12. Base constitucional y documentos relacionados

Este borrador se apoya en la constitución
([`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)):

- **Principio I**: contenido editorial verificable y atribuido; todo tiene autor, fuente,
  estado de revisión y estado de derechos.
- **Principio II**: sin scraping automático en el MVP; la importación es editorial.
- **Principio VII**: legalidad y activos; los derechos no se presuponen y las adaptaciones
  exigen evidencia que las cubra.
- **Principio VIII**: simplicidad; la hoja de ruta comunitaria no implementa cuentas,
  autenticación, editor público ni comentarios en el MVP.

Documentos hermanos y de contexto:

- [`CONTRIBUTING.md`](../../CONTRIBUTING.md), secciones de contenido, derechos y
  procedencia, y de documentación Markdown.
- [`source-policy.md`](source-policy.md)
- [`permission-request-template.md`](permission-request-template.md)
- [`takedown-runbook.md`](takedown-runbook.md)
- [`source-change-review.md`](source-change-review.md)
- [`forum-source-assessment.md`](forum-source-assessment.md)
- [Plan §16](../../specs/001-mvp-guias-builds/plan.md) y
  [spec FR-34 a FR-45](../../specs/001-mvp-guias-builds/spec.md)
