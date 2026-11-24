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
