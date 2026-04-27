-- Turnos por usuario (módulo Accesos) — un registro por (usuario, día).
-- Reutiliza public.dia_semana si ya existe (mirest_config_master).
-- Necesita: app.current_tenant_id (otras migraciones) y jwt_is_config_superadmin
--   (en 20260502120000 o 20260503050000).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'turno_categoria' and n.nspname = 'public') then
    create type public.turno_categoria as enum ('fijo', 'rotativo');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'dia_semana' and n.nspname = 'public') then
    create type public.dia_semana as enum (
      'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'
    );
  end if;
end $$;

create table if not exists public.usuario_turnos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  dia public.dia_semana not null,
  hora_entrada time,
  hora_salida time,
  activo boolean not null default true,
  categoria public.turno_categoria not null default 'fijo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dia)
);

create index if not exists idx_usuario_turnos_tenant on public.usuario_turnos (tenant_id);
create index if not exists idx_usuario_turnos_user on public.usuario_turnos (user_id, activo);

alter table public.usuario_turnos enable row level security;

drop policy if exists usuario_turnos_select on public.usuario_turnos;
drop policy if exists usuario_turnos_insert on public.usuario_turnos;
drop policy if exists usuario_turnos_update on public.usuario_turnos;
drop policy if exists usuario_turnos_delete on public.usuario_turnos;
drop policy if exists usuario_turnos_all on public.usuario_turnos;

-- Mismo criterio que otras tablas de tenant: JWT app.current_tenant_id();
-- superadmin (sin filtro de tenant en JWT) vía helper del proyecto
create policy usuario_turnos_select on public.usuario_turnos
  for select
  to authenticated
  using (
    (tenant_id = app.current_tenant_id() and app.current_tenant_id() is not null)
    or public.jwt_is_config_superadmin()
  );

create policy usuario_turnos_insert on public.usuario_turnos
  for insert
  to authenticated
  with check (
    (tenant_id = app.current_tenant_id() and app.current_tenant_id() is not null)
    or public.jwt_is_config_superadmin()
  );

create policy usuario_turnos_update on public.usuario_turnos
  for update
  to authenticated
  using (
    (tenant_id = app.current_tenant_id() and app.current_tenant_id() is not null)
    or public.jwt_is_config_superadmin()
  )
  with check (
    (tenant_id = app.current_tenant_id() and app.current_tenant_id() is not null)
    or public.jwt_is_config_superadmin()
  );

create policy usuario_turnos_delete on public.usuario_turnos
  for delete
  to authenticated
  using (
    (tenant_id = app.current_tenant_id() and app.current_tenant_id() is not null)
    or public.jwt_is_config_superadmin()
  );

grant select, insert, update, delete on public.usuario_turnos to authenticated, service_role;
