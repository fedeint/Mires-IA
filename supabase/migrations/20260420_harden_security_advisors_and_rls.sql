create or replace function app.current_tenant_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid
$$;

create or replace function public.set_access_requests_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.match_documents(
  query_embedding vector,
  match_threshold double precision,
  match_count integer
)
returns table(id uuid, content text, similarity double precision, metadata jsonb)
language sql
stable
set search_path = public, pg_catalog
as $$
  select
    id,
    content,
    1 - (embedding <=> query_embedding) as similarity,
    metadata
  from public.documents
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

create or replace view public.inventory_current_stock
with (security_invoker = true) as
select
  ii.tenant_id,
  ii.restaurant_id,
  ii.id as inventory_item_id,
  ii.code as item_code,
  ii.name as item_name,
  ii.category,
  ii.unit,
  ii.stock_minimum,
  ii.cost_unit,
  coalesce(sum(
    case
      when im.movement_type = any (array['ingreso'::inventory_movement_type, 'ajuste'::inventory_movement_type]) then im.quantity
      when im.movement_type = any (array['salida'::inventory_movement_type, 'merma'::inventory_movement_type]) then im.quantity * -1
      else 0
    end
  ), 0) as stock,
  case
    when coalesce(sum(
      case
        when im.movement_type = any (array['ingreso'::inventory_movement_type, 'ajuste'::inventory_movement_type]) then im.quantity
        when im.movement_type = any (array['salida'::inventory_movement_type, 'merma'::inventory_movement_type]) then im.quantity * -1
        else 0
      end
    ), 0) <= ii.stock_minimum * 0.5 then 'critical'
    when coalesce(sum(
      case
        when im.movement_type = any (array['ingreso'::inventory_movement_type, 'ajuste'::inventory_movement_type]) then im.quantity
        when im.movement_type = any (array['salida'::inventory_movement_type, 'merma'::inventory_movement_type]) then im.quantity * -1
        else 0
      end
    ), 0) <= ii.stock_minimum then 'low'
    else 'ok'
  end as status
from public.inventory_items ii
left join public.inventory_movements im on im.inventory_item_id = ii.id
group by ii.tenant_id, ii.restaurant_id, ii.id, ii.code, ii.name, ii.category, ii.unit, ii.stock_minimum, ii.cost_unit;

create or replace view public.delivery_affiliation_overview
with (security_invoker = true) as
select
  rda.tenant_id,
  rda.restaurant_id,
  dp.slug,
  dp.provider_name,
  rda.affiliation_status,
  rda.api_health,
  rda.integration_endpoint,
  rda.last_sync_at,
  rda.coverage,
  rda.commission_rate,
  rda.notes
from public.restaurant_delivery_affiliations rda
join public.delivery_providers dp on dp.id = rda.provider_id;

alter table public.tenants enable row level security;
alter table public.delivery_providers enable row level security;

drop policy if exists access_requests_public_insert on public.access_requests;
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

drop policy if exists access_requests_authenticated_update on public.access_requests;
create policy access_requests_authenticated_update
  on public.access_requests
  for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists tenants_authenticated_select_own on public.tenants;
create policy tenants_authenticated_select_own
  on public.tenants
  for select
  to authenticated
  using (id = app.current_tenant_id());

drop policy if exists delivery_providers_authenticated_select on public.delivery_providers;
create policy delivery_providers_authenticated_select
  on public.delivery_providers
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists documents_authenticated_select on public.documents;
create policy documents_authenticated_select
  on public.documents
  for select
  to authenticated
  using (auth.uid() is not null);
