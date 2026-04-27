-- Presencia en tiempo real: sesiones (histórico) + fila actual por usuario.
-- Canales Realtime: cliente usa `channel('mirest-presence-tenant-'+uuid)` con Presence;
--   esta migración además publica filas para postgres_changes + sweep de cierres.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'usuario_presencia_estado' and n.nspname = 'public') then
    create type public.usuario_presencia_estado as enum ('online', 'offline', 'inactivo');
  end if;
  if not exists (select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'dispositivo_presencia' and n.nspname = 'public') then
    create type public.dispositivo_presencia as enum ('web', 'pwa', 'mobile');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table if not exists public.usuario_sesiones (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  user_id            uuid not null references public.user_profiles (id) on delete cascade,
  fecha              date not null,
  hora_conexion      timestamptz not null,
  hora_desconexion   timestamptz,
  duracion_minutos   integer,
  dispositivo        public.dispositivo_presencia not null default 'web',
  client_ip          text,
  cierre_tipo        text
    check (cierre_tipo is null or cierre_tipo in ('manual', 'automatica', 'logout', 'sweep'))
);
create index if not exists idx_usuario_sesiones_tenant_user
  on public.usuario_sesiones (tenant_id, user_id, hora_conexion desc);
create index if not exists idx_usuario_sesiones_fecha
  on public.usuario_sesiones (tenant_id, user_id, fecha desc);

-- Una fila por usuario (última presencia; PK = user_id asegura un dispositivo “gana”)
create table if not exists public.usuario_presencia (
  user_id          uuid primary key references public.user_profiles (id) on delete cascade,
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  estado            public.usuario_presencia_estado not null default 'offline',
  ultima_actividad  timestamptz not null default now(),
  dispositivo       public.dispositivo_presencia not null default 'web',
  sesion_id         uuid references public.usuario_sesiones (id) on delete set null
);
create index if not exists idx_usuario_presencia_tenant
  on public.usuario_presencia (tenant_id);

-- FK sesion ahora que usuario_presencia existe: alter si ya estaba
alter table public.usuario_presencia
  drop constraint if exists usuario_presencia_sesion_id_fkey;

alter table public.usuario_presencia
  add constraint usuario_presencia_sesion_id_fkey
  foreign key (sesion_id) references public.usuario_sesiones (id) on delete set null;

alter table public.usuario_sesiones enable row level security;
alter table public.usuario_presencia enable row level security;

-- ---------------------------------------------------------------------------
-- Puede ver presencia de todo el tenant (admin / módulo accesos o superárea)
-- ---------------------------------------------------------------------------
create or replace function public.mirest_puede_ver_presencia_tenant (p_tenant uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tid uuid;
begin
  v_tid := app.current_tenant_id();
  if public.jwt_is_config_superadmin() then
    return true;
  end if;
  if v_tid is null or p_tenant <> v_tid then
    return false;
  end if;
  return exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid()
      and p.tenant_id = v_tid
      and coalesce(p.role, '') in (
        'admin', 'administrador', 'dueno', 'superadmin', 'proprietario', 'encargado', 'proprietario_tenant'
      )
  );
end;
$$;

