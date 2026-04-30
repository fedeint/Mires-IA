-- E2E (solo datos): cola de cocina → listo → salida almacén + caja (pedido con sesion_caja_id)
-- Requisito: migraciones 20260428120000, 20260428130000, 20260430180000 aplicadas.
-- Ejecución: rol con RLS desactivable o superusuario (p. ej. conexión Session Pooler/Postgres
-- en Supabase) para insertar en tablas.
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/e2e_kitchen_caja.sql
-- o, dentro de una transacción que luego haga ROLLBACK (no deja rastro):
--   begin; \i supabase/tests/e2e_kitchen_caja.sql ; rollback;
--
-- El bloque hace RAISE si alguna comprobación falla.

SET client_min_messages TO notice;
SET row_security = off;

DO $e2e$
DECLARE
  v_tenant_id  uuid := gen_random_uuid();
  v_rest_id    uuid := gen_random_uuid();
  v_insumo_id  uuid := gen_random_uuid();
  v_product_id uuid := gen_random_uuid();
  v_recipe_id  uuid := gen_random_uuid();
  v_cash_id    uuid := gen_random_uuid();
  v_order_id   uuid := gen_random_uuid();
  v_oi_id      uuid := gen_random_uuid();
  v_cc_id      uuid;
  n_cc         int;
  n_mov        int;
  s0           numeric;
  s1           numeric;
BEGIN
  RAISE notice 'E2E ids tenant=% product=%', v_tenant_id, v_product_id;

  INSERT INTO public.tenants (id, name)
  VALUES (v_tenant_id, 'E2E_MiRest');

  INSERT INTO public.restaurants (id, tenant_id, name)
  VALUES (v_rest_id, v_tenant_id, 'Local E2E');

  INSERT INTO public.insumos (id, tenant_id, restaurant_id, codigo, nombre, stock_actual, costo_unitario)
  VALUES (v_insumo_id, v_tenant_id, v_rest_id, 'E2E-INS-1', 'Insumo prueba E2E', 100, 1.5);

  INSERT INTO public.products (id, tenant_id, restaurant_id, sku, name, price)
  VALUES (v_product_id, v_tenant_id, v_rest_id, 'E2E-PL-1', 'Plato E2E', 25.00);

  -- yield_quantity existe tras 20260430180000; si no, ajusta a portions solamente
  INSERT INTO public.recipes (id, tenant_id, restaurant_id, name, portions, sale_product_id, yield_quantity)
  VALUES (v_recipe_id, v_tenant_id, v_rest_id, 'Receta E2E', 1, v_product_id, 1);

  INSERT INTO public.recipe_ingredients (id, recipe_id, insumo_id, quantity, unit)
  VALUES (gen_random_uuid(), v_recipe_id, v_insumo_id, 0.1, 'kg');

  INSERT INTO public.menu_product_recipes (tenant_id, menu_product_id, recipe_id, quantity_factor)
  VALUES (v_tenant_id, v_product_id, v_recipe_id, 1);

  INSERT INTO public.cash_sessions (id, tenant_id, restaurant_id, opening_float, metadata)
  VALUES (v_cash_id, v_tenant_id, v_rest_id, 0, '{}'::jsonb);

  INSERT INTO public.orders (id, tenant_id, restaurant_id, channel, status, metadata, sesion_caja_id)
  VALUES (v_order_id, v_tenant_id, v_rest_id, 'salon', 'open', '{}'::jsonb, v_cash_id);

  SELECT stock_actual INTO s0
  FROM public.insumos
  WHERE id = v_insumo_id;

  INSERT INTO public.order_items (id, tenant_id, order_id, product_id, product_name, quantity, unit_price, line_total, kitchen_status)
  VALUES (v_oi_id, v_tenant_id, v_order_id, v_product_id, 'Plato E2E', 1, 25, 25, 'pending');

  SELECT
    count(*)::int
  INTO
    n_cc
  FROM
    public.cocina_cola
  WHERE
    order_item_id = v_oi_id;

  IF n_cc <> 1 THEN
    RAISE EXCEPTION 'E2E: se esperaba 1 fila en cocina_cola, hay %', n_cc;
  END IF;

  SELECT
    id
  INTO
    v_cc_id
  FROM
    public.cocina_cola
  WHERE
    order_item_id = v_oi_id
  LIMIT 1;

  UPDATE
    public.cocina_cola
  SET
    estado = 'listo'
  WHERE
    id = v_cc_id;

  SELECT
    count(*)::int
  INTO
    n_mov
  FROM
    public.almacen_movimientos
  WHERE
    cocina_cola_id = v_cc_id
    AND tipo = 'salida_cocina';

  IF n_mov < 1 THEN
    RAISE EXCEPTION 'E2E: no hubo filas salida_cocina en almacen_movimientos';
  END IF;

  SELECT
    stock_actual
  INTO
    s1
  FROM
    public.insumos
  WHERE
    id = v_insumo_id;

  IF s1 IS NULL OR s1 >= s0 THEN
    RAISE EXCEPTION 'E2E: stock de insumo no bajó (antes %, después %)', s0, s1;
  END IF;

  RAISE notice
    'E2E OK: cocina → listo → almacen (salida_cocina) + insumos.stock; pedido con sesion_caja_id vinculada a cash_sessions.';
END;
$e2e$;
