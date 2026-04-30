-- Iniciar sesión: insert usuario_sesiones + upsert presencia
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
