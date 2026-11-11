# Inventario de secretos

Este inventario contiene nombres y metadatos, nunca valores. Las variables C5 son
configuración pública y se incluyen para distinguirlas de los secretos.

| Nombre | Categoría | Consumidor | Propietario | Rotación |
| --- | --- | --- | --- | --- |
| `POSTGRES_PASSWORD` | C1 | Inicialización de PostgreSQL | Mantenedor | Local: recrear volumen o sospecha; producción: máximo 90 días |
| `DB_PASSWORD_MIGRATOR` | C1 | Servicio de migración | Mantenedor | Local: recrear volumen o sospecha; producción: máximo 90 días |
| `DB_PASSWORD_IMPORTER` | C1 | Seed e importación local | Mantenedor | Local: recrear volumen o sospecha; producción: máximo 90 días |
| `DB_PASSWORD_EDITOR` | C1 | CLI editorial local (T-129) | Mantenedor | Local: recrear volumen o sospecha; producción: máximo 90 días |
| `DB_PASSWORD_API_RO` | C1 | Runtime de API de solo lectura | Mantenedor | Local: recrear volumen o sospecha; producción: máximo 90 días |
| `APP_ENV` | C5 | API y herramientas locales | — | — |
| `CONTENT_SOURCE` | C5 | Web y API | — | — |
| `API_PORT` | C5 | API | — | — |
| `CORS_ORIGINS` | C5 | Endurecimiento HTTP futuro | — | — |
| `POSTGRES_DB` | C5 | PostgreSQL local | — | — |
| `POSTGRES_USER` | C5 | Inicialización de PostgreSQL | — | — |
| `DB_USER_MIGRATOR` | C5 | Servicio de migración | — | — |
| `DB_USER_IMPORTER` | C5 | Seed e importación local | — | — |
| `DB_USER_EDITOR` | C5 | CLI editorial local (T-129) | — | — |
| `DB_USER_API_RO` | C5 | Runtime de API de solo lectura | — | — |
