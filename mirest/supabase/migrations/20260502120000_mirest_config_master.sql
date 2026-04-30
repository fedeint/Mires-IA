-- Configuración maestra: columnas en tenants, tablas alertas/horarios/módulos/onboarding/auditoría/integraciones.
-- RLS: tenant = JWT tenant_id; superadmin (app_metadata.role) abarca todos los tenants.

-- ---------------------------------------------------------------------------
-- 0) Helpers: superadmin desde JWT (misma convención que access_requests)
-- ---------------------------------------------------------------------------
create or replace function public.jwt_is_config_superadmin ()
  returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin'
$$;

-- ---------------------------------------------------------------------------
-- 1) Extiende tenants (DallA + ficha; columnas nulas hasta que rellene la app)
-- ---------------------------------------------------------------------------
alter table public.tenants add column if not exists dalla_nombre text;
alter table public.tenants add column if not exists dalla_tono text
  check (dalla_tono is null or dalla_tono in ('tuteo', 'usted'));
alter table public.tenants add column if not exists dalla_personalidad text
  check (dalla_personalidad is null or dalla_personalidad in ('formal', 'amigable', 'directo'));
alter table public.tenants add column if not exists dalla_activo_por_modulo jsonb not null default '{}';
alter table public.tenants add column if not exists logo_url text;
alter table public.tenants add column if not exists direccion text;
alter table public.tenants add column if not exists ruc text;
alter table public.tenants add column if not exists telefono text;
alter table public.tenants add column if not exists email_contacto text;
alter table public.tenants add column if not exists zona_horaria text default 'America/Lima';
alter table public.tenants add column if not exists moneda text default 'PEN';
alter table public.tenants add column if not exists plan text
  check (plan is null or plan in ('starter', 'pro', 'enterprise'));
alter table public.tenants add column if not exists max_usuarios integer;
alter table public.tenants add column if not exists fecha_renovacion date;
alter table public.tenants add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 2) Enums nuevos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'alerta_tipo' and n.nspname = 'public') then
    create type public.alerta_tipo as enum (
      'stock_critico', 'caja_cerrada', 'pedido_cobrado', 'reporte_diario', 'stock_agotado'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'alerta_canal' and n.nspname = 'public') then
    create type public.alerta_canal as enum ('email', 'whatsapp', 'push');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'dia_semana' and n.nspname = 'public') then
    create type public.dia_semana as enum (
      'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'turno_horario' and n.nspname = 'public') then
    create type public.turno_horario as enum ('unico', 'manana', 'noche');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'config_modulo_key' and n.nspname = 'public') then
    create type public.config_modulo_key as enum (
      'pedidos', 'cocina', 'caja', 'almacen', 'productos', 'recetas', 'proveedores',
      'delivery', 'clientes', 'facturacion', 'reportes', 'dalla'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'auditoria_config_accion' and n.nspname = 'public') then
    create type public.auditoria_config_accion as enum (
      'crear', 'editar', 'eliminar', 'activar', 'desactivar'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'integracion_servicio' and n.nspname = 'public') then
    create type public.integracion_servicio as enum (
      'rappi', 'pedidosya', 'sunat', 'whatsapp_api'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) alertas_config
-- ---------------------------------------------------------------------------
create table if not exists public.alertas_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tipo public.alerta_tipo not null,
  canal public.alerta_canal not null,
  destinatario text,
  activo boolean not null default true,
  umbral_stock integer,
  hora_reporte time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, tipo, canal)
);

-- ---------------------------------------------------------------------------
-- 4) tenant_modulos
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_modulos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  modulo public.config_modulo_key not null,
  activo boolean not null default true,
  visible_en_menu boolean not null default true,
  orden_menu integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (tenant_id, modulo)
);

-- ---------------------------------------------------------------------------
-- 5) tenant_horarios
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_horarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  dia public.dia_semana not null,
  hora_apertura time,
  hora_cierre time,
  activo boolean not null default true,
  turno public.turno_horario not null default 'unico',
  updated_at timestamptz not null default now(),
  unique (tenant_id, dia, turno)
);

