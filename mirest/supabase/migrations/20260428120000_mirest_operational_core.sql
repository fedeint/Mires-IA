-- MiRest con IA — núcleo operativo + inventario referenciado en 20260420_harden_security_advisors_and_rls.sql
-- Idempotente: seguro re-ejecutar en entornos donde parte del esquema ya exista.
-- Requisito: JWT con claim `tenant_id` (uuid) para RLS vía app.current_tenant_id().

-- ---------------------------------------------------------------------------
-- 0a. Helper JWT (por si aún no existe; misma firma que migración harden)
-- ---------------------------------------------------------------------------
create schema if not exists app;

create or replace function app.current_tenant_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- 0b. Extensión (documents / IA)
-- ---------------------------------------------------------------------------
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- 1. Enum movimientos de inventario (vista inventory_current_stock)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'inventory_movement_type' and n.nspname = 'public') then
    create type public.inventory_movement_type as enum (
      'ingreso', 'salida', 'ajuste', 'merma'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tenants y restaurantes (multi-local opcional bajo un tenant)
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  name        text not null,
  timezone    text default 'America/Lima',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists restaurants_tenant_id_idx on public.restaurants (tenant_id);

-- ---------------------------------------------------------------------------
-- 3. Inventario (tablas base para la vista inventory_current_stock)
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  restaurant_id   uuid references public.restaurants (id) on delete set null,
  code            text not null,
  name            text not null,
  category        text,
  unit            text not null default 'und',
  stock_minimum   numeric not null default 0,
  cost_unit       numeric not null default 0,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, restaurant_id, code)
);

create table if not exists public.inventory_movements (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  restaurant_id       uuid references public.restaurants (id) on delete set null,
  inventory_item_id   uuid not null references public.inventory_items (id) on delete cascade,
  movement_type       public.inventory_movement_type not null,
  quantity            numeric not null,
  reference_type      text,
  reference_id        uuid,
  notes               text,
  created_by          uuid references auth.users (id),
  created_at          timestamptz not null default now()
);

create index if not exists inventory_movements_item_created_idx
  on public.inventory_movements (inventory_item_id, created_at desc);
create index if not exists inventory_items_tenant_rest_idx
  on public.inventory_items (tenant_id, restaurant_id);

-- ---------------------------------------------------------------------------
-- 4. Delivery catálogo (vista delivery_affiliation_overview)
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_providers (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  provider_name text not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.restaurant_delivery_affiliations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  restaurant_id         uuid not null references public.restaurants (id) on delete cascade,
  provider_id           uuid not null references public.delivery_providers (id) on delete restrict,
  affiliation_status    text not null default 'pending',
  api_health              text,
  integration_endpoint    text,
  last_sync_at            timestamptz,
  coverage                text,
  commission_rate         numeric,
  notes                   text,
  created_at              timestamptz not null default now(),
  unique (restaurant_id, provider_id)
);

create index if not exists rda_tenant_idx on public.restaurant_delivery_affiliations (tenant_id);

-- ---------------------------------------------------------------------------
-- 5. Almacén legado (PostgREST nombre que usa Almacen/almacen-db.js)
-- ---------------------------------------------------------------------------
create table if not exists public.insumos (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid references public.tenants (id) on delete cascade,
  restaurant_id    uuid references public.restaurants (id) on delete set null,
  codigo           text not null,
  nombre           text not null,
  categoria        text,
  ubicacion        text,
  stock_actual     numeric default 0,
  unidad           text,
  stock_minimo     numeric default 0,
  costo_unitario   numeric default 0,
  ultimo_ingreso   text,
  proveedor        text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (tenant_id, restaurant_id, codigo)
);

create table if not exists public.entradas_insumos (
  id                     text primary key,
  tenant_id              uuid references public.tenants (id) on delete cascade,
  restaurant_id          uuid references public.restaurants (id) on delete set null,
  fecha                  text,
  hora                   text,
  comprobante            text,
  usuario                text,
  notas                  text,
  tipo                   text,
  referencia_id          text,
  costo_total_movimiento numeric default 0,
  ingredientes           jsonb,
  archivos               jsonb,
  created_at             timestamptz default now()
);

