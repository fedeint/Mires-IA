
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