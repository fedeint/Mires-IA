-- Alinea el historial con la migración remota `add_approved_permissions_to_access_requests`.
-- El remoto ya puede tener estos cambios aplicados; en instancias nuevas, reemplaza este
-- archivo por el SQL completo obtenido de `supabase db pull` o del historial del panel.
-- NO-OP evita error de migración vacía; sustituir si hace falta lógica real.
SELECT
  1;