create table if not exists public.salidas_insumos (
  id                     text primary key,
  tenant_id              uuid references public.tenants (id) on delete cascade,
  restaurant_id          uuid references public.restaurants (id) on delete set null,
  fecha                  text,
  hora                   text,
  motivo                 text,
  justificacion          text,
  comprobante            text,
  usuario                text,
  notas                  text,
  tipo                   text,
  referencia_id          text,
  costo_total_movimiento numeric default 0,
  ingredientes          jsonb,
  archivos              jsonb,
  created_at            timestamptz default now()
);

create table if not exists public.proveedores (
  id            bigint generated by default as identity primary key,
  tenant_id     uuid references public.tenants (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  nombre        text not null,
  ruc           text,
  telefono      text,
  categoria     jsonb,
  ubicacion     text,
  dias_credito  integer default 0,
  ultimo_ingreso text,
  estado        text default 'Activo',
  distancia_km  numeric default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Si estas tablas ya existían (p. ej. Almacen/migration.sql) sin multi-tenant,
-- CREATE TABLE IF NOT EXISTS no añade columnas: hay que hacerlo antes de índices/RLS.
alter table public.insumos add column if not exists tenant_id uuid references public.tenants (id) on delete cascade;
alter table public.insumos add column if not exists restaurant_id uuid references public.restaurants (id) on delete set null;
alter table public.entradas_insumos add column if not exists tenant_id uuid references public.tenants (id) on delete cascade;
alter table public.entradas_insumos add column if not exists restaurant_id uuid references public.restaurants (id) on delete set null;
alter table public.salidas_insumos add column if not exists tenant_id uuid references public.tenants (id) on delete cascade;
alter table public.salidas_insumos add column if not exists restaurant_id uuid references public.restaurants (id) on delete set null;
alter table public.proveedores add column if not exists tenant_id uuid references public.tenants (id) on delete cascade;
alter table public.proveedores add column if not exists restaurant_id uuid references public.restaurants (id) on delete set null;

create index if not exists idx_insumos_codigo on public.insumos (codigo);
create index if not exists idx_insumos_tenant on public.insumos (tenant_id);
create index if not exists idx_entradas_insumos_created on public.entradas_insumos (created_at);
create index if not exists idx_salidas_insumos_created on public.salidas_insumos (created_at);

-- ---------------------------------------------------------------------------
-- 6. Carta y pedidos
-- ---------------------------------------------------------------------------
create table if not exists public.product_categories (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  slug          text not null,
  name          text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create unique index if not exists product_categories_tenant_slug_uidx
  on public.product_categories (tenant_id, slug)
  where restaurant_id is null;
create unique index if not exists product_categories_rest_slug_uidx
  on public.product_categories (tenant_id, restaurant_id, slug)
  where restaurant_id is not null;

create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  restaurant_id   uuid references public.restaurants (id) on delete cascade,
  category_id     uuid references public.product_categories (id) on delete set null,
  sku             text,
  name            text not null,
  description     text,
  price           numeric(12, 2) not null default 0,
  currency        text not null default 'PEN',
  is_active       boolean not null default true,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists products_tenant_rest_sku_uidx
  on public.products (tenant_id, restaurant_id, sku)
  where sku is not null and restaurant_id is not null;
create unique index if not exists products_tenant_sku_global_uidx
  on public.products (tenant_id, sku)
  where sku is not null and restaurant_id is null;

create index if not exists products_tenant_active_idx on public.products (tenant_id, is_active);

create table if not exists public.dining_tables (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  label           text not null,
  zone            text,
  status          text not null default 'libre',
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  unique (restaurant_id, label)
);

create table if not exists public.customers (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  restaurant_id   uuid references public.restaurants (id) on delete set null,
  full_name       text,
  document_type   text,
  document_number text,
  phone           text,
  email           text,
  tags            text[] default '{}',
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists customers_tenant_phone_idx on public.customers (tenant_id, phone);

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'order_channel' and n.nspname = 'public') then
    create type public.order_channel as enum ('salon', 'delivery', 'takeaway');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'order_status' and n.nspname = 'public') then
    create type public.order_status as enum (
      'draft', 'open', 'in_kitchen', 'ready', 'served', 'closed', 'cancelled'
    );
  end if;
end $$;

create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  restaurant_id       uuid not null references public.restaurants (id) on delete cascade,
  channel             public.order_channel not null,
  status              public.order_status not null default 'open',
  dining_table_id     uuid references public.dining_tables (id) on delete set null,
  customer_id         uuid references public.customers (id) on delete set null,
  external_channel    text,
  external_order_id   text,
  delivery_address    text,
  delivery_phone      text,
  notes               text,
  opened_at           timestamptz not null default now(),
  closed_at           timestamptz,
  created_by          uuid references auth.users (id),
  metadata            jsonb not null default '{}'
);

-- Tabla orders legada sin columnas del flujo operativo (índice / RLS las esperan)
alter table public.orders add column if not exists tenant_id uuid references public.tenants (id) on delete cascade;
alter table public.orders add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;
alter table public.orders add column if not exists opened_at timestamptz not null default now();
alter table public.orders add column if not exists closed_at timestamptz;
alter table public.orders add column if not exists channel public.order_channel;
alter table public.orders add column if not exists status public.order_status default 'open'::public.order_status;
alter table public.orders add column if not exists dining_table_id uuid references public.dining_tables (id) on delete set null;
alter table public.orders add column if not exists customer_id uuid references public.customers (id) on delete set null;
alter table public.orders add column if not exists external_channel text;
alter table public.orders add column if not exists external_order_id text;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists delivery_phone text;
alter table public.orders add column if not exists notes text;
alter table public.orders add column if not exists created_by uuid references auth.users (id);
alter table public.orders add column if not exists metadata jsonb not null default '{}';

create index if not exists orders_tenant_rest_open_idx
  on public.orders (tenant_id, restaurant_id, status, opened_at desc);

create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  order_id        uuid not null references public.orders (id) on delete cascade,
  product_id      uuid references public.products (id) on delete set null,
  product_name    text,
  quantity        numeric(12, 3) not null default 1,
  unit_price       numeric(12, 2) not null default 0,
  line_total        numeric(12, 2) not null default 0,
  kitchen_status    text not null default 'pending',
  note              text,
  created_at        timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- 7. Caja y facturación
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'payment_method' and n.nspname = 'public') then
    create type public.payment_method as enum (
      'cash', 'card', 'yape', 'plin', 'transfer', 'other'
    );
  end if;
