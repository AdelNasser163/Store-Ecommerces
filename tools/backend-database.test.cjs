/* Disposable embedded PostgreSQL only. Never reads production configuration. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text);alter table storage.objects enable row level security;`);
 let sql=fs.readFileSync('supabase/setup.sql','utf8').replace('create extension if not exists pgcrypto with schema extensions;','');
 sql=sql.replace(/do \$\$[\s\S]*?end\$\$;/g,block=>block.includes('alter publication')?'-- NOT EXECUTED: Realtime requires Supabase publication.':block);
 for(let n=0;n<2;n++){try{await db.exec(sql)}catch(error){const offset=Number(error.position)||0;console.error('SQL context',sql.slice(Math.max(0,offset-130),offset+140));throw error}console.log('PASS disposable setup pass',n+1)}
 await db.exec("select set_config('almumez.test_isolated','yes',false)");
 for(const file of fs.readdirSync('supabase/tests').filter(f=>f.endsWith('.sql')).sort()){await db.exec(fs.readFileSync('supabase/tests/'+file,'utf8'));console.log('PASS disposable scenarios',file)}
 console.log('PASS disposable SQL support permissions, customer isolation, bundle validation, metadata preservation, failed/repeated/late payment restoration');
 const cases=[
  `create table public.orders(id text primary key,payload jsonb,created_at timestamptz default now(),updated_at timestamptz default now());insert into public.orders(id,payload) values('a','{"requestId":"duplicate-legacy"}'),('b','{"requestId":"duplicate-legacy"}')`,
  `create table public.products(id text primary key,published boolean,payload jsonb,updated_at timestamptz);insert into public.products values('a',true,'{"sku":"DUP"}',now()),('b',true,'{"sku":"dup"}',now())`,
 ];
 for(const fixture of cases){const isolated=new PGlite();try{await isolated.exec(fixture);await assert.rejects(()=>isolated.exec(fs.readFileSync('supabase/preflight.sql','utf8')),/Duplicate/);await isolated.exec('rollback');const table=fixture.includes('public.orders')?'orders':'products';assert.equal((await isolated.query('select count(*)::int n from public.'+table)).rows[0].n,2);console.log('PASS conflicting legacy '+table+' preflight aborts without changing either record')}finally{await isolated.close()}}
}finally{await db.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
