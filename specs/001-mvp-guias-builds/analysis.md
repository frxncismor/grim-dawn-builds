# Análisis de consistencia — 001-mvp-guias-builds (spec ↔ plan ↔ tasks ↔ constitución)

**Adenda rev. 8 (markdownlint obligatorio)**: Constitución v1.8.0 (Restricciones tecnológicas), spec FR-46/AC-26, plan §12.14 + R-M12 (y mención en la lista de checks de CI de §12.8), tasks §8.10 (T-123; T-064 y T-076 ajustadas). **0 CRITICAL · 0 HIGH · 2 MEDIUM · 2 LOW.** Fases 0–7 y MVP sin cambios.

| ID  | Sev.   | Hallazgo                                                                                                                                                                         | Acción                                                                                                              |
| --- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| M1  | MEDIUM | Los artefactos actuales (una línea por tarea, tablas compactas `\|---\|`, tablas pegadas al párrafo anterior en `analysis.md`) probablemente infringen MD013/MD058/MD060 y otras | T-123 corrige con `--fix` + manual; MD013 (y MD060 si aplica) únicas relajaciones, con motivo escrito (plan §12.14) |
| M2  | MEDIUM | Riesgo de debilitar la config para «pasar» el lint                                                                                                                               | R-M12; criterio (e) de T-123: solo MD013/MD060; revisión en PR                                                      |
| L1  | LOW    | Cambio previo no solicitado en `plan.md` (solo espaciado de tablas)                                                                                                              | Conservado y validado por T-123; sin impacto semántico                                                              |
| L2  | LOW    | Plantillas de Spec Kit en `.specify/` pueden infringir reglas                                                                                                                    | Corregir plantilla o excepción puntual comentada; nunca desactivación global                                        |

Cobertura: FR-46→T-123, T-064, T-076; AC-26→T-123 (a–i); Constitución (calidad de documentación)→T-123. **Implementable ya**; ninguna dependencia nueva de decisión del usuario. Prettier se mantiene; markdownlint prevalece en `.md`. Pendiente solo de configuración manual: marcar el check `lint:md`/CI como requerido en la protección de ramas.

**Adenda rev. 7 (guías comunitarias, futuro)**: Constitución v1.7.0 (VIII), spec US7, FR-34–FR-45, AC-24/AC-25, plan §16, data-model «Guías comunitarias» (diferido), tasks §8.9 (T-111–T-122). **0 CRITICAL · 0 HIGH · 3 MEDIUM · 1 LOW.** MVP intacto: sin cuentas públicas, editor ni comentarios.

| ID  | Sev.   | Hallazgo                                                                                             | Acción                               |
| --- | ------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------ |
| C1  | MEDIUM | D-1 (identidad), D-2 (términos/licencia) y D-3 (moderación/SLA) sin decidir; `[NEEDS CLARIFICATION]` | Bloquean T-114–T-122; no el MVP      |
| C2  | MEDIUM | Auth externo y cuentas contradicen hoy VIII/XI                                                       | Requiere enmienda al activar E2      |
| C3  | MEDIUM | Capacidad de moderación humana es el cuello de botella y riesgo legal                                | Empezar por E1 (invitados)           |
| C4  | LOW    | Términos del colaborador son borrador sin revisión legal                                             | T-111 lo marca; revisión recomendada |

**Implementable ya**: T-111, T-112, T-113 (y rev. 6: T-101–T-107, T-109). **Bloqueado**: T-114–T-122 (decisiones + enmienda + spec por etapa), T-108 (tras Fase 8), T-110 (permiso externo), ingesta T-092–T-100.

**Adenda rev. 6 (builds adaptadas, derechos y atribución)**: Constitución v1.6.0 (I/II/VII), spec US6, FR-27–FR-33, AC-20–AC-23, fuera de alcance; plan §15; data-model «Adaptaciones de terceros»; tasks §8.8 (T-101–T-110). **0 CRITICAL · 0 HIGH · 3 MEDIUM · 2 LOW.**
Reconciliación: el deseo del usuario (adaptar builds del foro con «Esta build fue adaptada de: …») se admite **solo** con licencia/permiso que cubra adaptación; atribución ≠ permiso; sin derechos ⇒ _link-only_ (sin cuerpo/imágenes/ranking). Coherente con FR-26, plan §14 (clases A–F; adaptación = A/B/C con evidencia) y AC-19.

