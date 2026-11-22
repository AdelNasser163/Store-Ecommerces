/* Real PostgreSQL (WASM) schema/RLS checks; Supabase auth/storage are small fixtures.
 * Development only. Nothing from PGlite is shipped to the website.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(process.env.LOCALAPPDATA||'C:/Users/WG/AppData/Local','npm-cache/_npx');
const packagePath=fs.readdirSync(root).map(n=>path.join(root,n,'node_modules/@electric-sql/pglite')).find(p=>fs.existsSync(path.join(p,'package.json')));
if(!packagePath)throw Error('Install the development test runner with npm exec --yes --package=@electric-sql/pglite -- node --version');
const {PGlite}=require(packagePath);
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text);alter table storage.objects enable row level security;`);
 let sql=fs.readFileSync('db/admin-schema.sql','utf8').replace('create extension if not exists pgcrypto;','');
 // Logical replication transport is a Supabase deployment check, not available in WASM.
 sql=sql.replace(/do \$\$declare name text;begin foreach name in array array\['orders','products','bundles','support_messages','notifications','settings'\][\s\S]*?end\$\$;/,'');
 await db.exec(sql);console.log('PASS schema migration');
 const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
 for(let i=0;i<ids.length;i++)await db.query('insert into auth.users(id,email) values($1,$2)',[ids[i],`fixture${i}@example.invalid`]);
 await db.query("insert into public.user_roles(user_id,role) values($1,'admin'),($2,'staff')",[ids[0],ids[1]]);
 const p={id:'fixture-phone',name:{ar:'هاتف اختبار',en:'Fixture phone'},price:100,stock:10,category:'mobiles',variants:[{id:'256',priceDelta:20,stock:4}],offer:{enabled:true,type:'prices',oldPrice:100,newPrice:90}};
 await db.query('insert into public.products(id,published,payload) values($1,true,$2)',[p.id,JSON.stringify(p)]);
 await db.query('insert into public.products(id,published,payload) values($1,false,$2)',['fixture-draft',JSON.stringify({...p,id:'fixture-draft'})]);
 const as=async(role,id='')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role)};
 await as('anon');assert.equal((await db.query('select count(*)::int n from public.products')).rows[0].n,1);
 await assert.rejects(()=>db.query('select * from public.orders'));
 await assert.rejects(()=>db.query('select public.admin_analytics(now(),now())'));
 const order={id:'MMZ-SQL-1',requestId:'fixture-request',customer:{name:'أحمد سمير',email:'fixture@example.invalid',phone:'01012345678',address:'عنوان اختبار',city:'القاهرة'},items:[{id:p.id,quantity:2,storage:'256',price:1}],subtotal:220,shipping:150,discount:0,total:0,payment:'cod',delivery:'express',demo:true,notes:[{text:'untrusted'}],language:'ar'};
 const submitted=(await db.query('select public.submit_store_order($1::jsonb) result',[JSON.stringify(order)])).rows[0].result;
 assert.equal(submitted.total,370);assert.equal(submitted.items[0].price,110);assert.equal(submitted.statusKey,'new');assert.equal(submitted.demo,undefined);assert.equal(submitted.notes,undefined);
 const repeat=(await db.query('select public.submit_store_order($1::jsonb) result',[JSON.stringify(order)])).rows[0].result;assert.equal(repeat.id,submitted.id);
 await assert.rejects(()=>db.query('select public.submit_store_order($1::jsonb)',[JSON.stringify({...order,id:'MMZ-TAMPER',subtotal:1})]));
 await db.exec('reset role');const stock=(await db.query('select payload from public.products where id=$1',[p.id])).rows[0].payload;assert.equal(stock.stock,8);assert.equal(stock.variants[0].stock,2);
 await as('authenticated',ids[2]);assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n,0);await assert.rejects(()=>db.query("insert into public.user_roles(user_id,role) values($1,'admin')",[ids[2]]));
 await as('authenticated',ids[1]);assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n,1);
 await assert.rejects(()=>db.query("update public.orders set payload=jsonb_set(payload,'{total}','1') where id='MMZ-SQL-1'"));
 await db.query("update public.orders set payload=jsonb_set(payload,'{statusKey}','\"processing\"') where id='MMZ-SQL-1'");
 assert.equal((await db.query("update public.settings set value='1' where key='monthlyGoal' returning key")).rows.length,0);
 assert.equal((await db.query("delete from public.products where id='fixture-draft' returning id")).rows.length,0);
 await as('authenticated',ids[0]);await db.query("update public.settings set value='1000' where key='monthlyGoal'");
 const analytics=(await db.query("select public.admin_analytics(now()-interval '1 day',now()+interval '1 day') value")).rows[0].value;assert.equal(analytics.sales,370);
 await as('anon');await db.query("insert into public.support_messages(name,email,subject,message,consent) values('عميل اختبار','test@example.invalid','other','رسالة تواصل اختبار حقيقية',true)");await assert.rejects(()=>db.query('select * from public.messages'));
 await as('authenticated',ids[1]);assert.equal((await db.query('select count(*)::int n from public.messages')).rows[0].n,1);await db.exec('reset role');await db.exec(fs.readFileSync('db/admin-seed.sql','utf8'));
 fs.writeFileSync('docs/dashboard-redesign/database-checks.json',JSON.stringify({engine:'PostgreSQL via PGlite (development only)',schema:true,seed:true,publicCatalogRLS:true,privateOrdersRLS:true,serverPricing:true,stockAtomicity:true,idempotency:true,staffRole:true,adminRole:true,messageRLS:true,realtimeTransport:'Requires configured Supabase project'},null,2));console.log('PASS database schema, seed, authorization, pricing and stock checks');
}finally{await db.close()}})().catch(error=>{console.error(error.message);process.exitCode=1});
