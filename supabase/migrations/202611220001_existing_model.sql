begin;
create table if not exists public.store_schema_migrations(version text primary key,applied_at timestamptz not null default now());
alter table public.store_schema_migrations enable row level security;revoke all on public.store_schema_migrations from anon,authenticated;
do $apply$ begin
-- AlMumez admin workspace v2. Run in Supabase SQL Editor, then assign an admin UUID.
-- No credentials or service-role keys belong in the static website.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,name text not null default '',created_at timestamptz not null default now());
create table if not exists public.user_roles(user_id uuid primary key references auth.users(id) on delete cascade,role text not null check(role in ('admin','staff')));
create or replace function public.admin_role() returns text language sql stable security definer set search_path='' as $$ select r.role from public.user_roles r join auth.users u on u.id=r.user_id where r.user_id=auth.uid() and u.email_confirmed_at is not null $$;
revoke all on function public.admin_role() from public; grant execute on function public.admin_role() to authenticated;
create or replace function public.admin_access() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.user_roles r join auth.users u on u.id=r.user_id where r.user_id=auth.uid() and r.role in ('admin','staff') and u.email_confirmed_at is not null)$$;
revoke all on function public.admin_access() from public;grant execute on function public.admin_access() to authenticated;
alter table public.profiles enable row level security;alter table public.user_roles enable row level security;
drop policy if exists profile_read on public.profiles;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.admin_access());
drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid() or public.admin_role()='admin') with check(id=auth.uid() or public.admin_role()='admin');
drop policy if exists role_read on public.user_roles;
create policy role_read on public.user_roles for select to authenticated using(user_id=auth.uid() or public.admin_role()='admin');
drop policy if exists role_manage on public.user_roles;
create policy role_manage on public.user_roles for all to authenticated using(public.admin_role()='admin') with check(public.admin_role()='admin');
create or replace function public.new_admin_profile() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.profiles(id,name) values(new.id,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1))) on conflict(id) do nothing;return new;end$$;
drop trigger if exists almumez_new_profile on auth.users;create trigger almumez_new_profile after insert on auth.users for each row execute function public.new_admin_profile();
insert into public.profiles(id,name) select id,coalesce(raw_user_meta_data->>'name',split_part(email,'@',1)) from auth.users on conflict(id) do nothing;

create table if not exists public.categories(id text primary key,name jsonb not null default '{}'::jsonb);
create table if not exists public.products(id text primary key,published boolean not null default true,payload jsonb not null check(jsonb_typeof(payload)='object'),updated_at timestamptz not null default now(),check((payload->>'price')::numeric>=0),check((payload->>'stock')::integer>=0));
create table if not exists public.bundles(id text primary key,payload jsonb not null check(jsonb_typeof(payload)='object'),updated_at timestamptz not null default now(),check((payload->>'price')::numeric>0));
create table if not exists public.bundle_items(bundle_id text references public.bundles(id) on delete cascade,product_id text references public.products(id) on delete restrict,quantity integer not null default 1 check(quantity>0),primary key(bundle_id,product_id));
create table if not exists public.customers(id uuid primary key default gen_random_uuid(),email text,phone text,name text,city text,created_at timestamptz not null default now());
create unique index if not exists customers_email_phone on public.customers(lower(coalesce(email,'')),coalesce(phone,''));
create table if not exists public.orders(id text primary key,payload jsonb not null check(jsonb_typeof(payload)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.orders add column if not exists request_id text;
alter table public.orders add column if not exists request_fingerprint text;
create table if not exists public.order_items(order_id text references public.orders(id) on delete cascade,line integer not null,product_id text references public.products(id) on delete set null,quantity integer not null check(quantity>0),unit_price numeric not null check(unit_price>=0),payload jsonb not null,primary key(order_id,line));
create table if not exists public.notifications(id text primary key,payload jsonb not null,created_at timestamptz not null default now());
create table if not exists public.settings(key text primary key,value jsonb not null);
insert into public.settings(key,value) values('shipping','{"express":150,"standard":0,"pickup":0}'),('paymentMethods','{"card":false,"cod":true,"valu":false}'),('storeName','"AlMumez"'),('monthlyGoal','0') on conflict(key) do nothing;

-- Keep the existing contact form contract. messages is an automatically updatable,
-- security-invoker view of the existing support_messages table, not a second inbox.
create table if not exists public.support_messages(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 2 and 100),email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),subject text not null check(subject in ('order','product','returns','other')),order_number text,product_name text,message text not null check(length(trim(message)) between 10 and 1000),consent boolean not null check(consent),status text not null default 'new' check(status in ('new','in_progress','resolved')),read_at timestamptz,created_at timestamptz not null default now());
alter table public.support_messages add column if not exists starred boolean not null default false;
alter table public.support_messages add column if not exists archived boolean not null default false;
alter table public.support_messages add column if not exists demo boolean not null default false;
drop policy if exists submit_request on public.support_messages;
drop policy if exists admin_read on public.support_messages;
drop policy if exists admin_update on public.support_messages;
create or replace view public.messages with(security_invoker=true) as select * from public.support_messages;
create or replace function public.is_support_admin() returns boolean language sql stable security definer set search_path='' as $$select public.admin_access()$$;
revoke all on function public.is_support_admin() from public,anon;grant execute on function public.is_support_admin() to authenticated;

