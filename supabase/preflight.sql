-- Fail closed on incompatible schemas; preserve unknown objects for manual review.
begin;
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
commit;