create or replace function public.mirest_es_sesion_propio (p_sesion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuario_sesiones s
    where s.id = p_sesion_id
      and s.user_id = auth.uid()
      and s.tenant_id = app.current_tenant_id()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
drop policy if exists usuario_sesiones_read on public.usuario_sesiones;
create policy usuario_sesiones_read on public.usuario_sesiones
  for select
  to authenticated
  using (
    (user_id = auth.uid() and tenant_id = app.current_tenant_id())
    or (tenant_id = app.current_tenant_id() and mirest_puede_ver_presencia_tenant (tenant_id))
  );

-- Escritura: solo el propio usuario (las RPCs usan el mismo contexto de sesión)
drop policy if exists usuario_sesiones_no_direct on public.usuario_sesiones;
drop policy if exists usuario_sesiones_ins on public.usuario_sesiones;
create policy usuario_sesiones_ins on public.usuario_sesiones
  for insert
  to authenticated
  with check (user_id = auth.uid() and tenant_id = app.current_tenant_id());
drop policy if exists usuario_sesiones_upd on public.usuario_sesiones;
create policy usuario_sesiones_upd on public.usuario_sesiones
  for update
  to authenticated
  using (user_id = auth.uid() and tenant_id = app.current_tenant_id())
  with check (user_id = auth.uid() and tenant_id = app.current_tenant_id());

grant select, insert, update, delete on public.usuario_sesiones to service_role;

-- Presencia: lectura según rol; sin escritura directa
drop policy if exists usuario_presencia_read on public.usuario_presencia;
create policy usuario_presencia_read on public.usuario_presencia
  for select
  to authenticated
  using (
    (user_id = auth.uid() and tenant_id = app.current_tenant_id())
    or (tenant_id = app.current_tenant_id() and mirest_puede_ver_presencia_tenant (tenant_id))
  );

drop policy if exists usuario_presencia_no_write on public.usuario_presencia;
drop policy if exists usuario_presencia_ups on public.usuario_presencia;
create policy usuario_presencia_ups on public.usuario_presencia
  for insert
  to authenticated
  with check (user_id = auth.uid() and tenant_id = app.current_tenant_id());
drop policy if exists usuario_presencia_u on public.usuario_presencia;
create policy usuario_presencia_u on public.usuario_presencia
  for update
  to authenticated
  using (user_id = auth.uid() and tenant_id = app.current_tenant_id())
  with check (user_id = auth.uid() and tenant_id = app.current_tenant_id());

-- ---------------------------------------------------------------------------
-- Iniciar sesión: insert usuario_sesiones + upsert presencia
-- ---------------------------------------------------------------------------
create or replace function public.mirest_presence_sesion_iniciar (p_dispositivo text default 'web', p_client_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_uid   uuid;
  v_disp  public.dispositivo_presencia;
  v_sid   uuid;
begin
  v_uid := auth.uid();
  v_tenant := app.current_tenant_id();
  if v_uid is null or v_tenant is null then
    return jsonb_build_object('ok', false, 'error', 'auth o tenant faltante');
  end if;
  begin
    v_disp := lower(coalesce(p_dispositivo, 'web'))::public.dispositivo_presencia;
  exception
    when others then
      v_disp := 'web';
  end;

  -- Cerrar sesión abierta previa (misma conexión / pestaña duplicada)
  update public.usuario_sesiones s
  set
    hora_desconexion = now(),
    duracion_minutos = greatest(
      0,
      floor(
        extract(epoch from (now() - s.hora_conexion)) / 60.0
      )::int
    ),
    cierre_tipo = 'automatica'
  where s.user_id = v_uid
    and s.tenant_id = v_tenant
    and s.hora_desconexion is null;

  insert into public.usuario_sesiones (
    tenant_id, user_id, fecha, hora_conexion, dispositivo, client_ip, cierre_tipo
  )
  values (
    v_tenant,
    v_uid,
    (now() at time zone coalesce((
      select t.zona_horaria from public.tenants t where t.id = v_tenant
    ), 'America/Lima'))::date,
    now(),
    v_disp,
    p_client_ip,
    null
  )
  returning id into v_sid;

  insert into public.usuario_presencia (user_id, tenant_id, estado, ultima_actividad, dispositivo, sesion_id)
  values (v_uid, v_tenant, 'online', now(), v_disp, v_sid)
  on conflict (user_id) do update
    set
      tenant_id = excluded.tenant_id,
      estado = 'online',
      ultima_actividad = now(),
      dispositivo = excluded.dispositivo,
      sesion_id = v_sid;

  return jsonb_build_object('ok', true, 'sesion_id', v_sid);
end;
$$;

-- Cierre manual
create or replace function public.mirest_presence_sesion_cerrar (p_sesion_id uuid, p_motivo text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_uid   uuid;
  v_conn  timestamptz;
  v_tipo  text;
  v_mins  integer;
begin
  v_uid := auth.uid();
  v_tenant := app.current_tenant_id();
  if v_uid is null or v_tenant is null or p_sesion_id is null then
    return jsonb_build_object('ok', false, 'error', 'param');
  end if;
  v_tipo := case
    when p_motivo in ('logout', 'automatica', 'manual', 'sweep') then p_motivo
    else 'manual'
  end;

  select s.hora_conexion into v_conn
  from public.usuario_sesiones s
  where s.id = p_sesion_id
    and s.user_id = v_uid
    and s.tenant_id = v_tenant;
  if v_conn is null then
    return jsonb_build_object('ok', false, 'error', 'sesion');
  end if;
  v_mins := greatest(0, floor(extract(epoch from (now() - v_conn)) / 60.0)::int);
  update public.usuario_sesiones
    set
      hora_desconexion = now(),
      duracion_minutos = v_mins,
      cierre_tipo = v_tipo
  where id = p_sesion_id;

  update public.usuario_presencia
    set estado = 'offline', ultima_actividad = now(), sesion_id = null
  where user_id = v_uid and tenant_id = v_tenant;

  return jsonb_build_object('ok', true);
end;
$$;

-- Marca actividad (heartbeat) y mantiene online; no cierra la sesión
create or replace function public.mirest_presence_heartbeat (p_sesion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid;
  v_tid  uuid;
  n int;
begin
  v_uid := auth.uid();
  v_tid := app.current_tenant_id();
  if v_uid is null or v_tid is null or p_sesion_id is null then
    return jsonb_build_object('ok', false);
  end if;
  update public.usuario_presencia p
    set ultima_actividad = now(),
        estado = 'online'::public.usuario_presencia_estado
  where p.user_id = v_uid
    and p.tenant_id = v_tid
    and p.sesion_id = p_sesion_id;
  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Pasa a inactivo (sin desconexión de la sesión en usuario_sesiones)
create or replace function public.mirest_presence_set_inactivo ()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_tid uuid;
begin
  v_uid := auth.uid();
  v_tid := app.current_tenant_id();
  if v_uid is null or v_tid is null then
    return jsonb_build_object('ok', false);
  end if;
  update public.usuario_presencia
    set
      ultima_actividad = now(),
      estado = 'inactivo'::public.usuario_presencia_estado
  where user_id = v_uid and tenant_id = v_tid;
  return jsonb_build_object('ok', true);
end;
$$;

-- Cierre de sesión huérfana (p. ej. cierre de pestaña); llamar con service_role o desde cron
create or replace function public.mirest_presence_sweep_stale (p_min_inactivo_min int default 30)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
  v_mins int;
  v_tipo text := 'sweep';
begin
  for r in
    select
      s.id as sid,
      s.user_id,
      s.tenant_id,
      s.hora_conexion
    from public.usuario_sesiones s
    join public.usuario_presencia p on p.user_id = s.user_id and p.sesion_id = s.id
    where s.hora_desconexion is null
      and p.ultima_actividad < (now() - (greatest(1, p_min_inactivo_min) * interval '1 minute'))
  loop
    v_mins := greatest(0, floor(extract(epoch from (now() - r.hora_conexion)) / 60.0)::int);
    update public.usuario_sesiones
      set
        hora_desconexion = now(),
        duracion_minutos = v_mins,
        cierre_tipo = v_tipo
    where id = r.sid;
    update public.usuario_presencia
      set
        estado = 'offline',
        ultima_actividad = now(),
        sesion_id = null
    where user_id = r.user_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Permisos de ejecución
grant execute on function public.mirest_presence_sesion_iniciar (text, text) to authenticated, service_role;
grant execute on function public.mirest_presence_sesion_cerrar (uuid, text) to authenticated, service_role;
grant execute on function public.mirest_presence_heartbeat (uuid) to authenticated, service_role;
grant execute on function public.mirest_presence_set_inactivo () to authenticated, service_role;
grant execute on function public.mirest_presence_sweep_stale (int) to service_role;
grant execute on function public.mirest_puede_ver_presencia_tenant (uuid) to authenticated;
grant select, insert, update, delete on public.usuario_presencia to service_role;

-- Realtime (con optional filter por tenant)
alter table public.usuario_presencia replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.usuario_presencia;
exception
  when duplicate_object then null;
  when others then
    raise notice 'usuario_presencia: no añadido a supabase_realtime: %', sqlerrm;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.usuario_sesiones;
exception
  when duplicate_object then null;
  when others then
    raise notice 'usuario_sesiones: no añadido a supabase_realtime: %', sqlerrm;
end;
$$;

comment on table public.usuario_sesiones is 'Historial de conexiones: una fila por apertura de “turno de sesión” (login/entrada a la app).';
comment on table public.usuario_presencia is 'Estado actual: una fila por user_id; alineado a Realtime Presence y heartbeat.';