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