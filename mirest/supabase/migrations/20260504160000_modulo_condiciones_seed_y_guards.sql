-- Semilla de modulo_condiciones por tenant + funciones de guarda (RPC) para caja y pedidos.
-- Requisito: migración 20260504140000_modulo_bloqueos_y_condiciones.sql

-- ---------------------------------------------------------------------------
-- 1) Semilla: una fila por (tenant, codigo_regla) — core marcadas no_desactivable
-- ---------------------------------------------------------------------------
insert into public.modulo_condiciones (
  tenant_id, codigo_regla, modulo_origen, accion, condicion, tipo,
  mensaje_usuario, mensaje_admin, activo, notifica_admin, notifica_superadmin, no_desactivable
)
select
  t.id,
  v.codigo_regla,
  v.modulo_origen,
  v.accion,
  v.condicion,
  v.tipo::public.condicion_tipo,
  v.mensaje_usuario,
  v.mensaje_admin,
  true,
  v.notifica_admin,
  v.notifica_superadmin,
  v.no_desactivable
from public.tenants t
cross join (
  values
    -- Caja
    (
      'caja.abrir.sesion.sin_cajeros', 'caja', 'abrir_sesion',
      'Existe al menos un usuario de perfil en el tenant (Accesos / personal).',
      'bloqueo',
      'No tienes cajeros registrados. Ve a Accesos.',
      'Bloqueo: sin personal en user_profiles para el tenant.',
      true, false, true
    ),
    (
      'caja.abrir.sesion.ya_activa', 'caja', 'abrir_sesion',
      'Máximo una cash_sessions con closed_at nulo por lógica operativa.',
      'bloqueo',
      'Ya hay una sesión activa. Ciérrala primero.',
      'Bloqueo: sesión de caja ya abierta en BD.',
      true, false, true
    ),
    (
      'caja.abrir.sesion.fuera_horario', 'caja', 'abrir_sesion',
      'tenant_horarios y zona_horaria en tenants.',
      'bloqueo',
      'Fuera de horario de operación. Revisa Configuración.',
      'Bloqueo: reloj local fuera de franja en tenant_horarios.',
      true, true, false
    ),
    (
      'caja.cerrar.pedidos_pendientes', 'caja', 'cerrar_sesion',
      'Pedidos en estado distinto a served/closed/cancelled.',
      'bloqueo',
      'Tienes pedidos sin cobrar. Resuélvelos antes de cerrar.',
      'Bloqueo: aún hay orders operativos abiertos.',
      true, true, true
    ),
    (
      'caja.cerrar.cocina_pendiente', 'caja', 'cerrar_sesion',
      'Cola de cocina sin estado entregado/cancelado/rechazado.',
      'bloqueo',
      'Cocina tiene platos pendientes de entregar.',
      'Bloqueo: cocina_cola pendiente.',
      true, true, true
    ),
    (
      'caja.cerrar.sin_monto_contado', 'caja', 'cerrar_sesion',
      'Monto de arqueo ingresado en UI o closing_count al cerrar sesión.',
      'bloqueo',
      'Ingresa el monto contado para cerrar.',
      'Bloqueo: falta monto al cierre (validado en cliente).',
      true, true, true
    ),
    -- Pedidos
    (
      'pedidos.crear.sin_sesion_caja', 'pedidos', 'crear_pedido',
      'Existe al menos cash_sessions con closed_at nulo (o política de negocio).',
      'bloqueo',
      'No hay caja abierta. Pide a tu cajero que abra la sesión.',
      'Bloqueo: sin sesión caja viva.',
      true, true, true
    ),
    (
      'pedidos.crear.sin_productos_activos', 'pedidos', 'crear_pedido',
      'products.is_active = true al menos 1 fila.',
      'bloqueo',
      'No hay productos disponibles. Revisa el módulo de Productos.',
      'Bloqueo: catálogo vacío o sin activos.',
      true, true, true
    ),
    (
      'pedidos.crear.fuera_horario', 'pedidos', 'crear_pedido',
      'Misma regla de tenant_horarios.',
      'bloqueo',
      'El restaurante está cerrado según el horario configurado.',
      'Bloqueo: fuera de horario.',
      true, true, false
    ),
    -- Core
    (
      'core.cobrar.sin_sesion_caja', 'caja', 'cobrar',
      'Cobro requiere caja (sesión) abierta.',
      'bloqueo',
      'Debes tener la caja abierta para cobrar.',
      'Bloqueo core: cobro sin caja.',
      true, true, true
    ),
    (
      'core.inventario.stock_no_negativo', 'almacen', 'movimiento_salida',
      'Inventario no baja de 0 (validado en triger o servicio).',
      'bloqueo',
      'No puedes dejar el stock en negativo.',
      'Bloqueo core: validación de stock.',
      true, true, true
    ),
    (
      'recetas.crear.sin_insumos', 'recetas', 'crear_receta',
      'al menos 1 fila en insumos o inventory.',
      'bloqueo',
      'Necesitas registrar insumos primero. Ve a Almacén.',
      'Bloqueo: insumos vacíos.',
      true, true, true
    )
) as v (codigo_regla, modulo_origen, accion, condicion, tipo, mensaje_usuario, mensaje_admin, notifica_admin, notifica_superadmin, no_desactivable)
on conflict (tenant_id, codigo_regla) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Horario: si no hay filas en tenant_horarios, se considera “siempre abierto”
-- ---------------------------------------------------------------------------
create or replace function public.mirest_tenant_dentro_horario (p_tenant uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz  text;
  n   int;
  dia public.dia_semana;
  tt  time;
  h   public.tenant_horarios%rowtype;
  dow int;
begin
  select coalesce(t.zona_horaria, 'America/Lima') into tz
  from public.tenants t where t.id = p_tenant;
  if not found then
    return true;
  end if;
  select count(*) into n
  from public.tenant_horarios th
  where th.tenant_id = p_tenant and th.activo;
  if n = 0 then
    return true;
  end if;
  dow := extract(dow from (now() at time zone tz))::int;
  dia := case dow
    when 0 then 'domingo'::public.dia_semana
    when 1 then 'lunes'::public.dia_semana
    when 2 then 'martes'::public.dia_semana
    when 3 then 'miercoles'::public.dia_semana
    when 4 then 'jueves'::public.dia_semana
    when 5 then 'viernes'::public.dia_semana
    else 'sabado'::public.dia_semana
  end;
  select * into h
  from public.tenant_horarios th
  where th.tenant_id = p_tenant and th.activo and th.dia = dia
  order by th.turno
  limit 1;
  if not found then
    return false;
  end if;
  if h.hora_apertura is null or h.hora_cierre is null then
    return true;
  end if;
  tt := (now() at time zone tz)::time;
  if h.hora_cierre < h.hora_apertura then
    return tt >= h.hora_apertura or tt <= h.hora_cierre;
  end if;
  return tt >= h.hora_apertura and tt <= h.hora_cierre;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Guard: abrir caja
-- ---------------------------------------------------------------------------
create or replace function public.mirest_guard_caja_abrir (p_tenant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid   uuid;
  v_open  int;
  v_staff int;
begin
  v_tid := app.current_tenant_id();
  if v_tid is null or v_tid <> p_tenant then
    return jsonb_build_object('ok', false, 'codigo', 'auth', 'mensaje', 'Sesión o tenant no válido.');
  end if;
  select count(*)::int into v_open
  from public.cash_sessions
  where tenant_id = p_tenant and closed_at is null;
  if v_open > 0 then
    return jsonb_build_object('ok', false, 'codigo', 'caja.abrir.sesion.ya_activa', 'mensaje', 'Ya hay una sesión activa. Ciérrala primero.');
  end if;
  select count(*)::int into v_staff
  from public.user_profiles
  where tenant_id = p_tenant;
  if v_staff < 1 then
    return jsonb_build_object('ok', false, 'codigo', 'caja.abrir.sesion.sin_cajeros', 'mensaje', 'No tienes cajeros registrados. Ve a Accesos.');
  end if;
  if not public.mirest_tenant_dentro_horario (p_tenant) then
    return jsonb_build_object('ok', false, 'codigo', 'caja.abrir.sesion.fuera_horario', 'mensaje', 'Fuera de horario de operación. Revisa Configuración.');
  end if;
  return jsonb_build_object('ok', true, 'codigo', null, 'mensaje', null);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Guard: cerrar caja (pedidos + cocina; monto = fuera de SQL)
-- ---------------------------------------------------------------------------
create or replace function public.mirest_guard_caja_cerrar (p_tenant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid  uuid;
  n_ord  int;
  n_coc  int;
begin
  v_tid := app.current_tenant_id();
  if v_tid is null or v_tid <> p_tenant then
    return jsonb_build_object('ok', false, 'codigo', 'auth', 'mensaje', 'Sesión o tenant no válido.');
  end if;
  select count(*)::int into n_ord
  from public.orders
  where tenant_id = p_tenant
    and status in (
      'open'::public.order_status,
      'in_kitchen'::public.order_status,
      'ready'::public.order_status
    );
  if n_ord > 0 then
    return jsonb_build_object('ok', false, 'codigo', 'caja.cerrar.pedidos_pendientes', 'mensaje', 'Tienes ' || n_ord::text || ' pedidos sin cobrar. Resuélvelos antes de cerrar.');
  end if;
  select count(*)::int into n_coc
  from public.cocina_cola
  where tenant_id = p_tenant
    and estado not in ('entregado', 'cancelado', 'rechazado');
  if n_coc > 0 then
    return jsonb_build_object('ok', false, 'codigo', 'caja.cerrar.cocina_pendiente', 'mensaje', 'Cocina tiene ' || n_coc::text || ' platos pendientes de entregar.');
  end if;
  return jsonb_build_object('ok', true, 'codigo', null, 'mensaje', null);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Guard: crear pedido (caja + productos + horario)
-- ---------------------------------------------------------------------------
create or replace function public.mirest_guard_pedido_crear (p_tenant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid  uuid;
  n_caja int;
  n_prod int;
begin
  v_tid := app.current_tenant_id();
  if v_tid is null or v_tid <> p_tenant then
    return jsonb_build_object('ok', false, 'codigo', 'auth', 'mensaje', 'Sesión o tenant no válido.');
  end if;
  select count(*)::int into n_caja
  from public.cash_sessions
  where tenant_id = p_tenant and closed_at is null;
  if n_caja < 1 then
    return jsonb_build_object('ok', false, 'codigo', 'pedidos.crear.sin_sesion_caja', 'mensaje', 'No hay caja abierta. Pide a tu cajero que abra la sesión.');
  end if;
  select count(*)::int into n_prod
  from public.products
  where tenant_id = p_tenant and is_active = true;
  if n_prod < 1 then
    return jsonb_build_object('ok', false, 'codigo', 'pedidos.crear.sin_productos_activos', 'mensaje', 'No hay productos disponibles. Revisa el módulo de Productos.');
  end if;
  if not public.mirest_tenant_dentro_horario (p_tenant) then
    return jsonb_build_object('ok', false, 'codigo', 'pedidos.crear.fuera_horario', 'mensaje', 'El restaurante está cerrado según el horario configurado.');
  end if;
  return jsonb_build_object('ok', true, 'codigo', null, 'mensaje', null);
end;
$$;

grant execute on function public.mirest_tenant_dentro_horario (uuid) to authenticated;
grant execute on function public.mirest_guard_caja_abrir (uuid) to authenticated;
grant execute on function public.mirest_guard_caja_cerrar (uuid) to authenticated;
grant execute on function public.mirest_guard_pedido_crear (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Outbox in-app (Nivel 2): se llena desde Edge; RLS: tenant + servicio
-- ---------------------------------------------------------------------------
create table if not exists public.modulo_bloqueo_outbox (
  id                  uuid primary key default gen_random_uuid(),
  bloqueo_id          uuid not null references public.modulo_bloqueos (id) on delete cascade,
  destino             text not null
    check (destino in ('admin_tenant', 'superadmin_digest')),
  creado_at            timestamptz not null default now(),
  enviado_at            timestamptz,
  detalle                jsonb not null default '{}'
);

create index if not exists idx_modulo_bloqueo_outbox_pendiente
  on public.modulo_bloqueo_outbox (destino, creado_at)
  where enviado_at is null;

alter table public.modulo_bloqueo_outbox enable row level security;

drop policy if exists modulo_bloqueo_outbox_tenant on public.modulo_bloqueo_outbox;
create policy modulo_bloqueo_outbox_tenant on public.modulo_bloqueo_outbox
  for select to authenticated
  using (
    exists (
      select 1 from public.modulo_bloqueos b
      where b.id = bloqueo_id
        and b.tenant_id = app.current_tenant_id()
    )
    or public.jwt_is_config_superadmin()
  );

drop policy if exists modulo_bloqueo_outbox_service on public.modulo_bloqueo_outbox;
create policy modulo_bloqueo_outbox_service on public.modulo_bloqueo_outbox
  for all to service_role
  using (true)
  with check (true);

-- insert: solo vía service (Edge) o ampliar política — simplificado: no inserta el cliente; Edge usa service
grant select on public.modulo_bloqueo_outbox to authenticated, service_role;
grant insert, update, delete on public.modulo_bloqueo_outbox to service_role;

comment on table public.modulo_bloqueo_outbox is 'Cola de notificaciones a admin; insert/update desde Edge Functions (service role).';
