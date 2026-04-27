-- =============================================================================
-- MiRest: cocina (cola), almacén por insumo, caja, vista inventario, semilla
--         roles_modulos. Migración UNIFICADA en un solo archivo.
--
-- Orden requerido (vista previa en /supabase/migrations):
--   1) 20260428120000_mirest_operational_core.sql
--        → public.inventory_movements, insumos, orders, order_items, cash_sessions,
--          recipes, recipe_ingredients, …
--   2) 20260426120000_mirest_canonical_spanish_views.sql (o equivalente)
--        → public.roles_modulos (tabla; UNIQUE (tenant_id, rol))
--   3) Esta migración: DESPUÉS de las anteriores.
-- Tabla/relación: public.menu_product_recipes debe existir en el esquema de catálogo
--   (el trigger la usa en runtime; creada en otra migración del repo si aplica).
--
-- Idempotencia: IF NOT EXISTS, OR REPLACE, ON CONFLICT, DROP ... IF EXISTS.
-- Documentación: supabase/docs/README_COCINA_ALMACEN_CAJA.md
-- =============================================================================

-- MiRest: cola de cocina, almacen_movimientos (insumos), triggers, sesión caja, vista inventario, semilla roles_modulos.

-- ── 0) Vista para inventario en inglés (antes: public.almacen_movimientos apuntaba aquí) ──
DROP VIEW IF EXISTS public.almacen_movimientos;

CREATE OR REPLACE VIEW public.movimientos_inventario
WITH (security_invoker = true) AS
SELECT * FROM public.inventory_movements;

GRANT SELECT ON public.movimientos_inventario TO authenticated, service_role;

-- ── 1) order_items: estado de línea cocina (opcional para clientes) ──
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS kitchen_status text NOT NULL DEFAULT 'pending';

-- ── 2) Cola de cocina ──
CREATE TABLE IF NOT EXISTS public.cocina_cola (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants (id) ON DELETE SET NULL,
  order_item_id uuid NOT NULL REFERENCES public.order_items (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  nombre_producto text NOT NULL,
  cantidad int NOT NULL DEFAULT 1,
  notas text,
  mesa_referencia text,
  tipo_pedido text,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN (
      'pendiente', 'preparando', 'listo', 'entregado', 'rechazado', 'cancelado'
    )),
  prioridad text NOT NULL DEFAULT 'normal'
    CHECK (prioridad IN ('normal', 'urgente', 'vip')),
  recibido_at timestamptz NOT NULL DEFAULT now(),
  inicio_preparacion_at timestamptz,
  listo_at timestamptz,
  entregado_at timestamptz,
  chef_id uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL,
  tiempo_estimado_min int
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cocina_cola_order_item ON public.cocina_cola (order_item_id);
CREATE INDEX IF NOT EXISTS idx_cocina_cola_tenant_estado
  ON public.cocina_cola (tenant_id, estado, recibido_at);

-- ── 3) Caja: vínculo pedido ↔ sesión (expuesto en la vista public.pedidos) ──
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sesion_caja_id uuid REFERENCES public.cash_sessions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_sesion_caja
  ON public.orders (sesion_caja_id)
  WHERE sesion_caja_id IS NOT NULL;

-- Reemplazar la vista para incluir la nueva columna
CREATE OR REPLACE VIEW public.pedidos
WITH (security_invoker = true) AS
SELECT * FROM public.orders;

