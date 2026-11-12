# Procedimiento de revisión de cambios de la fuente (T-103)

Procedimiento operativo para vigilar si una fuente ya registrada cambia después de
haber sido evaluada, y para decidir qué hacer con lo publicado a partir de ella.
Se aplica a las clases A–F de [`source-policy.md`](source-policy.md).

Este documento **no habilita** ninguna fuente ni concede permiso. Solo describe cómo
se observa, registra y atiende un cambio. Una fuente se habilita únicamente como
indica [`source-policy.md`](source-policy.md) y la [plantilla de permiso](permission-request-template.md).

Principios aplicables (constitución, `.specify/memory/constitution.md`):

- **Principio I**: todo contenido tiene fuente, estado de revisión y estado de derechos.
- **Principio II**: no hay scraping automático en el MVP; la observación es humana.
- **Principio VII**: los derechos no se presuponen y una adaptación sigue sujeta a
  retirada y a revisión por cambios de la fuente.

## Disparadores

Una revisión se abre cuando ocurre alguno de estos casos:

1. **Al publicar una adaptación**: antes de publicar, y como primera referencia de
   la fuente.
2. **Revisión periódica**: por defecto cada **90 días** desde la última revisión
   registrada. El intervalo es ajustable por el mantenedor; cualquier cambio del
   intervalo debe justificarse por escrito en el expediente de la fuente.
3. **Revisión inmediata** ante:
   - un aviso del autor o del titular del sitio;
   - una solicitud de retirada, según [`takedown-runbook.md`](takedown-runbook.md);
   - una duda sobre si el contenido o sus términos siguen siendo los evaluados.

## Método de observación

La observación es **lectura humana** de la fuente por un editor. No se usan
scripts que descarguen, indexen o comparen páginas.

Si se usa una comprobación de enlace o HTTP (por ejemplo, para saber si una URL
responde), se cumplen **todas** estas condiciones:

- los términos del sitio la permiten;
- `robots.txt` no la prohíbe (y esta comprobación se registra solo como señal de
  acceso, nunca como permiso);
- no hay inicio de sesión ni se usan credenciales;
- no se atraviesan muros, captchas ni límites de uso;
- no se descarga ni se almacena contenido de la página, solo el código de estado y
  la fecha de la comprobación.

Quedan **prohibidos**: el scraping, la captura masiva de páginas, la extracción
automática de texto o imágenes y cualquier comprobación que eluda un control de
acceso. Si una comprobación no cumple estas condiciones, se hace a mano o no se hace.

## Huella editorial

Un cambio se detecta sin copiar el contenido. Se usan solo datos observables a mano:

| Señal                                                                        | Qué se registra                                   | Qué no se registra                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------- |
| Fecha de última edición visible en la página                                 | La fecha tal como aparece                         | El texto que la rodea                       |
| Recuento y estructura de secciones                                           | Número de secciones y su orden, en palabras clave | El texto de cada sección                    |
| Datos factuales concretos (p. ej. orden de puntos, versión del juego citada) | Valor observado y fecha de observación            | Captura, copia literal o imagen             |
| Hash de una captura privada                                                  | **Solo si existe una canalización aprobada**      | No aplica en el MVP: no existe canalización |

En el MVP **no existe canalización de capturas**, por lo que no se calcula ningún
hash de contenido. La huella se compone de la fecha visible y de los datos
factuales anteriores. Si una señal no está visible, se anota como «no visible»
y no se infiere.

## Registro de cambios (`source_change_events`)

Cada observación que encuentre un cambio, o que motive una revisión inmediata, se
registra con estos campos mínimos:

| Campo          | Contenido                                                               |
| -------------- | ----------------------------------------------------------------------- |
| `observado_el` | Fecha y hora de la observación                                          |
| `fuente`       | Identificador de la fuente en `content/sources/` y URL exacta           |
| `huella`       | Fecha de edición visible y/o datos factuales observados (sin contenido) |
| `tipo`         | `edicion`, `licencia`, `eliminacion` o `bloqueo`                        |
| `observador`   | Persona que observó (nombre o alias del editor)                         |
| `resultado`    | Decisión tomada y estado resultante (ver tabla de estados)              |

