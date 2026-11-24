-- FIRST MyStore APPLICATION DEPLOYMENT; SOURCE PREPARED, NOT EXECUTED.
-- Requires explicit owner approval and the verified external database backup.
-- Never run this and setup.sql as two deployments. This entry point includes it.
-- REVIEWED SOURCE; not executed. Apply whole file, never selected fragments.
BEGIN;

-- FIRST DEPLOYMENT ONLY. Repeat execution intentionally aborts rather than
-- replacing existing application objects. Existing Supabase platform objects
-- (auth/storage/realtime/extensions) are retained.
select pg_advisory_xact_lock(hashtextextended('almumez-schema-migration',0));
do $first_deployment_guard$ declare existing text;target text;verified_platform_oid oid=0;candidate_oid oid;begin
 if current_database()<>'postgres' then raise exception 'Expected the reviewed postgres database';end if;
 if current_setting('server_version_num')::int<170000 then raise exception 'This entry point targets the reviewed PostgreSQL 17+ environment';end if;
 if to_regclass('auth.users') is null or to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then raise exception 'Required existing Supabase platform schema is missing';end if;
 if not exists(select 1 from pg_roles where rolname='anon') or not exists(select 1 from pg_roles where rolname='authenticated') or not exists(select 1 from pg_roles where rolname='service_role') then raise exception 'Required Supabase roles are missing';end if;
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then raise exception 'Existing Supabase Realtime publication required';end if;
 foreach target in array array['store_schema_migrations','profiles','user_roles','categories','products','bundles','bundle_items','customers','orders','order_items','notifications','settings','support_messages','product_images','inventory_transactions','message_replies','payment_transactions','provider_events','shipments','order_stock_reservations','shipment_requests','deleted_support_messages','messages','public_products','public_bundles'] loop
  if to_regclass('public.'||target) is not null then raise exception 'Existing target relation public.%; preserve and review separately',target;end if;
 end loop;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['admin_access','admin_analytics','admin_category_page','admin_customer_detail','admin_notifications','admin_operational_summary','admin_overview','admin_page','admin_report','admin_role','admin_search','admin_set_order_status','admin_summary','apply_verified_payment','archive_deleted_support_message','backfill_guest_customers','catalog_match','catalog_page','customer_orders','customer_summary','customer_support_messages','effective_product_price','guard_catalog_shape','guard_category_delete','guard_payment_settings','guard_preserved_children','is_support_admin','list_support_messages','message_customer_sync','new_admin_profile','order_customer_sync','product_relations_sync','protect_reserved_variants','public_catalog_json','reserve_order_record','restore_deleted_support_message','restore_order_stock','site_bootstrap','submit_store_order','support_submission_guard','verified_administrative_role','workspace_bundle_sync','workspace_order_items','workspace_order_sync','workspace_product_sync'])) or to_regprocedure('support_private.limit_submissions()') is not null then raise exception 'Existing target routines; preserve and review separately';end if;
 select string_agg(n.nspname||'.'||c.relname,', ') into existing from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','support_private') and c.relkind in ('r','p','v','m','S','f')
 and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e');
 if existing is not null then raise exception 'First deployment refused: existing relations %. Nothing replaced; review separately.',existing;end if;
 -- Verified against PostgreSQL 17.12 and the pre-deployment backup: the supplied
 -- fingerprint is MD5(pg_catalog.pg_get_functiondef(oid)), NOT MD5(prosrc).
 -- Do not normalize whitespace, replace the function, or disable its event trigger.
 candidate_oid=to_regprocedure('public.rls_auto_enable()');
 -- Fail closed before inspecting the trigger. A valid function and trigger are
 -- required; there is no optional/ELSE branch after successful verification.
 if candidate_oid is null then
  raise exception 'First deployment refused: verified platform function public.rls_auto_enable() is missing';
 end if;
  if not exists(
   select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   join pg_language l on l.oid=p.prolang join pg_roles owner_role on owner_role.oid=p.proowner
   where p.oid=candidate_oid and n.nspname='public' and p.proname='rls_auto_enable'
   and p.prokind='f' and p.pronargs=0 and p.pronargdefaults=0 and p.provariadic=0
   and p.proallargtypes is null and not p.proretset and p.prorettype='pg_catalog.event_trigger'::regtype
   and owner_role.rolname='postgres' and l.lanname='plpgsql' and p.prosecdef
   and p.proconfig=array['search_path=pg_catalog']::text[]
   and pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid))='846ec2fbff751d24b890656d63c3a9bf'
  ) then raise exception 'First deployment refused: rls_auto_enable definition, owner or security settings mismatch';end if;
  if not exists(
   select 1 from pg_event_trigger e join pg_roles owner_role on owner_role.oid=e.evtowner
   where e.evtname='ensure_rls' and e.evtfoid=candidate_oid
   and e.evtevent='ddl_command_end' and e.evtenabled='O' and owner_role.rolname='postgres'
   and (select array_agg(tag order by tag) from unnest(e.evttags) tag)=array['CREATE TABLE','CREATE TABLE AS','SELECT INTO']::text[]
  ) or (select count(*) from pg_event_trigger where evtfoid=candidate_oid)<>1
  then raise exception 'First deployment refused: ensure_rls event trigger missing or configuration mismatch';end if;
 -- Only both successful checks authorize exclusion of this exact OID.
 verified_platform_oid=candidate_oid;
 select string_agg(n.nspname||'.'||p.proname,', ') into existing from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','support_private')
 and p.oid<>verified_platform_oid
 and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e');
 if existing is not null then raise exception 'First deployment refused: existing routines %. Nothing replaced.',existing;end if;
 if exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='almumez_new_profile') then raise exception 'Existing application Auth trigger; review separately';end if;
 if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname=any(array['admin_image_read','admin_image_insert','admin_image_update','admin_image_delete'])) then raise exception 'Existing named application Storage policies; preserve and review separately';end if;
 if exists(select 1 from storage.buckets) or exists(select 1 from storage.objects) then raise exception 'Storage no longer matches the reviewed empty state. Back up objects and review first';end if;
end $first_deployment_guard$;

-- FILE: preflight.sql
-- Fail closed on incompatible schemas; preserve unknown objects for manual review.

