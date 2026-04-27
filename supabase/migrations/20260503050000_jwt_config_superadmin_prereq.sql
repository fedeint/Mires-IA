-- Helper mínimo para RLS (también está en 20260502120000_mirest_config_master.sql).
-- Idempotente: `create or replace`. Útil si se aplicó el core pero no el config master.
create or replace function public.jwt_is_config_superadmin ()
  returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin'
$$;

grant execute on function public.jwt_is_config_superadmin() to authenticated, service_role, anon;
