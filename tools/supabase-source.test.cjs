// NO SQL execution: PostgreSQL grammar parsing, source invariants, SDK adapter contract.
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),p=require('libpg-query');
(async()=>{
const files=['supabase/setup.sql','supabase/preflight.sql',...fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).map(f=>'supabase/migrations/'+f)];
let functions=0;for(const file of files){const s=fs.readFileSync(file,'utf8');await p.parse(s);await p.parsePlPgSQL(s);for(const f of s.matchAll(/create or replace function[\s\S]*?\$\$[\s\S]*?\$\$;/g)){await p.parse(f[0]);await p.parsePlPgSQL(f[0]);functions++}assert(!/[\u00c3\u00c2\u00d8\u00d9\ufffd]/.test(s),'Corrupted encoding: '+file)}
const sql=fs.readFileSync('supabase/setup.sql','utf8');assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);
assert(!/drop\s+(?:table|schema)|truncate\s+/i.test(sql));assert(!/update public\.products set payload=payload/.test(sql));
assert(sql.includes("'status','طلب جديد'"));assert(sql.includes("'stockReservationVersion',1"));assert(sql.includes("state='reserved'"));assert(sql.includes("state='released',released_at=now()"));assert(sql.includes('Terminal orders cannot be reopened'));
assert(sql.includes('reconciliation_required=true'));assert(sql.includes('Online payments require a configured server-side provider and verified webhook'));
assert(sql.includes("return existing.payload-array['notes','timeline','requestId']"));assert(sql.includes('existing.request_fingerprint is distinct from fingerprint'));assert(sql.includes("'almumez-order-request:'"));assert(sql.includes('Unreviewed existing policies'));
const last=sql.slice(sql.indexOf('-- FILE: 202611220006'));assert(!last.includes('select exists(select 1 from support_private.admins'));
assert(last.includes('from public,anon,authenticated'));assert(last.includes('to service_role'));assert(last.includes("jwt_role<>'service_role'"));
const calls=[],session={access_token:'test-fixture-only'};
const shared={enabled:true,configured:true,config:{},session:async()=>session,subscribe:fn=>{fn({session});return()=>{}},rpc:async name=>{calls.push(['rpc',name]);return true},client:{auth:{signInWithPassword:async()=>({data:{session},error:null}),signOut:async()=>({error:null})},from:table=>({insert:async row=>{calls.push(['insert',table,row]);return {error:null}},update:row=>({eq:()=>({select:()=>({single:async()=>{calls.push(['update',table,row]);return {data:row,error:null}}})})})})}};
const ctx={window:{StoreBackendConfig:{enabled:true,url:'https://example.supabase.co',publishableKey:'fixture'},StoreSupabase:shared},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('support-config.js','utf8'),ctx);vm.runInContext(fs.readFileSync('js/support-api.js','utf8'),ctx);
const api=ctx.window.AlMumezSupport;assert(api.ready);await api.login('test@example.invalid','fixture');assert(calls.some(x=>x[1]==='is_support_admin'));
await api.submit({name:'Customer',email:'customer@example.invalid',subject:'product',message:'A product question',consent:true,productName:'Product'});
await api.update('id',{status:'resolved',email:'attacker@example.invalid',customer_id:'victim'});assert.deepEqual(Object.keys(calls.find(x=>x[0]==='update')[2]),['status']);
assert(!fs.readFileSync('js/support-api.js','utf8').includes('almumez-support-session:'));
const realtime=fs.readFileSync('js/admin/data.js','utf8');for(const name of ['orders','products','bundles','support_messages','message_replies','customers','notifications','settings','payment_transactions','shipments','order_stock_reservations']){assert(realtime.includes("'"+name+"'"));assert(last.includes("'"+name+"'"))}
const settingsContext={window:{StoreBackendConfig:{enabled:true}},localStorage:{getItem:()=>JSON.stringify({paymentMethods:{card:true,valu:true,cod:true}})},document:{querySelectorAll:()=>[],querySelector:()=>null}};vm.createContext(settingsContext);vm.runInContext(fs.readFileSync('js/storefront-settings.js','utf8'),settingsContext);assert.equal(settingsContext.window.StorefrontSettings.paymentMethods.card,false);assert.equal(settingsContext.window.StorefrontSettings.paymentMethods.valu,false);assert.equal(settingsContext.window.StorefrontSettings.defaultPayment,'cod');
console.log('PASS source-only SQL/PLpgSQL grammar ('+files.length+' files, '+functions+' function definitions), source guards and MOCKED SDK support contract. No database was executed or contacted.');
})().catch(error=>{console.error(error.message);process.exitCode=1});