| ID  | Sev.   | Hallazgo                                                                                                  | Acción                                                                          |
| --- | ------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| D1  | MEDIUM | Términos del foro y derechos por autor sin evaluar; probable que casi todo quede _link-only_              | T-103; T-110 bloqueada; `[NEEDS CLARIFICATION]` abierta al usuario              |
| D2  | MEDIUM | Plazo de retirada (72 h), cadencia de revisión (90 d) y canal de contacto son supuestos                   | Confirmar con el usuario (plan §15.4/15.5)                                      |
| D3  | MEDIUM | Aviso legal: este diseño no es asesoría jurídica; la interpretación de licencias requiere criterio humano | Revisión humana en la puerta (§15.2); considerar asesoría                       |
| D4  | LOW    | Conflicto potencial entre «adaptación» y `tier_entries` (rankings de terceros)                            | FR-30: sin ranking derivado en _link-only_; tier propio exige evaluación propia |
| D5  | LOW    | Nuevas tablas dependen de Fase 8 (BD)                                                                     | T-104/T-107 en dominio primero; T-108 después                                   |

**Implementable ya**: T-101–T-107, T-109 (docs, dominio, UI con fixtures sintéticos, `check-scope`). **Tras Fase 8**: T-108. **Bloqueado**: T-110 (primera adaptación real; requiere permiso), toda ingesta automatizada/masiva y cualquier acceso automatizado al foro (T-092–T-100).

**Adenda rev. 5b (hoja de ruta de ingesta)**: Constitución v1.5.0 (II), spec FR-26/AC-19/fuera de alcance, plan §14 + R-M10, data-model (cambios diferidos), tasks §8.7 (T-091–T-100, solo T-091 y T-069b implementables). Sin CRITICAL/HIGH. I1 MEDIUM: fuentes concretas y permisos sin decidir (`[NEEDS CLARIFICATION]`, plan §14.4), no bloquea el MVP. I2 LOW: el riesgo de que «hoja de ruta» se lea como permiso se mitiga con AC-19 y T-069b.

**Adenda rev. 5 (secretos)**: 0 CRITICAL · 0 HIGH · 2 MEDIUM · 2 LOW. Cambios: Constitución v1.4.0 (nuevo XII; precisión en XI), spec FR-25/AC-18, plan §13 y R-M9, data-model (credenciales por rol), tasks §8.6 (T-078–T-090; T-066a, T-056 ajustadas). Cobertura: FR-25/AC-18→T-066a, T-078–T-086; diferidas T-087–T-090.

| ID  | Sev.   | Hallazgo                                                                          | Acción                                                                                              |
| --- | ------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| S1  | MEDIUM | Contradicción previa «`.env.example` sin valores» vs. valores seguros por defecto | Resuelto: valores no secretos permitidos, campos secretos vacíos (XI, plan §11/§12.7, T-066a/T-080) |
| S2  | MEDIUM | T-056 (Compose) podría cerrarse sin separación de credenciales                    | T-056b obligatoria; Compose no se considera terminado sin ella                                      |
| S3  | LOW    | Herramienta de escaneo (gitleaks vs equivalente) y umbrales sin fijar             | Se fija en T-083                                                                                    |
| S4  | LOW    | Vault autoalojado: recomendación «no todavía» (plan §13.9); proveedor sin decidir | Reevaluar al decidir hosting; requiere enmienda                                                     |

Acciones manuales del usuario: _secret scanning_ + _push protection_ de GitHub.

**Resultado (rev. 4)**: 0 CRITICAL · 0 HIGH · 4 MEDIUM · 3 LOW. Cambios: Constitución v1.3.1 (BD = única fuente de verdad; Fastify/Drizzle/Node 22 LTS/PostgreSQL 17; release solo desde API; política `mvp/1` → `develop` → `main` con pruebas, lint, DAST y Copilot), spec FR-22–FR-24/AC-15–AC-17 (AC-11 reescrito; A12/A13 reemplazadas), plan §12.5–12.5c/12.9/12.10, data-model «rev. 4», tasks Fase 8 reordenada (T-071–T-077 nuevas; T-007/T-008/T-011/T-013 reemplazadas). Fases 0–7 no cambian. **Implementables ya**: todas las de Fase 8 salvo T-061 (B-5) y T-072 (B-7).

## Hallazgos rev. 4