select pg_advisory_xact_lock(hashtextextended('almumez-schema-migration',0));
do $preflight$ declare expected record;actual_type text;unexpected text;begin
 if current_setting('server_version_num')::int<150000 then raise exception 'PostgreSQL 15+ is required';end if;
 if to_regclass('public.orders') is not null then
  for expected in select * from(values ('request_id'),('request_fingerprint'))v(column_name) loop
   select format_type(atttypid,atttypmod) into actual_type from pg_attribute where attrelid='public.orders'::regclass and attname=expected.column_name and not attisdropped;
   if actual_type is not null and actual_type<>'text' then raise exception 'Incompatible optional orders.% column',expected.column_name;end if;
  end loop;
  execute 'select count(*)::text from (select coalesce(to_jsonb(o)->>''request_id'',nullif(payload->>''requestId'','''')) from public.orders o where coalesce(to_jsonb(o)->>''request_id'',nullif(payload->>''requestId'','''')) is not null group by 1 having count(*)>1)d' into unexpected;
  if unexpected<>'0' then raise exception 'Duplicate legacy/new checkout request IDs (% groups). No automatic merge or deletion.',unexpected;end if;
 end if;
 if to_regclass('public.products') is not null then
  execute 'select count(*)::text from(select lower(payload->>''sku'') from public.products where nullif(payload->>''sku'','''') is not null group by 1 having count(*)>1)d' into unexpected;
  if unexpected<>'0' then raise exception 'Duplicate existing product SKUs. No automatic product merge/deletion.';end if;
 end if;
 -- Precheck every managed non-primary unique key before CREATE UNIQUE INDEX /
 -- IF NOT EXISTS table adoption. Unknown duplicates abort the whole transaction.
 for expected in select * from(values
 ('customers','lower(coalesce(email,'''')),coalesce(phone,'''')'),
 ('product_images','product_id,url'),('message_replies','client_id'),
 ('payment_transactions','provider_id'),('payment_transactions','order_id,provider'),
 ('shipments','order_id'),('shipment_requests','order_id'),('shipment_requests','idempotency_key')
 )v(table_name,key_sql) loop
  if to_regclass('public.'||expected.table_name) is not null then
   execute format('select count(*)::text from(select %s from public.%I %s group by %s having count(*)>1)d',expected.key_sql,expected.table_name,case when expected.key_sql='provider_id' then 'where provider_id is not null' else '' end,expected.key_sql) into unexpected;
   if unexpected<>'0' then raise exception 'Duplicate existing key in % (%). Stop; no data merged/deleted.',expected.table_name,expected.key_sql;end if;
  end if;
 end loop;
 for expected in select * from(values ('store_schema_migrations','version','text'),
('store_schema_migrations','applied_at','timestamp with time zone'),
('profiles','id','uuid'),
('profiles','name','text'),
('profiles','created_at','timestamp with time zone'),
('user_roles','user_id','uuid'),
('user_roles','role','text'),
('categories','id','text'),
('categories','name','jsonb'),
('products','id','text'),
('products','published','boolean'),
('products','payload','jsonb'),
('products','updated_at','timestamp with time zone'),
('bundles','id','text'),
('bundles','payload','jsonb'),
('bundles','updated_at','timestamp with time zone'),
('bundle_items','bundle_id','text'),
('bundle_items','product_id','text'),
('bundle_items','quantity','integer'),
('customers','id','uuid'),
('customers','email','text'),
('customers','phone','text'),
('customers','name','text'),
('customers','city','text'),
('customers','created_at','timestamp with time zone'),
('orders','id','text'),
('orders','payload','jsonb'),
('orders','created_at','timestamp with time zone'),
('orders','updated_at','timestamp with time zone'),
('order_items','order_id','text'),
('order_items','line','integer'),
('order_items','product_id','text'),
('order_items','quantity','integer'),
('order_items','unit_price','numeric'),
('order_items','payload','jsonb'),
('notifications','id','text'),
('notifications','payload','jsonb'),
('notifications','created_at','timestamp with time zone'),
('settings','key','text'),
('settings','value','jsonb'),
('support_messages','id','uuid'),
('support_messages','name','text'),
('support_messages','email','text'),
('support_messages','subject','text'),
('support_messages','order_number','text'),
('support_messages','product_name','text'),
('support_messages','message','text'),
('support_messages','consent','boolean'),
('support_messages','status','text'),
('support_messages','read_at','timestamp with time zone'),
('support_messages','created_at','timestamp with time zone'),
('product_images','id','uuid'),
('product_images','product_id','text'),
('product_images','url','text'),
('product_images','position','integer'),
('product_images','created_at','timestamp with time zone'),
('inventory_transactions','id','uuid'),
('inventory_transactions','product_id','text'),
('inventory_transactions','old_quantity','integer'),
('inventory_transactions','new_quantity','integer'),
('inventory_transactions','changed_by','uuid'),
('inventory_transactions','created_at','timestamp with time zone'),
('message_replies','id','uuid'),
('message_replies','message_id','uuid'),
('message_replies','sender_id','uuid'),
('message_replies','body','text'),
('message_replies','created_at','timestamp with time zone'),
('message_replies','client_id','uuid'),
('payment_transactions','id','uuid'),
('payment_transactions','order_id','text'),
('payment_transactions','provider','text'),
('payment_transactions','provider_id','text'),
('payment_transactions','status','text'),
('payment_transactions','amount','numeric'),
('payment_transactions','currency','text'),
('payment_transactions','created_at','timestamp with time zone'),
('payment_transactions','updated_at','timestamp with time zone'),
('provider_events','id','text'),
('provider_events','provider','text'),
('provider_events','processed_at','timestamp with time zone'),
('shipments','id','uuid'),
('shipments','order_id','text'),
('shipments','provider','text'),
('shipments','provider_id','text'),
('shipments','status','text'),
('shipments','created_at','timestamp with time zone'),
('order_stock_reservations','order_id','text'),
('order_stock_reservations','product_id','text'),
('order_stock_reservations','variant_id','text'),
('order_stock_reservations','quantity','integer'),
('order_stock_reservations','state','text'),
('order_stock_reservations','created_at','timestamp with time zone'),
('order_stock_reservations','released_at','timestamp with time zone'),
('shipment_requests','id','uuid'),
('shipment_requests','order_id','text'),
('shipment_requests','state','text'),
('shipment_requests','provider','text'),
('shipment_requests','provider_reference','text'),
('shipment_requests','tracking_number','text'),
('shipment_requests','idempotency_key','uuid'),
('shipment_requests','created_at','timestamp with time zone'),
('shipment_requests','updated_at','timestamp with time zone'),
('deleted_support_messages','id','uuid'),
('deleted_support_messages','message_id','uuid'),
('deleted_support_messages','payload','jsonb'),
('deleted_support_messages','replies','jsonb'),
('deleted_support_messages','deleted_by','uuid'),
('deleted_support_messages','deleted_at','timestamp with time zone'),
('deleted_support_messages','restored_by','uuid'),
('deleted_support_messages','restored_at','timestamp with time zone'))v(table_name,column_name,type_name) loop
  if to_regclass('public.'||expected.table_name) is not null then
   if not exists(select 1 from pg_class where oid=to_regclass('public.'||expected.table_name) and relkind='r') then raise exception 'Expected ordinary table: %',expected.table_name;end if;
   select format_type(a.atttypid,a.atttypmod) into actual_type from pg_attribute a where a.attrelid=to_regclass('public.'||expected.table_name) and a.attname=expected.column_name and not a.attisdropped;
   if actual_type is distinct from expected.type_name then raise exception 'Incompatible existing column %.%: expected %, found %. No automatic conversion.',expected.table_name,expected.column_name,expected.type_name,actual_type;end if;
  end if;
 end loop;
 for expected in select * from(values ('store_schema_migrations',array['version']) ,('profiles',array['id']) ,('user_roles',array['user_id']) ,('categories',array['id']) ,('products',array['id']) ,('bundles',array['id']) ,('bundle_items',array['bundle_id','product_id']) ,('customers',array['id']) ,('orders',array['id']) ,('order_items',array['order_id','line']) ,('notifications',array['id']) ,('settings',array['key']) ,('support_messages',array['id']) ,('product_images',array['id']) ,('inventory_transactions',array['id']) ,('message_replies',array['id']) ,('payment_transactions',array['id']) ,('provider_events',array['id']) ,('shipments',array['id']) ,('order_stock_reservations',array['order_id','product_id','variant_id']) ,('shipment_requests',array['id']) ,('deleted_support_messages',array['id']) )v(table_name,key_columns) loop
  if to_regclass('public.'||expected.table_name) is not null and not exists(select 1 from pg_constraint c where c.conrelid=to_regclass('public.'||expected.table_name) and c.contype='p' and (select array_agg(a.attname::text order by k.ordinality) from unnest(c.conkey) with ordinality k(attnum,ordinality) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)=expected.key_columns) then raise exception 'Incompatible primary key on %. Review separately.',expected.table_name;end if;
 end loop;
 for expected in select * from(values ('profiles','id','auth.users'),('user_roles','user_id','auth.users'),('bundle_items','bundle_id','public.bundles'),('bundle_items','product_id','public.products'),('order_items','order_id','public.orders'),('order_items','product_id','public.products'),('orders','customer_id','public.customers'),('customers','auth_user_id','auth.users'),('support_messages','customer_id','public.customers'),('product_images','product_id','public.products'),('inventory_transactions','product_id','public.products'),('inventory_transactions','changed_by','auth.users'),('message_replies','message_id','public.support_messages'),('message_replies','sender_id','auth.users'),('payment_transactions','order_id','public.orders'),('shipments','order_id','public.orders'),('order_stock_reservations','order_id','public.orders'),('order_stock_reservations','product_id','public.products'),('shipment_requests','order_id','public.orders'),('provider_events','payment_transaction_id','public.payment_transactions'))v(table_name,column_name,target_table) loop
  if exists(select 1 from pg_attribute where attrelid=to_regclass('public.'||expected.table_name) and attname=expected.column_name and not attisdropped) then
   if not exists(select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) join pg_attribute target on target.attrelid=c.confrelid and target.attnum=any(c.confkey) where c.conrelid=to_regclass('public.'||expected.table_name) and c.contype='f' and c.convalidated and array_length(c.conkey,1)=1 and a.attname=expected.column_name and c.confrelid=to_regclass(expected.target_table) and target.attname='id') then raise exception 'Incompatible or missing foreign key %.% -> %. Review separately.',expected.table_name,expected.column_name,expected.target_table;end if;
  end if;
 end loop;
 if to_regclass('public.messages') is not null and not exists(select 1 from pg_class where oid=to_regclass('public.messages') and relkind='v') then raise exception 'public.messages is not a view; preserve and review it manually';end if;
 select string_agg(schemaname||'.'||tablename||'.'||policyname,', ') into unexpected from pg_policies where ((schemaname='public' and tablename=any(array['store_schema_migrations','profiles','user_roles','categories','products','bundles','bundle_items','customers','orders','order_items','notifications','settings','support_messages','product_images','inventory_transactions','message_replies','payment_transactions','provider_events','shipments','order_stock_reservations','shipment_requests','deleted_support_messages'])) or (schemaname='storage' and tablename='objects')) and (schemaname||'.'||tablename||'.'||policyname)<>all(array['public.profiles.profile_read','public.profiles.profile_update','public.user_roles.role_read','public.user_roles.role_manage','public.products.catalog_public','public.categories.category_public','public.bundles.bundle_public','public.settings.settings_public','public.orders.order_insert','public.orders.order_update','public.orders.order_delete','public.settings.settings_manage','public.notifications.notifications_manage','public.support_messages.support_submit','public.support_messages.support_manage','storage.objects.admin_image_read','storage.objects.admin_image_insert','storage.objects.admin_image_update','storage.objects.admin_image_delete','public.payment_transactions.payment_read','public.shipments.shipment_read','public.product_images.image_read','public.inventory_transactions.inventory_read','public.message_replies.replies_read','public.message_replies.replies_send','public.customers.customer_own_read','public.customers.customer_update','public.orders.order_own_read','public.order_items.order_items_own_read','public.support_messages.support_own_read','public.support_messages.support_customer_submit','public.product_images.image_public_read','public.product_images.image_staff_read','public.order_stock_reservations.reservation_staff_read','public.support_messages.support_staff_read','public.support_messages.support_staff_update','public.support_messages.support_admin_delete','public.support_messages.support_admin_restore','public.shipment_requests.shipment_request_staff_read','public.deleted_support_messages.deleted_support_admin_read','public.categories.workspace_read','public.products.workspace_read','public.bundles.workspace_read','public.bundle_items.workspace_read','public.customers.workspace_read','public.orders.workspace_read','public.order_items.workspace_read','public.notifications.workspace_read','public.settings.workspace_read','public.support_messages.workspace_read','public.products.workspace_insert','public.products.workspace_update','public.products.workspace_delete','public.categories.workspace_insert','public.categories.workspace_update','public.categories.workspace_delete','public.bundles.workspace_insert','public.bundles.workspace_update','public.bundles.workspace_delete','public.support_messages.submit_request','public.support_messages.admin_read','public.support_messages.admin_update']);
 if unexpected is not null then raise exception 'Unreviewed existing policies: %. Nothing deleted; review separately.',unexpected;end if;
 select string_agg(c.relname||'.'||t.tgname,', ') into unexpected from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname='public' and c.relname=any(array['store_schema_migrations','profiles','user_roles','categories','products','bundles','bundle_items','customers','orders','order_items','notifications','settings','support_messages','product_images','inventory_transactions','message_replies','payment_transactions','provider_events','shipments','order_stock_reservations','shipment_requests','deleted_support_messages']) and t.tgname<>all(array['almumez_new_profile','workspace_product_sync','workspace_bundle_sync','workspace_order_guard','workspace_order_items','product_relations_sync','order_customer_sync','message_customer_sync','reserve_order_record','protect_reserved_variants','limit_support_submissions','support_submission_guard','guard_payment_settings','guard_preserved_product','guard_preserved_bundle','guard_preserved_order','verified_administrative_role','guard_catalog_shape','guard_category_delete','archive_deleted_support_message']);
 if unexpected is not null then raise exception 'Unreviewed existing triggers: %. Review separately.',unexpected;end if;
 if to_regclass('public.settings') is not null then execute 'select string_agg(key,'', '') from public.settings where key not in (''storeName'',''supportEmail'',''whatsappNumber'',''monthlyGoal'',''shipping'',''paymentMethods'',''preferences'')' into unexpected;if unexpected is not null then raise exception 'Unreviewed settings keys: %. No data removed.',unexpected;end if;end if;
end $preflight$;


-- FILE: 202611220001_existing_model.sql

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


-- FILE: 202611220002_relations_and_queries.sql

do $apply$ begin
alter table public.customers add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.support_messages add column if not exists customer_id uuid references public.customers(id) on delete set null;
create table if not exists public.product_images(id uuid primary key default gen_random_uuid(),product_id text not null references public.products(id) on delete cascade,url text not null,position int not null default 0,created_at timestamptz not null default now(),unique(product_id,url));
create table if not exists public.inventory_transactions(id uuid primary key default gen_random_uuid(),product_id text references public.products(id) on delete set null,old_quantity int not null,new_quantity int not null,changed_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now());
create table if not exists public.message_replies(id uuid primary key default gen_random_uuid(),message_id uuid not null references public.support_messages(id) on delete cascade,sender_id uuid not null references auth.users(id),body text not null check(length(trim(body)) between 1 and 4000),created_at timestamptz not null default now(),client_id uuid not null unique);
create table if not exists public.payment_transactions(id uuid primary key default gen_random_uuid(),order_id text not null references public.orders(id),provider text not null,provider_id text unique,status text not null default 'pending' check(status in ('pending','paid','failed','cancelled')),amount numeric not null check(amount>=0),currency text not null default 'EGP',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(order_id,provider));
create table if not exists public.provider_events(id text primary key,provider text not null,processed_at timestamptz not null default now());
alter table public.provider_events add column if not exists payment_transaction_id uuid references public.payment_transactions(id) on delete restrict;
alter table public.provider_events add column if not exists event_status text;
alter table public.provider_events add column if not exists amount numeric;
alter table public.provider_events add column if not exists currency text;
create table if not exists public.shipments(id uuid primary key default gen_random_uuid(),order_id text not null unique references public.orders(id),provider text not null,provider_id text,status text not null default 'pending',created_at timestamptz not null default now());
create index if not exists orders_customer_idx on public.orders(customer_id,created_at desc);
create index if not exists customer_auth_idx on public.customers(auth_user_id);
create index if not exists replies_parent_idx on public.message_replies(message_id,created_at);
create index if not exists images_product_idx on public.product_images(product_id,position);
create index if not exists orders_customer_search on public.orders(lower(payload->'customer'->>'name'));
alter table public.product_images enable row level security;alter table public.inventory_transactions enable row level security;alter table public.message_replies enable row level security;alter table public.payment_transactions enable row level security;alter table public.provider_events enable row level security;alter table public.shipments enable row level security;
revoke all on public.provider_events,public.payment_transactions,public.shipments from anon,authenticated;
grant select on public.payment_transactions,public.shipments to authenticated;
drop policy if exists payment_read on public.payment_transactions;
create policy payment_read on public.payment_transactions for select to authenticated using(public.admin_access() or exists(select 1 from public.orders o join public.customers c on c.id=o.customer_id where o.id=order_id and c.auth_user_id=auth.uid()));
drop policy if exists shipment_read on public.shipments;
create policy shipment_read on public.shipments for select to authenticated using(public.admin_access());
grant select on public.product_images to anon,authenticated;
drop policy if exists image_read on public.product_images;
create policy image_read on public.product_images for select using(exists(select 1 from public.products p where p.id=product_id and p.published) or public.admin_access());
grant select on public.inventory_transactions to authenticated;
drop policy if exists inventory_read on public.inventory_transactions;
create policy inventory_read on public.inventory_transactions for select to authenticated using(public.admin_access());
grant select,insert on public.message_replies to authenticated;
drop policy if exists replies_read on public.message_replies;
create policy replies_read on public.message_replies for select to authenticated using(public.admin_access() or exists(select 1 from public.support_messages m join public.customers c on c.id=m.customer_id where m.id=message_id and c.auth_user_id=auth.uid()));
drop policy if exists replies_send on public.message_replies;
create policy replies_send on public.message_replies for insert to authenticated with check(sender_id=auth.uid() and (public.admin_access() or exists(select 1 from public.support_messages m join public.customers c on c.id=m.customer_id where m.id=message_id and c.auth_user_id=auth.uid())));
grant update(name,phone,city,address) on public.customers to authenticated;
drop policy if exists customer_own_read on public.customers;
create policy customer_own_read on public.customers for select to authenticated using(auth_user_id=auth.uid());
drop policy if exists customer_update on public.customers;
create policy customer_update on public.customers for update to authenticated using(public.admin_access() or auth_user_id=auth.uid()) with check(public.admin_access() or auth_user_id=auth.uid());
drop policy if exists order_own_read on public.orders;
create policy order_own_read on public.orders for select to authenticated using(exists(select 1 from public.customers c where c.id=customer_id and c.auth_user_id=auth.uid()));
drop policy if exists order_items_own_read on public.order_items;
create policy order_items_own_read on public.order_items for select to authenticated using(exists(select 1 from public.orders o join public.customers c on c.id=o.customer_id where o.id=order_id and c.auth_user_id=auth.uid()));
drop policy if exists support_own_read on public.support_messages;
create policy support_own_read on public.support_messages for select to authenticated using(exists(select 1 from public.customers c where c.id=customer_id and c.auth_user_id=auth.uid()));
-- No arbitrary settings keys: secrets never enter this frontend-readable relation.
do $constraint$ begin if not exists(select 1 from pg_constraint where conrelid='public.settings'::regclass and conname='public_settings_keys') then alter table public.settings add constraint public_settings_keys check(key in ('storeName','supportEmail','whatsappNumber','monthlyGoal','shipping','paymentMethods','preferences')) not valid;end if;end $constraint$;
create or replace function public.product_relations_sync() returns trigger language plpgsql security definer set search_path='' as $$declare image text;idx int=0;begin
 if TG_OP='UPDATE' and (old.payload->>'stock')::int<>(new.payload->>'stock')::int then insert into public.inventory_transactions(product_id,old_quantity,new_quantity,changed_by) values(new.id,(old.payload->>'stock')::int,(new.payload->>'stock')::int,auth.uid());end if;
 for image in select distinct value from jsonb_array_elements_text(jsonb_build_array(new.payload->>'image')||coalesce(new.payload->'gallery','[]')) where value is not null and value<>'' loop insert into public.product_images(product_id,url,position) values(new.id,image,idx) on conflict(product_id,url) do nothing;idx=idx+1;end loop;return new;end$$;
drop trigger if exists product_relations_sync on public.products;
create trigger product_relations_sync after insert or update of payload on public.products for each row execute function public.product_relations_sync();
create or replace function public.order_customer_sync() returns trigger language plpgsql security definer set search_path='' as $$declare customer_uuid uuid;verified_uid uuid;begin
 select id into verified_uid from auth.users where id=auth.uid() and email_confirmed_at is not null and lower(email)=lower(new.payload->'customer'->>'email');
 if exists(select 1 from public.customers where lower(coalesce(email,''))=lower(coalesce(new.payload->'customer'->>'email','')) and coalesce(phone,'')=coalesce(new.payload->'customer'->>'phone','') and auth_user_id is not null and auth_user_id is distinct from verified_uid) then new.customer_id=null;return new;end if;
 insert into public.customers(name,email,phone,city,address,auth_user_id) values(new.payload->'customer'->>'name',lower(new.payload->'customer'->>'email'),new.payload->'customer'->>'phone',new.payload->'customer'->>'city',new.payload->'customer'->>'address',verified_uid) on conflict(lower(coalesce(email,'')),coalesce(phone,'')) do update set updated_at=now(),auth_user_id=coalesce(public.customers.auth_user_id,excluded.auth_user_id) returning id into customer_uuid;
 new.customer_id=customer_uuid;return new;end$$;
drop trigger if exists order_customer_sync on public.orders;
create trigger order_customer_sync before insert on public.orders for each row execute function public.order_customer_sync();
create or replace function public.message_customer_sync() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null then select c.id into new.customer_id from public.customers c join auth.users u on u.id=c.auth_user_id where c.auth_user_id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=lower(new.email) limit 1;end if;return new;end$$;
drop trigger if exists message_customer_sync on public.support_messages;
create trigger message_customer_sync before insert on public.support_messages for each row execute function public.message_customer_sync();
-- A signed-in customer can submit a contact request but cannot mutate admin fields.
drop policy if exists support_customer_submit on public.support_messages;
create policy support_customer_submit on public.support_messages for insert to authenticated with check(consent and status='new' and not starred and not archived and not demo and (customer_id is null or exists(select 1 from public.customers c where c.id=customer_id and c.auth_user_id=auth.uid())));

create or replace function public.admin_page(p_kind text,p_filter jsonb default '{}',p_page int default 1,p_per int default 25) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;query text;condition text;sorting text;table_name text;page int=greatest(1,least(p_page,100000));per int=greatest(1,least(p_per,100));term text=left(coalesce(p_filter->>'q',''),200);begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 if p_kind not in ('orders','products','bundles','messages','customers') then raise exception 'Unknown entity';end if;
 table_name=case when p_kind='messages' then 'support_messages' else p_kind end;
 if p_kind='orders' then
  condition=format('(%L='''' or strpos(lower(id||payload::text),lower(%L))>0)',term,term);
  if nullif(p_filter->>'status','') is not null then condition=condition||format(' and payload->>''statusKey''=%L',p_filter->>'status');end if;
  if nullif(p_filter->>'payment','') is not null then condition=condition||format(' and payload->>''payment''=%L',p_filter->>'payment');end if;
  if nullif(p_filter->>'from','') is not null then condition=condition||format(' and created_at>=%L::date',p_filter->>'from');end if;
  if nullif(p_filter->>'to','') is not null then condition=condition||format(' and created_at<%L::date+interval ''1 day''',p_filter->>'to');end if;
  sorting=case p_filter->>'sort' when 'total' then '(payload->>''total'')::numeric' when 'customer' then 'payload->''customer''->>''name''' else 'created_at' end||case when coalesce((p_filter->>'desc')::boolean,true) then ' desc' else ' asc' end||',id';
 elsif p_kind='products' then
  condition=format('(%L='''' or strpos(lower(payload::text),lower(%L))>0)',term,term);
  if nullif(p_filter->>'category','') is not null then condition=condition||format(' and payload->>''category''=%L',p_filter->>'category');end if;
  if p_filter->>'stock'='out' then condition=condition||' and (payload->>''stock'')::int<=0';elsif p_filter->>'stock'='low' then condition=condition||' and (payload->>''stock'')::int between 1 and 5';elsif p_filter->>'stock'='in' then condition=condition||' and (payload->>''stock'')::int>5';end if;
  if p_filter->>'published'='draft' then condition=condition||' and not published';elsif p_filter->>'published'='published' then condition=condition||' and published';end if;sorting='updated_at desc,id';
 elsif p_kind='messages' then
  condition=format('(%L='''' or strpos(lower(name||email||message),lower(%L))>0)',term,term);
  if p_filter->>'filter'='archived' then condition=condition||' and archived';else condition=condition||' and not archived';end if;
  if p_filter->>'filter'='unread' then condition=condition||' and read_at is null';elsif p_filter->>'filter'='starred' then condition=condition||' and starred';elsif p_filter->>'filter'='resolved' then condition=condition||' and status=''resolved''';end if;
  if nullif(p_filter->>'topic','') is not null then condition=condition||format(' and subject=%L',p_filter->>'topic');end if;sorting='created_at desc,id';
 elsif p_kind='customers' then condition=format('(%L='''' or strpos(lower(coalesce(name,'''')||coalesce(email,'''')||coalesce(phone,'''')||coalesce(city,'''')),lower(%L))>0)',term,term);sorting='created_at desc,id';
 else condition='true';if p_filter->>'status'='active' then condition=condition||' and (payload->>''enabled'')::boolean';elsif p_filter->>'status'='inactive' then condition=condition||' and not (payload->>''enabled'')::boolean';end if;sorting='updated_at desc,id';end if;
 query=format('with filtered as(select * from public.%I where %s),paged as(select * from filtered order by %s limit %s offset %s) select jsonb_build_object(''rows'',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),''[]''::jsonb),''total'',(select count(*) from filtered),''page'',%s,''per'',%s)',table_name,condition,sorting,per,(page-1)*per,page,per);
 execute query into result;return result;end$$;
revoke all on function public.admin_page(text,jsonb,int,int) from public,anon;grant execute on function public.admin_page(text,jsonb,int,int) to authenticated;

create or replace function public.admin_summary() returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 select jsonb_build_object('orders',jsonb_build_object('total',(select count(*) from public.orders),'new',(select count(*) from public.orders where payload->>'statusKey'='new'),'processing',(select count(*) from public.orders where payload->>'statusKey'='processing'),'shipping',(select count(*) from public.orders where payload->>'statusKey'='shipping'),'completed',(select count(*) from public.orders where payload->>'statusKey'='completed'),'cancelled',(select count(*) from public.orders where payload->>'statusKey'='cancelled')),'products',jsonb_build_object('total',(select count(*) from public.products),'low',(select count(*) from public.products where (payload->>'stock')::int between 1 and 5),'out',(select count(*) from public.products where (payload->>'stock')::int<=0),'value',(select coalesce(sum(public.effective_product_price(payload)*(payload->>'stock')::int),0) from public.products)),'unread',(select count(*) from public.support_messages where read_at is null and not archived),'customers',(select count(*) from public.customers),'categories',(select coalesce(jsonb_agg(id),'[]'::jsonb) from public.categories),'payments',(select coalesce(jsonb_agg(distinct payload->>'payment'),'[]'::jsonb) from public.orders),'recentNotifications',(select coalesce(jsonb_agg(to_jsonb(n)),'[]'::jsonb) from (select * from public.notifications order by created_at desc limit 8)n)) into result;return result;end$$;
revoke all on function public.admin_summary() from public,anon;grant execute on function public.admin_summary() to authenticated;

create or replace function public.admin_report(p_start timestamptz,p_end timestamptz,p_group text default 'product') returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 with matching as(select * from public.orders where created_at>=p_start and created_at<p_end),valid as(select * from matching where payload->>'statusKey'<>'cancelled'),items as(select o.payload->'customer'->>'city' city,i.payload,coalesce(p.payload->>'category','other') category from valid o join public.order_items i on i.order_id=o.id left join public.products p on p.id=i.product_id),groups as(select case p_group when 'city' then city when 'category' then category else coalesce(payload->'name'->>'ar',payload->>'name',payload->>'id') end label,sum((payload->>'quantity')::int) quantity,sum((payload->>'price')::numeric*(payload->>'quantity')::int) total from items group by 1)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(groups) order by total desc) from groups),'[]'::jsonb),'sales',(select coalesce(sum((payload->>'total')::numeric),0) from valid),'orders',(select count(*) from matching),'cancelled',(select count(*) from matching where payload->>'statusKey'='cancelled'),'completed',(select count(*) from matching where payload->>'statusKey'='completed'),'processed',(select count(*) from matching where payload->>'statusKey' in ('processing','shipping','completed')),'days',coalesce((select jsonb_object_agg(day_label,n) from(select to_char(created_at,'Dy') day_label,count(*) n from valid group by 1)d),'{}'::jsonb)) into result;return result;end$$;
revoke all on function public.admin_report(timestamptz,timestamptz,text) from public,anon;grant execute on function public.admin_report(timestamptz,timestamptz,text) to authenticated;
create or replace function public.admin_customer_detail(p_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$begin if not public.admin_access() then raise insufficient_privilege;end if;return jsonb_build_object('customer',(select to_jsonb(c) from public.customers c where id=p_id),'orders',coalesce((select jsonb_agg(to_jsonb(o)) from(select * from public.orders where customer_id=p_id order by created_at desc limit 25)o),'[]'::jsonb));end$$;
grant execute on function public.admin_customer_detail(uuid) to authenticated;revoke all on function public.admin_customer_detail(uuid) from public,anon;
create or replace function public.apply_verified_payment(p_event_id text,p_provider text,p_provider_id text,p_status text,p_amount numeric,p_currency text) returns void language plpgsql security definer set search_path='' as $$declare txn public.payment_transactions%rowtype;begin
 if p_status not in ('paid','failed','cancelled') then raise exception 'Invalid settlement state';end if;
 insert into public.provider_events(id,provider) values(p_event_id,p_provider) on conflict(id) do nothing;if not found then return;end if;
 select * into txn from public.payment_transactions where provider=p_provider and provider_id=p_provider_id for update;
 if not found or txn.amount<>p_amount or lower(txn.currency)<>lower(p_currency) then raise exception 'Payment settlement mismatch';end if;
 if txn.status='paid' then return;end if;
 update public.payment_transactions set status=p_status,updated_at=now() where id=txn.id;
 if p_status='paid' then update public.orders set payload=payload||jsonb_build_object('paymentVerified',true,'paymentStatus','paid') where id=txn.order_id;end if;end$$;
revoke all on function public.apply_verified_payment(text,text,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.apply_verified_payment(text,text,text,text,numeric,text) to service_role;
-- Backfill without replacing existing orders/products/customers.
insert into public.product_images(product_id,url,position) select p.id,image.value,0 from public.products p cross join lateral jsonb_array_elements_text(jsonb_build_array(p.payload->>'image')||coalesce(p.payload->'gallery','[]')) image where image.value is not null and image.value<>'' on conflict(product_id,url) do nothing;
-- Historical order/customer associations remain unchanged. Any explicit backfill
-- requires a separately reviewed import; do not infer business ownership here.
do $$declare table_name text;begin foreach table_name in array array['message_replies','customers','product_images','inventory_transactions','shipments'] loop if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then execute format('alter publication supabase_realtime add table public.%I',table_name);end if;end loop;end$$;
insert into public.store_schema_migrations(version) values('202611220002') on conflict(version) do nothing;end $apply$;


-- FILE: 202611220003_overview.sql

create or replace function public.admin_overview(p_start timestamptz,p_end timestamptz,p_previous_start timestamptz,p_previous_end timestamptz) returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 with current_orders as(select * from public.orders where created_at>=p_start and created_at<p_end),previous_orders as(select * from public.orders where created_at>=p_previous_start and created_at<p_previous_end),valid as(select * from current_orders where payload->>'statusKey'<>'cancelled'),previous_valid as(select * from previous_orders where payload->>'statusKey'<>'cancelled'),bins as(select n,p_start+(p_end-p_start)*n/7 date from generate_series(0,6)n),old_bins as(select n,p_previous_start+(p_previous_end-p_previous_start)*n/7 date from generate_series(0,6)n),payments as(select payload->>'payment' method,count(*) count,sum((payload->>'total')::numeric) total from valid group by 1),best as(select i.payload->>'id' id,max(i.payload->>'name') name,max(i.payload->>'image') image,sum(i.quantity) quantity,sum(i.quantity*i.unit_price) total from valid o join public.order_items i on i.order_id=o.id group by 1 order by total desc limit 5)
 select jsonb_build_object('current',public.admin_analytics(p_start,p_end),'previous',public.admin_analytics(p_previous_start,p_previous_end),'series',(select jsonb_agg(jsonb_build_object('date',b.date,'sales',coalesce((select sum((payload->>'total')::numeric) from valid where created_at>=b.date and created_at<b.date+(p_end-p_start)/7),0),'orders',(select count(*) from valid where created_at>=b.date and created_at<b.date+(p_end-p_start)/7)) order by b.n) from bins b),'previousSeries',(select jsonb_agg(jsonb_build_object('date',b.date,'sales',coalesce((select sum((payload->>'total')::numeric) from previous_valid where created_at>=b.date and created_at<b.date+(p_previous_end-p_previous_start)/7),0),'orders',(select count(*) from previous_valid where created_at>=b.date and created_at<b.date+(p_previous_end-p_previous_start)/7)) order by b.n) from old_bins b),'payments',coalesce((select jsonb_agg(to_jsonb(payments)) from payments),'[]'::jsonb),'recent',coalesce((select jsonb_agg(payload) from(select payload from current_orders order by created_at desc limit 6)recent),'[]'::jsonb),'best',coalesce((select jsonb_agg(to_jsonb(best)) from best),'[]'::jsonb),'low',coalesce((select jsonb_agg(payload) from(select payload from public.products where (payload->>'stock')::int<=5 order by (payload->>'stock')::int,id limit 8)low),'[]'::jsonb)) into result;return result;end$$;
revoke all on function public.admin_overview(timestamptz,timestamptz,timestamptz,timestamptz) from public,anon;grant execute on function public.admin_overview(timestamptz,timestamptz,timestamptz,timestamptz) to authenticated;
insert into public.store_schema_migrations(version) values('202611220003') on conflict(version) do nothing;


-- FILE: 202611220004_safe_operations.sql

create or replace function public.admin_set_order_status(p_ids text[],p_status text) returns void language plpgsql security invoker set search_path='' as $$declare row public.orders%rowtype;label text;begin
 if not public.admin_access() or coalesce(cardinality(p_ids),0) not between 1 and 1000 then raise insufficient_privilege;end if;
 label=case p_status when 'new' then 'طلب جديد' when 'processing' then 'قيد التجهيز' when 'shipping' then 'جاري التوصيل' when 'completed' then 'مكتمل' when 'cancelled' then 'ملغي' end;if label is null then raise exception 'Invalid order status';end if;
 for row in select * from public.orders where id=any(p_ids) order by id for update loop
  if row.payload->>'statusKey'=p_status then continue;end if;
  update public.orders set payload=payload||jsonb_build_object('statusKey',p_status,'status',label,'statusUpdatedAt',now(),'timeline',coalesce(payload->'timeline','[]')||jsonb_build_array(jsonb_build_object('status',p_status,'at',now(),'by',auth.uid()))) where id=row.id;
 end loop;end$$;
revoke all on function public.admin_set_order_status(text[],text) from public,anon;grant execute on function public.admin_set_order_status(text[],text) to authenticated;
create or replace function public.admin_search(p_query text) returns jsonb language plpgsql stable security invoker set search_path='' as $$declare term text=lower(left(trim(p_query),100));begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(to_jsonb(result)) from(select 'order' kind,id,coalesce(payload->'customer'->>'name',id) label,payload->'customer'->>'city' hint from public.orders where strpos(lower(id||payload::text),term)>0 union all select 'product',id,coalesce(payload->'name'->>'ar',payload->'name'->>'en',id),payload->>'sku' from public.products where strpos(lower(payload::text),term)>0 union all select 'customer',id::text,name,email from public.customers where strpos(lower(coalesce(name,'')||coalesce(email,'')),term)>0 limit 12)result),'[]');end$$;
revoke all on function public.admin_search(text) from public,anon;grant execute on function public.admin_search(text) to authenticated;
create or replace function public.customer_summary(p_ids uuid[]) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(row),'[]') from(select c.id,count(o.id) count,coalesce(sum((o.payload->>'total')::numeric) filter(where o.payload->>'statusKey'<>'cancelled'),0) total,max(o.created_at) "lastOrder" from public.customers c left join public.orders o on o.customer_id=c.id where c.id=any(p_ids) group by c.id)row;
$$;
revoke all on function public.customer_summary(uuid[]) from public,anon;grant execute on function public.customer_summary(uuid[]) to authenticated;
insert into public.store_schema_migrations(version) values('202611220004') on conflict(version) do nothing;


-- FILE: 202611220005_customer_privacy.sql

-- Customers use a deliberately sanitized RPC; internal notes remain staff-only.
drop policy if exists order_own_read on public.orders;
drop policy if exists order_items_own_read on public.order_items;
create or replace function public.customer_orders(p_page int default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(safe) from(select o.payload-array['notes','timeline','requestId'] safe from public.orders o join public.customers c on c.id=o.customer_id where c.auth_user_id=auth.uid() order by o.created_at desc limit 20 offset (greatest(1,least(p_page,10000))-1)*20)r),'[]');end$$;
revoke all on function public.customer_orders(int) from public,anon;grant execute on function public.customer_orders(int) to authenticated;
insert into public.store_schema_migrations(version) values('202611220005') on conflict(version) do nothing;


-- FILE: 202611220006_security_review.sql

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


-- FILE: 202611220007_final_permissions.sql

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


-- FILE: 202611230008_checkout_identity.sql

-- No request IDs/fingerprints are guessed or backfilled for legacy orders.
-- Duplicate checks run before installing any additional unique request index.
do $duplicates$ begin
 if exists(select 1 from public.orders where coalesce(request_id,nullif(payload->>'requestId','')) is not null group by coalesce(request_id,nullif(payload->>'requestId','')) having count(*)>1) then
  raise exception 'Duplicate historical checkout request IDs. Stop and review; no rows merged or removed';
 end if;
end $duplicates$;
create unique index if not exists orders_request_id_unique on public.orders(request_id) where request_id is not null;
do $identity_index$ begin
 if not exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.orders_request_id_unique') and i.indrelid='public.orders'::regclass and i.indisunique and i.indisvalid and i.indisready and i.indnatts=1 and i.indkey[0]=(select attnum from pg_attribute where attrelid='public.orders'::regclass and attname='request_id') and pg_get_expr(i.indpred,i.indrelid)='(request_id IS NOT NULL)') then raise exception 'Existing orders_request_id_unique has incompatible definition; review without deleting data';end if;
end $identity_index$;
create index if not exists orders_legacy_request_lookup on public.orders((payload->>'requestId')) where request_id is null;
-- Compatibility view: anonymous submission can use either name, but there is
-- only one table and the view must retain invoker security and restricted columns.
grant insert(name,email,subject,order_number,product_name,message,consent) on public.messages to anon;
revoke select,update,delete,truncate,references,trigger on public.messages from anon;
insert into public.store_schema_migrations(version) values('202611230008') on conflict(version) do nothing;


-- FILE: 202611230009_live_queries.sql


-- Public JSON is an allowlist, including nested structures. Unknown/private keys
-- are not forwarded even when added to product payloads later.
create or replace function public.public_catalog_json(p jsonb,scope text default 'product') returns jsonb language plpgsql immutable security invoker set search_path='' as $$declare k text;v jsonb;result jsonb='{}';allowed text[];begin
 allowed=case scope
 when 'localized' then array['ar','en']
 when 'offer' then array['enabled','type','value','newPrice','oldPrice','startsAt','endsAt','sold','claimed','total','quantity','label']
 when 'variant' then array['id','label','stock','priceDelta','price','oldPrice','default','color','image']
 when 'placements' then array['home-flash','home-featured','all-products','accessories']
 when 'spec' then array['name','label','value','icon']
 when 'bundle' then array['id','title','description','price','oldPrice','productIds','enabled','startsAt','endsAt','image','badge','placements']
 else array['id','name','brand','category','categoryLabel','subcategory','price','oldPrice','stock','image','gallery','relatedIds','rating','reviews','reviewsCount','badge','express','description','specs','features','variants','offer','placements','createdAt','published','sku','warranty','delivery'] end;
 if jsonb_typeof(p) is distinct from 'object' then return '{}'::jsonb;end if;
 for k,v in select key,value from jsonb_each(p) where key=any(allowed) loop
  if k in ('name','title','description','brand','categoryLabel','subcategory','label','value','warranty','delivery') and jsonb_typeof(v)='object' then v=public.public_catalog_json(v,'localized');
  elsif k='offer' then v=public.public_catalog_json(v,'offer');
  elsif k='placements' then v=public.public_catalog_json(v,'placements');
  elsif k in ('variants','specs') then
   if jsonb_typeof(v)='array' then select coalesce(jsonb_agg(public.public_catalog_json(e,case when k='variants' then 'variant' else 'spec' end)),'[]') into v from jsonb_array_elements(v)e;else v='[]';end if;
  elsif k in ('gallery','productIds','relatedIds','features') then
   if jsonb_typeof(v)='array' then select coalesce(jsonb_agg(case when jsonb_typeof(e)='object' then public.public_catalog_json(e,'localized') else e end),'[]') into v from jsonb_array_elements(v)e where jsonb_typeof(e) in ('string','number','boolean','object');else v='[]';end if;
  elsif jsonb_typeof(v) in ('object','array') then continue;
  end if;
  result=result||jsonb_build_object(k,v);
 end loop;return result;
end$$;
revoke all on function public.public_catalog_json(jsonb,text) from public,anon,authenticated;
grant execute on function public.public_catalog_json(jsonb,text) to anon,authenticated;
-- Explicit owner-rights views expose only sanitized published/active records.
-- They are read-only to browser roles and do not forward private raw payloads.
create or replace view public.public_products with(security_barrier=true) as
 select id,published,public.public_catalog_json(payload)||jsonb_build_object('id',id,'published',published) payload from public.products where published;
create or replace view public.public_bundles with(security_barrier=true) as
 select id,updated_at,public.public_catalog_json(payload,'bundle')||jsonb_build_object('id',id) payload from public.bundles where coalesce((payload->>'enabled')::boolean,false) and (nullif(payload->>'startsAt','') is null or (payload->>'startsAt')::timestamptz<=now()) and (nullif(payload->>'endsAt','') is null or (payload->>'endsAt')::timestamptz>now());
revoke all on public.public_products,public.public_bundles from public,anon,authenticated;
grant select on public.public_products,public.public_bundles to anon,authenticated;

create or replace function public.catalog_match(p jsonb,f jsonb,skip text default '') returns boolean language plpgsql stable security invoker set search_path='' as $$declare amount numeric=public.effective_product_price(p);brand text=coalesce(p->'brand'->>'en',p->>'brand','');begin
 if skip<>'q' and coalesce(f->>'q','')<>'' and strpos(translate(lower(p::text),'أإآىة','ااايه'),translate(lower(f->>'q'),'أإآىة','ااايه'))=0 then return false;end if;
 if skip<>'dept' and coalesce(f->>'dept','')<>'' and p->>'category' is distinct from f->>'dept' then return false;end if;
 if skip<>'brands' and jsonb_array_length(coalesce(f->'brands','[]'))>0 and not (f->'brands' ? brand) then return false;end if;
 if skip<>'storage' and jsonb_array_length(coalesce(f->'storage','[]'))>0 and not exists(select 1 from jsonb_array_elements(coalesce(p->'variants','[]')) v where f->'storage' ? coalesce(v->'label'->>'en',v->'label'->>'ar',v->>'id')) then return false;end if;
 if skip<>'price' and ((nullif(f->>'min','') is not null and amount<(f->>'min')::numeric) or (nullif(f->>'max','') is not null and amount>(f->>'max')::numeric)) then return false;end if;
 if skip<>'rating' and coalesce((p->>'rating')::numeric,0)<coalesce((f->>'rating')::numeric,0) then return false;end if;
 if skip<>'availability' then
  if coalesce((f->>'stock')::boolean,false) and coalesce((p->>'stock')::int,0)<=0 then return false;end if;
  if coalesce((f->>'sale')::boolean,false) and amount>=greatest((p->>'price')::numeric,coalesce((p->>'oldPrice')::numeric,0)) then return false;end if;
  if coalesce((f->>'express')::boolean,false) and not coalesce((p->>'express')::boolean,false) then return false;end if;
 end if;return true;end$$;
revoke all on function public.catalog_match(jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.catalog_match(jsonb,jsonb,text),public.effective_product_price(jsonb,text) to anon,authenticated;

create or replace function public.catalog_page(p_filter jsonb default '{}',p_page int default 1,p_per int default 12) returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 with base as(select id,payload,public.effective_product_price(payload) price from public.public_products where published),matched as(select * from base where public.catalog_match(payload,p_filter)),counts as(select count(*) total from matched),bounds as(select total,greatest(1,least(coalesce(p_per,12),48)) per,greatest(1,least(greatest(1,coalesce(p_page,1)),ceil(total::numeric/greatest(1,least(coalesce(p_per,12),48)))::int)) page from counts),rows as(select m.* from matched m order by
 case when p_filter->>'sort'='price-asc' then price end asc,
 case when p_filter->>'sort'='price-desc' then price end desc,
 case when p_filter->>'sort'='rating' then (payload->>'rating')::numeric end desc nulls last,
 case when p_filter->>'sort'='newest' then nullif(payload->>'createdAt','')::timestamptz end desc nulls last,
 case when p_filter->>'sort'='discount' then 1-price/nullif(greatest((payload->>'price')::numeric,coalesce((payload->>'oldPrice')::numeric,0)),0) end desc nulls last,
 coalesce((payload->'offer'->>'sold')::numeric,0) desc,id limit(select per from bounds) offset(select (page-1)*per from bounds)),deps as(select payload->>'category' key,count(*) n from base where public.catalog_match(payload,p_filter,'dept') group by 1),brands as(select coalesce(payload->'brand'->>'en',payload->>'brand','') key,count(*) n from base where public.catalog_match(payload,p_filter,'brands') group by 1),storages as(select coalesce(v->'label'->>'en',v->'label'->>'ar',v->>'id') key,count(distinct b.id)n from base b cross join lateral jsonb_array_elements(coalesce(payload->'variants','[]'))v where public.catalog_match(payload,p_filter,'storage') group by 1)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(payload||jsonb_build_object('id',id)) from rows),'[]'),'total',total,'page',page,'pages',greatest(1,ceil(total::numeric/per)::int),'facets',jsonb_build_object('departments',coalesce((select jsonb_object_agg(key,n) from deps where key is not null),'{}'),'brands',coalesce((select jsonb_object_agg(key,n) from brands where key is not null),'{}'),'storages',coalesce((select jsonb_object_agg(key,n) from storages where key is not null),'{}')),'departments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'ar',coalesce(name->>'ar',id),'en',coalesce(name->>'en',id))) from public.categories),'[]'),'brands',coalesce((select jsonb_agg(distinct coalesce(payload->'brand'->>'en',payload->>'brand','')) from base),'[]'),'storages',coalesce((select jsonb_agg(distinct coalesce(v->'label'->>'en',v->'label'->>'ar',v->>'id')) from base cross join lateral jsonb_array_elements(coalesce(payload->'variants','[]'))v),'[]')) into result from bounds;
 return result;end$$;
revoke all on function public.catalog_page(jsonb,int,int) from public,anon,authenticated;
grant execute on function public.catalog_page(jsonb,int,int) to anon,authenticated;

create or replace function public.site_bootstrap(p_ids text[] default '{}') returns jsonb language sql stable security invoker set search_path='' as $$
 with chosen as(select id,payload from public.public_products where published and (id=any(p_ids[1:100]) or id in(select id from public.public_products where published and payload->'placements' ? 'home-flash' order by (payload->'placements'->>'home-flash')::numeric,id limit 8) or id in(select id from public.public_products where published and payload->'placements' ? 'home-featured' order by (payload->'placements'->>'home-featured')::numeric,id limit 8)) order by (id=any(p_ids[1:100])) desc,id limit 116),b as(select id,payload from public.public_bundles order by updated_at desc limit 12)
 select jsonb_build_object('products',coalesce((select jsonb_agg(payload||jsonb_build_object('id',id)) from chosen),'[]'),'bundles',coalesce((select jsonb_agg(payload||jsonb_build_object('id',id)) from b),'[]'),'settings',coalesce((select jsonb_object_agg(key,value) from public.settings where key in ('storeName','supportEmail','whatsappNumber','shipping','paymentMethods')),'{}'));
$$;
revoke all on function public.site_bootstrap(text[]) from public,anon,authenticated;
grant execute on function public.site_bootstrap(text[]) to anon,authenticated;

create or replace function public.admin_operational_summary() returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 return jsonb_build_object('monthSales',(select coalesce(sum((payload->>'total')::numeric),0) from public.orders where created_at>=date_trunc('month',now()) and payload->>'statusKey'<>'cancelled'),'customers',jsonb_build_object('total',(select count(*) from public.customers),'purchases',(select coalesce(sum((payload->>'total')::numeric),0) from public.orders where payload->>'statusKey'<>'cancelled'),'returning',(select count(*) from(select customer_id from public.orders where customer_id is not null group by customer_id having count(*)>1)c),'cities',(select count(distinct city) from public.customers)),'bundles',jsonb_build_object('total',(select count(*) from public.bundles),'active',(select count(*) from public.bundles where coalesce((payload->>'enabled')::boolean,false) and (nullif(payload->>'startsAt','') is null or (payload->>'startsAt')::timestamptz<=now()) and (nullif(payload->>'endsAt','') is null or (payload->>'endsAt')::timestamptz>now()))),'bundleSales',coalesce((select jsonb_object_agg(id,jsonb_build_object('quantity',quantity,'total',total)) from(select i.payload->>'bundleId' id,sum(i.quantity)quantity,sum(i.quantity*i.unit_price)total from public.order_items i join public.orders o on o.id=i.order_id where i.payload->>'isBundle'='true' and o.payload->>'statusKey'<>'cancelled' group by 1)b),'{}'));
end$$;
revoke all on function public.admin_operational_summary() from public,anon,authenticated;
grant execute on function public.admin_operational_summary() to authenticated;
-- Raw product/bundle JSON is operational-only; views/RPCs are the public API.
revoke select on public.products,public.bundles from anon;
drop policy if exists catalog_public on public.products;
drop policy if exists bundle_public on public.bundles;
drop policy if exists image_public_read on public.product_images;
create policy image_public_read on public.product_images for select to anon,authenticated using(exists(select 1 from public.public_products p where p.id=product_id));
insert into public.store_schema_migrations(version) values('202611230009') on conflict(version) do nothing;


-- FILE: 202611230010_privacy_and_roles.sql

create or replace function public.verified_administrative_role() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.role='admin' and not exists(select 1 from auth.users where id=new.user_id and email_confirmed_at is not null) then raise exception 'Administrator must be a verified Authentication user';end if;return new;end$$;
drop trigger if exists verified_administrative_role on public.user_roles;
create trigger verified_administrative_role before insert or update on public.user_roles for each row execute function public.verified_administrative_role();
revoke all on function public.verified_administrative_role() from public,anon,authenticated;

create or replace function public.guard_catalog_shape() returns trigger language plpgsql security definer set search_path='' as $$declare variant jsonb;begin
 if coalesce((new.payload->>'stock')::int,-1)<0 or coalesce((new.payload->>'price')::numeric,-1)<0 then raise exception 'Invalid stock or price';end if;
 if new.payload ? 'variants' then
  if jsonb_typeof(new.payload->'variants') is distinct from 'array' then raise exception 'Variants must be an array';end if;
  if exists(select 1 from jsonb_array_elements(new.payload->'variants')v group by v->>'id' having count(*)>1) then raise exception 'Duplicate variant IDs';end if;
  for variant in select value from jsonb_array_elements(new.payload->'variants') loop
   if nullif(trim(variant->>'id'),'') is null or coalesce((variant->>'stock')::int,-1)<0 or (new.payload->>'price')::numeric+coalesce((variant->>'priceDelta')::numeric,0)<0 then raise exception 'Invalid variant';end if;
  end loop;
 end if;return new;end$$;
drop trigger if exists guard_catalog_shape on public.products;
create trigger guard_catalog_shape before insert or update on public.products for each row execute function public.guard_catalog_shape();
revoke all on function public.guard_catalog_shape() from public,anon,authenticated;

-- A bounded explicit administrator action, not an automatic migration. Historical
-- customer contact grouping is not proof of authenticated ownership. Never assign
-- auth_user_id here or link a guest order to an already-owned customer record.
create or replace function public.backfill_guest_customers(p_limit int default 100,p_after text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare row public.orders%rowtype;customer_uuid uuid;linked int=0;skipped int=0;last_id text;begin
 if public.admin_role() is distinct from 'admin' then raise insufficient_privilege;end if;
 for row in select * from public.orders where customer_id is null and (p_after is null or id>p_after) order by id limit greatest(1,least(p_limit,100)) for update loop
  last_id=row.id;
  if coalesce(row.payload->'customer'->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(coalesce(row.payload->'customer'->>'phone','')) not between 8 and 30 then skipped=skipped+1;continue;end if;
  insert into public.customers(email,phone,name,city,address) values(lower(row.payload->'customer'->>'email'),row.payload->'customer'->>'phone',row.payload->'customer'->>'name',row.payload->'customer'->>'city',row.payload->'customer'->>'address') on conflict(lower(coalesce(email,'')),coalesce(phone,'')) do nothing;
  select id into customer_uuid from public.customers where lower(email)=lower(row.payload->'customer'->>'email') and phone=row.payload->'customer'->>'phone' and auth_user_id is null;
  if customer_uuid is null then skipped=skipped+1;continue;end if;
  perform set_config('almumez.link_guest_customer','yes',true);
  update public.orders set customer_id=customer_uuid where id=row.id and customer_id is null;linked=linked+1;
  perform set_config('almumez.link_guest_customer','',true);
 end loop;return jsonb_build_object('linked',linked,'skipped',skipped,'nextCursor',last_id);end$$;
revoke all on function public.backfill_guest_customers(int,text) from public,anon,authenticated;
grant execute on function public.backfill_guest_customers(int,text) to authenticated;
create or replace function public.admin_category_page(p_query text default '',p_page int default 1) returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 return(select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p)) from(select c.*,(select count(*) from public.products where payload->>'category'=c.id) products from public.categories c where strpos(lower(c.id||c.name::text),lower(left(p_query,100)))>0 order by c.id limit 20 offset (greatest(1,least(p_page,100000))-1)*20)p),'[]'),'total',(select count(*) from public.categories c where strpos(lower(c.id||c.name::text),lower(left(p_query,100)))>0)));
end$$;
revoke all on function public.admin_category_page(text,int) from public,anon,authenticated;
grant execute on function public.admin_category_page(text,int) to authenticated;
create or replace function public.message_customer_sync() returns trigger language plpgsql security definer set search_path='' as $$declare verified_uid uuid;customer_uuid uuid;begin
 new.customer_id=null;
 select id into verified_uid from auth.users where id=auth.uid() and email_confirmed_at is not null and lower(email)=lower(new.email);
 if verified_uid is null then return new;end if;
 select id into customer_uuid from public.customers where auth_user_id=verified_uid order by created_at,id limit 1;
 if customer_uuid is null then
  insert into public.customers(email,phone,name,auth_user_id) values(lower(new.email),null,new.name,verified_uid)
  on conflict(lower(coalesce(email,'')),coalesce(phone,'')) do update set auth_user_id=excluded.auth_user_id where public.customers.auth_user_id is null or public.customers.auth_user_id=excluded.auth_user_id returning id into customer_uuid;
 end if;
 new.customer_id=customer_uuid;return new;end$$;
revoke all on function public.message_customer_sync() from public,anon,authenticated;
create or replace function public.customer_support_messages(p_page int default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(to_jsonb(m)) from(select m.id,m.subject,m.status,m.message,m.created_at from public.support_messages m join public.customers c on c.id=m.customer_id where c.auth_user_id=auth.uid() order by m.created_at desc,m.id limit 20 offset (greatest(1,least(p_page,10000))-1)*20)m),'[]');
end$$;
revoke all on function public.customer_support_messages(int) from public,anon,authenticated;
grant execute on function public.customer_support_messages(int) to authenticated;
create or replace function public.admin_notifications() returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(to_jsonb(n)) from(select * from(
 select 'order-'||id id,'order' kind,id reference,coalesce(payload->'customer'->>'name',id) label,created_at time from public.orders where payload->>'statusKey'='new'
 union all select 'message-'||id::text,'message',id::text,name,created_at from public.support_messages where read_at is null and not archived
 union all select 'stock-'||id,'product',id,coalesce(payload->'name'->>'ar',payload->'name'->>'en',id),updated_at from public.products where (payload->>'stock')::int<=5
 )events order by time desc,id limit 20)n),'[]');end$$;
revoke all on function public.admin_notifications() from public,anon,authenticated;
grant execute on function public.admin_notifications() to authenticated;
create or replace function public.guard_category_delete() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.products where payload->>'category'=old.id) then raise exception 'Category is used by products; preserve the category';end if;return old;end$$;
drop trigger if exists guard_category_delete on public.categories;
create trigger guard_category_delete before delete on public.categories for each row execute function public.guard_category_delete();
revoke all on function public.guard_category_delete() from public,anon,authenticated;
do $sku$ begin
 if exists(select 1 from public.products where nullif(payload->>'sku','') is not null group by lower(payload->>'sku') having count(*)>1) then raise exception 'Duplicate existing SKU values; no automatic product merge';end if;
end $sku$;
create unique index if not exists products_sku_unique on public.products(lower(payload->>'sku')) where nullif(payload->>'sku','') is not null;
insert into public.store_schema_migrations(version) values('202611230010') on conflict(version) do nothing;


-- FILE: 202611230011_deployment_safety.sql

-- Only the administrator restore RPC, for an exact archived row, bypasses the
-- ordinary submission rate limit. GUC alone and customer/admin INSERT do not.
create or replace function support_private.limit_submissions() returns trigger language plpgsql security definer set search_path='' as $$begin
 if public.admin_role()='admin' and current_setting('almumez.support_restore',true)='yes'
 and exists(select 1 from public.deleted_support_messages d where d.message_id=new.id and d.restored_at is null and d.payload=to_jsonb(new)) then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(new.email),0));
 if (select count(*) from public.support_messages where lower(email)=lower(new.email) and created_at>now()-interval '10 minutes')>=3 then raise exception 'Please wait before submitting another request';end if;
 return new;
end$$;
revoke all on function support_private.limit_submissions() from public,anon,authenticated;
-- Refresh the expanded projection AFTER customer_id and other fields exist.
create or replace view public.messages with(security_invoker=true) as select * from public.support_messages;
revoke all on public.messages from anon;
grant insert(name,email,subject,order_number,product_name,message,consent) on public.messages to anon;

create table if not exists public.deleted_support_messages(
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 replies jsonb not null default '[]' check(jsonb_typeof(replies)='array'),
 deleted_by uuid not null,
 deleted_at timestamptz not null default now(),
 restored_by uuid,
 restored_at timestamptz
);
-- Deliberately no FK to the deleted message or Auth account: retain audit history.
create index if not exists deleted_support_messages_created on public.deleted_support_messages(deleted_at desc,id);
alter table public.deleted_support_messages enable row level security;
revoke all on public.deleted_support_messages from public,anon,authenticated;
grant select on public.deleted_support_messages to authenticated;
drop policy if exists deleted_support_admin_read on public.deleted_support_messages;
create policy deleted_support_admin_read on public.deleted_support_messages for select to authenticated using(public.admin_role()='admin');

create or replace function public.archive_deleted_support_message() returns trigger language plpgsql security definer set search_path='' as $$begin
 if public.admin_role() is distinct from 'admin' then raise insufficient_privilege;end if;
 -- Serialize reply insertion against deletion before taking the reply snapshot.
 perform 1 from public.support_messages where id=old.id for update;
 insert into public.deleted_support_messages(message_id,payload,replies,deleted_by)
 values(old.id,to_jsonb(old),coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at,r.id) from public.message_replies r where r.message_id=old.id),'[]'::jsonb),auth.uid());
 return old;
end$$;
drop trigger if exists archive_deleted_support_message on public.support_messages;
create trigger archive_deleted_support_message before delete on public.support_messages for each row execute function public.archive_deleted_support_message();
revoke all on function public.archive_deleted_support_message() from public,anon,authenticated;

-- Preserve verified ownership during an admin-only archive restore. All normal
-- submissions still discard caller-supplied ownership and derive it from Auth.
create or replace function public.message_customer_sync() returns trigger language plpgsql security definer set search_path='' as $$declare verified_uid uuid;customer_uuid uuid;begin
 if public.admin_role()='admin' and current_setting('almumez.support_restore',true)='yes' and exists(select 1 from public.deleted_support_messages d where d.message_id=new.id and d.restored_at is null and d.payload=to_jsonb(new)) then return new;end if;
 new.customer_id=null;
 select id into verified_uid from auth.users where id=auth.uid() and email_confirmed_at is not null and lower(email)=lower(new.email);
 if verified_uid is null then return new;end if;
 select id into customer_uuid from public.customers where auth_user_id=verified_uid order by created_at,id limit 1;
 if customer_uuid is null then
  insert into public.customers(email,phone,name,auth_user_id) values(lower(new.email),null,new.name,verified_uid)
  on conflict(lower(coalesce(email,'')),coalesce(phone,'')) do update set auth_user_id=excluded.auth_user_id where public.customers.auth_user_id is null or public.customers.auth_user_id=excluded.auth_user_id returning id into customer_uuid;
 end if;
 new.customer_id=customer_uuid;return new;
end$$;
revoke all on function public.message_customer_sync() from public,anon,authenticated;

create or replace function public.restore_deleted_support_message(p_archive_id uuid) returns uuid language plpgsql security definer set search_path='' as $$declare saved public.deleted_support_messages;previous_flag text;begin
 if public.admin_role() is distinct from 'admin' then raise insufficient_privilege;end if;
 select * into saved from public.deleted_support_messages where id=p_archive_id for update;
 if not found then raise exception 'Deleted message not found';end if;
 if saved.restored_at is not null then return saved.message_id;end if;
 if exists(select 1 from public.support_messages where id=saved.message_id) then raise exception 'Message ID already exists; nothing overwritten';end if;
 previous_flag=current_setting('almumez.support_restore',true);
 perform set_config('almumez.support_restore','yes',true);
 insert into public.support_messages select (jsonb_populate_record(null::public.support_messages,saved.payload)).*;
 -- No ON CONFLICT suppression: a reply collision must roll the whole restore
 -- back rather than silently dropping independently stored conversation data.
 insert into public.message_replies select * from jsonb_populate_recordset(null::public.message_replies,saved.replies);
 perform set_config('almumez.support_restore',coalesce(previous_flag,''),true);
 update public.deleted_support_messages set restored_at=now(),restored_by=auth.uid() where id=saved.id;
 return saved.message_id;
end$$;
revoke all on function public.restore_deleted_support_message(uuid) from public,anon,authenticated;
grant execute on function public.restore_deleted_support_message(uuid) to authenticated;

-- Old demo-order deletion conflicts with the relationship preservation guard.
-- Remove its authorization; never weaken the guard or remove order history.
drop policy if exists order_delete on public.orders;
revoke delete on public.orders from anon,authenticated;
-- The dashboard subscribes to category changes as well as product/order changes.
do $categories_realtime$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='categories') then
  alter publication supabase_realtime add table public.categories;
 end if;
end $categories_realtime$;
insert into public.store_schema_migrations(version) values('202611230011') on conflict(version) do nothing;



-- Structural checks BEFORE commit. They do not call checkout or any mutating RPC.
do $deployment_assertions$ declare name text;begin
 foreach name in array array['store_schema_migrations','profiles','user_roles','categories','products','bundles','bundle_items','customers','orders','order_items','notifications','settings','support_messages','product_images','inventory_transactions','message_replies','payment_transactions','provider_events','shipments','order_stock_reservations','shipment_requests','deleted_support_messages'] loop
  if not exists(select 1 from pg_class where oid=to_regclass('public.'||name) and relrowsecurity) then raise exception 'Missing table/RLS: %',name;end if;
 end loop;
 foreach name in array array['admin_access','admin_analytics','admin_category_page','admin_customer_detail','admin_notifications','admin_operational_summary','admin_overview','admin_page','admin_report','admin_role','admin_search','admin_set_order_status','admin_summary','apply_verified_payment','archive_deleted_support_message','backfill_guest_customers','catalog_match','catalog_page','customer_orders','customer_summary','customer_support_messages','effective_product_price','guard_catalog_shape','guard_category_delete','guard_payment_settings','guard_preserved_children','is_support_admin','list_support_messages','message_customer_sync','new_admin_profile','order_customer_sync','product_relations_sync','protect_reserved_variants','public_catalog_json','reserve_order_record','restore_deleted_support_message','restore_order_stock','site_bootstrap','submit_store_order','support_submission_guard','verified_administrative_role','workspace_bundle_sync','workspace_order_items','workspace_order_sync','workspace_product_sync'] loop
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=name) then raise exception 'Missing routine: %',name;end if;
 end loop;
 foreach name in array array['public.profiles.profile_read','public.profiles.profile_update','public.user_roles.role_read','public.user_roles.role_manage','public.categories.category_public','public.settings.settings_public','public.orders.order_insert','public.orders.order_update','public.settings.settings_manage','public.notifications.notifications_manage','public.support_messages.support_submit','storage.objects.admin_image_read','storage.objects.admin_image_insert','storage.objects.admin_image_update','storage.objects.admin_image_delete','public.payment_transactions.payment_read','public.shipments.shipment_read','public.inventory_transactions.inventory_read','public.message_replies.replies_read','public.message_replies.replies_send','public.customers.customer_own_read','public.customers.customer_update','public.support_messages.support_own_read','public.support_messages.support_customer_submit','public.product_images.image_public_read','public.product_images.image_staff_read','public.order_stock_reservations.reservation_staff_read','public.support_messages.support_staff_read','public.support_messages.support_staff_update','public.support_messages.support_admin_delete','public.support_messages.support_admin_restore','public.shipment_requests.shipment_request_staff_read','public.deleted_support_messages.deleted_support_admin_read','public.categories.workspace_read','public.products.workspace_read','public.bundles.workspace_read','public.bundle_items.workspace_read','public.customers.workspace_read','public.orders.workspace_read','public.order_items.workspace_read','public.notifications.workspace_read','public.settings.workspace_read','public.support_messages.workspace_read','public.products.workspace_insert','public.products.workspace_update','public.products.workspace_delete','public.categories.workspace_insert','public.categories.workspace_update','public.categories.workspace_delete','public.bundles.workspace_insert','public.bundles.workspace_update','public.bundles.workspace_delete'] loop
  if not exists(select 1 from pg_policies p where p.schemaname||'.'||p.tablename||'.'||p.policyname=name) then raise exception 'Missing policy: %',name;end if;
 end loop;
 foreach name in array array['almumez_new_profile','workspace_product_sync','workspace_bundle_sync','workspace_order_guard','workspace_order_items','product_relations_sync','order_customer_sync','message_customer_sync','reserve_order_record','protect_reserved_variants','limit_support_submissions','support_submission_guard','guard_payment_settings','guard_preserved_product','guard_preserved_bundle','guard_preserved_order','verified_administrative_role','guard_catalog_shape','guard_category_delete','archive_deleted_support_message'] loop
  if not exists(select 1 from pg_trigger t where not t.tgisinternal and t.tgname=name) then raise exception 'Missing trigger: %',name;end if;
 end loop;
 if (select count(*) from public.store_schema_migrations where version=any(array['202611220001','202611220002','202611220003','202611220004','202611220005','202611220006','202611220007','202611230008','202611230009','202611230010','202611230011']))<>11 then raise exception 'Missing migration versions';end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='messages' and column_name='customer_id') then raise exception 'messages.customer_id missing';end if;
 if has_table_privilege('anon','public.messages','INSERT') or has_table_privilege('anon','public.messages','SELECT') or has_column_privilege('anon','public.messages','status','INSERT') or not has_column_privilege('anon','public.messages','message','INSERT') then raise exception 'Unsafe anonymous inbox privileges';end if;
 if not exists(select 1 from public.settings where key='paymentMethods' and value @> '{"cod":true,"card":false,"valu":false}'::jsonb) then raise exception 'COD-only settings missing';end if;
 if not exists(select 1 from storage.buckets where id='product-images' and public and file_size_limit=12582912 and allowed_mime_types=array['image/webp']) then raise exception 'Product image bucket configuration mismatch';end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='categories') then raise exception 'Category Realtime publication missing';end if;
 if has_table_privilege('anon','public.products','SELECT') or has_table_privilege('anon','public.bundles','SELECT') or not has_table_privilege('anon','public.public_products','SELECT') then raise exception 'Unsafe public product privileges';end if;
end $deployment_assertions$;

COMMIT;
-- MIGRATION COMMITTED. Following SELECTs verify the committed schema only.
-- A verification error does NOT undo the COMMIT. Do not rerun first-install SQL.
SELECT 'MIGRATION_COMMITTED'::text AS migration_status;

-- READ-ONLY VERIFICATION. Never creates orders, assigns roles or edits records.
-- Run this AFTER an approved deployment; all present/RLS/PK/valid checks should be true.
with expected(name) as(select unnest(array['store_schema_migrations','profiles','user_roles','categories','products','bundles','bundle_items','customers','orders','order_items','notifications','settings','support_messages','product_images','inventory_transactions','message_replies','payment_transactions','provider_events','shipments','order_stock_reservations','shipment_requests','deleted_support_messages']))
select e.name,to_regclass('public.'||e.name) is not null present,coalesce(c.relrowsecurity,false) rls_enabled,
 exists(select 1 from pg_constraint k where k.conrelid=c.oid and k.contype='p') primary_key
from expected e left join pg_class c on c.oid=to_regclass('public.'||e.name) order by e.name;
with expected(name) as(select unnest(array['admin_access','admin_analytics','admin_category_page','admin_customer_detail','admin_notifications','admin_operational_summary','admin_overview','admin_page','admin_report','admin_role','admin_search','admin_set_order_status','admin_summary','apply_verified_payment','archive_deleted_support_message','backfill_guest_customers','catalog_match','catalog_page','customer_orders','customer_summary','customer_support_messages','effective_product_price','guard_catalog_shape','guard_category_delete','guard_payment_settings','guard_preserved_children','is_support_admin','list_support_messages','message_customer_sync','new_admin_profile','order_customer_sync','product_relations_sync','protect_reserved_variants','public_catalog_json','reserve_order_record','restore_deleted_support_message','restore_order_stock','site_bootstrap','submit_store_order','support_submission_guard','verified_administrative_role','workspace_bundle_sync','workspace_order_items','workspace_order_sync','workspace_product_sync']))
select e.name,count(p.oid)>0 present,bool_and(not p.prosecdef or coalesce(p.proconfig,array[]::text[]) @> array['search_path=""']) definer_path_pinned
from expected e left join pg_namespace n on n.nspname='public' left join pg_proc p on p.pronamespace=n.oid and p.proname=e.name group by e.name order by e.name;
with expected(name) as(select unnest(array['public.profiles.profile_read','public.profiles.profile_update','public.user_roles.role_read','public.user_roles.role_manage','public.categories.category_public','public.settings.settings_public','public.orders.order_insert','public.orders.order_update','public.settings.settings_manage','public.notifications.notifications_manage','public.support_messages.support_submit','storage.objects.admin_image_read','storage.objects.admin_image_insert','storage.objects.admin_image_update','storage.objects.admin_image_delete','public.payment_transactions.payment_read','public.shipments.shipment_read','public.inventory_transactions.inventory_read','public.message_replies.replies_read','public.message_replies.replies_send','public.customers.customer_own_read','public.customers.customer_update','public.support_messages.support_own_read','public.support_messages.support_customer_submit','public.product_images.image_public_read','public.product_images.image_staff_read','public.order_stock_reservations.reservation_staff_read','public.support_messages.support_staff_read','public.support_messages.support_staff_update','public.support_messages.support_admin_delete','public.support_messages.support_admin_restore','public.shipment_requests.shipment_request_staff_read','public.deleted_support_messages.deleted_support_admin_read','public.categories.workspace_read','public.products.workspace_read','public.bundles.workspace_read','public.bundle_items.workspace_read','public.customers.workspace_read','public.orders.workspace_read','public.order_items.workspace_read','public.notifications.workspace_read','public.settings.workspace_read','public.support_messages.workspace_read','public.products.workspace_insert','public.products.workspace_update','public.products.workspace_delete','public.categories.workspace_insert','public.categories.workspace_update','public.categories.workspace_delete','public.bundles.workspace_insert','public.bundles.workspace_update','public.bundles.workspace_delete']))
select e.name,exists(select 1 from pg_policies p where p.schemaname||'.'||p.tablename||'.'||p.policyname=e.name) present from expected e order by e.name;
select version,applied_at from public.store_schema_migrations order by version;
-- Expected 11 versions: 202611220001, 202611220002, 202611220003, 202611220004, 202611220005, 202611220006, 202611220007, 202611230008, 202611230009, 202611230010, 202611230011.
select t.tgname,c.oid::regclass relation,t.tgenabled,pg_get_triggerdef(t.oid) definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and t.tgname=any(array['almumez_new_profile','workspace_product_sync','workspace_bundle_sync','workspace_order_guard','workspace_order_items','product_relations_sync','order_customer_sync','message_customer_sync','reserve_order_record','protect_reserved_variants','limit_support_submissions','support_submission_guard','guard_payment_settings','guard_preserved_product','guard_preserved_bundle','guard_preserved_order','verified_administrative_role','guard_catalog_shape','guard_category_delete','archive_deleted_support_message']) order by 2,1;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where (schemaname='public' and tablename=any(array['store_schema_migrations','profiles','user_roles','categories','products','bundles','bundle_items','customers','orders','order_items','notifications','settings','support_messages','product_images','inventory_transactions','message_replies','payment_transactions','provider_events','shipments','order_stock_reservations','shipment_requests','deleted_support_messages'])) or (schemaname='storage' and policyname=any(array['admin_image_read','admin_image_insert','admin_image_update','admin_image_delete'])) order by 1,2,3;
select conrelid::regclass relation,conname,contype,convalidated,pg_get_constraintdef(oid) definition
from pg_constraint where connamespace='public'::regnamespace order by 1,2;
-- Three additive preserve_* foreign keys are deliberately NOT VALID for legacy compatibility;
-- their parent guards still preserve relationships. Other normal PK/FK checks should be valid.
select t.relname relation,i.relname index_name,x.indisvalid,x.indisready,pg_get_indexdef(i.oid) definition
from pg_index x join pg_class t on t.oid=x.indrelid join pg_class i on i.oid=x.indexrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' order by 1,2;
select column_name from information_schema.columns where table_schema='public' and table_name='messages' and column_name='customer_id';
select reloptions from pg_class where oid='public.messages'::regclass; -- security_invoker=true
select has_table_privilege('anon','public.products','SELECT') anonymous_raw_products,
 has_table_privilege('anon','public.bundles','SELECT') anonymous_raw_bundles,
 has_table_privilege('anon','public.public_products','SELECT') sanitized_products,
 has_table_privilege('anon','public.public_bundles','SELECT') sanitized_bundles;
-- Expected false,false,true,true. Customer raw SELECT is filtered by operational RLS.
select has_table_privilege('anon','public.messages','SELECT') anon_message_read,
 has_table_privilege('anon','public.messages','INSERT') anon_all_column_insert,
 has_column_privilege('anon','public.messages','message','INSERT') anon_message_insert,
 has_column_privilege('anon','public.messages','status','INSERT') anon_status_insert;
-- Expected false,false,true,false.
select has_function_privilege('anon','public.submit_store_order(jsonb)','EXECUTE') public_checkout,
 has_function_privilege('anon','public.admin_set_order_status(text[],text)','EXECUTE') anonymous_admin_status,
 has_function_privilege('anon','public.restore_deleted_support_message(uuid)','EXECUTE') anonymous_restore,
 has_table_privilege('authenticated','public.orders','DELETE') browser_order_delete;
-- Expected true,false,false,false. Real staff/customer JWT tests are separate.
select key,value from public.settings where key in ('paymentMethods','shipping');
-- paymentMethods must contain cod=true, card=false, valu=false. Fees are not carrier integrations.
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets; -- only product-images, public, WebP, 12582912 bytes
select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime' order by 1,2;
select table_name,grantee,privilege_type from information_schema.table_privileges where table_schema='public' and grantee in ('anon','authenticated') order by 1,2,3;
select routine_name,grantee,privilege_type from information_schema.routine_privileges where specific_schema='public' and grantee in ('PUBLIC','anon','authenticated') order by 1,2;

SELECT 'POST_DEPLOY_QUERIES_COMPLETED_REVIEW_RESULTS'::text AS verification_status;
