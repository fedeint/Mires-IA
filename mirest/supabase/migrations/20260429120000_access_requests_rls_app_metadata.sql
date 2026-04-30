-- Security Advisor: RLS no debe usar user_metadata (editable por el cliente).
-- Rol superadmin: auth.jwt() -> 'app_metadata' ->> 'role' (Dashboard / Admin API).
-- Tras aplicar: usuarios superadmin existentes deben tener role en App metadata
-- (Authentication → Users → usuario → App metadata: {"role":"superadmin"}).

drop policy if exists access_requests_authenticated_select on public.access_requests;
create policy access_requests_authenticated_select
  on public.access_requests
  for select
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin');

drop policy if exists access_requests_authenticated_update on public.access_requests;
create policy access_requests_authenticated_update
  on public.access_requests
  for update
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin');

drop policy if exists access_requests_authenticated_delete on public.access_requests;
create policy access_requests_authenticated_delete
  on public.access_requests
  for delete
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin');