| ID  | Sev.   | Hallazgo                                                                                                    | Acción                                                                                                                          |
| --- | ------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R1  | MEDIUM | B-7: no hay vía de escritura editorial tras el cutover (CLI `editor` vs API admin)                          | Bloquea solo T-072 y la edición de producción; sin cutover no hay «producción» (local-first), por lo que no existen dos fuentes |
| R2  | MEDIUM | Riesgo de dos fuentes: fixtures y BD                                                                        | Mitigado: dos modos (`fixture` solo dev/test, `api` único release), T-074/AC-16, bloqueo post-bootstrap (T-059/T-072/AC-17)     |
| R3  | MEDIUM | Puertas duplicadas en Zod y SQL (deriva)                                                                    | T-058 (paridad + `drizzle-kit generate` sin diff) y T-073 (pruebas SQL)                                                         |
| R4  | MEDIUM | Constitución IV: nuevas dependencias (`fastify`, `drizzle-orm`, `drizzle-kit`, driver pg)                   | Justificadas en plan §12.2; solo en `apps/api`; sin `drizzle-zod`                                                               |
| R5  | LOW    | Tags/digests exactos de `node:22` y `postgres:17` no fijados aún                                            | Fijar en T-054/T-056                                                                                                            |
| R6  | LOW    | Herramienta y umbral de DAST sin elegir; revisión de Copilot y protección de ramas son configuración manual | T-077 y acción del usuario (T-064/T-076)                                                                                        |
| R7  | LOW    | AC-11 ya no implica «sitio público idéntico sin API»: el release exige API                                  | Aceptado; el desarrollo sin Docker sigue con `fixture`                                                                          |

Cobertura nueva: FR-22→T-059, T-072, T-074; FR-23→T-055, T-073; FR-24→T-057, T-059, T-072; AC-15→T-073; AC-16→T-074; AC-17→T-059, T-068; política de ramas→T-064, T-076, T-077. Principios VI y XI→T-058, T-062, T-074; VII (activos)→T-055/T-073; IV→R4.

## Bloqueos y supuestos

- **Abiertos**: B-5 (CORS, T-061); B-7 (vía de escritura editorial, T-072). **Externos ya existentes**: derechos de la guía (T-044). **Manuales del usuario**: protección de ramas, revisión obligatoria de Copilot.
- **Cerrados por el usuario**: Fastify, Drizzle, Node 22 LTS, PostgreSQL 17, BD = fuente de verdad, política de ramas.
- **Supuestos**: nombres `@gd/*`; roles `migrator`/`importer`/`editor`/`api_ro`; presupuestos §12.12 provisionales; ZAP baseline como candidato DAST.

---

## Análisis previo (rev. 3, histórico)

**Resultado (rev. 3)**: 0 CRITICAL · 0 HIGH · 5 MEDIUM · 4 LOW. Los hallazgos N1–N4 (framework, acceso a datos, versiones, proyección vs fuente de verdad) quedaron **cerrados en rev. 4**; N5 desaparece (Supabase descartado). Añadido: monorepo pnpm + backend en Docker (Constitución v1.2.0, spec FR-18–FR-21/AC-11–AC-14, plan §12, data-model «Backend y propiedad de datos», tasks Fase 8 T-050–T-070). Las Fases 0–7 no cambian y no dependen de la Fase 8. **Implementables ya**: T-050, T-051, T-052, T-063, T-064, T-066a, T-069, T-070 (parcial). **Diferidas por decisión abierta**: T-053–T-062, T-065, T-066b, T-068. T-067 (mover la web) opcional en PR dedicado.

## Hallazgos rev. 3

| ID  | Sev.   | Hallazgo                                                                                         | Acción                                                                                                     |
| --- | ------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| N1  | MEDIUM | Framework (Fastify/NestJS) no decidido (B-1)                                                     | Bloquea solo T-053+; no se asume                                                                           |
| N2  | MEDIUM | Acceso a datos/migraciones (B-2) y versiones Node/PostgreSQL (B-3) sin decidir                   | Bloquean T-054–T-058; elegir al implementar                                                                |
| N3  | MEDIUM | BD como proyección vs fuente de verdad (B-4/A13): riesgo de dos fuentes                          | Supuesto explícito + test de paridad T-058; confirmar con el usuario                                       |
| N4  | MEDIUM | Sin consumidor real de la API (B-6, R-M2): riesgo de sobreingeniería                             | Todo lo específico de la API queda tras la puerta B-6; lo agnóstico (dominio, CI, higiene) sí avanza       |
| N5  | LOW    | Posible duplicación `supabase/migrations/0001_init.sql` (T-007) vs migración del backend (T-055) | Mismo SQL o derivación comprobada (plan §12.7, data-model)                                                 |
| N6  | LOW    | Existía incoherencia «sin monorepo»/«sin workflows» en constitución/T-004/T-045                  | Corregida: VIII y XI, T-004 y plan §11 reconcilian CI de verificación (permitido) vs despliegue (diferido) |
| N7  | LOW    | Scripts reales usan `.mts` y `pnpm`, tareas antiguas dicen `.ts`/`npm`                           | Las tareas nuevas usan `pnpm`/`.mts`; las antiguas se leen como equivalentes                               |
| N8  | LOW    | Protección de ramas y GitFlow no son configurables desde el repo                                 | Acción manual del usuario; documentada en T-064                                                            |

