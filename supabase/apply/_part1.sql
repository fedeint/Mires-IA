-- Enums, tablas, RLS on
do $$
begin
  if not exists (select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'usuario_presencia_estado' and n.nspname = 'public') then
    create type public.usuario_presencia_estado as enum ('online', 'offline', 'inactivo');
  end if;
  if not exists (select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'dispositivo_presencia' and n.nspname = 'public') then
    create type public.dispositivo_presencia as enum ('web', 'pwa', 'mobile');
  end if;
end $$;

create table if not exists public.usuario_sesiones (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  user_id            uuid not null references public.user_profiles (id) on delete cascade,
  fecha              date not null,
  hora_conexion      timestamptz not null,
  hora_desconexion   timestamptz,
  duracion_minutos   integer,
  dispositivo        public.dispositivo_presencia not null default 'web',
  client_ip          text,
  cierre_tipo        text
    check (cierre_tipo is null or cierre_tipo in ('manual', 'automatica', 'logout', 'sweep'))
);
create index if not exists idx_usuario_sesiones_tenant_user
  on public.usuario_sesiones (tenant_id, user_id, hora_conexion desc);
create index if not exists idx_usuario_sesiones_fecha
  on public.usuario_sesiones (tenant_id, user_id, fecha desc);

create table if not exists public.usuario_presencia (
  user_id          uuid primary key references public.user_profiles (id) on delete cascade,
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  estado            public.usuario_presencia_estado not null default 'offline',
  ultima_actividad  timestamptz not null default now(),
  dispositivo       public.dispositivo_presencia not null default 'web',
  sesion_id         uuid references public.usuario_sesiones (id) on delete set null
);
create index if not exists idx_usuario_presencia_tenant
  on public.usuario_presencia (tenant_id);

alter table public.usuario_presencia
  drop constraint if exists usuario_presencia_sesion_id_fkey;

alter table public.usuario_presencia
  add constraint usuario_presencia_sesion_id_fkey
  foreign key (sesion_id) references public.usuario_sesiones (id) on delete set null;

alter table public.usuario_sesiones enable row level security;
alter table public.usuario_presencia enable row level security;
