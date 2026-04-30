-- Permisos explícitos para la app (configuración por local en JSONB)
grant select, insert, update, delete on public.restaurant_settings to authenticated, service_role;
