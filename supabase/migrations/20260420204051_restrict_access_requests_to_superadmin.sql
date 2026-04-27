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