Cobertura nueva: FR-18→T-060, T-062; FR-19→T-053, T-060; FR-20→T-054, T-056, T-061, T-066a/b; FR-21→T-051, T-067; AC-11→T-062, `pnpm verify`; AC-12→T-056, T-060; AC-13→T-063, T-060; AC-14→T-054, T-066b. Constitución XI→T-052, T-054, T-056, T-063, T-066. Principios II/VII/VIII preservados (T-069 impide Redis/colas/auth/object storage).

## Bloqueos y supuestos (rev. 3)

- **Bloqueos del usuario (solo API)**: B-1 framework, B-2 acceso a datos/migraciones, B-3 versiones, B-4 rol de la BD, B-5 CORS/publicación, B-6 necesidad de consumo desde la web. Ninguno bloquea el MVP local ni la Fase A.
- **Supuestos (no decisiones del usuario)**: nombres `@gd/*`; BD = proyección de `content/`; API solo lectura; roles de BD `migrator`/`importer`/`api_ro`; presupuestos de §12.12 provisionales.

---

## Análisis previo (rev. 2)

**Resultado (rev. 2)**: 0 CRITICAL · 0 HIGH · 3 MEDIUM · 3 LOW. Decisiones confirmadas incorporadas (spec §0): `guide_rights=pending`, `tierlist=all_builds`, `game_art=official_assets`, `hosting=local_first`. El desarrollo local puede empezar (T-001–T-043, T-046–T-048); **T-044** queda bloqueada solo para la publicación de la guía; **T-045** diferida.

## Cobertura

- US1→T-028–T-037; US2→T-016, T-022–T-025; US3→T-038; US4→T-036, T-039; US5→T-009, T-013, T-044, T-047. FR-01–FR-17 y AC-01–AC-10 tienen tarea (AC-08→T-046; AC-05→T-003, T-012, T-042; FR-13/AC-07/AC-09→T-005, T-006, T-010, T-014, T-021, T-037; FR-14/15→T-016, T-024; FR-16/AC-10→T-047, T-048; FR-17→T-004, T-045).
- Constitución v1.1.0: I (T-005/6, T-014, T-044), II (T-046), III (T-018, T-020, T-021), IV (T-003, T-042), V (T-041, T-043), VI (T-005/6), VII (T-047, T-048, T-016), VIII (T-046), IX (fases con TDD).

## Hallazgos

| ID  | Sev.          | Hallazgo                                                                                          | Acción                                                                                                       |
| --- | ------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| F1  | MEDIUM        | Autoría/derechos de la guía sin confirmar (`pending`)                                             | Bloquea solo publicación (T-044); gate técnico FR-13/AC-07/AC-09                                             |
| F2  | MEDIUM        | Catálogo completo depende de la lista vigente de maestrías y de procedencia por entrada           | Resuelto en diseño (placeholders + FR-15); verificar lista en T-016                                          |
| F3  | MEDIUM        | Afinidades de devoción no verificadas                                                             | `sin_verificar` visible; T-044 las revisa                                                                    |
| F4  | LOW           | Incoherencia «Viento Demoníaco» (prioridad 4 vs. orden de compra)                                 | Resolver en T-014                                                                                            |
| F5  | LOW           | Texto 9.5–11 px y contraste de `ash`                                                              | T-017                                                                                                        |
| F6  | LOW (cerrado) | Hosting no definido                                                                               | Decidido `local_first`; T-045 diferida; portabilidad en plan §11                                             |
| F7  | LOW           | Permisos concretos de arte oficial no aportados                                                   | No bloquea: fallback SVG hasta `approved` (T-047/T-048)                                                      |
| F8  | LOW           | Con `pending`, el build público no tiene ninguna guía publicada (home/tier list sin build propia) | Aceptado y especificado (home condicional, placeholders); la guía se verifica en modo local `INCLUDE_DRAFTS` |

## Pendientes

- **Verdaderos bloqueos**: ninguno para el desarrollo local. Bloqueo de publicación: confirmación de autoría/derechos de la guía (T-044).
- **No bloqueantes**: permisos de arte oficial; lista vigente de maestrías; fuentes/permisos para entradas de terceros del catálogo; futura decisión de hosting/secretos/CI (T-045, T-007/8/11/13 diferibles).
