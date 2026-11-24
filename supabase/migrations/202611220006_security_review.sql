begin;
-- No business records are removed. Legacy support administrators are NOT promoted.
-- Authorization is exclusively public.user_roles, assigned by a trusted operator.
create or replace function public.is_support_admin() returns boolean language sql stable security definer set search_path='' as $$select public.admin_access()$$;
revoke all on function public.is_support_admin() from public,anon;
grant execute on function public.is_support_admin() to authenticated;

drop policy if exists catalog_public on public.products;
create policy catalog_public on public.products for select to anon,authenticated using(published);
drop policy if exists category_public on public.categories;
create policy category_public on public.categories for select to anon,authenticated using(true);
drop policy if exists bundle_public on public.bundles;
create policy bundle_public on public.bundles for select to anon,authenticated using(coalesce((payload->>'enabled')::boolean,false) and (nullif(payload->>'startsAt','') is null or (payload->>'startsAt')::timestamptz<=now()) and (nullif(payload->>'endsAt','') is null or (payload->>'endsAt')::timestamptz>now()));
drop policy if exists settings_public on public.settings;
create policy settings_public on public.settings for select to anon,authenticated using(key in ('storeName','supportEmail','whatsappNumber','shipping','paymentMethods'));
drop policy if exists image_read on public.product_images;
drop policy if exists image_public_read on public.product_images;
drop policy if exists image_staff_read on public.product_images;
create policy image_public_read on public.product_images for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_id and p.published));
create policy image_staff_read on public.product_images for select to authenticated using(public.admin_access());