-- ---------------------------------------------------------------------------
-- 6) Onboarding
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  modulo text not null,
  rol text,
  orden integer not null default 0,
  titulo text not null,
  descripcion text,
  accion_requerida text,
  completado_cuando text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  user_id uuid not null,
  step_id uuid not null references public.onboarding_steps (id) on delete cascade,
  completado boolean not null default false,
  fecha_completado timestamptz,
  unique (user_id, step_id)
);

-- ---------------------------------------------------------------------------
-- 7) auditoria_config
-- ---------------------------------------------------------------------------
create table if not exists public.auditoria_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid,
  seccion text not null,
  accion public.auditoria_config_accion not null,
  detalle jsonb not null default '{}',
  ts timestamptz not null default now()
);
create index if not exists idx_auditoria_config_tenant_ts
  on public.auditoria_config (tenant_id, ts desc);

-- ---------------------------------------------------------------------------
-- 8) tenant_integraciones (claves en claro: la app deberá cifrar/mascar en UI; columna = texto)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_integraciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  servicio public.integracion_servicio not null,
  api_key text,
  activo boolean not null default false,
  ultimo_sync timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, servicio)
);

-- ---------------------------------------------------------------------------
-- 9) RLS
-- ---------------------------------------------------------------------------
alter table public.alertas_config enable row level security;
alter table public.tenant_modulos enable row level security;
alter table public.tenant_horarios enable row level security;
alter table public.onboarding_steps enable row level security;
alter table public.onboarding_progress enable row level security;
alter table public.auditoria_config enable row level security;
alter table public.tenant_integraciones enable row level security;

-- tenants: ya existía; reforzamos update para admin de su tenant
drop policy if exists tenants_cfg_select on public.tenants;
create policy tenants_cfg_select on public.tenants
  for select to authenticated
  using (id = app.current_tenant_id() or public.jwt_is_config_superadmin ());

drop policy if exists tenants_cfg_update on public.tenants;
create policy tenants_cfg_update on public.tenants
  for update to authenticated
  using (id = app.current_tenant_id() or public.jwt_is_config_superadmin ())
  with check (id = app.current_tenant_id() or public.jwt_is_config_superadmin ());

-- Plantilla: políticas comunes "mi tenant o superadmin"
-- alertas_config
drop policy if exists alertas_config_rw on public.alertas_config;
create policy alertas_config_rw on public.alertas_config
  for all to authenticated
  using (tenant_id = app.current_tenant_id() or public.jwt_is_config_superadmin ())
  with check (tenant_id = app.current_tenant_id() or public.jwt_is_config_superadmin ());

-- tenant_modulos
drop policy if exists tenant_modulos_rw on public.tenant_modulos;
create policy tenant_modulos_rw on public.tenant_modulos
  for all to authenticated
  using (tenant_id = app.current_tenant_id() or public.jwt_is_config_superadmin ())
  with check (tenant_id = app.current_tenant_id() or public.jwt_is_config_superadmin ());

-- tenant_horarios
drop policy if exists tenant_horarios_rw on public.tenant_horarios;
create policy tenant_horarios_rw on public.tenant_horarios
  for all to authenticated
  using (tenant_id = app.current_tenant_id() or public.jwt_is_config_superadmin ())
  with check (tenant_id = app.current_tenant_id() or public.jwt_is_config_superadmin ());

-- onboarding_steps: lectores del tenant; escritura reservada a superadmin
drop policy if exists onboarding_steps_select on public.onboarding_steps;
create policy onboarding_steps_select on public.onboarding_steps
  for select to authenticated
  using (
    tenant_id is null
    or tenant_id = app.current_tenant_id()
    or public.jwt_is_config_superadmin ()
  );

drop policy if exists onboarding_steps_write on public.onboarding_steps;
create policy onboarding_steps_write on public.onboarding_steps
  for all to authenticated
  using (public.jwt_is_config_superadmin ())
  with check (public.jwt_is_config_superadmin ());

