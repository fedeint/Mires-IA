-- Security Advisor: "RLS references user metadata" en public.access_requests.
-- Elimina cualquier política antigua (p. ej. que usara auth.jwt() -> 'user_metadata')
-- y deja solo reglas basadas en app_metadata.role = 'superadmin'.

do $$
declare
  pol text;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'access_requests'
  loop
    execute format('drop policy if exists %I on public.access_requests', pol);
  end loop;
end $$;

create policy access_requests_public_insert
  on public.access_requests
  for insert
  to public
  with check (
    full_name is not null
    and length(trim(full_name)) >= 3
    and email is not null
    and position('@' in email) > 1
    and restaurant_name is not null
    and length(trim(restaurant_name)) >= 2
    and business_count >= 1
    and source in ('login', 'backoffice')
  );

create policy access_requests_authenticated_select
  on public.access_requests
  for select
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin');

create policy access_requests_authenticated_update
  on public.access_requests
  for update
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin');

create policy access_requests_authenticated_delete
  on public.access_requests
  for delete
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin');
