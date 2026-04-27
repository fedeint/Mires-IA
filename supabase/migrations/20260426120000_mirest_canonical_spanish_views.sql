-- Vistas canónicas (nombres en español) = alias de tablas existentes; PostgREST expone read/write en vistas simples 1:1.
-- + roles_modulos (por tenant) alimentado desde roles_config.

CREATE OR REPLACE VIEW public.pedidos
WITH (security_invoker = true) AS
SELECT * FROM public.orders;

CREATE OR REPLACE VIEW public.pedido_items
WITH (security_invoker = true) AS
SELECT * FROM public.order_items;

CREATE OR REPLACE VIEW public.clientes
WITH (security_invoker = true) AS
SELECT * FROM public.customers;

CREATE OR REPLACE VIEW public.mesas
WITH (security_invoker = true) AS
SELECT * FROM public.dining_tables;

CREATE OR REPLACE VIEW public.productos
WITH (security_invoker = true) AS
SELECT * FROM public.products;

CREATE OR REPLACE VIEW public.categorias_producto
WITH (security_invoker = true) AS
SELECT * FROM public.product_categories;

CREATE OR REPLACE VIEW public.sesiones_caja
WITH (security_invoker = true) AS
SELECT * FROM public.cash_sessions;

CREATE OR REPLACE VIEW public.caja_movimientos
WITH (security_invoker = true) AS
SELECT * FROM public.payments;

CREATE OR REPLACE VIEW public.comprobantes
WITH (security_invoker = true) AS
SELECT * FROM public.invoices;

CREATE OR REPLACE VIEW public.almacen_movimientos
WITH (security_invoker = true) AS
SELECT * FROM public.inventory_movements;

CREATE OR REPLACE VIEW public.recetas
WITH (security_invoker = true) AS
SELECT * FROM public.recipes;

CREATE OR REPLACE VIEW public.receta_insumos
WITH (security_invoker = true) AS
SELECT * FROM public.recipe_ingredients;

CREATE OR REPLACE VIEW public.usuarios
WITH (security_invoker = true) AS
SELECT * FROM public.user_profiles;

CREATE TABLE IF NOT EXISTS public.roles_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rol text NOT NULL,
  modulos text[] NOT NULL DEFAULT '{}',
  usa_pwa boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, rol)
);

ALTER TABLE public.roles_modulos ENABLE ROW LEVEL SECURITY;

INSERT INTO public.roles_modulos (tenant_id, rol, modulos, usa_pwa)
SELECT t.id, rc.role, rc.modulos, rc.usa_pwa
FROM public.tenants t
CROSS JOIN public.roles_config rc
ON CONFLICT (tenant_id, rol) DO NOTHING;

DROP POLICY IF EXISTS "roles_modulos_tenant" ON public.roles_modulos;
CREATE POLICY "roles_modulos_tenant" ON public.roles_modulos
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (SELECT up.tenant_id FROM public.user_profiles up WHERE up.id = auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT up.tenant_id FROM public.user_profiles up WHERE up.id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles_modulos TO authenticated, service_role;
