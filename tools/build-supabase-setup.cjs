// Generates SQL source only. Never connects to or executes SQL against a database.
const fs=require('node:fs'),dir='supabase/migrations';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort(),sources=files.map(f=>fs.readFileSync(dir+'/'+f,'utf8')),all=sources.join('\n');
const columns=[];
for(const match of all.matchAll(/create table if not exists public\.(\w+)\(([^;]+)\);/g)){
 let depth=0,quote=false,start=0;const parts=[];
 for(let i=0;i<match[2].length;i++){const c=match[2][i];if(c==="'"){if(quote&&match[2][i+1]==="'"){i++;continue}quote=!quote}if(!quote){if(c==='(')depth++;if(c===')')depth--;if(c===','&&!depth){parts.push(match[2].slice(start,i));start=i+1}}}parts.push(match[2].slice(start));
 for(const part of parts){const col=part.trim().match(/^(\w+)\s+(uuid|text|jsonb|int\b|integer|numeric|timestamptz|boolean|bigint)/);if(col)columns.push([match[1],col[1],({int:'integer',timestamptz:'timestamp with time zone'})[col[2]]||col[2]])}
}
const policyPairs=[...all.matchAll(/create policy (\w+) on ((?:public|storage)\.\w+)/g)].map(m=>m[2]+'.'+m[1]);
for(const name of ['categories','products','bundles','bundle_items','customers','orders','order_items','notifications','settings','support_messages'])policyPairs.push('public.'+name+'.workspace_read');
for(const table of ['products','categories','bundles'])for(const name of ['workspace_insert','workspace_update','workspace_delete'])policyPairs.push('public.'+table+'.'+name);
for(const name of ['submit_request','admin_read','admin_update'])policyPairs.push('public.support_messages.'+name);
const triggers=[...new Set([...all.matchAll(/create trigger (\w+)/g)].map(m=>m[1]).concat(['limit_support_submissions']))],tables=[...new Set(columns.map(c=>c[0]))];
const primaryKeys={store_schema_migrations:['version'],profiles:['id'],user_roles:['user_id'],categories:['id'],products:['id'],bundles:['id'],bundle_items:['bundle_id','product_id'],customers:['id'],orders:['id'],order_items:['order_id','line'],notifications:['id'],settings:['key'],support_messages:['id'],product_images:['id'],inventory_transactions:['id'],message_replies:['id'],payment_transactions:['id'],provider_events:['id'],shipments:['id'],order_stock_reservations:['order_id','product_id','variant_id'],shipment_requests:['id']};
const foreignKeys=[['profiles','id','auth.users'],['user_roles','user_id','auth.users'],['bundle_items','bundle_id','public.bundles'],['bundle_items','product_id','public.products'],['order_items','order_id','public.orders'],['order_items','product_id','public.products'],['orders','customer_id','public.customers'],['customers','auth_user_id','auth.users'],['support_messages','customer_id','public.customers'],['product_images','product_id','public.products'],['inventory_transactions','product_id','public.products'],['inventory_transactions','changed_by','auth.users'],['message_replies','message_id','public.support_messages'],['message_replies','sender_id','auth.users'],['payment_transactions','order_id','public.orders'],['shipments','order_id','public.orders'],['order_stock_reservations','order_id','public.orders'],['order_stock_reservations','product_id','public.products']];
const quoted=list=>list.map(v=>"'"+v+"'").join(','),values=columns.map(row=>'('+quoted(row)+')').join(',\n');
primaryKeys.deleted_support_messages=['id'];
foreignKeys.push(['shipment_requests','order_id','public.orders']);
foreignKeys.push(['provider_events','payment_transaction_id','public.payment_transactions']);
const preflight=`-- Fail closed on incompatible schemas; preserve unknown objects for manual review.
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
 for expected in select * from(values ${values})v(table_name,column_name,type_name) loop
  if to_regclass('public.'||expected.table_name) is not null then
   if not exists(select 1 from pg_class where oid=to_regclass('public.'||expected.table_name) and relkind='r') then raise exception 'Expected ordinary table: %',expected.table_name;end if;
   select format_type(a.atttypid,a.atttypmod) into actual_type from pg_attribute a where a.attrelid=to_regclass('public.'||expected.table_name) and a.attname=expected.column_name and not a.attisdropped;
   if actual_type is distinct from expected.type_name then raise exception 'Incompatible existing column %.%: expected %, found %. No automatic conversion.',expected.table_name,expected.column_name,expected.type_name,actual_type;end if;
  end if;
 end loop;
 for expected in select * from(values ${Object.entries(primaryKeys).map(([table,cols])=>"('"+table+"',array["+quoted(cols)+"]) ").join(',')})v(table_name,key_columns) loop
  if to_regclass('public.'||expected.table_name) is not null and not exists(select 1 from pg_constraint c where c.conrelid=to_regclass('public.'||expected.table_name) and c.contype='p' and (select array_agg(a.attname::text order by k.ordinality) from unnest(c.conkey) with ordinality k(attnum,ordinality) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)=expected.key_columns) then raise exception 'Incompatible primary key on %. Review separately.',expected.table_name;end if;
 end loop;
 for expected in select * from(values ${foreignKeys.map(row=>'('+quoted(row)+')').join(',')})v(table_name,column_name,target_table) loop
  if exists(select 1 from pg_attribute where attrelid=to_regclass('public.'||expected.table_name) and attname=expected.column_name and not attisdropped) then
   if not exists(select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) join pg_attribute target on target.attrelid=c.confrelid and target.attnum=any(c.confkey) where c.conrelid=to_regclass('public.'||expected.table_name) and c.contype='f' and c.convalidated and array_length(c.conkey,1)=1 and a.attname=expected.column_name and c.confrelid=to_regclass(expected.target_table) and target.attname='id') then raise exception 'Incompatible or missing foreign key %.% -> %. Review separately.',expected.table_name,expected.column_name,expected.target_table;end if;
  end if;
 end loop;
 if to_regclass('public.messages') is not null and not exists(select 1 from pg_class where oid=to_regclass('public.messages') and relkind='v') then raise exception 'public.messages is not a view; preserve and review it manually';end if;
 select string_agg(schemaname||'.'||tablename||'.'||policyname,', ') into unexpected from pg_policies where ((schemaname='public' and tablename=any(array[${quoted(tables)}])) or (schemaname='storage' and tablename='objects')) and (schemaname||'.'||tablename||'.'||policyname)<>all(array[${quoted([...new Set(policyPairs)])}]);
 if unexpected is not null then raise exception 'Unreviewed existing policies: %. Nothing deleted; review separately.',unexpected;end if;
 select string_agg(c.relname||'.'||t.tgname,', ') into unexpected from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname='public' and c.relname=any(array[${quoted(tables)}]) and t.tgname<>all(array[${quoted(triggers)}]);
 if unexpected is not null then raise exception 'Unreviewed existing triggers: %. Review separately.',unexpected;end if;
 if to_regclass('public.settings') is not null then execute 'select string_agg(key,'', '') from public.settings where key not in (''storeName'',''supportEmail'',''whatsappNumber'',''monthlyGoal'',''shipping'',''paymentMethods'',''preferences'')' into unexpected;if unexpected is not null then raise exception 'Unreviewed settings keys: %. No data removed.',unexpected;end if;end if;
end $preflight$;
commit;
`;
fs.writeFileSync('supabase/preflight.sql',preflight);
const fragments=[['preflight.sql',preflight],...files.map((f,i)=>[f,sources[i]])];
fs.writeFileSync('supabase/setup.sql','-- REVIEWED SOURCE; not executed. Apply whole file, never selected fragments.\nBEGIN;\n'+fragments.map(([name,s])=>'-- FILE: '+name+'\n'+s.replace(/^begin;\r?$/gmi,'').replace(/^commit;\r?$/gmi,'')).join('\n')+'\nCOMMIT;\n');
console.log('Generated atomic setup.sql from preflight and '+files.length+' migrations (no SQL executed)');
