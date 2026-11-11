# Runbook de retirada (_takedown_) (T-102)

Procedimiento para atender una solicitud de retirada de contenido. Tiene **prioridad
sobre cualquier otra tarea**: se atiende antes que seguir implementando.

Contexto: [`source-policy.md`](source-policy.md).

## Canal

**GitHub Issues del repositorio**: <https://github.com/frxncismor/grim-dawn-builds/issues>
(decisión del 2026-11-10).

El canal se usa para retiradas y contacto general. **No** hay correo, teléfono,
responsable legal ni SLA pactado: no se inventan ni se prometen. Si en el futuro se
define otro canal, se actualiza este documento y la página `/legal` en el mismo
cambio.

## Objetivo operativo

Despublicar el contenido afectado en **≤ 72 h** desde que la solicitud es verificable.
Es un objetivo operativo del proyecto, no una garantía contractual: no se presenta
como obligación legal.

## Procedimiento

1. **Registrar la solicitud.** Abrir una entrada con fecha y hora, canal, quien
   solicita, contenido afectado (URL y slug) y motivo. No copiar datos personales
   más allá del nombre de contacto.
2. **Verificar la legitimidad.** Comprobar que quien solicita es el titular o su
   representante. Si no se puede verificar, se responde pidiendo la información que
   falta, sin publicar la conversación.
3. **Despublicar primero, discutir después.** Ante duda razonable, se retira de
   inmediato. La carga de la prueba no recae en el titular.
4. **Elegir el grado de retirada:**
   - **Retirada total**: la página deja de existir, se elimina del sitemap y del
     JSON-LD.
   - **Degradación a _link-only_**: solo si el titular lo acepta expresamente;
     queda título, autor, sitio, URL, fecha y datos factuales propios.
   - **Corrección**: si el problema es un dato, se corrige y se documenta; no
     sustituye a la retirada cuando el titular pide retirar.
5. **Ejecutar el cambio** con el mismo rigor que cualquier otro: no editar la base
   de datos a mano sin registro, y dejar el cambio trazable.
6. **Invalidar derivados**: regenerar el build público, el sitemap y comprobar que
   no queda caché ni copia en `dist/`.
7. **Purgar capturas crudas** si existieran para esa fuente; no aplica al MVP,
   porque no hay canalización de ingesta activa.
8. **Responder** al solicitante indicando qué se hizo y desde cuándo.
9. **Registrar el cierre** con fecha, decisión y evidencia. Se conserva el registro
   mínimo necesario; no se conserva el contenido retirado.

## Qué se conserva como evidencia

| Se conserva                                   | No se conserva                         |
| --------------------------------------------- | -------------------------------------- |
| Fecha y hora de la solicitud y de la retirada | Texto copiado del contenido retirado   |
| Identificador del contenido afectado          | Datos personales más allá del contacto |
| Decisión tomada y su motivo                   | Capturas del contenido retirado        |
| Quién ejecutó la retirada                     | Conversaciones completas               |

## Estados y su efecto

| Estado de la fuente | Efecto en el contenido                                        |
| ------------------- | ------------------------------------------------------------- |
| `revocada`          | retirada total o _link-only_ acordado                         |
| `limitada`          | se ajusta el contenido a lo permitido                         |
| `prohibida`         | sin cuerpo derivado; solo mención si el titular no lo prohíbe |

## Lista de comprobación

- [ ] Solicitud registrada con fecha y contenido afectado.
- [ ] Titularidad verificada o duda razonable documentada.
- [ ] Contenido despublicado (no solo oculto en la UI).
- [ ] Ruta eliminada del build público y del sitemap.
- [ ] JSON-LD y metadatos sociales sin el contenido.
- [ ] `content/sources/` actualizado al estado correspondiente.
- [ ] Respuesta enviada al solicitante.
- [ ] Cierre registrado y contenido no retirado en ningún artefacto.

## Qué no se hace

- No se promete un plazo legal ni una indemnización.
- No se responde con datos personales de terceros.
- No se deja el contenido publicado «mientras se investiga».
- No se reutiliza el contenido retirado en otra entrada.
