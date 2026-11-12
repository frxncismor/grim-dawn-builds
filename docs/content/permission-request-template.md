# Plantilla de solicitud de permiso (T-101)

Plantilla para pedir permiso a un autor o sitio antes de adaptar o republicar su
contenido. **Nunca se envía sin autorización del mantenedor**, y un permiso
implícito, tácito o condicionado verbalmente no cuenta: se registra por escrito.

Contexto y reglas: [`source-policy.md`](source-policy.md).

## Antes de enviar

- [ ] La fuente está registrada en `content/sources/` con estado `pending`.
- [ ] Se revisaron sus términos de uso y `robots.txt`.
- [ ] Se identificó al titular real (autor de la guía, no solo del sitio).
- [ ] El mantenedor autorizó el envío.
- [ ] Queda claro qué se pide exactamente y para qué.

## Cuerpo del mensaje (español)

```text
Asunto: Solicitud de permiso para adaptar «<título de la guía>»

Hola <nombre>:

Te escribo de Grim Dawn Builds (https://github.com/frxncismor/grim-dawn-builds),
un proyecto sin ánimo de lucro, no afiliado a Crate Entertainment ni a GrimTools.

Me gustaría solicitar tu permiso para:

1. Adaptar tu guía «<título>» (<URL>) al formato interactivo del proyecto.
2. Traducirla al español, si corresponde.
3. Republicar sus datos factuales (maestrías, habilidades, orden de puntos,
   devociones) junto con una atribución visible a tu persona y un enlace a la
   guía original.

Alcance que solicito:
- Uso: <adaptación / traducción / republicación / imágenes>.
- Atribución: «Esta build fue adaptada de: <título> de <autor> en <sitio>»,
  visible en la página y en los datos estructurados.
- Vigencia: <indefinida / N años / hasta que la revoques>.
- Retirada: si en cualquier momento lo pides, el contenido se despublica y se
  aplica el procedimiento de retirada del proyecto.

Qué NO haré: no copiaré tus imágenes ni tu texto literal, no afirmaré autoría
propia y no presentaré la adaptación como contenido verificado si no lo está.

¿Me confirmas si lo autorizas, con qué alcance y con qué condiciones?

Gracias por tu tiempo.
<firma>
```

## Message body (English)

```text
Subject: Permission request to adapt "<guide title>"

Hi <name>,

I am writing from Grim Dawn Builds
(https://github.com/frxncismor/grim-dawn-builds), a non-commercial project that is
not affiliated with Crate Entertainment or GrimTools.

I would like to ask for your permission to:

1. Adapt your guide "<title>" (<URL>) into the project's interactive format.
2. Translate it into Spanish where applicable.
3. Republish its factual data (masteries, skills, point order, devotions) together
   with visible attribution to you and a link to the original guide.

Requested scope:
- Use: <adaptation / translation / republishing / images>.
- Attribution: "This build was adapted from: <title> by <author> on <site>",
  visible on the page and in structured data.
- Term: <perpetual / N years / until revoked>.
- Withdrawal: at any time you can ask for removal and the project will unpublish it
  and apply its takedown procedure.

What I will not do: copy your images or your verbatim text, claim authorship, or
present the adaptation as verified content when it is not.

Could you confirm whether you grant this permission, with which scope and
conditions?

Thank you for your time.
<signature>
```

## Registro de la respuesta

Rellenar cuando llegue la respuesta. Sin estos campos la fuente sigue en
`evaluando`.

| Campo                                                | Valor |
| ---------------------------------------------------- | ----- |
| Fecha de la solicitud                                |       |
| Fecha de la respuesta                                |       |
| Titular que responde                                 |       |
| Canal de la respuesta (y referencia)                 |       |
| Decisión (`concedido` / `denegado` / `condicionado`) |       |
| Alcance concedido                                    |       |
| Condiciones impuestas                                |       |
| Vigencia                                             |       |
| Cómo se retira                                       |       |
| Revisor que valida la evidencia                      |       |
| Revisor distinto del editor de la adaptación         |       |

## Reglas de cierre

- **Concedido y con alcance suficiente**: la fuente pasa a `habilitada`.
- **Concedido con condiciones**: pasa a `limitada`; las condiciones se escriben en
  la ficha de la fuente y se respetan literalmente.
- **Denegado o sin respuesta**: solo _link-only_, o nada.
- **Silencio**: no es permiso. Se documenta como `pending` y no se publica.
- La atribución se implementa siempre, incluso con permiso concedido.