end $$;

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  order_id        uuid references public.orders (id) on delete set null,
  method          public.payment_method not null,
  amount          numeric(12, 2) not null,
  currency        text not null default 'PEN',
  received_at     timestamptz not null default now(),
  recorded_by     uuid references auth.users (id),
  metadata        jsonb not null default '{}'
);

create table if not exists public.cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  opening_float   numeric(12, 2) not null default 0,
  closing_count   numeric(12, 2),
  opened_by       uuid references auth.users (id),
  closed_by       uuid references auth.users (id),
  metadata        jsonb not null default '{}'
);

alter table public.cash_sessions add column if not exists tenant_id uuid references public.tenants (id) on delete cascade;
alter table public.cash_sessions add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;
alter table public.cash_sessions add column if not exists opened_at timestamptz not null default now();
alter table public.cash_sessions add column if not exists closed_at timestamptz;
alter table public.cash_sessions add column if not exists opening_float numeric(12, 2) not null default 0;
alter table public.cash_sessions add column if not exists closing_count numeric(12, 2);
alter table public.cash_sessions add column if not exists opened_by uuid references auth.users (id);
alter table public.cash_sessions add column if not exists closed_by uuid references auth.users (id);
alter table public.cash_sessions add column if not exists metadata jsonb not null default '{}';

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  order_id        uuid references public.orders (id) on delete set null,
  document_type   text not null,
  series          text,
  number          text,
  total           numeric(12, 2) not null default 0,
  currency        text not null default 'PEN',
  status          text not null default 'draft',
  issued_at       timestamptz,
  xml_url         text,
  pdf_url         text,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create table if not exists public.credit_notes (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  invoice_id      uuid not null references public.invoices (id) on delete cascade,
  reason          text,
  total           numeric(12, 2) not null default 0,
  issued_at       timestamptz,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Recetas (costeo; insumo_id → public.insumos)
-- ---------------------------------------------------------------------------
create table if not exists public.recipes (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  restaurant_id     uuid references public.restaurants (id) on delete cascade,
  name              text not null,
  portions          numeric(12, 2) not null default 1,
  sale_product_id   uuid references public.products (id) on delete set null,
  is_active         boolean not null default true,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references public.recipes (id) on delete cascade,
  insumo_id     uuid references public.insumos (id) on delete set null,
  quantity      numeric(12, 4) not null,
  unit          text not null default 'kg',
  notes         text
);

create index if not exists recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

-- ---------------------------------------------------------------------------
-- 9. Ajustes RLS (alinear con migración harden: tablas que ya tenían RLS)
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.restaurants enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.delivery_providers enable row level security;
alter table public.restaurant_delivery_affiliations enable row level security;
alter table public.insumos enable row level security;
alter table public.entradas_insumos enable row level security;
alter table public.salidas_insumos enable row level security;
alter table public.proveedores enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.dining_tables enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.invoices enable row level security;
alter table public.credit_notes enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

-- Políticas tenant (authenticated + tenant_id en JWT)
drop policy if exists restaurants_tenant_select on public.restaurants;
create policy restaurants_tenant_select
  on public.restaurants for select to authenticated
  using (tenant_id = app.current_tenant_id());

drop policy if exists restaurants_tenant_write on public.restaurants;
create policy restaurants_tenant_write
  on public.restaurants for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists inventory_items_tenant on public.inventory_items;
create policy inventory_items_tenant
  on public.inventory_items for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists inventory_movements_tenant on public.inventory_movements;
create policy inventory_movements_tenant
  on public.inventory_movements for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists rda_tenant on public.restaurant_delivery_affiliations;
create policy rda_tenant
  on public.restaurant_delivery_affiliations for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists insumos_tenant on public.insumos;
create policy insumos_tenant
  on public.insumos for all to authenticated
  using (tenant_id is null or tenant_id = app.current_tenant_id())
  with check (tenant_id is null or tenant_id = app.current_tenant_id());

drop policy if exists entradas_tenant on public.entradas_insumos;
create policy entradas_tenant
  on public.entradas_insumos for all to authenticated
  using (tenant_id is null or tenant_id = app.current_tenant_id())
  with check (tenant_id is null or tenant_id = app.current_tenant_id());

drop policy if exists salidas_tenant on public.salidas_insumos;
create policy salidas_tenant
  on public.salidas_insumos for all to authenticated
  using (tenant_id is null or tenant_id = app.current_tenant_id())
  with check (tenant_id is null or tenant_id = app.current_tenant_id());

drop policy if exists proveedores_tenant on public.proveedores;
create policy proveedores_tenant
  on public.proveedores for all to authenticated
  using (tenant_id is null or tenant_id = app.current_tenant_id())
  with check (tenant_id is null or tenant_id = app.current_tenant_id());

drop policy if exists product_categories_tenant on public.product_categories;
create policy product_categories_tenant
  on public.product_categories for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists products_tenant on public.products;
create policy products_tenant
  on public.products for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists dining_tables_tenant on public.dining_tables;
create policy dining_tables_tenant
  on public.dining_tables for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists customers_tenant on public.customers;
create policy customers_tenant
  on public.customers for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists orders_tenant on public.orders;
create policy orders_tenant
  on public.orders for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists order_items_tenant on public.order_items;
create policy order_items_tenant
  on public.order_items for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists payments_tenant on public.payments;
create policy payments_tenant
  on public.payments for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists cash_sessions_tenant on public.cash_sessions;
create policy cash_sessions_tenant
  on public.cash_sessions for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists invoices_tenant on public.invoices;
create policy invoices_tenant
  on public.invoices for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists credit_notes_tenant on public.credit_notes;
create policy credit_notes_tenant
  on public.credit_notes for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists recipes_tenant on public.recipes;
create policy recipes_tenant
  on public.recipes for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists recipe_ingredients_by_recipe on public.recipe_ingredients;
create policy recipe_ingredients_by_recipe
  on public.recipe_ingredients for all to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.tenant_id = app.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.tenant_id = app.current_tenant_id()
    )
  );

