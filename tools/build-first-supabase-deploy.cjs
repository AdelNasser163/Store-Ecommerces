// SOURCE GENERATION ONLY. No driver, connection, SQL execution or network.
const fs=require('node:fs'),crypto=require('node:crypto');
const files=fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort();
if(files.length!==11||!files[10].startsWith('202611230011'))throw Error('Review migration order before generating');
const setup=fs.readFileSync('supabase/setup.sql','utf8');
const strip=s=>s.replace(/^begin;\r?$/gmi,'').replace(/^commit;\r?$/gmi,'');
for(const file of files)if(!setup.includes(strip(fs.readFileSync('supabase/migrations/'+file,'utf8'))))throw Error('Regenerate setup first: '+file);
const tables=[...new Set([...setup.matchAll(/create table if not exists public\.(\w+)\s*\(/g)].map(m=>m[1]))];
const names=[...new Set([...setup.matchAll(/create or replace function public\.(\w+)\(/g)].map(m=>m[1]))].sort();
const quote=a=>a.map(s=>"'"+s+"'").join(',');
const expectedVersions=files.map(n=>n.split('_')[0]);
const triggers=[...new Set([...setup.matchAll(/create trigger (\w+)/g)].map(m=>m[1]))];
const storagePolicyNames=['admin_image_read','admin_image_insert','admin_image_update','admin_image_delete'];
const policies=[...setup.matchAll(/create policy (\w+) on ((?:public|storage)\.\w+)/g)].map(m=>m[2]+'.'+m[1]);
// Above names can be dropped AND recreated. Preserve those with a final CREATE
// after the last literal DROP; remove only names whose terminal action is DROP.
const terminalPolicies=[...new Set(policies)].filter(pair=>{
 const at=pair.lastIndexOf('.'),table=pair.slice(0,at),name=pair.slice(at+1);
 return setup.lastIndexOf('create policy '+name+' on '+table)>setup.lastIndexOf('drop policy if exists '+name+' on '+table);
});
for(const table of ['categories','products','bundles','bundle_items','customers','orders','order_items','notifications','settings','support_messages'])terminalPolicies.push('public.'+table+'.workspace_read');
for(const table of ['products','categories','bundles'])for(const op of ['insert','update','delete'])terminalPolicies.push('public.'+table+'.workspace_'+op);
const guard=`
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
 foreach target in array array[${quote([...tables,'messages','public_products','public_bundles'])}] loop
  if to_regclass('public.'||target) is not null then raise exception 'Existing target relation public.%; preserve and review separately',target;end if;
 end loop;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[${quote(names)}])) or to_regprocedure('support_private.limit_submissions()') is not null then raise exception 'Existing target routines; preserve and review separately';end if;
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
 if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname=any(array[${quote(storagePolicyNames)}])) then raise exception 'Existing named application Storage policies; preserve and review separately';end if;
 if exists(select 1 from storage.buckets) or exists(select 1 from storage.objects) then raise exception 'Storage no longer matches the reviewed empty state. Back up objects and review first';end if;
end $first_deployment_guard$;
`;
const verify=`-- READ-ONLY VERIFICATION. Never creates orders, assigns roles or edits records.
-- Run this AFTER an approved deployment; all present/RLS/PK/valid checks should be true.
with expected(name) as(select unnest(array[${quote(tables)}]))
select e.name,to_regclass('public.'||e.name) is not null present,coalesce(c.relrowsecurity,false) rls_enabled,
 exists(select 1 from pg_constraint k where k.conrelid=c.oid and k.contype='p') primary_key
from expected e left join pg_class c on c.oid=to_regclass('public.'||e.name) order by e.name;
with expected(name) as(select unnest(array[${quote(names)}]))
select e.name,count(p.oid)>0 present,bool_and(not p.prosecdef or coalesce(p.proconfig,array[]::text[]) @> array['search_path=""']) definer_path_pinned
from expected e left join pg_namespace n on n.nspname='public' left join pg_proc p on p.pronamespace=n.oid and p.proname=e.name group by e.name order by e.name;
with expected(name) as(select unnest(array[${quote(terminalPolicies)}]))
select e.name,exists(select 1 from pg_policies p where p.schemaname||'.'||p.tablename||'.'||p.policyname=e.name) present from expected e order by e.name;
select version,applied_at from public.store_schema_migrations order by version;
-- Expected 11 versions: ${expectedVersions.join(', ')}.
select t.tgname,c.oid::regclass relation,t.tgenabled,pg_get_triggerdef(t.oid) definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and t.tgname=any(array[${quote(triggers)}]) order by 2,1;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where (schemaname='public' and tablename=any(array[${quote(tables)}])) or (schemaname='storage' and policyname=any(array[${quote(storagePolicyNames)}])) order by 1,2,3;
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
`;
const sanity=`
-- Structural checks BEFORE commit. They do not call checkout or any mutating RPC.
do $deployment_assertions$ declare name text;begin
 foreach name in array array[${quote(tables)}] loop
  if not exists(select 1 from pg_class where oid=to_regclass('public.'||name) and relrowsecurity) then raise exception 'Missing table/RLS: %',name;end if;
 end loop;
 foreach name in array array[${quote(names)}] loop
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=name) then raise exception 'Missing routine: %',name;end if;
 end loop;
 foreach name in array array[${quote(terminalPolicies)}] loop
  if not exists(select 1 from pg_policies p where p.schemaname||'.'||p.tablename||'.'||p.policyname=name) then raise exception 'Missing policy: %',name;end if;
 end loop;
 foreach name in array array[${quote(triggers)}] loop
  if not exists(select 1 from pg_trigger t where not t.tgisinternal and t.tgname=name) then raise exception 'Missing trigger: %',name;end if;
 end loop;
 if (select count(*) from public.store_schema_migrations where version=any(array[${quote(expectedVersions)}]))<>11 then raise exception 'Missing migration versions';end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='messages' and column_name='customer_id') then raise exception 'messages.customer_id missing';end if;
 if has_table_privilege('anon','public.messages','INSERT') or has_table_privilege('anon','public.messages','SELECT') or has_column_privilege('anon','public.messages','status','INSERT') or not has_column_privilege('anon','public.messages','message','INSERT') then raise exception 'Unsafe anonymous inbox privileges';end if;
 if not exists(select 1 from public.settings where key='paymentMethods' and value @> '{"cod":true,"card":false,"valu":false}'::jsonb) then raise exception 'COD-only settings missing';end if;
 if not exists(select 1 from storage.buckets where id='product-images' and public and file_size_limit=12582912 and allowed_mime_types=array['image/webp']) then raise exception 'Product image bucket configuration mismatch';end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='categories') then raise exception 'Category Realtime publication missing';end if;
 if has_table_privilege('anon','public.products','SELECT') or has_table_privilege('anon','public.bundles','SELECT') or not has_table_privilege('anon','public.public_products','SELECT') then raise exception 'Unsafe public product privileges';end if;
end $deployment_assertions$;
`;
if(!/^--[^\n]*\nBEGIN;/i.test(setup)||!setup.trimEnd().endsWith('COMMIT;'))throw Error('Unexpected setup transaction envelope');
const result='-- FIRST MyStore APPLICATION DEPLOYMENT; SOURCE PREPARED, NOT EXECUTED.\n-- Requires explicit owner approval and the verified external database backup.\n-- Never run this and setup.sql as two deployments. This entry point includes it.\n'+setup.replace(/BEGIN;/,()=>('BEGIN;\n'+guard)).replace(/COMMIT;\s*$/,()=>sanity+'\nCOMMIT;\n-- MIGRATION COMMITTED. Following SELECTs verify the committed schema only.\n-- A verification error does NOT undo the COMMIT. Do not rerun first-install SQL.\nSELECT \'MIGRATION_COMMITTED\'::text AS migration_status;\n\n'+verify+'\nSELECT \'POST_DEPLOY_QUERIES_COMPLETED_REVIEW_RESULTS\'::text AS verification_status;\n');
fs.writeFileSync('supabase/DEPLOY_TO_SUPABASE.sql',result);
fs.writeFileSync('supabase/VERIFY_DEPLOYMENT.sql',verify);
console.log(JSON.stringify({generated:'supabase/DEPLOY_TO_SUPABASE.sql',sha256:crypto.createHash('sha256').update(result).digest('hex'),tables,functions:names,migrations:files},null,2));
