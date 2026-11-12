# Política de fuentes (T-091)

Regla que gobierna este documento: **una fuente no es reutilizable por ser
pública**. El permiso es explícito, por fuente y por alcance. El silencio, la
ausencia de una prohibición o un `robots.txt` permisivo **no** son permiso.
(Constitución I, II y VII.)

## Estados de una fuente

| Estado       | Significado                                                                       | Qué permite                                         |
| ------------ | --------------------------------------------------------------------------------- | --------------------------------------------------- |
| `pending`    | registrada, sin evaluar                                                           | nada; solo lectura humana para evaluar              |
| `evaluando`  | términos y derechos en revisión                                                   | nada                                                |
| `habilitada` | permiso o licencia registrado y verificado, con alcance que cubre el uso previsto | lo que el permiso cubra, y nada más                 |
| `limitada`   | permiso parcial o condicionado                                                    | solo lo concedido, con la condición escrita         |
| `revocada`   | el titular retiró el permiso                                                      | despublicar y aplicar el runbook de retirada        |
| `prohibida`  | términos o decisión del titular lo impiden                                        | solo mención con enlace si el titular no lo prohíbe |

Una fuente `habilitada` **no** autoriza a otras fuentes de su misma clase.

## Clases de fuente

| Clase | Qué es                                                          | Quién aprueba                            | Evidencia mínima                                                       |
| ----- | --------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| **A** | Obra propia del mantenedor                                      | mantenedor                               | declaración de autoría con fecha                                       |
| **B** | Licencia abierta explícita (p. ej. CC BY, MIT)                  | mantenedor                               | enlace a la licencia y versión, y confirmación de que cubre adaptación |
| **C** | Permiso escrito del autor o del sitio                           | mantenedor + revisor distinto del editor | mensaje o documento con alcance, fecha y vigencia                      |
| **D** | Documentación y datos oficiales del juego                       | mantenedor                               | términos del titular y alcance permitido                               |
| **E** | Agregadores y guías de terceros (incluido el foro de Grim Dawn) | mantenedor + revisor de derechos         | evaluación de términos **y** derechos de cada autor por separado       |
| **F** | Contenido sin derechos identificables                           | no se aprueba                            | no aplica: solo _link-only_                                            |

La clase **E** es la más delicada: que una publicación sea pública no la hace
reutilizable, y el permiso de un autor no cubre a otro.

## Flujo de solicitud

1. Registrar la fuente en `content/sources/` con estado `pending` y la URL exacta.
2. Evaluar términos de uso y `robots.txt`. Si prohíben el uso, la fuente pasa a
   `prohibida` y se detiene aquí.
3. Enviar la solicitud con la plantilla
   [`permission-request-template.md`](permission-request-template.md). No se envía
   nada a terceros sin autorización del mantenedor.
4. Registrar la respuesta como evidencia: tipo, referencia, alcance, fecha y
   vigencia.
5. Verificar que el alcance cubre **exactamente** el uso previsto (adaptación,
   traducción, republicación, imágenes).
6. Solo entonces la fuente pasa a `habilitada` o `limitada`.

Sin los pasos 4 y 5, la fuente sigue en `evaluando` y no se publica nada derivado.

## Reglas operativas

- **Atribución obligatoria y nunca suficiente.** «Esta build fue adaptada de: …» es
  necesario, no es permiso.
- **Sin derechos confirmados**: solo tarjeta _link-only_ con título, autor, sitio,
  URL, fecha y datos factuales verificados de forma independiente. Sin texto,
  imágenes ni rankings derivados.
- **Prohibido** eludir controles de acceso, muros, captchas o límites, y raspar
  sitios que lo prohíban.
- **El foro de Grim Dawn es fuente candidata**, no habilitada: requiere evaluar sus
  términos y los derechos de cada autor por separado.
- **Revocación**: cualquier retirada se atiende con el
  [runbook](takedown-runbook.md) y tiene prioridad sobre cualquier otra tarea.

## Guardia automática (`check-scope`, T-109)

`pnpm check:scope` falla si el código de la aplicación o de la ingesta contiene
una llamada HTTP automatizada a un host que no sea el propio del proyecto
(`external-source-access`), y si un registro de `content/sources/` figura
`habilitada` o `limitada` sin evidencia completa (`source-rights-gate`). Un
registro sin `status` se trata como `pending` y no se marca.

La regla de acceso admite **una excepción explícita y acotada**: un comentario en
la misma línea de la llamada, o en la inmediatamente anterior, con el marcador
`check-scope:external-http-ok` y un motivo de al menos 10 caracteres. Sin motivo
válido, el marcador no exime. La excepción justifica tooling de desarrollo (por
ejemplo, descargar un binario fijado) y **nunca** sustituye al permiso de una
fuente.

## Trazabilidad

Cada fuente habilitada debe poder responder: quién la aprobó, con qué evidencia,
para qué alcance, hasta cuándo y quién la revisó por última vez. Si falta una de
esas respuestas, la fuente no está habilitada.
