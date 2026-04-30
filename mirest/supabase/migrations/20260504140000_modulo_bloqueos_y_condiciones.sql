-- =============================================================================
-- MiRest: condiciones cruzadas entre módulos y registro de bloqueos
-- - modulo_condiciones: qué se valida, mensajes, flags de notificación (por tenant)
-- - modulo_bloqueos: cada intento bloqueado (auditoría + Nivel 1–3)
-- RLS: tenant vía app.current_tenant_id(); superadmin: jwt_is_config_superadmin()
-- Idempotente: IF NOT EXISTS / OR REPLACE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Enum: tipo de condición
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'condicion_tipo' and n.nspname = 'public'
  ) then
    create type public.condicion_tipo as enum ('bloqueo', 'advertencia');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Tabla: definición de condiciones (por tenant; SuperAdmin puede ajustar activo)
-- ---------------------------------------------------------------------------
create table if not exists public.modulo_condiciones (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  codigo_regla          text not null,
  modulo_origen         text not null,
  accion                text not null,
  condicion             text not null,
  query_verificacion     text,
  tipo                  public.condicion_tipo not null default 'bloqueo',
  mensaje_usuario        text not null,
  mensaje_admin          text,
  activo                boolean not null default true,
  notifica_admin         boolean not null default true,
  notifica_superadmin   boolean not null default false,
  no_desactivable        boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tenant_id, codigo_regla)
);

create index if not exists idx_modulo_condiciones_tenant_activo
  on public.modulo_condiciones (tenant_id, activo)
  where activo;

-- ---------------------------------------------------------------------------
-- 3) Tabla: instancias de bloqueo (Nivel 1: UI; 2/3: job + notificaciones)
-- ---------------------------------------------------------------------------
create table if not exists public.modulo_bloqueos (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  restaurant_id         uuid references public.restaurants (id) on delete set null,
  user_id               uuid references auth.users (id) on delete set null,
  modulo                text not null,
  accion                text not null,
  condicion_faltante    text not null,
  condicion_id          uuid references public.modulo_condiciones (id) on delete set null,
  resuelto              boolean not null default false,
  fecha_bloqueo         timestamptz not null default now(),
  fecha_resolucion      timestamptz,
  metadata              jsonb not null default '{}'
);

create index if not exists idx_modulo_bloqueos_tenant_pendiente
  on public.modulo_bloqueos (tenant_id, resuelto, fecha_bloqueo desc);

create index if not exists idx_modulo_bloqueos_superadmin_24h
  on public.modulo_bloqueos (tenant_id, fecha_bloqueo)
  where not resuelto;

-- ---------------------------------------------------------------------------
-- 4) Trigger: reglas core — no se puede poner activo = false si no_desactivable
-- ---------------------------------------------------------------------------
create or replace function public.trg_modulo_condiciones_prevent_core_disable ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'insert' then
    if new.no_desactivable and new.activo = false and not public.jwt_is_config_superadmin() then
      raise exception 'CONDICION_CORE: las condiciones core no se pueden desactivar' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'update' then
    if new.no_desactivable
       and new.activo = false
       and (old.activo = true)
       and not public.jwt_is_config_superadmin() then
      raise exception 'CONDICION_CORE: las condiciones core no se pueden desactivar' using errcode = '23514';
    end if;
  end if;
  if tg_op in ('update', 'insert') then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_modulo_condiciones_core on public.modulo_condiciones;
create trigger trg_modulo_condiciones_core
  before insert or update on public.modulo_condiciones
  for each row
  execute function public.trg_modulo_condiciones_prevent_core_disable ();

-- Al resolver, timestamp
create or replace function public.trg_modulo_bloqueos_set_resolucion ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'update' then
    if new.resuelto = true and (old.resuelto = false) then
      new.fecha_resolucion := coalesce(new.fecha_resolucion, now());
    end if;
    if new.resuelto = false then
      new.fecha_resolucion := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_modulo_bloqueos_res on public.modulo_bloqueos;
create trigger trg_modulo_bloqueos_res
  before update on public.modulo_bloqueos
  for each row
  execute function public.trg_modulo_bloqueos_set_resolucion ();

-- ---------------------------------------------------------------------------
-- 5) Vista: bloqueos sin resolver > 24h (Nivel 3 / digest)
-- ---------------------------------------------------------------------------
create or replace view public.v_modulo_bloqueos_pendientes_24h
with (security_invoker = true) as
select
  b.*,
  t.name as tenant_nombre
from public.modulo_bloqueos b
join public.tenants t on t.id = b.tenant_id
where not b.resuelto
  and b.fecha_bloqueo < (now() - interval '24 hours');

comment on view public.v_modulo_bloqueos_pendientes_24h is
  'Bloqueos aún abiertos después de 24h (alerta Nivel 3 a SuperAdmin). Usar con rol superadmin o service_role.';

-- ---------------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------------
alter table public.modulo_condiciones enable row level security;
alter table public.modulo_bloqueos enable row level security;

drop policy if exists modulo_condiciones_select on public.modulo_condiciones;
create policy modulo_condiciones_select on public.modulo_condiciones
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    or public.jwt_is_config_superadmin ()
  );

drop policy if exists modulo_condiciones_write on public.modulo_condiciones;
create policy modulo_condiciones_write on public.modulo_condiciones
  for all to authenticated
  using (
    tenant_id = app.current_tenant_id()
    or public.jwt_is_config_superadmin ()
  )
  with check (
    tenant_id = app.current_tenant_id()
    or public.jwt_is_config_superadmin ()
  );

drop policy if exists modulo_bloqueos_all on public.modulo_bloqueos;
create policy modulo_bloqueos_all on public.modulo_bloqueos
  for all to authenticated
  using (
    tenant_id = app.current_tenant_id()
    or public.jwt_is_config_superadmin ()
  )
  with check (
    tenant_id = app.current_tenant_id()
    or public.jwt_is_config_superadmin ()
  );

-- ---------------------------------------------------------------------------
-- 7) Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.modulo_condiciones to authenticated, service_role;
grant select, insert, update, delete on public.modulo_bloqueos to authenticated, service_role;
grant select on public.v_modulo_bloqueos_pendientes_24h to service_role;
grant select on public.v_modulo_bloqueos_pendientes_24h to authenticated;

-- superadmin: lectura de vista (filtrar en app por role)
-- authenticated sin superadmin: la vista requiere JOIN tenants — ocultar si hace falta
comment on table public.modulo_bloqueos is
  'Intentos de acción bloqueados: toast al usuario, notificaciones admin vía outbox/Edge según condición.';

comment on table public.modulo_condiciones is
  'Definición por tenant de qué acciones se validan; query_verificacion solo documentación/Edge (no evaluar en cliente).';