-- delivery_providers: solo lectura autenticada (catálogo global)
drop policy if exists delivery_providers_authenticated_select on public.delivery_providers;
create policy delivery_providers_authenticated_select
  on public.delivery_providers for select to authenticated
  using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- 10. Recrear vistas que dependen de inventory_* (definición en harden)
-- ---------------------------------------------------------------------------
create or replace view public.inventory_current_stock
with (security_invoker = true) as
select
  ii.tenant_id,
  ii.restaurant_id,
  ii.id as inventory_item_id,
  ii.code as item_code,
  ii.name as item_name,
  ii.category,
  ii.unit,
  ii.stock_minimum,
  ii.cost_unit,
  coalesce(sum(
    case
      when im.movement_type = any (array['ingreso'::inventory_movement_type, 'ajuste'::inventory_movement_type]) then im.quantity
      when im.movement_type = any (array['salida'::inventory_movement_type, 'merma'::inventory_movement_type]) then im.quantity * -1
      else 0
    end
  ), 0) as stock,
  case
    when coalesce(sum(
      case
        when im.movement_type = any (array['ingreso'::inventory_movement_type, 'ajuste'::inventory_movement_type]) then im.quantity
        when im.movement_type = any (array['salida'::inventory_movement_type, 'merma'::inventory_movement_type]) then im.quantity * -1
        else 0
      end
    ), 0) <= ii.stock_minimum * 0.5 then 'critical'
    when coalesce(sum(
      case
        when im.movement_type = any (array['ingreso'::inventory_movement_type, 'ajuste'::inventory_movement_type]) then im.quantity
        when im.movement_type = any (array['salida'::inventory_movement_type, 'merma'::inventory_movement_type]) then im.quantity * -1
        else 0
      end
    ), 0) <= ii.stock_minimum then 'low'
    else 'ok'
  end as status