-- ── 4) Movimientos de almacén por insumo (tabla; ya no es vista) ──
CREATE TABLE IF NOT EXISTS public.almacen_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants (id) ON DELETE SET NULL,
  insumo_id uuid NOT NULL REFERENCES public.insumos (id) ON DELETE RESTRICT,
  tipo text NOT NULL
    CHECK (tipo IN (
      'entrada_compra', 'entrada_devolucion', 'entrada_inventario', 'ajuste_positivo',
      'salida_cocina', 'salida_merma', 'salida_consumo', 'salida_venta', 'ajuste_negativo'
    )),
  cantidad numeric(18, 6) NOT NULL,
  costo_unitario numeric(14, 6),
  costo_total numeric(18, 6),
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES public.order_items (id) ON DELETE SET NULL,
  cocina_cola_id uuid REFERENCES public.cocina_cola (id) ON DELETE SET NULL,
  proveedor_id bigint,
  nro_comprobante text,
  motivo text,
  referencia text,
  notas text,
  usuario_id uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_almacen_movimientos_tenant_created
  ON public.almacen_movimientos (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_almacen_movimientos_insumo
  ON public.almacen_movimientos (insumo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_almacen_cocina ON public.almacen_movimientos (cocina_cola_id)
  WHERE cocina_cola_id IS NOT NULL;

-- ── 5) Nuevo pedido/ítem → fila en cocina ──
CREATE OR REPLACE FUNCTION public.fn_trg_order_item_cocina ()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $f$
DECLARE
  o_tenant   uuid;
  o_rest     uuid;
  o_channel  text;
  o_meta     jsonb;
  o_xch      text;
  o_dtid     uuid;
  o_tid      uuid;
  tbln       text;
  mesa_txt   text;
  t_ped      text;
  mp_id      uuid;
  rid        uuid;
  t_est      int;
  n_line     int;
  nm         text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.cocina_cola c WHERE c.order_item_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT
    o.tenant_id, o.restaurant_id, o.channel::text, o.metadata,
    o.external_channel, o.dining_table_id, null::uuid
  INTO o_tenant, o_rest, o_channel, o_meta, o_xch, o_dtid, o_tid
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  IF o_tenant IS NULL THEN
    RETURN NEW;
  END IF;

  t_ped := coalesce(nullif(btrim(o_channel), ''), 'salon');
  o_meta := coalesce(o_meta, '{}'::jsonb);

  SELECT dt.label
  INTO tbln
  FROM public.dining_tables dt
  WHERE dt.id = coalesce(o_dtid, o_tid)
  LIMIT 1;

  IF t_ped = 'salon' AND tbln IS NOT NULL AND btrim(coalesce(tbln, '')) <> '' THEN
    mesa_txt := 'Mesa ' || btrim(tbln);
  ELSIF t_ped = 'takeaway' THEN
    mesa_txt := 'Para llevar';
  ELSIF t_ped = 'delivery' THEN
    mesa_txt := 'Delivery ' || coalesce(
      nullif(btrim(coalesce(o_xch, o_meta->>'canal', '')), ''),
      'canal'
    );
  ELSE
    mesa_txt := t_ped;
  END IF;

  mp_id := NEW.menu_product_id;
  IF mp_id IS NOT NULL THEN
    SELECT mpr.recipe_id
    INTO rid
    FROM public.menu_product_recipes mpr
    WHERE mpr.menu_product_id = mp_id
    LIMIT 1;
  END IF;

  t_est := 15;
  n_line := greatest(1, least(100000, ceiling(coalesce(NEW.quantity, 1::numeric))::int));
  nm := coalesce(nullif(btrim(NEW.item_name), ''), 'Producto');

  INSERT INTO public.cocina_cola (
    tenant_id, restaurant_id, order_item_id, order_id,
    nombre_producto, cantidad, notas, mesa_referencia, tipo_pedido, tiempo_estimado_min, estado
  ) VALUES (
    o_tenant, o_rest, NEW.id, NEW.order_id,
    nm, n_line, NEW.notes, mesa_txt, t_ped, t_est, 'pendiente'
  );
  RETURN NEW;
END;
$f$;

DROP TRIGGER IF EXISTS trg_order_item_cocina ON public.order_items;
CREATE TRIGGER trg_order_item_cocina
  AFTER INSERT ON public.order_items
  FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_order_item_cocina ();

-- ── 6) listo en cocina → salida de insumos (evitar doble descuento) ──
CREATE OR REPLACE FUNCTION public.fn_cocina_listo_descuenta_stock ()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $f$
DECLARE
  oi_id   uuid;
  oi_o    uuid;
  oi_mp   uuid;
  oi_q    numeric;
  o_rest  uuid;
  o_ten   uuid;
  mp_id   uuid;
  rec_id  uuid;
  f       numeric;
  v_yield numeric;
  need    numeric;
  cu      numeric;
  ct      numeric;
  ri      record;
  dup     boolean;