-- onboarding_progress: el usuario o superadmin; admin de tenant: ver progreso del local (v2)
drop policy if exists onboarding_progress_self on public.onboarding_progress;
create policy onboarding_progress_tenant on public.onboarding_progress
  for all to authenticated
  using (tenant_id = app.current_tenant_id() or public.jwt_is_config_superadmin ())
  with check (tenant_id = app.current_tenant_id() or public.jwt_is_config_superadmin ());

-- auditoria_config: solo lectura de su tenant; insert permitido a authenticated (servicio pone user_id)
drop policy if exists auditoria_config_read on public.auditoria_config;
create policy auditoria_config_read on public.auditoria_config
  for select to authenticated
  using (tenant_id = app.current_tenant_id() or public.jwt_is_config_superadmin ());

drop policy if exists auditoria_config_ins on public.auditoria_config;
create policy auditoria_config_ins on public.auditoria_config
  for insert to authenticated
  with check (tenant_id = app.current_tenant_id() or public.jwt_is_config_superadmin ());

-- tenant_integraciones
drop policy if exists tenant_integraciones_rw on public.tenant_integraciones;
create policy tenant_integraciones_rw on public.tenant_integraciones
  for all to authenticated
  using (tenant_id = app.current_tenant_id() or public.jwt_is_config_superadmin ())
  with check (tenant_id = app.current_tenant_id() or public.jwt_is_config_superadmin ());

-- Reemplaza política antigua restrictiva de tenants (solo select own) con las nuevas
-- (harden migration podía haber creado tenants_authenticated_select_own)
drop policy if exists tenants_authenticated_select_own on public.tenants;

-- ---------------------------------------------------------------------------
-- 10) Trigger: no permitir a no-superadmin editar plan, max_usuarios, fecha_renovacion
-- ---------------------------------------------------------------------------
create or replace function public.trg_tenants_strip_plan_for_non_superadmin ()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not public.jwt_is_config_superadmin() then
    new.plan = old.plan;
    new.max_usuarios = old.max_usuarios;
    new.fecha_renovacion = old.fecha_renovacion;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tenants_plan_guard on public.tenants;
create trigger trg_tenants_plan_guard
  before update on public.tenants
  for each row
  execute function public.trg_tenants_strip_plan_for_non_superadmin ();

-- ---------------------------------------------------------------------------
-- 11) Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.alertas_config to authenticated, service_role;
grant select, insert, update, delete on public.tenant_modulos to authenticated, service_role;
grant select, insert, update, delete on public.tenant_horarios to authenticated, service_role;
grant select, insert, update, delete on public.onboarding_steps to authenticated, service_role;
grant select, insert, update, delete on public.onboarding_progress to authenticated, service_role;
grant select, insert on public.auditoria_config to authenticated, service_role;
grant select, insert, update, delete on public.tenant_integraciones to authenticated, service_role;
grant update on public.tenants to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12) Semilla tenant_modulos para tenants existentes (1 fila / módulo; orden por enum)
-- ---------------------------------------------------------------------------
insert into public.tenant_modulos (tenant_id, modulo, activo, visible_en_menu, orden_menu)
select t.id, m.modulo, true, true, m.ord
from public.tenants t
cross join (
  values
    ('pedidos'::public.config_modulo_key, 1),
    ('cocina'::public.config_modulo_key, 2),
    ('caja'::public.config_modulo_key, 3),
    ('almacen'::public.config_modulo_key, 4),
    ('productos'::public.config_modulo_key, 5),
    ('recetas'::public.config_modulo_key, 6),
    ('proveedores'::public.config_modulo_key, 7),
    ('delivery'::public.config_modulo_key, 8),
    ('clientes'::public.config_modulo_key, 9),
    ('facturacion'::public.config_modulo_key, 10),
    ('reportes'::public.config_modulo_key, 11),
    ('dalla'::public.config_modulo_key, 12)
) as m (modulo, ord)
on conflict (tenant_id, modulo) do nothing;
