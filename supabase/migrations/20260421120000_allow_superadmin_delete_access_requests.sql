-- Permite al superadmin eliminar solicitudes de acceso desde el panel
-- (por ejemplo, para purgar solicitudes rechazadas antiguas del mismo email
-- que ya no aportan valor al seguimiento comercial).
drop policy if exists access_requests_authenticated_delete on public.access_requests;
create policy access_requests_authenticated_delete
  on public.access_requests
  for delete
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin');