do $$declare name text;begin foreach name in array array['categories','products','bundles','bundle_items','customers','orders','order_items','notifications','settings','support_messages'] loop execute format('alter table public.%I enable row level security',name);execute format('revoke all on public.%I from anon,authenticated',name);execute format('grant select on public.%I to authenticated',name);execute format('drop policy if exists workspace_read on public.%I',name);execute format('create policy workspace_read on public.%I for select to authenticated using(public.admin_access())',name);end loop;end$$;
grant select on public.products,public.categories,public.bundles,public.settings to anon;
drop policy if exists catalog_public on public.products;
create policy catalog_public on public.products for select to anon using(published);
drop policy if exists category_public on public.categories;
create policy category_public on public.categories for select to anon using(true);
drop policy if exists bundle_public on public.bundles;
create policy bundle_public on public.bundles for select to anon using(coalesce((payload->>'enabled')::boolean,false) and (nullif(payload->>'startsAt','') is null or (payload->>'startsAt')::timestamptz<=now()) and (nullif(payload->>'endsAt','') is null or (payload->>'endsAt')::timestamptz>now()));
drop policy if exists settings_public on public.settings;
create policy settings_public on public.settings for select to anon using(key in ('storeName','supportEmail','whatsappNumber','shipping','paymentMethods'));
do $$declare name text;begin foreach name in array array['products','categories','bundles'] loop execute format('grant insert,update on public.%I to authenticated',name);execute format('drop policy if exists workspace_insert on public.%I',name);execute format('create policy workspace_insert on public.%I for insert to authenticated with check(public.admin_access())',name);execute format('drop policy if exists workspace_update on public.%I',name);execute format('create policy workspace_update on public.%I for update to authenticated using(public.admin_access()) with check(public.admin_access())',name);execute format('grant delete on public.%I to authenticated',name);execute format('drop policy if exists workspace_delete on public.%I',name);execute format('create policy workspace_delete on public.%I for delete to authenticated using(public.admin_role()=''admin'')',name);end loop;end$$;
grant insert,update,delete on public.orders,public.notifications,public.settings to authenticated;
drop policy if exists order_insert on public.orders;
create policy order_insert on public.orders for insert to authenticated with check(public.admin_role()='admin');
drop policy if exists order_update on public.orders;
create policy order_update on public.orders for update to authenticated using(public.admin_access()) with check(public.admin_access());
drop policy if exists order_delete on public.orders;
create policy order_delete on public.orders for delete to authenticated using(public.admin_role()='admin' and coalesce((payload->>'demo')::boolean,false));
drop policy if exists settings_manage on public.settings;
create policy settings_manage on public.settings for all to authenticated using(public.admin_role()='admin') with check(public.admin_role()='admin');
drop policy if exists notifications_manage on public.notifications;
create policy notifications_manage on public.notifications for all to authenticated using(public.admin_access()) with check(public.admin_access());
grant insert(name,email,subject,order_number,product_name,message,consent) on public.support_messages to anon;
grant select,insert,update,delete on public.support_messages,public.messages to authenticated;
drop policy if exists support_submit on public.support_messages;
create policy support_submit on public.support_messages for insert to anon with check(consent and status='new' and not starred and not archived and not demo);
drop policy if exists support_manage on public.support_messages;
create policy support_manage on public.support_messages for all to authenticated using(public.admin_access()) with check(public.admin_access());
create index if not exists orders_created on public.orders(created_at desc);
create index if not exists orders_status on public.orders((payload->>'statusKey'));
create index if not exists support_created on public.support_messages(created_at desc);
create index if not exists product_category on public.products((payload->>'category'));

