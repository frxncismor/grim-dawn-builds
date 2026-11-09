# Gestión de secretos

## Alcance

Este documento aplica a secretos locales, CI y producción. Los valores nunca se
registran en Git, documentación, logs, imágenes ni artefactos.

## Categorías y responsables

| Categoría | Uso | Propietario | Rotación | Revocación |
| --- | --- | --- | --- | --- |
| C1 | Credenciales de PostgreSQL por rol | Mantenedor | Local: al recrear volumen o ante sospecha. Producción: máximo 90 días | Cambiar contraseña o `NOLOGIN`; reiniciar consumidores |
| C2 | Credenciales de CI | Mantenedor | Máximo 90 días; preferir OIDC | Eliminar el secreto y revocar en origen |
| C3 | Credenciales de despliegue o nube | Mantenedor | OIDC efímero; si no, máximo 90 días | Revocar el rol o token del proveedor |
| C4 | Secretos de aplicación | Mantenedor | Máximo 180 días o tras incidente | Rotar y reiniciar |
| C5 | Configuración pública | No aplica | No aplica | No aplica |

Los nombres que terminan en `_PASSWORD`, `_TOKEN`, `_KEY` o `_SECRET` son C1–C4.
Todo secreto nuevo debe añadirse al inventario sin incluir su valor.

## Manejo local

- Solo `infra/docker/.env.example` se versiona; los archivos `.env*` locales se ignoran.
- Los campos C1 permanecen vacíos en la plantilla. `pnpm setup:env` los generará
  localmente cuando se implemente.
- Las credenciales de desarrollo no se reutilizan fuera de la máquina local.
- Los secretos se entregarán preferentemente como archivos en
  `infra/docker/secrets/`, ignorados por Git, y montados en `/run/secrets`.

## Manejo en CI y producción

- Los PR no reciben secretos y no usan `pull_request_target`.
- Los valores efímeros generados por CI se enmascaran y nunca se imprimen.
- Producción usará una fuente gestionada con auditoría y entrega en tiempo de
  ejecución; no se usarán `ARG`, `ENV` secreto, capas de imagen ni comandos.

## Incidente

Ante una sospecha de exposición, revocar o rotar el secreto, detener consumidores
si corresponde, revisar el acceso y documentar el incidente. El runbook detallado
se añadirá antes del primer despliegue.
