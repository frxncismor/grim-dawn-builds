# Incidente: <título breve>

> Plantilla. Copiar a `docs/security/incidents/AAAA-MM-DD-<slug>.md` y seguir el
> [runbook](../incident-secret-exposure.md).
> **No incluir valores** de secretos, contraseñas, tokens, cadenas de conexión ni
> capturas sin redactar. Usar nombres de variables, rutas, SHA y fechas.

## Datos del incidente

| Campo | Valor |
| --- | --- |
| ID | INC-AAAA-NNN |
| Tipo | simulacro / exposición / exposición con uso |
| Estado | abierto / contenido / erradicado / cerrado |
| Detectado (fecha, hora y zona) | |
| Propietario | |
| Categoría (C1–C4) | |
| Nombre de la variable | |
| Ubicación (ruta, rama, SHA, workflow o artefacto) | |
| Primera exposición (SHA y fecha) | |
| Copias afectadas (remoto, forks, artefactos, logs) | |

## Cronología

| Fecha y hora | Evento | Actor |
| --- | --- | --- |
| | Detección | |
| | Inicio de contención | |

## Alcance y uso

- Qué puede hacer la credencial:
- Uso detectado: sí / no / pendiente de revisión
- Evidencia (ubicación fuera del repositorio, con acceso restringido):

## Contención y rotación

- [ ] Secreto tratado como comprometido
- [ ] Credencial revocada o rotada en origen (categoría según el runbook, sección 3)
- [ ] Consumidores detenidos o reiniciados, si aplica
- [ ] Credencial antigua verificada como inoperativa
- [ ] Ninguna rama afectada subida al remoto sin aprobación

## Limpieza del historial

- [ ] SHA y referencias registrados antes de reescribir
- [ ] Forks y clones avisados, si existen
- [ ] Cachés, artefactos de CI y logs afectados eliminados
- [ ] Escaneo del historial completo sin hallazgos

## Notificaciones

| Destinatario | Motivo | Fecha | Confirmado |
| --- | --- | --- | --- |
| | | | no |

## Recuperación

- [ ] Consumidores arrancados con la credencial nueva
- [ ] Conexión nueva verificada
- [ ] `/ready` de la API correcto, si aplica
- [ ] CI en verde sin el secreto antiguo

## Revisión posterior

- Causa raíz:
- Control que falló:
- Cómo se detectó:
- Regla o prueba que lo habría evitado:

| Acción | Responsable | Fecha límite | Estado |
| --- | --- | --- | --- |
| | | | abierta |

## Cierre

- Revisor del postmortem:
- Fecha de cierre:
- Propietario (firma o confirmación):
