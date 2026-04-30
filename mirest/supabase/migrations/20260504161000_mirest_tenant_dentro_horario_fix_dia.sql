-- Asegura comparación explícita columna vs variable (evita sombra/ambigüedad de `dia` en cláusula WHERE).
-- Idempotente si 20260504160000 ya contenía el fix.

create or replace function public.mirest_tenant_dentro_horario (p_tenant uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz  text;
  n   int;
  dia public.dia_semana;
  tt  time;
  h   public.tenant_horarios%rowtype;
  dow int;
begin
  select coalesce(t.zona_horaria, 'America/Lima') into tz
  from public.tenants t where t.id = p_tenant;
  if not found then
    return true;
  end if;
  select count(*) into n
  from public.tenant_horarios th
  where th.tenant_id = p_tenant and th.activo;
  if n = 0 then
    return true;
  end if;
  dow := extract(dow from (now() at time zone tz))::int;
  dia := case dow
    when 0 then 'domingo'::public.dia_semana
    when 1 then 'lunes'::public.dia_semana
    when 2 then 'martes'::public.dia_semana
    when 3 then 'miercoles'::public.dia_semana
    when 4 then 'jueves'::public.dia_semana
    when 5 then 'viernes'::public.dia_semana
    else 'sabado'::public.dia_semana
  end;
  select * into h
  from public.tenant_horarios th
  where th.tenant_id = p_tenant and th.activo and th.dia = dia
  order by th.turno
  limit 1;
  if not found then
    return false;
  end if;
  if h.hora_apertura is null or h.hora_cierre is null then
    return true;
  end if;
  tt := (now() at time zone tz)::time;
  if h.hora_cierre < h.hora_apertura then
    return tt >= h.hora_apertura or tt <= h.hora_cierre;
  end if;
  return tt >= h.hora_apertura and tt <= h.hora_cierre;
end;
$$;

grant execute on function public.mirest_tenant_dentro_horario (uuid) to authenticated;