BEGIN
  IF new.estado IS DISTINCT FROM 'listo' OR coalesce(old.estado, '') = 'listo' THEN
    RETURN new;
  END IF;

  SELECT
    exists (
      SELECT
        1
      FROM
        public.almacen_movimientos m
      WHERE
        m.cocina_cola_id = new.id
        AND m.tipo = 'salida_cocina')
  INTO dup;

  IF coalesce(dup, FALSE) THEN
    RETURN new;
  END IF;

  SELECT
    oi2.id, o2.tenant_id, o2.restaurant_id, o2.id, oi2.menu_product_id, coalesce(oi2.quantity, 1::numeric)
  INTO
    oi_id, o_ten, o_rest, oi_o, oi_mp, oi_q
  FROM
    public.order_items oi2
    JOIN public.orders o2 ON o2.id = oi2.order_id
  WHERE
    oi2.id = new.order_item_id;

  IF oi_id IS NULL THEN
    RETURN new;
  END IF;

  mp_id := oi_mp;
  rec_id := NULL;
  f := 1::numeric;

  IF mp_id IS NOT NULL THEN
    SELECT
      mpr.recipe_id,
      mpr.quantity_factor
    INTO
      rec_id, f
    FROM
      public.menu_product_recipes mpr
    WHERE
      mpr.menu_product_id = mp_id
    LIMIT 1;
  END IF;

  IF rec_id IS NULL THEN
    UPDATE
      public.order_items
    SET
      kitchen_status = 'listo'
    WHERE
      id = oi_id;
    UPDATE
      public.cocina_cola
    SET
      listo_at = coalesce(new.listo_at, now())
    WHERE
      id = new.id;
    RETURN new;
  END IF;

  SELECT
    r.yield_quantity
  INTO
    v_yield
  FROM
    public.recipes r
  WHERE
    r.id = rec_id;

  v_yield := greatest(coalesce(v_yield, 1::numeric), 0.0001);
  f := greatest(coalesce(f, 1::numeric), 0.0001);

  FOR ri IN
  SELECT
    ri2.insumo_id,
    ri2.quantity,
    i.costo_unitario
  FROM
    public.recipe_ingredients ri2
    JOIN public.insumos i ON i.id = ri2.insumo_id
  WHERE
    ri2.recipe_id = rec_id
    AND ri2.insumo_id IS NOT NULL
  LOOP
    need := (ri.quantity / v_yield) * oi_q * f;
    need := greatest(0, need);
    IF need <= 0 THEN
      CONTINUE;
    END IF;
    cu := coalesce(ri.costo_unitario, 0);
    ct := need * cu;

    INSERT INTO public.almacen_movimientos (tenant_id, restaurant_id, insumo_id, tipo, cantidad,
      costo_unitario, costo_total, order_id, order_item_id, cocina_cola_id, motivo, created_at)
    VALUES (o_ten, o_rest, ri.insumo_id, 'salida_cocina', need, cu, ct, oi_o, oi_id, new.id, 'listo en cocina', now());

    UPDATE
      public.insumos
    SET
      stock_actual = greatest(0, coalesce(stock_actual, 0) - need),
      updated_at = now()
    WHERE
      id = ri.insumo_id
      AND (tenant_id IS NULL OR tenant_id = o_ten);
  END LOOP;

  UPDATE
    public.order_items
  SET
    kitchen_status = 'listo'
  WHERE
    id = oi_id;

  UPDATE
    public.cocina_cola
  SET
    listo_at = coalesce(new.listo_at, now())
  WHERE
    id = new.id
    AND listo_at IS NULL;
  RETURN new;
END;
$f$;

DROP TRIGGER IF EXISTS trg_cocina_listo_stock ON public.cocina_cola;
CREATE TRIGGER trg_cocina_listo_stock
  AFTER UPDATE OF estado ON public.cocina_cola
  FOR EACH ROW
EXECUTE FUNCTION public.fn_cocina_listo_descuenta_stock ();

