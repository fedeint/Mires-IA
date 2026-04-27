-- roles_config: plantilla por rol (módulos shell + PWA) y activación PWA
-- Ejecutar en Supabase → SQL o como migración; luego ajusta según RLS/tenant.

create table if not exists public.roles_config (
  role text primary key,
  modulos text[] not null default '{}',
  usa_pwa boolean not null default true,
  updated_at timestamptz default now()
);

comment on table public.roles_config is 'Módulos permitidos por defecto (ids del shell) y si el rol usa la PWA de operación Pedidos.';

-- Lectura a cualquier usuario autenticado (shell + PWA con misma clave)
alter table public.roles_config enable row level security;

create policy "roles_config_select_auth"
  on public.roles_config
  for select
  to authenticated
  using (true);

-- Escribir solo vía servicio/Admin (o añade política por rol superadmin)

-- Datos iniciales (mismo criterio que scripts/navigation.js; superadmin: *)
insert into public.roles_config (role, modulos, usa_pwa) values
  ('superadmin', array['*']::text[], true),
  ('admin', array['almacen', 'caja', 'cocina', 'clientes', 'facturacion', 'ia', 'pedidos', 'productos', 'proveedores', 'recetas', 'reportes', 'soporte', 'configuracion', 'accesos']::text[], true),
  ('caja', array['caja', 'pedidos', 'clientes', 'soporte']::text[], true),
  ('chef', array['cocina', 'almacen', 'recetas', 'soporte', 'almacen_lectura']::text[], true),
  ('pedidos', array['pedidos', 'soporte']::text[], true),
  ('almacen', array['almacen', 'proveedores', 'recetas', 'soporte']::text[], true),
  ('marketing', array['reportes', 'clientes', 'productos', 'soporte', 'productos_lectura']::text[], true)
on conflict (role) do update set
  modulos = excluded.modulos,
  usa_pwa = excluded.usa_pwa,
  updated_at = now();
