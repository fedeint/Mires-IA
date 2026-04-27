# Prueba E2E: cocina → almacén → caja (datos mínimos)

Hilo verificado: insertar un ítem de pedido (con `product_id` ligado a `menu_product_recipes` y receta con insumos) → se crea fila en `cocina_cola` → al marcar `estado = 'listo'` se genera `almacen_movimientos` (tipo `salida_cocina`) y baja el stock; el `orders` puede llevar `sesion_caja_id` a una `cash_sessions`.

## Requisitos

1. En la base, aplicar al menos:
   - `20260428120000_mirest_operational_core.sql`
   - `20260428130000_mirest_cocina_modulos_sesion_caja.sql`
   - `20260430180000_mirest_kitchen_caja_e2e_wiring.sql` (enlace plato–receta, `yield` en `recipes`, columnas alias en `order_items`, y triggers alineados al esquema operacional).

2. Conexión: cadena con permiso de insertar en el esquema (por ejemplo [Session pooler/Postgres de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)) y, si aplica, `row_security` desactivado o rol que bypassa RLS (el script pone `SET row_security = off;` en la sesión).

3. (Opcional) `psql` en PATH o, desde `Pedidos/`, el runner Node que hace ROLLback del todo.

## Cómo ejecutar

**Con `psql` y commit de datos (no hace ROLLBack):**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/e2e_kitchen_caja.sql
```

**Solo dejar rastro al verificar, sin datos permanentes (transacción manual):**

```text
psql  …
BEGIN;
\i supabase/tests/e2e_kitchen_caja.sql
ROLLBACK;
```

**Con Node (desde la carpeta `Pedidos/`, requiere `npm install pg` una vez):**

```bash
cd Pedidos
npm i --save-dev pg@8
$env:DATABASE_URL="postgres://…"   # o SUPABASE_DB_URL
npm run test:e2e:kitchen
```

El script envuelve el SQL en `BEGIN` y `ROLLBACK` para no persistir el tenant de prueba.

## Qué no cubre (front)

Esto prueba la **lógica en la base y los triggers**; no sustituye un e2e de navegador (login, PWA, cierre de caja en UI). Para E2E en el cliente hace falta otra batería (p. ej. Playwright) apuntando a la URL del front y credenciales de prueba en Auth.

## Fallos frecuentes

- `column ... does not exist` → faltan migraciones (sobre todo `20260430180000_…`).
- Política RLS bloquea inserts → conectar con un rol adecuado o ajustar políticas; el script hace `SET row_security = off;` (útil con rol que lo permita).
- `recipes` sin `yield_quantity` → debe existir gracias a `20260430180000_…` (o insertar con `portions`/`yield` acorde al esquema actual).
