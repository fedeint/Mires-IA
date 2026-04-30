begin;

create schema if not exists app;

create or replace function app.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select up.role::text
  from public.user_profiles up
  where up.id = auth.uid()
    and up.tenant_id = app.current_tenant_id()
  limit 1
$$;

create or replace function app.is_manager_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.current_user_role() in ('superadmin','administrador'), false)
$$;

revoke all on function app.current_user_role() from public;
revoke all on function app.is_manager_role() from public;
grant execute on function app.current_user_role() to authenticated;
grant execute on function app.is_manager_role() to authenticated;

drop policy if exists user_profiles_tenant_policy on public.user_profiles;

create policy user_profiles_select_tenant
on public.user_profiles
for select
to authenticated
using (tenant_id = app.current_tenant_id());

create policy user_profiles_update_self_or_manager
on public.user_profiles
for update
to authenticated
using (
  tenant_id = app.current_tenant_id()
  and (
    id = auth.uid()
    or app.is_manager_role()
  )
)
with check (
  tenant_id = app.current_tenant_id()
  and (
    id = auth.uid()
    or app.is_manager_role()
  )
);

create policy user_profiles_insert_manager
on public.user_profiles
for insert
to authenticated
with check (
  tenant_id = app.current_tenant_id()
  and app.is_manager_role()
);

create policy user_profiles_delete_manager
on public.user_profiles
for delete
to authenticated
using (
  tenant_id = app.current_tenant_id()
  and app.is_manager_role()
);

drop policy if exists restaurant_settings_tenant on public.restaurant_settings;

create policy restaurant_settings_select_tenant
on public.restaurant_settings
for select
to authenticated
using (tenant_id = app.current_tenant_id());

create policy restaurant_settings_write_manager
on public.restaurant_settings
for all
to authenticated
using (
  tenant_id = app.current_tenant_id()
  and app.is_manager_role()
)
with check (
  tenant_id = app.current_tenant_id()
  and app.is_manager_role()
);

drop policy if exists roles_modulos_tenant on public.roles_modulos;

create policy roles_modulos_select_tenant
on public.roles_modulos
for select
to authenticated
using (tenant_id = app.current_tenant_id());

create policy roles_modulos_write_manager
on public.roles_modulos
for all
to authenticated
using (
  tenant_id = app.current_tenant_id()
  and app.is_manager_role()
)
with check (
  tenant_id = app.current_tenant_id()
  and app.is_manager_role()
);

commit;
