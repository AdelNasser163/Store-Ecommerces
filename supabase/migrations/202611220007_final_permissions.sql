begin;
-- One authorization source. Splitting ALL is essential: permissive policies OR.
drop policy if exists support_manage on public.support_messages;
drop policy if exists support_staff_read on public.support_messages;
drop policy if exists support_staff_update on public.support_messages;
drop policy if exists support_admin_delete on public.support_messages;
create policy support_staff_read on public.support_messages for select to authenticated using(public.admin_access());
create policy support_staff_update on public.support_messages for update to authenticated using(public.admin_access()) with check(public.admin_access());
create policy support_admin_delete on public.support_messages for delete to authenticated using(public.admin_role()='admin');
drop policy if exists support_admin_restore on public.support_messages;
create policy support_admin_restore on public.support_messages for insert to authenticated with check(public.admin_role()='admin');
revoke update on public.support_messages,public.messages from authenticated;
grant update(status,read_at,starred,archived) on public.support_messages,public.messages to authenticated;
-- Anonymous support_submit and signed-in support_customer_submit remain intact.
-- Customers cannot change administrative inbox fields through UPDATE policies.
-- Remove possible Supabase default grants on derived/private tables. RLS does
-- not protect TRUNCATE, and adding a SELECT grant does not remove older grants.
revoke all on public.product_images,public.inventory_transactions,public.message_replies from anon,authenticated;
grant select on public.product_images to anon,authenticated;
grant select on public.inventory_transactions,public.message_replies to authenticated;
grant insert on public.message_replies to authenticated;
do $browser_grants$ declare table_name text;begin
 foreach table_name in array array['store_schema_migrations','profiles','user_roles','categories','products','bundles','bundle_items','customers','orders','order_items','notifications','settings','support_messages','product_images','inventory_transactions','message_replies','payment_transactions','provider_events','shipments','order_stock_reservations'] loop
  execute format('revoke truncate,references,trigger on public.%I from public,anon,authenticated',table_name);
 end loop;end $browser_grants$;

-- Payment availability is configuration, not evidence of a provider integration.
-- Preserve other settings and existing payment metadata; alter availability only.
create or replace function public.guard_payment_settings() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.key='paymentMethods' then
  if jsonb_typeof(new.value) is distinct from 'object' then raise exception 'Payment settings must be an object';end if;
  new.value=new.value||jsonb_build_object('card',false,'valu',false,'cod',true);
 end if;return new;end$$;
drop trigger if exists guard_payment_settings on public.settings;
create trigger guard_payment_settings before insert or update on public.settings for each row execute function public.guard_payment_settings();
insert into public.settings(key,value) values('paymentMethods','{"card":false,"valu":false,"cod":true}')
on conflict(key) do update set value=public.settings.value||jsonb_build_object('card',false,'valu',false,'cod',true);
revoke all on function public.guard_payment_settings() from public,anon,authenticated;

-- Preserve independently maintained bundle relationships. Checkout selects only
-- component IDs explicitly present in the validated current bundle productIds.
-- No delete/reinsert synchronization of images, bundle_items or order_items.
-- Existing derived rows and independently stored metadata are never overwritten.

-- Fees in settings.shipping remain business configuration. Carrier requests are
-- separate private records with an explicit unconfigured state and no tracking.
create table if not exists public.shipment_requests(
 id uuid primary key default gen_random_uuid(),
 order_id text not null unique references public.orders(id) on delete restrict,
 state text not null default 'unconfigured' check(state in ('unconfigured','requested','confirmed','failed')),
 provider text,provider_reference text,tracking_number text,
 idempotency_key uuid not null unique,created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(state<>'confirmed' or (nullif(provider,'') is not null and nullif(provider_reference,'') is not null)),
 check(state='confirmed' or tracking_number is null));
alter table public.shipment_requests enable row level security;
revoke all on public.shipment_requests from public,anon,authenticated,service_role;
grant select on public.shipment_requests to authenticated;
drop policy if exists shipment_request_staff_read on public.shipment_requests;
create policy shipment_request_staff_read on public.shipment_requests for select to authenticated using(public.admin_access());
grant select,insert,update on public.shipment_requests to service_role;
-- Future carrier adapter verifies the admin caller, calls a configured carrier
-- API using server-only credentials, then persists the actual response. No fake
-- tracking, browser confirmation or assumed carrier is provided by this setup.

-- Removing a catalog record must not cascade-delete independent child metadata.
-- Preserve existing foreign keys; RESTRICT guards are additive and repeatable.
do $preserve$ declare spec record;begin
 for spec in select * from(values
 ('product_images','product_id','products','preserve_product_images'),
 ('bundle_items','bundle_id','bundles','preserve_bundle_items'),
 ('order_items','order_id','orders','preserve_order_items')
 )v(child_table,child_column,parent_table,constraint_name) loop
  if not exists(select 1 from pg_constraint where conrelid=to_regclass('public.'||spec.child_table) and conname=spec.constraint_name) then
   execute format('alter table public.%I add constraint %I foreign key(%I) references public.%I(id) on delete restrict not valid',spec.child_table,spec.constraint_name,spec.child_column,spec.parent_table);
  end if;
 end loop;end $preserve$;
-- Restrict constraints alone cannot reliably precede existing CASCADE triggers.
-- A BEFORE DELETE guard refuses parent deletion while preserved rows exist.
create or replace function public.guard_preserved_children() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_TABLE_NAME='products' and exists(select 1 from public.product_images where product_id=old.id) then raise exception 'Archive this product; related images must be preserved';end if;
 if TG_TABLE_NAME='bundles' and exists(select 1 from public.bundle_items where bundle_id=old.id) then raise exception 'Disable this bundle; related components must be preserved';end if;
 if TG_TABLE_NAME='orders' and exists(select 1 from public.order_items where order_id=old.id) then raise exception 'Order lines must be preserved';end if;
 return old;end$$;
drop trigger if exists guard_preserved_product on public.products;
create trigger guard_preserved_product before delete on public.products for each row execute function public.guard_preserved_children();
drop trigger if exists guard_preserved_bundle on public.bundles;
create trigger guard_preserved_bundle before delete on public.bundles for each row execute function public.guard_preserved_children();
drop trigger if exists guard_preserved_order on public.orders;
create trigger guard_preserved_order before delete on public.orders for each row execute function public.guard_preserved_children();
revoke all on function public.guard_preserved_children() from public,anon,authenticated;
do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='shipment_requests') then alter publication supabase_realtime add table public.shipment_requests;end if;
end$$;
insert into public.store_schema_migrations(version) values('202611220007') on conflict(version) do nothing;
commit;
