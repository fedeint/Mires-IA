-- Unifica esquema operacional (order_items, orders, recipes) con triggers de cocina/caja
-- creados en 20260428130000. Sin esto, los triggers fallan o referencian columnas inexistentes
-- (menu_product_recipes, yield, table_id, item_name vs product_name, etc.).

-- ── 0) Línea de pedido: alias compatibles (opcionales) frente a product_id / product_name / note
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS menu_product_id uuid REFERENCES public.products (id) ON DELETE SET NULL;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS item_name text;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS notes text;

-- ── 1) Relación plato (products) → receta y factor de carga por carta
CREATE TABLE IF NOT EXISTS public.menu_product_recipes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  menu_product_id  uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  recipe_id         uuid NOT NULL REFERENCES public.recipes (id) ON DELETE RESTRICT,
  quantity_factor  numeric(18, 6) NOT NULL DEFAULT 1,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_product_recipes_tenant_plato
  ON public.menu_product_recipes (tenant_id, menu_product_id);

CREATE INDEX IF NOT EXISTS idx_mpr_tenant
  ON public.menu_product_recipes (tenant_id);

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS yield_quantity numeric(12, 6);

DO $yr$
BEGIN
  IF EXISTS (
    SELECT
      1
    FROM
      information_schema.columns
    WHERE
      table_schema = 'public'
      AND table_name = 'recipes'
      AND column_name = 'portions'
  ) THEN
    UPDATE
      public.recipes
    SET
      yield_quantity = greatest(
        0.0001,
        coalesce(
          nullif(yield_quantity, 0::numeric),
          nullif(portions::numeric, 0::numeric),
          1::numeric
        )
      );
  ELSE
    UPDATE
      public.recipes
    SET
      yield_quantity = 1
    WHERE
      yield_quantity IS NULL
      OR yield_quantity = 0::numeric;
  END IF;
END;
$yr$;

UPDATE
  public.recipes
SET
  yield_quantity = 1
WHERE
  yield_quantity IS NULL
  OR yield_quantity = 0::numeric;

ALTER TABLE public.recipes
  ALTER COLUMN yield_quantity SET DEFAULT 1;
ALTER TABLE public.recipes
  ALTER COLUMN yield_quantity SET NOT NULL;

-- ── 2) RLS coherente con public.products / recipes (claim JWT)
ALTER TABLE public.menu_product_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mpr_tenant on public.menu_product_recipes;
CREATE POLICY mpr_tenant
  ON public.menu_product_recipes
  FOR ALL
  TO authenticated
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_product_recipes TO authenticated, service_role;

-- ── 3) Triggers de cocina: alineados con 20260428120000 (product_id, product_name, note; sin orders.table_id)
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
  nota_line  text;
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

  SELECT
    dt.label
  INTO
    tbln
  FROM
    public.dining_tables dt
  WHERE
    dt.id = coalesce(o_dtid, o_tid)
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

  mp_id := coalesce(NEW.menu_product_id, NEW.product_id);
  IF mp_id IS NOT NULL THEN
    SELECT
      mpr.recipe_id
    INTO
      rid
    FROM
      public.menu_product_recipes mpr
    WHERE
      mpr.menu_product_id = mp_id
      AND mpr.tenant_id = o_tenant
    LIMIT 1;
  END IF;

  t_est := 15;
  n_line := greatest(1, least(100000, ceiling(coalesce(NEW.quantity, 1::numeric))::int));
  nm := coalesce(
    nullif(btrim(NEW.item_name), ''),
    nullif(btrim(NEW.product_name), ''),
    'Producto'
  );
  nota_line := coalesce(NEW.notes, NEW.note);

  INSERT INTO public.cocina_cola (
    tenant_id, restaurant_id, order_item_id, order_id,
    nombre_producto, cantidad, notas, mesa_referencia, tipo_pedido, tiempo_estimado_min, estado
  ) VALUES (
    o_tenant, o_rest, NEW.id, NEW.order_id,
    nm, n_line, nota_line, mesa_txt, t_ped, t_est, 'pendiente'
  );
  RETURN NEW;
END;
$f$;

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
  INTO
    dup;

  IF coalesce(dup, FALSE) THEN
    RETURN new;
  END IF;

  SELECT
    oi2.id, o2.tenant_id, o2.restaurant_id, o2.id, coalesce(oi2.menu_product_id, oi2.product_id), coalesce(oi2.quantity, 1::numeric)
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
      AND mpr.tenant_id = o_ten
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

COMMENT ON TABLE public.menu_product_recipes IS
  'Mapea public.products (plato en carta) a receta de coste y factor de ajuste para descuento en cocina.';