-- A customer summary must never expose other customers' order aggregates.
create or replace function public.customer_summary(p_ids uuid[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if not public.admin_access() or coalesce(cardinality(p_ids),0)>100 then raise insufficient_privilege;end if;
 return (select coalesce(jsonb_agg(row),'[]') from(select c.id,count(o.id) count,coalesce(sum((o.payload->>'total')::numeric) filter(where o.payload->>'statusKey'<>'cancelled'),0) total,max(o.created_at) "lastOrder" from public.customers c left join public.orders o on o.customer_id=c.id where c.id=any(p_ids) group by c.id)row);
end$$;
revoke all on function public.customer_summary(uuid[]) from public,anon;
grant execute on function public.customer_summary(uuid[]) to authenticated;

create table if not exists public.order_stock_reservations(
 order_id text not null references public.orders(id) on delete restrict,
 product_id text not null references public.products(id) on delete restrict,
 variant_id text not null default '',quantity int not null check(quantity>0),
 state text not null default 'reserved' check(state in ('reserved','released','consumed')),
 created_at timestamptz not null default now(),released_at timestamptz,
 primary key(order_id,product_id,variant_id));
alter table public.order_stock_reservations enable row level security;
revoke all on public.order_stock_reservations from public,anon,authenticated;
grant select on public.order_stock_reservations to authenticated;
drop policy if exists reservation_staff_read on public.order_stock_reservations;
create policy reservation_staff_read on public.order_stock_reservations for select to authenticated using(public.admin_access());
-- No reservations are inferred for historical orders: their stock history is unknown.
alter table public.payment_transactions add column if not exists reconciliation_required boolean not null default false;

create or replace function public.reserve_order_record() returns trigger language plpgsql security definer set search_path='' as $$declare item jsonb;component jsonb;begin
 -- Only server-authoritative checkout marks an order as stock-reserved.
 if new.payload->>'stockReservationVersion'<>'1' or new.payload->>'stockReservationVersion' is null then return new;end if;
 for item in select value from jsonb_array_elements(new.payload->'items') loop
  if coalesce((item->>'isBundle')::boolean,false) then
   for component in select value from jsonb_array_elements(item->'components') loop
    insert into public.order_stock_reservations(order_id,product_id,quantity) values(new.id,component->>'id',(item->>'quantity')::int*(component->>'quantity')::int)
    on conflict(order_id,product_id,variant_id) do update set quantity=public.order_stock_reservations.quantity+excluded.quantity;
   end loop;
  else
   insert into public.order_stock_reservations(order_id,product_id,variant_id,quantity) values(new.id,item->>'id',coalesce(item->>'storage',''),(item->>'quantity')::int)
   on conflict(order_id,product_id,variant_id) do update set quantity=public.order_stock_reservations.quantity+excluded.quantity;
  end if;
 end loop;
 insert into public.payment_transactions(order_id,provider,amount,currency) values(new.id,case when new.payload->>'payment'='cod' then 'cod' else 'unconfigured' end,(new.payload->>'total')::numeric,'EGP') on conflict(order_id,provider) do nothing;
 return new;end$$;
drop trigger if exists reserve_order_record on public.orders;
create trigger reserve_order_record after insert on public.orders for each row execute function public.reserve_order_record();

create or replace function public.restore_order_stock(p_order_id text) returns void language plpgsql security definer set search_path='' as $$declare reservation public.order_stock_reservations%rowtype;product_payload jsonb;variants jsonb;begin
 -- Internal only. The caller must hold the order row lock before product locks.
 for reservation in select * from public.order_stock_reservations where order_id=p_order_id and state='reserved' order by product_id,variant_id for update loop
  select payload into product_payload from public.products where id=reservation.product_id for update;
  if not found then raise exception 'Reserved product is missing; manual reconciliation required';end if;
  if reservation.variant_id<>'' then
   if not exists(select 1 from jsonb_array_elements(coalesce(product_payload->'variants','[]')) v where v->>'id'=reservation.variant_id) then raise exception 'Reserved variant is missing; manual reconciliation required';end if;
   select jsonb_agg(case when v->>'id'=reservation.variant_id then jsonb_set(v,'{stock}',to_jsonb((v->>'stock')::int+reservation.quantity)) else v end) into variants from jsonb_array_elements(product_payload->'variants') v;
   product_payload=jsonb_set(product_payload,'{variants}',variants);
  end if;
  update public.products set payload=jsonb_set(product_payload,'{stock}',to_jsonb((product_payload->>'stock')::int+reservation.quantity)) where id=reservation.product_id;
  update public.order_stock_reservations set state='released',released_at=now() where order_id=reservation.order_id and product_id=reservation.product_id and variant_id=reservation.variant_id;
 end loop;
end$$;
revoke all on function public.restore_order_stock(text) from public,anon,authenticated,service_role;

create or replace function public.workspace_order_sync() returns trigger language plpgsql security definer set search_path='' as $$declare role_name text=public.admin_role();jwt_role text=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',current_setting('request.jwt.claim.role',true),'');begin
 if new.id is distinct from old.id or new.created_at is distinct from old.created_at then raise exception 'Order identity is immutable';end if;
 if new.customer_id is distinct from old.customer_id and not coalesce(public.admin_role()='admin' and current_setting('almumez.link_guest_customer',true)='yes' and old.customer_id is null and new.customer_id is not null and new.payload=old.payload,false) then raise exception 'Order customer identity is immutable';end if;
 if new.request_id is distinct from old.request_id or new.request_fingerprint is distinct from old.request_fingerprint then raise exception 'Order request identity is immutable';end if;
 if (new.payload-array['status','statusKey','statusUpdatedAt','timeline','notes','paymentVerified','paymentStatus']) is distinct from (old.payload-array['status','statusKey','statusUpdatedAt','timeline','notes','paymentVerified','paymentStatus']) then raise exception 'Commercial order fields are immutable';end if;
 if (new.payload->'paymentVerified' is distinct from old.payload->'paymentVerified' or new.payload->'paymentStatus' is distinct from old.payload->'paymentStatus') and jwt_role<>'service_role' then raise insufficient_privilege;end if;
 if role_name is null and jwt_role<>'service_role' then raise insufficient_privilege;end if;
 if new.payload->>'statusKey' is distinct from old.payload->>'statusKey' then
  if new.payload->>'statusKey' is null or new.payload->>'statusKey' not in ('new','processing','shipping','completed','cancelled') then raise exception 'Invalid order status';end if;
  if old.payload->>'statusKey' in ('cancelled','completed') then raise exception 'Terminal orders cannot be reopened';end if;
  if old.payload->>'statusKey'='shipping' and new.payload->>'statusKey'<>'completed' then raise exception 'Shipped orders require delivery or a return workflow';end if;
  if old.payload->>'statusKey'='processing' and new.payload->>'statusKey'='new' then raise exception 'Order status cannot move backwards';end if;
  if new.payload->>'statusKey'='cancelled' then
   if old.payload->>'statusKey'='shipping' or coalesce((old.payload->>'paymentVerified')::boolean,false) or exists(select 1 from public.order_stock_reservations where order_id=old.id and state='consumed') then raise exception 'Shipped or settled orders require a verified return/refund workflow';end if;
   perform public.restore_order_stock(old.id);
  elsif new.payload->>'statusKey' in ('shipping','completed') then
   if old.payload->>'payment'<>'cod' and not coalesce((old.payload->>'paymentVerified')::boolean,false) then raise exception 'Payment has not been verified';end if;
   update public.order_stock_reservations set state='consumed' where order_id=old.id and state='reserved';
  end if;
  new.payload=new.payload||jsonb_build_object('status',case new.payload->>'statusKey' when 'new' then 'طلب جديد' when 'processing' then 'قيد التجهيز' when 'shipping' then 'جاري التوصيل' when 'completed' then 'مكتمل' when 'cancelled' then 'ملغي' end,'statusUpdatedAt',now(),'timeline',coalesce(old.payload->'timeline','[]')||jsonb_build_array(jsonb_build_object('status',new.payload->>'statusKey','at',now(),'by',auth.uid())));
 elsif new.payload->'timeline' is distinct from old.payload->'timeline' or new.payload->'statusUpdatedAt' is distinct from old.payload->'statusUpdatedAt' or new.payload->'status' is distinct from old.payload->'status' then
  raise exception 'Order status audit fields are server-managed';
 end if;
 new.updated_at=now();return new;end$$;

-- Product stock used by reservations cannot be silently removed by editing variants.
create or replace function public.protect_reserved_variants() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.order_stock_reservations r where r.product_id=old.id and r.state='reserved' and r.variant_id<>'' and not exists(select 1 from jsonb_array_elements(coalesce(new.payload->'variants','[]')) v where v->>'id'=r.variant_id)) then raise exception 'A variant has an active stock reservation';end if;return new;end$$;
drop trigger if exists protect_reserved_variants on public.products;
create trigger protect_reserved_variants before update on public.products for each row execute function public.protect_reserved_variants();

-- Provider signatures and authoritative amounts must be checked by the server first.
-- This RPC is NOT a webhook endpoint and is never executable with a browser key.
create or replace function public.apply_verified_payment(p_event_id text,p_provider text,p_provider_id text,p_status text,p_amount numeric,p_currency text) returns void language plpgsql security definer set search_path='' as $$declare txn public.payment_transactions%rowtype;order_row public.orders%rowtype;begin
 if p_status is null or p_status not in ('paid','failed','cancelled') or nullif(p_event_id,'') is null or nullif(p_provider_id,'') is null then raise exception 'Invalid settlement';end if;
 -- Always acquire the order lock before transaction/product locks.
 select o.* into order_row from public.orders o join public.payment_transactions t on t.order_id=o.id where t.provider=p_provider and t.provider_id=p_provider_id for update of o;
 if not found then raise exception 'Unknown provider payment';end if;
 select * into txn from public.payment_transactions where provider=p_provider and provider_id=p_provider_id for update;
 if txn.amount is distinct from p_amount or lower(txn.currency) is distinct from lower(p_currency) then raise exception 'Payment settlement mismatch';end if;
 insert into public.provider_events(id,provider,payment_transaction_id,event_status,amount,currency) values(p_provider||':'||p_event_id,p_provider,txn.id,p_status,p_amount,p_currency) on conflict(id) do nothing;if not found then return;end if;
 if txn.status='paid' then return;end if;
 if p_status='paid' and (order_row.payload->>'statusKey'='cancelled' or exists(select 1 from public.order_stock_reservations where order_id=txn.order_id and state='released')) then
  update public.payment_transactions set reconciliation_required=true,updated_at=now() where id=txn.id;return;
 end if;
 if txn.status in ('failed','cancelled') and p_status<>'paid' then return;end if;
 update public.payment_transactions set status=p_status,updated_at=now() where id=txn.id;
 if p_status='paid' then
  update public.orders set payload=payload||jsonb_build_object('paymentVerified',true,'paymentStatus','paid') where id=txn.order_id;
 else
  update public.orders set payload=payload||jsonb_build_object('paymentStatus',p_status,'statusKey','cancelled','status','ملغي','statusUpdatedAt',now()) where id=txn.order_id and payload->>'statusKey' not in ('cancelled','completed','shipping');
 end if;
end$$;
revoke all on function public.apply_verified_payment(text,text,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.apply_verified_payment(text,text,text,text,numeric,text) to service_role;

-- The old support rate-limit trigger is retained if it already exists.
create schema if not exists support_private;
revoke all on schema support_private from public,anon,authenticated;
create or replace function support_private.limit_submissions() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(lower(new.email),0));
 if (select count(*) from public.support_messages where lower(email)=lower(new.email) and created_at>now()-interval '10 minutes')>=3 then raise exception 'Please wait before submitting another request';end if;return new;end$$;
revoke all on function support_private.limit_submissions() from public,anon,authenticated;
drop trigger if exists limit_support_submissions on public.support_messages;
create trigger limit_support_submissions before insert on public.support_messages for each row execute function support_private.limit_submissions();
create or replace function public.support_submission_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not coalesce(public.admin_access(),false) and (new.status<>'new' or new.starred or new.archived or new.demo or new.read_at is not null or abs(extract(epoch from new.created_at-now()))>10) then raise insufficient_privilege;end if;
 if length(coalesce(new.order_number,''))>80 or length(coalesce(new.product_name,''))>160 then raise exception 'Invalid reference';end if;return new;end$$;
drop trigger if exists support_submission_guard on public.support_messages;
create trigger support_submission_guard before insert on public.support_messages for each row execute function public.support_submission_guard();

-- Trigger functions are not callable RPCs. Explicitly close default PUBLIC EXECUTE.
revoke all on function public.new_admin_profile(),public.workspace_product_sync(),public.workspace_bundle_sync(),public.workspace_order_sync(),public.workspace_order_items(),public.product_relations_sync(),public.order_customer_sync(),public.message_customer_sync(),public.reserve_order_record(),public.protect_reserved_variants(),public.support_submission_guard() from public,anon,authenticated;
revoke all on public.user_roles from anon,authenticated;
grant select,insert,update,delete on public.user_roles to authenticated;
revoke all on public.profiles from public,anon,authenticated;
grant select,update(name) on public.profiles to authenticated;
-- Existing role_manage policy still requires admin for EVERY write.
-- Order creation is exclusively the authoritative checkout RPC, never raw INSERT.
revoke insert on public.orders from authenticated;
revoke create on schema public from public,anon,authenticated;
do $table_grants$ declare table_name text;begin
 foreach table_name in array array['store_schema_migrations','user_roles','categories','products','bundles','bundle_items','customers','orders','order_items','notifications','settings','support_messages','product_images','inventory_transactions','message_replies','payment_transactions','provider_events','shipments','order_stock_reservations'] loop
  execute format('revoke all on public.%I from public',table_name);
 end loop;end $table_grants$;
-- Close Supabase default EXECUTE grants as well as PostgreSQL's PUBLIC grant,
-- including obsolete overloads with these managed names. Regrant exact APIs only.
do $permissions$ declare fn record;begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['admin_role','admin_access','is_support_admin','new_admin_profile','workspace_product_sync','workspace_bundle_sync','workspace_order_sync','workspace_order_items','effective_product_price','submit_store_order','admin_analytics','list_support_messages','product_relations_sync','order_customer_sync','message_customer_sync','admin_page','admin_summary','admin_report','admin_customer_detail','apply_verified_payment','admin_overview','admin_set_order_status','admin_search','customer_summary','customer_orders','reserve_order_record','restore_order_stock','protect_reserved_variants','support_submission_guard']) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
 end loop;end $permissions$;
grant execute on function public.admin_role(),public.admin_access(),public.is_support_admin(),public.effective_product_price(jsonb,text),public.admin_analytics(timestamptz,timestamptz),public.list_support_messages(text,text,text,int),public.admin_page(text,jsonb,int,int),public.admin_summary(),public.admin_report(timestamptz,timestamptz,text),public.admin_customer_detail(uuid),public.admin_overview(timestamptz,timestamptz,timestamptz,timestamptz),public.admin_set_order_status(text[],text),public.admin_search(text),public.customer_summary(uuid[]),public.customer_orders(int) to authenticated;
grant execute on function public.submit_store_order(jsonb) to anon,authenticated;

do $$declare table_name text;begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then raise exception 'Supabase Realtime publication is missing';end if;
 foreach table_name in array array['orders','products','bundles','support_messages','notifications','settings','message_replies','customers','product_images','inventory_transactions','shipments','payment_transactions','order_stock_reservations'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then execute format('alter publication supabase_realtime add table public.%I',table_name);end if;
 end loop;end$$;
insert into public.store_schema_migrations(version) values('202611220006') on conflict(version) do nothing;
commit;
