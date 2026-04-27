# Sincronizar `supabase db pull` y el historial de migraciones

## Por qué falla `npx supabase db pull`

1. **Archivos que no son migraciones** en `supabase/migrations/` (por ejemplo `.md`) hacen que el CLI se queje. La documentación está en [README_COCINA_ALMACEN_CAJA.md](README_COCINA_ALMACEN_CAJA.md) en esta misma carpeta `supabase/docs/`, no en `migrations/`.

2. **Prefijos duplicados o cortos**: Varios `20260420_*.sql` con el **mismo** prefijo de 8 u 11 caracteres hacen que el CLI no tenga un **id único** por archivo (en Supabase el id es un timestamp de 14 caracteres, `YYYYMMDDHHmmss`).

3. **Divergencia remoto ↔ local**: Aplicar SQL por **MCP / SQL editor / otra PC** con **otro timestamp** (p. ej. `20260427022140`) y en git guardar el mismo cuerpo como `20260428130000_...` hace que la tabla `supabase_migrations.schema_migrations` en el remoto no coincida con los nombres de archivo locales.

## Qué ya se ajustó en el repo

- Tres flujos del 20/04/2026 renombrados a: `20260420174705_*`, `20260420182054_*`, `20260420200828_*`, `20260420204051_*` (orden lógico por version).
- `20260420200828_*` es un NO-OP mientras no pegues el SQL real que tenga el remoto para “approved permissions” (o sustituyes con lo que saques de [documentación de migración repair](https://supabase.com/docs/reference/cli/supabase-migration-repair)).
- Nombres de `20260421_` y `20260426_` llevados a 14 caracteres: `20260421120000_*`, `20260426120000_*` (puedes refinar el timestamp si hace falta alinear 1:1 con el remoto).

## Cómo alinear tu proyecto vinculado (pasos sugeridos)

1. Asegurarte de estar en la raíz del repo, con [Supabase CLI](https://supabase.com/docs/guides/cli) y el proyecto vinculado: `npx supabase link`.

2. Listar y comparar:  
   `npx supabase migration list`  
   Compara la columna **local** y **remote** con el listado de archivos en `supabase/migrations/*.sql`.

3. Con el editor SQL (Supabase → SQL), opcional:  
   `select version, name from supabase_migrations.schema_migrations order by version;`  
   (nombres de versión según el proyecto; la tabla es la de historial de migraciones.)

4. Ajuste del historial **sin** re-ejecutar SQL (solo cuando el esquema en remoto **ya** es el correcto): [Supabase: migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair).  
   Típico: marcar como *reverted* entradas huérfanas creadas por un id distinto, y luego *applied* los timestamps que coincidan con tus **archivos locales** actuales.

5. No copies ciegamente la lista truncada de `db pull` que dice `reverted 20174705` sin el prefijo `202604` completo: el `version` debe ser el de **14 dígitos** que tenga el remoto, según el paso 3.

6. Vuelve a probar: `npx supabase db pull` (o `npx supabase db push` en otra rama, según el flujo).

## Si hace falta dejarlo limpio

- **Nuevo baseline** (solo con acuerdo del equipo): [squash o baseline](https://supabase.com/docs/guides/deployment/managing-environments#database-migration-strategies) generando un único parche desde el remoto, y acordar historial a partir de ahí.

## Referencia

- [Base de datos – migraciones](https://supabase.com/docs/guides/deployment/database-migrations)  
- [Supabase – migration repair (CLI)](https://supabase.com/docs/reference/cli/supabase-migration-repair)