from public.inventory_items ii
left join public.inventory_movements im on im.inventory_item_id = ii.id
group by ii.tenant_id, ii.restaurant_id, ii.id, ii.code, ii.name, ii.category, ii.unit, ii.stock_minimum, ii.cost_unit;

create or replace view public.delivery_affiliation_overview
with (security_invoker = true) as
select
  rda.tenant_id,
  rda.restaurant_id,
  dp.slug,
  dp.provider_name,
  rda.affiliation_status,
  rda.api_health,
  rda.integration_endpoint,
  rda.last_sync_at,
  rda.coverage,
  rda.commission_rate,
  rda.notes
from public.restaurant_delivery_affiliations rda
join public.delivery_providers dp on dp.id = rda.provider_id;

-- ---------------------------------------------------------------------------
-- 11. Configuración por restaurante (clave/valor JSON)
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_settings (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  key             text not null,
  value           jsonb not null default '{}',
  updated_at      timestamptz not null default now(),
  unique (restaurant_id, key)
);

alter table public.restaurant_settings enable row level security;

drop policy if exists restaurant_settings_tenant on public.restaurant_settings;
create policy restaurant_settings_tenant
  on public.restaurant_settings for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- ---------------------------------------------------------------------------
-- 12. Política tenants (si la tabla se creó aquí y aún no tenía política)
-- ---------------------------------------------------------------------------
drop policy if exists tenants_authenticated_select_own on public.tenants;
create policy tenants_authenticated_select_own
  on public.tenants for select to authenticated
  using (id = app.current_tenant_id());

-- ---------------------------------------------------------------------------
-- 13. Catálogo mínimo de integradores delivery (para pruebas de afiliación)
-- ---------------------------------------------------------------------------
insert into public.delivery_providers (slug, provider_name)
values
  ('rappi', 'Rappi'),
  ('pedidosya', 'PedidosYa'),
  ('ubereats', 'Uber Eats'),
  ('direct', 'Directo / WhatsApp')
on conflict (slug) do nothing;
