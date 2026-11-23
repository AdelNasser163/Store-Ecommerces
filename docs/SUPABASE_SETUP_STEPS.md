# Existing MyStore: manual setup

No production connection or migration was performed. Do not run this until the
PostgreSQL 16 gate reports `passed:true` in `backend-audit/postgres16-results.json`.

1. Supabase Dashboard: select existing **MyStore**, project reference
   `gsgbbhvbxfloyrhnywol`. Never create a replacement project.
2. Database → Backups: take/verify a recoverable backup, including separate
   Storage files. Alternatively use trusted local `pg_dump --format=custom
   --file=MyStore-before-migration.dump` with connection credentials supplied
   privately through PostgreSQL environment variables, never Git/chat.
3. SQL Editor → New query: inspect existing row counts using the query below.
   If orders/customers exist, STOP and explicitly confirm backup completion
   before any migration. Do not assume they are disposable test records.
4. After the gate and backup review, paste the ENTIRE `supabase/setup.sql` into
   a new query and Run. It is one transaction, preflight plus migrations 001–011.
   Never use legacy support-setup.sql/db/admin-schema.sql or selected fragments.
5. If preflight rejects duplicates/custom objects, stop and retain the error.
   No automatic deletion, merging or constraint bypass is authorized.

```sql
do $$ declare r record; n bigint; begin
 for r in select * from(values ('public','products'),('public','orders'),
 ('public','customers'),('public','support_messages'),('public','settings'),
 ('auth','users'),('storage','objects'))v(s,t) loop
  if to_regclass(format('%I.%I',r.s,r.t)) is null then
   raise notice '%.% absent',r.s,r.t;
  else
   execute format('select count(*) from %I.%I',r.s,r.t) into n;
   raise notice '%.%: % rows',r.s,r.t,n;
  end if;
 end loop;
end$$;
```

Read-only verification after successful migration:

```sql
select version from public.store_schema_migrations order by version;
-- 11 rows: 202611220001–007 and 202611230008–011.
select column_name from information_schema.columns where table_schema='public'
 and table_name='messages' and column_name='customer_id'; -- one row
select has_table_privilege('anon','public.messages','SELECT') as read,
 has_table_privilege('anon','public.messages','INSERT') as all_columns_insert,
 has_column_privilege('anon','public.messages','message','INSERT') as message_insert,
 has_column_privilege('anon','public.messages','status','INSERT') as status_insert;
-- false,false,true,false
select key,value from public.settings where key='paymentMethods';
-- cod true, card false, valu false
select e.extname,n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
-- fresh installation: extensions; existing extensions are not forcibly moved
select * from pg_policies where schemaname in ('public','storage');
select tablename,indexname,indexdef from pg_indexes where schemaname='public';
select conrelid::regclass,conname,pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace;
select event_object_table,trigger_name from information_schema.triggers where trigger_schema='public';
select p.oid::regprocedure,p.prosecdef,p.proconfig,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
select table_name,grantee,privilege_type from information_schema.table_privileges where table_schema='public' and grantee in ('anon','authenticated');
select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime';
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='product-images';
```

Every hosted check is **Requires my manual action**. SQL Editor owner reads do
not prove customer isolation: test real anon/customer/staff/admin sessions too.
Follow FIRST_ADMIN_SETUP.md, DEPLOYMENT.md and MULTI_DEVICE_TEST.md afterward.
