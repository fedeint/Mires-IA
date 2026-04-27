create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  restaurant_name text not null,
  legal_owner_name text,
  business_count integer not null default 1 check (business_count >= 1),
  city text,
  country text,
  applicant_role text,
  notes text,
  source text not null default 'login',
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'approved', 'rejected')),
  approved_role text,
  follow_up_notes text,
  approved_at timestamptz,
  rejected_at timestamptz,
  invite_sent_at timestamptz,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists access_requests_status_created_at_idx
  on public.access_requests (status, created_at desc);

create index if not exists access_requests_email_idx
  on public.access_requests (lower(email));

create or replace function public.set_access_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists access_requests_set_updated_at on public.access_requests;
create trigger access_requests_set_updated_at
before update on public.access_requests
for each row
execute function public.set_access_requests_updated_at();

alter table public.access_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'access_requests'
      and policyname = 'access_requests_public_insert'
  ) then
    create policy access_requests_public_insert
      on public.access_requests
      for insert
      to public
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'access_requests'
      and policyname = 'access_requests_authenticated_select'
  ) then
    create policy access_requests_authenticated_select
      on public.access_requests
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'access_requests'
      and policyname = 'access_requests_authenticated_update'
  ) then
    create policy access_requests_authenticated_update
      on public.access_requests
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
