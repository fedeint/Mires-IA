-- Granularidad alineada a la matriz de Configuración (front: ConfigUI.resolveSectionAccess):
-- - restaurant_settings.value (clave mirest_shell_v1): administrador no puede cambiar dallIA / horarios / restaurante (JSON shell).
-- - tenant_horarios: solo superadmin (JWT app_metadata o rol de perfil en el tenant).
-- - tenants: administrador no puede mutar columnas de ficha + DallA (el resto sigue gobernado por trg_tenants_plan_guard).

begin;

-- ---------------------------------------------------------------------------
-- 1) Trigger: restaurant_settings (solo clave mirest_shell_v1)
-- ---------------------------------------------------------------------------
create or replace function app.trg_restaurant_settings_enforce_shell_subkeys ()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  bypass boolean;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.key is distinct from 'mirest_shell_v1' then
    return new;
  end if;
  if auth.uid () is null then
    return new;
  end if;

  bypass := coalesce(public.jwt_is_config_superadmin (), false)
    or coalesce(app.current_user_role (), '') = 'superadmin';

  if bypass then
    return new;
  end if;

  if coalesce(app.current_user_role (), '') is distinct from 'administrador' then
    return new;
  end if;

  if (new.value->'dallIA') is distinct from (old.value->'dallIA') then
    raise exception 'Sin permiso para modificar dallIA (solo superadmin).'
      using errcode = '42501';
  end if;
  if (new.value->'horarios') is distinct from (old.value->'horarios') then
    raise exception 'Sin permiso para modificar horarios en la configuración shell (solo superadmin).'
      using errcode = '42501';
  end if;
  if (new.value->'restaurante') is distinct from (old.value->'restaurante') then
    raise exception 'Sin permiso para modificar restaurante en la configuración shell (solo superadmin).'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app.trg_restaurant_settings_enforce_shell_subkeys () from public;

drop trigger if exists trg_restaurant_settings_shell_subkeys on public.restaurant_settings;

create trigger trg_restaurant_settings_shell_subkeys
  before update on public.restaurant_settings
  for each row
  execute function app.trg_restaurant_settings_enforce_shell_subkeys ();

-- ---------------------------------------------------------------------------
-- 2) tenant_horarios: lectura para el tenant; escritura solo superadmin
--    (condicional: entornos mínimos sin mirest_config_master no tienen la tabla)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass ('public.tenant_horarios') is null then
    raise notice 'tenant_horarios ausente: se omiten políticas granulares';
    return;
  end if;
  execute 'drop policy if exists tenant_horarios_rw on public.tenant_horarios';
  execute 'drop policy if exists tenant_horarios_select_tenant on public.tenant_horarios';
  execute 'drop policy if exists tenant_horarios_write_superadmin on public.tenant_horarios';
  execute 'drop policy if exists tenant_horarios_update_superadmin on public.tenant_horarios';
  execute 'drop policy if exists tenant_horarios_delete_superadmin on public.tenant_horarios';
  execute $p$
    create policy tenant_horarios_select_tenant
      on public.tenant_horarios
      for select
      to authenticated
      using (
        tenant_id = app.current_tenant_id ()
        or public.jwt_is_config_superadmin ()
      )
  $p$;
  execute $p$
    create policy tenant_horarios_write_superadmin
      on public.tenant_horarios
      for insert
      to authenticated
      with check (
        (
          tenant_id = app.current_tenant_id ()
          and coalesce(app.current_user_role (), '') = 'superadmin'
        )
        or public.jwt_is_config_superadmin ()
      )
  $p$;
  execute $p$
    create policy tenant_horarios_update_superadmin
      on public.tenant_horarios
      for update
      to authenticated
      using (
        (
          tenant_id = app.current_tenant_id ()
          and coalesce(app.current_user_role (), '') = 'superadmin'
        )
        or public.jwt_is_config_superadmin ()
      )
      with check (
        (
          tenant_id = app.current_tenant_id ()
          and coalesce(app.current_user_role (), '') = 'superadmin'
        )
        or public.jwt_is_config_superadmin ()
      )
  $p$;
  execute $p$
    create policy tenant_horarios_delete_superadmin
      on public.tenant_horarios
      for delete
      to authenticated
      using (
        (
          tenant_id = app.current_tenant_id ()
          and coalesce(app.current_user_role (), '') = 'superadmin'
        )
        or public.jwt_is_config_superadmin ()
      )
  $p$;
end
$$;

-- ---------------------------------------------------------------------------
-- 3) tenants: administrador no altera ficha ni DallA (BEFORE UPDATE)
-- ---------------------------------------------------------------------------
create or replace function app.trg_tenants_strip_administrador_locked_columns ()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if auth.uid () is null then
    return new;
  end if;
  if public.jwt_is_config_superadmin () then
    return new;
  end if;
  if coalesce(app.current_user_role (), '') is distinct from 'administrador' then
    return new;
  end if;

  new.name := old.name;
  new.slug := old.slug;
  new.dalla_nombre := old.dalla_nombre;
  new.dalla_tono := old.dalla_tono;
  new.dalla_personalidad := old.dalla_personalidad;
  new.dalla_activo_por_modulo := old.dalla_activo_por_modulo;
  new.logo_url := old.logo_url;
  new.direccion := old.direccion;
  new.ruc := old.ruc;
  new.telefono := old.telefono;
  new.email_contacto := old.email_contacto;
  new.zona_horaria := old.zona_horaria;
  new.moneda := old.moneda;
  return new;
end;
$$;

revoke all on function app.trg_tenants_strip_administrador_locked_columns () from public;

drop trigger if exists trg_tenants_strip_admin_cfg on public.tenants;

create trigger trg_tenants_strip_admin_cfg
  before update on public.tenants
  for each row
  execute function app.trg_tenants_strip_administrador_locked_columns ();

commit;