-- ── 7) RLS básica ──
ALTER TABLE public.cocina_cola ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almacen_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cocina_tenant" ON public.cocina_cola;
CREATE POLICY "cocina_tenant" ON public.cocina_cola
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (
      SELECT
        u.tenant_id
      FROM
        public.user_profiles u
      WHERE
        u.id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT
      u2.tenant_id
    FROM
      public.user_profiles u2
    WHERE
      u2.id = auth.uid()));

DROP POLICY IF EXISTS "almacen_mov_tenant" ON public.almacen_movimientos;
CREATE POLICY "almacen_mov_tenant" ON public.almacen_movimientos
  FOR ALL
  TO authenticated
  USING (tenant_id = (SELECT
    u.tenant_id
  FROM
    public.user_profiles u
  WHERE
    u.id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT
    u2.tenant_id
  FROM
    public.user_profiles u2
  WHERE
    u2.id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cocina_cola TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.almacen_movimientos TO authenticated, service_role;

-- ── 8) Realtime (no fallar si publicación no existe) ──
DO $p$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cocina_cola;
EXCEPTION
  WHEN OTHERS THEN
    RAISE notice 'cocina_cola: no se añadió a supabase_realtime (%)', sqlerrm;
END;
$p$;

-- ── 9) roles_modulos: plantilla por shell + trigger en tenant ──
CREATE OR REPLACE FUNCTION public.fn_seed_roles_modulos_for_tenant (p_tenant_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $f$
BEGIN
  INSERT INTO public.roles_modulos (tenant_id, rol, modulos, usa_pwa)
  VALUES
    (p_tenant_id, 'superadmin', array['*']::text[], true),
    (p_tenant_id, 'admin', ARRAY['dashboard', 'caja', 'pedidos', 'cocina', 'almacen', 'clientes', 'productos', 'proveedores', 'recetas', 'facturacion', 'reportes', 'ia', 'soporte', 'configuracion', 'accesos']::text[], true),
    (p_tenant_id, 'caja', ARRAY['pedidos', 'caja', 'clientes']::text[], true),
    (p_tenant_id, 'pedidos', ARRAY['pedidos', 'caja', 'clientes']::text[], true),
    (p_tenant_id, 'chef', ARRAY['cocina', 'almacen', 'recetas', 'productos']::text[], true),
    (p_tenant_id, 'almacen', ARRAY['almacen', 'proveedores', 'recetas', 'productos']::text[], true),
    (p_tenant_id, 'marketing', ARRAY['reportes', 'clientes', 'productos', 'dashboard']::text[], true),
    (p_tenant_id, 'soporte', ARRAY['soporte', 'dashboard', 'ia']::text[], true)
  ON CONFLICT (tenant_id, rol)
    DO UPDATE SET
      modulos = excluded.modulos,
      usa_pwa = excluded.usa_pwa,
      updated_at = now();
END;
$f$;

-- Semilla al crear tenant: función y trigger (un solo CREATE)
CREATE OR REPLACE FUNCTION public.fn_tenants_after_insert_modulos ()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $f$
BEGIN
  PERFORM
    public.fn_seed_roles_modulos_for_tenant (new.id);
  RETURN new;
END;
$f$;

DROP TRIGGER IF EXISTS trg_tenants_seed_roles_modulos ON public.tenants;
CREATE TRIGGER trg_tenants_seed_roles_modulos
  AFTER INSERT ON public.tenants
  FOR EACH ROW
EXECUTE FUNCTION public.fn_tenants_after_insert_modulos ();

-- Rellenar lo que faltaba
DO $d$
DECLARE
  r record;
BEGIN
  FOR r IN
  SELECT
    t.id
  FROM
    public.tenants t
  LOOP
    PERFORM public.fn_seed_roles_modulos_for_tenant (r.id);
  END LOOP;
END;
$d$;

COMMENT ON TABLE public.cocina_cola IS
  'Cola de cocina; creada por trigger en order_items; stock vía almacen_movimientos (salida_cocina) al marcar listo.';

COMMENT ON TABLE public.almacen_movimientos IS
  'Movimientos de stock a nivel insumo. La vista movimientos_inventario mapea el inventario en inglés.';
