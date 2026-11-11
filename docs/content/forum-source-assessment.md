# Evaluación del foro de Grim Dawn como fuente candidata (T-103)

Evaluación del foro de Grim Dawn como **fuente candidata** de clase E según
[`source-policy.md`](source-policy.md). Es un documento de proceso: **no** registra
ninguna evaluación completada ni autoriza el uso de ninguna publicación.

Principios aplicables (constitución, `.specify/memory/constitution.md`):

- **Principio I**: toda guía tiene autor, fuente, estado de revisión y estado de derechos.
- **Principio II**: no hay scraping automático ni importación masiva; la lectura es humana.
- **Principio VII**: los derechos no se presuponen; una adaptación requiere evidencia que la cubra.

## Estado actual

| Elemento                          | Estado                                     |
| --------------------------------- | ------------------------------------------ |
| Estado de la fuente (foro)        | **`pending`**                              |
| Permiso del foro o de sus autores | **Ninguno registrado**                     |
| Reutilización de publicaciones    | **No permitida**                           |
| Acceso permitido al foro          | Solo lectura humana por un editor          |
| Evaluación de términos del foro   | **Pendiente**: no hay evidencia registrada |
| Evaluación de derechos por autor  | **Pendiente**: no hay autores evaluados    |

Mientras la fuente esté en `pending`, la única salida permitida es una tarjeta
_link-only_ con metadatos factuales verificados a mano (título, autor, sitio, URL,
fecha y datos factuales propios). Sin cuerpo de guía, imágenes, activos ni rankings
derivados.

## Regla del doble filtro

Una publicación del foro solo puede reutilizarse si pasan **los dos** filtros:

1. **Términos del sitio o del foro.** Los términos de uso y la política de contenido
   del foro deben permitir el uso previsto (adaptación, traducción, republicación).
   Si los términos lo impiden, la fuente pasa a `prohibida` y se detiene el proceso.
2. **Derechos de cada autor, por separado.** El permiso o la licencia de un autor
   cubre **solo** sus propias publicaciones y solo el alcance que indique. El permiso
   de un autor **no cubre** a otro autor, ni a otro post del mismo autor sin
   evidencia propia.

Reglas de evidencia:

- Una licencia, una firma, un perfil o una frase en el post solo se registran como
  evidencia si son **explícitos** y se citan literalmente con su enlace y fecha.
- Una publicación pública **no** es reutilizable por ser pública.
- El silencio, la ausencia de prohibición o un `robots.txt` permisivo **no** son permiso.
- Si la licencia indicada no cubre derivados (p. ej. «no derivatives»), el resultado
  es solo _link-only_.
- Términos del foro y permiso del autor se evalúan por separado; **el más restrictivo prevalece**.

## Qué leer y registrar antes de cualquier solicitud

Estas comprobaciones se hacen a mano. Ninguna se da por realizada hasta que quede
registrada con fecha y referencia.

- [ ] Términos de uso del foro: texto vigente, fecha de consulta y enlace exacto.
- [ ] Política de contenido del foro: qué se puede reproducir, traducir o derivar.
- [ ] Política de contacto del foro: canal oficial para pedir permiso.
- [ ] Condiciones sobre reproducción, traducción y obras derivadas.
- [ ] Estado de `robots.txt`, registrado **solo como señal de acceso**. Un `robots.txt`
      permisivo no equivale a permiso de uso.
- [ ] Por cada autor candidato: licencia o permiso indicado en el post, firma y perfil,
      solo si son explícitos.

## Solicitud de permiso

Antes de enviar cualquier solicitud se aplican [`permission-request-template.md`](permission-request-template.md)
y el paso 2 del flujo de [`source-policy.md`](source-policy.md): los términos
revisados y el titular identificado. Nada se envía sin autorización del mantenedor.
Una solicitud no se envía a un autor cuyo post no haya sido evaluado en la tabla de
abajo.

## Tabla de evaluación por autor

Una fila por autor y post candidato. Las filas se añaden solo cuando hay evidencia
verificada a mano.

| Autor         | Enlace al post | Licencia o permiso indicado | Alcance | Evidencia (fecha y referencia) | Estado    |
| ------------- | -------------- | --------------------------- | ------- | ------------------------------ | --------- |
| _sin evaluar_ |                |                             |         |                                | `pending` |

## Resultado posible

| Resultado   | Cuándo se aplica                                                                                    | Efecto                                              |
| ----------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `pending`   | Por defecto. Sin evaluación completa o sin evidencia registrada.                                    | Solo tarjeta _link-only_ con metadatos propios.     |
| `limitada`  | Solo con permiso **explícito, por autor y por alcance**, con condiciones escritas en el expediente. | Solo lo concedido, en las condiciones escritas.     |
| `prohibida` | Los términos del foro impiden el uso.                                                               | Sin cuerpo derivado; solo mención si no se prohíbe. |

Un resultado `limitada` no se extiende a otros autores ni a otros posts del foro.

Si un permiso concedido se **revoca**, la fuente pasa a `revocada` y se aplica el
[runbook de retirada](takedown-runbook.md): despublicar y, si el titular lo acepta,
degradar a _link-only_. Los cambios posteriores de los posts o de los términos siguen
[`source-change-review.md`](source-change-review.md).

## Lo que este documento no hace

- No registra términos concretos del foro ni los cita: esa lectura está pendiente.
- No contiene URLs de posts, nombres de autores ni correos de contacto verificados.
- No afirma que la evaluación de términos ni de derechos ya se haya realizado.
- No habilita el uso de ninguna publicación ni concede permiso alguno.
- No automatiza el acceso al foro ni prevé scraping.
