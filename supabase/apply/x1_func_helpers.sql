-- helpers (antes de RLS)
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