create or replace function public.workspace_product_sync() returns trigger language plpgsql security definer set search_path='' as $$begin
 new.updated_at=now();new.payload=jsonb_set(new.payload,'{id}',to_jsonb(new.id));new.payload=jsonb_set(new.payload,'{published}',to_jsonb(new.published));
 insert into public.categories(id,name) values(coalesce(new.payload->>'category','other'),jsonb_build_object('ar',coalesce(new.payload->>'category','other'),'en',coalesce(new.payload->>'category','other'))) on conflict(id) do nothing;return new;end$$;
drop trigger if exists workspace_product_sync on public.products;
create trigger workspace_product_sync before insert or update on public.products for each row execute function public.workspace_product_sync();
create or replace function public.workspace_bundle_sync() returns trigger language plpgsql security definer set search_path='' as $$declare product text;entry jsonb;begin
 if jsonb_typeof(new.payload->'productIds') is distinct from 'array' then raise exception 'productIds must be an array';end if;
 if jsonb_array_length(new.payload->'productIds') not between 2 and 8 then raise exception 'Choose 2 to 8 products';end if;
 if (select count(distinct value) from jsonb_array_elements(new.payload->'productIds'))<>jsonb_array_length(new.payload->'productIds') then raise exception 'Duplicate bundle products';end if;
 for entry in select value from jsonb_array_elements(new.payload->'productIds') loop
  if jsonb_typeof(entry) is distinct from 'string' or length(trim(entry#>>'{}'))=0 then raise exception 'Invalid bundle product';end if;
  product=entry#>>'{}';if not exists(select 1 from public.products where id=product) then raise exception 'Unknown bundle product';end if;
  insert into public.bundle_items(bundle_id,product_id) values(new.id,product) on conflict(bundle_id,product_id) do nothing;
 end loop;return new;end$$;
drop trigger if exists workspace_bundle_sync on public.bundles;
create trigger workspace_bundle_sync after insert or update on public.bundles for each row execute function public.workspace_bundle_sync();
create or replace function public.workspace_order_sync() returns trigger language plpgsql security definer set search_path='' as $$declare item jsonb;idx integer=0;begin
 if TG_OP='UPDATE' and public.admin_role()='staff' and ((new.payload-array['status','statusKey','statusUpdatedAt','timeline','notes'])<>(old.payload-array['status','statusKey','statusUpdatedAt','timeline','notes']) or new.created_at<>old.created_at or new.id<>old.id) then raise insufficient_privilege;end if;
 new.updated_at=now();return new;end$$;
drop trigger if exists workspace_order_guard on public.orders;
create trigger workspace_order_guard before update on public.orders for each row execute function public.workspace_order_sync();
create or replace function public.workspace_order_items() returns trigger language plpgsql security definer set search_path='' as $$declare item jsonb;idx integer=0;begin
 if TG_OP='UPDATE' then if new.payload->'items' is distinct from old.payload->'items' then raise exception 'Order line items are immutable';end if;return new;end if;
 for item in select * from jsonb_array_elements(new.payload->'items') loop idx=idx+1;insert into public.order_items(order_id,line,product_id,quantity,unit_price,payload) values(new.id,idx,case when exists(select 1 from public.products where id=item->>'id') then item->>'id' else null end,(item->>'quantity')::int,(item->>'price')::numeric,item) on conflict(order_id,line) do nothing;end loop;
 insert into public.notifications(id,payload) values('order-'||new.id,jsonb_build_object('type','order','orderId',new.id,'createdAt',now())) on conflict(id) do nothing;return new;end$$;
drop trigger if exists workspace_order_items on public.orders;
create trigger workspace_order_items after insert or update of payload on public.orders for each row execute function public.workspace_order_items();

create or replace function public.effective_product_price(p jsonb,variant_id text default null) returns numeric language plpgsql stable set search_path='' as $$declare base_price numeric=(p->>'price')::numeric;o jsonb=p->'offer';v jsonb;begin
 if coalesce((o->>'enabled')::boolean,false) and (nullif(o->>'startsAt','') is null or (o->>'startsAt')::timestamptz<=now()) and (nullif(o->>'endsAt','') is null or (o->>'endsAt')::timestamptz>now()) then
  if o->>'type'='prices' then base_price=(o->>'newPrice')::numeric;elsif o->>'type'='percent' then base_price=round(base_price*(1-(o->>'value')::numeric/100));elsif o->>'type'='fixed' then base_price=greatest(0,base_price-(o->>'value')::numeric);end if;
 end if;
 if variant_id is not null then select value into v from jsonb_array_elements(coalesce(p->'variants','[]')) where value->>'id'=variant_id;if v is null then raise exception 'Invalid product variant';end if;base_price=base_price+coalesce((v->>'priceDelta')::numeric,0);end if;return greatest(0,base_price);end$$;

-- Server-authoritative pricing and stock reservation. Card/ValU orders remain
-- awaiting confirmation until a real payment provider verifies settlement.
create or replace function public.submit_store_order(p_order jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb;product public.products%rowtype;b public.bundles%rowtype;items jsonb='[]';components jsonb;component jsonb;product_id text;variant_id text;variants jsonb;qty int;component_qty int;price numeric;subtotal numeric=0;shipping numeric;discount numeric=0;total numeric;shipping_settings jsonb;payment_settings jsonb;result jsonb;existing public.orders%rowtype;canonical_items jsonb;fingerprint text;customer jsonb=p_order->'customer';
begin
 if nullif(p_order->>'requestId','') is null or length(p_order->>'requestId') not between 32 and 80 then raise exception 'Invalid idempotency key';end if;
 if jsonb_typeof(p_order->'items') is distinct from 'array' or jsonb_array_length(p_order->'items') not between 1 and 50 then raise exception 'Invalid items';end if;
 if length(coalesce(customer->>'name','')) not between 2 and 100 or length(coalesce(customer->>'phone','')) not between 8 and 30 or length(coalesce(customer->>'email',''))>254 or length(coalesce(customer->>'address','')) not between 3 and 500 or length(coalesce(customer->>'city',''))>100 then raise exception 'Invalid customer details';end if;
 if coalesce(trim(customer->>'email'),'')<>'' and trim(customer->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid customer email';end if;
 if coalesce(customer->>'phone','') !~ '^\+?[0-9][0-9 ()-]{7,29}$' then raise exception 'Invalid customer phone';end if;
 customer=jsonb_build_object('name',trim(customer->>'name'),'email',lower(trim(coalesce(customer->>'email',''))),'phone',regexp_replace(customer->>'phone','[^0-9+]','','g'),'address',trim(customer->>'address'),'city',trim(customer->>'city'));
 if length(coalesce(p_order->>'id','')) not between 5 and 80 then raise exception 'Invalid order ID';end if;
 select jsonb_agg(jsonb_build_object('id',value->>'id','quantity',(value->>'quantity')::int,'storage',nullif(value->>'storage',''),'isBundle',coalesce((value->>'isBundle')::boolean,false),'bundleId',nullif(value->>'bundleId','')) order by value->>'id',value->>'storage',value->>'bundleId',(value->>'quantity')::int) into canonical_items from jsonb_array_elements(p_order->'items');
 fingerprint=encode(sha256(convert_to(jsonb_build_object('customer',customer,'items',canonical_items,'coupon',coalesce(p_order->>'coupon',''),'delivery',p_order->>'delivery','payment',p_order->>'payment','language',coalesce(p_order->>'language','ar'))::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('almumez-order-request:'||(p_order->>'requestId'),0));
 select * into existing from public.orders where request_id=p_order->>'requestId' or (request_id is null and payload->>'requestId'=p_order->>'requestId') limit 1;
 if found then
  if existing.request_fingerprint is null then raise exception 'Legacy request has no trustworthy fingerprint; manual review required';end if;
  if existing.request_fingerprint is distinct from fingerprint then raise exception 'Request ID already used with different checkout details';end if;
  return existing.payload-array['notes','timeline','requestId'];
 end if;
 if exists(select 1 from public.orders where id=p_order->>'id') then raise exception 'Duplicate order ID';end if;
 perform pg_advisory_xact_lock(hashtextextended('almumez-order-phone:'||coalesce(customer->>'phone',''),0));
 if (select count(*) from public.orders where payload->'customer'->>'phone'=customer->>'phone' and created_at>now()-interval '10 minutes')>=3 then raise exception 'Please wait before ordering again';end if;
 select value into shipping_settings from public.settings where key='shipping';select value into payment_settings from public.settings where key='paymentMethods';
 if p_order->>'payment' in ('card','valu') then raise exception 'Online payments require a configured server-side provider and verified webhook';end if;
 if p_order->>'delivery' is null or p_order->>'payment' is null or p_order->>'delivery' not in ('express','standard','pickup') or p_order->>'payment' not in ('card','cod','valu') or not coalesce((payment_settings->>(p_order->>'payment'))::boolean,false) then raise exception 'Shipping or payment is unavailable';end if;
 shipping=coalesce((shipping_settings->>(p_order->>'delivery'))::numeric,0);
 -- Lock bundle definitions before their component products, in stable order.
 perform 1 from public.bundles where id in(select value->>'bundleId' from jsonb_array_elements(p_order->'items')) order by id for update;
 -- Lock product rows in a stable order to avoid cross-order deadlocks.
 perform 1 from public.products where id in (select value->>'id' from jsonb_array_elements(p_order->'items') union select bi.product_id from public.bundle_items bi join jsonb_array_elements(p_order->'items') i on bi.bundle_id=i.value->>'bundleId') order by id for update;
 for item in select * from jsonb_array_elements(p_order->'items') loop
  qty=(item->>'quantity')::int;if qty is null or qty not between 1 and 100 then raise exception 'Invalid quantity';end if;
  if coalesce((item->>'isBundle')::boolean,false) then
   select * into b from public.bundles where id=item->>'bundleId';if not found or not coalesce((b.payload->>'enabled')::boolean,false) or (nullif(b.payload->>'startsAt','') is not null and (b.payload->>'startsAt')::timestamptz>now()) or (nullif(b.payload->>'endsAt','') is not null and (b.payload->>'endsAt')::timestamptz<=now()) then raise exception 'Bundle is unavailable';end if;
   components='[]';for product_id in select bi.product_id from public.bundle_items bi where bi.bundle_id=b.id and b.payload->'productIds' ? bi.product_id order by bi.product_id loop
    select * into product from public.products where id=product_id;
    select bi.quantity into component_qty from public.bundle_items bi where bi.bundle_id=b.id and bi.product_id=product.id;
    if not product.published or (product.payload->>'stock')::int<qty*component_qty then raise exception 'Bundle product is unavailable';end if;
    update public.products set payload=jsonb_set(payload,'{stock}',to_jsonb((payload->>'stock')::int-qty*component_qty)) where id=product_id;
    components=components||jsonb_build_array(jsonb_build_object('id',product.id,'name',coalesce(product.payload->'name'->>(case when p_order->>'language'='en' then 'en' else 'ar' end),product.id),'price',public.effective_product_price(product.payload),'quantity',component_qty));
   end loop;price=(b.payload->>'price')::numeric;item=jsonb_build_object('id',b.id,'bundleId',b.id,'isBundle',true,'price',price,'quantity',qty,'components',components,'name',coalesce(b.payload->'title'->>(case when p_order->>'language'='en' then 'en' else 'ar' end),b.id));
  else
   select * into product from public.products where id=item->>'id';if not found or not product.published or (product.payload->>'stock')::int<qty then raise exception 'Product is unavailable';end if;
   variant_id=nullif(item->>'storage','');price=public.effective_product_price(product.payload,variant_id);
   if variant_id is not null then if not exists(select 1 from jsonb_array_elements(coalesce(product.payload->'variants','[]')) v where v->>'id'=variant_id and (v->>'stock')::int>=qty) then raise exception 'Variant is unavailable';end if;
    select jsonb_agg(case when v->>'id'=variant_id then jsonb_set(v,'{stock}',to_jsonb((v->>'stock')::int-qty)) else v end) into variants from jsonb_array_elements(product.payload->'variants') v;
    update public.products set payload=jsonb_set(jsonb_set(payload,'{stock}',to_jsonb((payload->>'stock')::int-qty)),'{variants}',variants) where id=product.id;
   else update public.products set payload=jsonb_set(payload,'{stock}',to_jsonb((payload->>'stock')::int-qty)) where id=product.id;end if;
   item=jsonb_build_object('id',product.id,'storage',variant_id,'price',price,'quantity',qty,'isBundle',false,'name',coalesce(product.payload->'name'->>(case when p_order->>'language'='en' then 'en' else 'ar' end),product.id),'image',product.payload->>'image');
  end if;
  subtotal=subtotal+price*qty;items=items||jsonb_build_array(item);
 end loop;
 if p_order->>'coupon'='MUMEZ25' then discount=least(500,subtotal);end if;total=greatest(0,subtotal+shipping-discount);
 if subtotal is distinct from (p_order->>'subtotal')::numeric or shipping is distinct from (p_order->>'shipping')::numeric or discount is distinct from (p_order->>'discount')::numeric then raise exception 'Prices changed. Reload checkout and review the updated total.';end if;
 result=jsonb_build_object('id',p_order->>'id','requestId',p_order->>'requestId','customer',customer,'items',items,'subtotal',subtotal,'shipping',shipping,'discount',discount,'total',total,'createdAt',now(),'delivery',p_order->>'delivery','payment',p_order->>'payment','status','طلب جديد','statusKey','new','paymentVerified',false,'stockReservationVersion',1);
 insert into public.orders(id,payload,request_id,request_fingerprint) values(result->>'id',result,p_order->>'requestId',fingerprint);
 -- Customer association is handled by order_customer_sync with verified ownership.
 return result;
end$$;
revoke all on function public.submit_store_order(jsonb) from public;grant execute on function public.submit_store_order(jsonb) to anon,authenticated;

create or replace function public.admin_analytics(p_start timestamptz,p_end timestamptz) returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 select jsonb_build_object('orders',count(*),'sales',coalesce(sum((payload->>'total')::numeric) filter(where payload->>'statusKey'<>'cancelled'),0),'average',coalesce(avg((payload->>'total')::numeric) filter(where payload->>'statusKey'<>'cancelled'),0),'newOrders',count(*) filter(where payload->>'statusKey'='new')) into result from public.orders where created_at>=p_start and created_at<p_end;return result;end$$;
revoke all on function public.admin_analytics(timestamptz,timestamptz) from public,anon;grant execute on function public.admin_analytics(timestamptz,timestamptz) to authenticated;
create or replace function public.list_support_messages(p_topic text default '',p_status text default '',p_query text default '',p_page integer default 0) returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 with filtered as(select * from public.support_messages where(p_topic='' or subject=p_topic) and(p_status='' or status=p_status) and(p_query='' or strpos(lower(concat_ws(' ',name,email,message,order_number,product_name)),lower(left(p_query,200)))>0)),paged as(select * from filtered order by created_at desc,id limit 25 offset greatest(0,least(p_page,100000))*25)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'::jsonb),'total',(select count(*) from filtered),'unread',(select count(*) from public.support_messages where read_at is null and not archived)) into result;return result;end$$;
revoke all on function public.list_support_messages(text,text,text,integer) from public,anon;grant execute on function public.list_support_messages(text,text,text,integer) to authenticated;

-- Public images; only authenticated staff may upload, administrators may delete.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-images','product-images',true,12582912,array['image/webp']) on conflict(id) do nothing;
drop policy if exists admin_image_read on storage.objects;
create policy admin_image_read on storage.objects for select using(bucket_id='product-images');
drop policy if exists admin_image_insert on storage.objects;
create policy admin_image_insert on storage.objects for insert to authenticated with check(bucket_id='product-images' and public.admin_access());
drop policy if exists admin_image_update on storage.objects;
create policy admin_image_update on storage.objects for update to authenticated using(bucket_id='product-images' and public.admin_access()) with check(bucket_id='product-images' and public.admin_access());
drop policy if exists admin_image_delete on storage.objects;
create policy admin_image_delete on storage.objects for delete to authenticated using(bucket_id='product-images' and public.admin_role()='admin');
do $$declare name text;begin foreach name in array array['orders','products','bundles','support_messages','notifications','settings'] loop if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=name) then execute format('alter publication supabase_realtime add table public.%I',name);end if;end loop;end$$;

-- Grant the FIRST admin manually; never expose an anonymous role-granting RPC:
-- insert into public.user_roles(user_id,role) values('AUTH_USER_UUID','admin');

insert into public.store_schema_migrations(version) values('202611220001') on conflict(version) do nothing;end $apply$;
commit;