- `edicion`: la página cambió (fecha, secciones o datos factuales).
- `licencia`: cambian o desaparecen la licencia o el permiso indicados.
- `eliminacion`: la página ya no existe o no es accesible públicamente.
- `bloqueo`: la fuente exige registro, muro, captcha o prohíbe el uso.

La tabla `source_change_events` es **diseño** de
[plan §15.5](../../specs/001-mvp-guias-builds/plan.md) y del modelo de datos. **En el
MVP no existe base de datos para ella**: los eventos se registran en el repositorio o
en el expediente editorial de la fuente, con los mismos campos, hasta que exista la BD.

## Efecto sobre lo publicado

- Un cambio de cualquier tipo deja la fuente en **`revision_pendiente`** y abre una
  revisión editorial.
- **Lo publicado no se actualiza solo.** Ningún cambio observado modifica una build
  ni su atribución de forma automática; la decisión es editorial.
- Una **eliminación**, una **prohibición** o un **cambio de licencia** que deje sin
  cobertura la adaptación activa el [runbook de retirada](takedown-runbook.md).
- Una **revocación** del permiso pasa la fuente a `revocada` y exige despublicar
  según el mismo runbook.

## Separación de funciones

Según [plan §15.2](../../specs/001-mvp-guias-builds/plan.md):

- **El observador no es el aprobador.** Quien observa el cambio no decide si la
  adaptación sigue vigente.
- **El revisor de derechos no es el editor de la adaptación.** La revisión de la
  nueva evidencia la hace otra persona que la adaptación.

Si el proyecto solo tiene una persona disponible, se registra esa limitación en el
expediente y la decisión queda pendiente hasta que haya un revisor distinto.

## Estados

| Estado de la fuente  | Significado                                     | Efecto sobre lo publicado                                              |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| `vigente`            | Sin cambios observados desde la última revisión | Se mantiene lo publicado                                               |
| `revision_pendiente` | Cambio observado; revisión editorial en curso   | Se mantiene lo publicado hasta resolver la revisión                    |
| `revocada`           | El titular retiró el permiso                    | Despublicar según el runbook; _link-only_ solo si el titular lo acepta |
| `prohibida`          | Los términos o el titular lo impiden            | Sin cuerpo derivado; solo mención si el titular no lo prohíbe          |
| `eliminada`          | La fuente ya no existe o no es accesible        | Aplicar el runbook; conservar solo el registro mínimo                  |

Los estados `habilitada` y `limitada` siguen la definición de
[`source-policy.md`](source-policy.md). Un cambio nunca convierte una fuente en
`habilitada` por sí mismo.

## Lista de comprobación

- [ ] Disparador identificado y anotado (publicación, periodicidad, aviso, retirada o duda).
- [ ] Observación hecha a mano por un editor, sin scraping ni captura masiva.
- [ ] Si hubo comprobación HTTP: términos y `robots.txt` la permiten, sin login ni muros.
- [ ] Huella registrada (fecha visible y datos factuales), sin copiar contenido.
- [ ] Evento registrado en `source_change_events` (o su expediente en el MVP) con todos los campos.
- [ ] Estado de la fuente actualizado en `content/sources/`.
- [ ] Si hay cambio: revisión editorial abierta y lo publicado sin cambios automáticos.
- [ ] Si hay eliminación, prohibición o cambio de licencia: runbook de retirada aplicado.
- [ ] Observador distinto del aprobador, y revisor de derechos distinto del editor.
- [ ] Próxima revisión programada (90 días por defecto, o el intervalo justificado).

## Qué no se hace

- No se copia el texto, las imágenes ni los activos de la fuente al expediente.
- No se actualiza una build publicada solo porque la fuente cambió.
- No se presume que un cambio mantiene el permiso anterior.
- No se evade ningún control de acceso para observar un cambio.
- No se promete un plazo legal ni una garantía frente a terceros.
