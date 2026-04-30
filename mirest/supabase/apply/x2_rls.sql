-- RLS
drop policy if exists usuario_sesiones_read on public.usuario_sesiones;
create policy usuario_sesiones_read on public.usuario_sesiones
  for select
  to authenticated
  using (
    (user_id = auth.uid() and tenant_id = app.current_tenant_id())
    or (tenant_id = app.current_tenant_id() and mirest_puede_ver_presencia_tenant (tenant_id))
  );

-- Escritura: solo el propio usuario (las RPCs usan el mismo contexto de sesión)
drop policy if exists usuario_sesiones_no_direct on public.usuario_sesiones;
drop policy if exists usuario_sesiones_ins on public.usuario_sesiones;
create policy usuario_sesiones_ins on public.usuario_sesiones
  for insert
  to authenticated
  with check (user_id = auth.uid() and tenant_id = app.current_tenant_id());
drop policy if exists usuario_sesiones_upd on public.usuario_sesiones;
create policy usuario_sesiones_upd on public.usuario_sesiones
  for update
  to authenticated
  using (user_id = auth.uid() and tenant_id = app.current_tenant_id())
  with check (user_id = auth.uid() and tenant_id = app.current_tenant_id());

grant select, insert, update, delete on public.usuario_sesiones to service_role;

-- Presencia: lectura según rol; sin escritura directa
drop policy if exists usuario_presencia_read on public.usuario_presencia;
create policy usuario_presencia_read on public.usuario_presencia
  for select
  to authenticated
  using (
    (user_id = auth.uid() and tenant_id = app.current_tenant_id())
    or (tenant_id = app.current_tenant_id() and mirest_puede_ver_presencia_tenant (tenant_id))
  );

drop policy if exists usuario_presencia_no_write on public.usuario_presencia;
drop policy if exists usuario_presencia_ups on public.usuario_presencia;
create policy usuario_presencia_ups on public.usuario_presencia
  for insert
  to authenticated
  with check (user_id = auth.uid() and tenant_id = app.current_tenant_id());
drop policy if exists usuario_presencia_u on public.usuario_presencia;
create policy usuario_presencia_u on public.usuario_presencia
  for update
  to authenticated
  using (user_id = auth.uid() and tenant_id = app.current_tenant_id())
  with check (user_id = auth.uid() and tenant_id = app.current_tenant_id());
