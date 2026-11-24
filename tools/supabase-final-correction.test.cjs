// Source checks only. No SQL execution, database driver or network calls.
const fs=require('node:fs'),assert=require('node:assert/strict'),parser=require('libpg-query');
(async()=>{
 const m=fs.readFileSync('supabase/migrations/202611220007_final_permissions.sql','utf8'),s=fs.readFileSync('supabase/setup.sql','utf8');
 assert(m.includes('drop policy if exists support_manage'));
 const policies=[...m.matchAll(/create policy (\w+) on public\.support_messages for (\w+) to authenticated (.*);/g)],deletion=policies.filter(p=>p[2]==='delete');
 assert.equal(deletion.length,1);assert(deletion[0][3].includes("public.admin_role()='admin'"));
 for(const op of ['select','update'])assert(policies.some(p=>p[2]===op&&p[3].includes('public.admin_access()')));
 assert(s.includes('create policy support_submit'));assert(s.includes('create policy support_customer_submit'));assert(m.includes('grant update(status,read_at,starred,archived)'));
 assert(!/^update public\.orders .*customer_id=/m.test(s),'Do not infer historical order ownership');
 assert(m.includes('revoke truncate,references,trigger'));assert(m.includes('revoke all on public.product_images,public.inventory_transactions,public.message_replies from anon,authenticated'));
 for(const table of ['product_images','bundle_items','order_items'])assert(!new RegExp('delete\\s+from\\s+public\\.'+table,'i').test(s),'Destructive child sync: '+table);
 assert(!/drop\s+table|truncate\s+/i.test(s));for(const key of ['product_id,url','bundle_id,product_id','order_id,line'])assert(s.includes('on conflict('+key+') do nothing'));
 assert(s.includes("jsonb_typeof(new.payload->'productIds') is distinct from 'array'"));assert(s.includes('Duplicate bundle products'));assert(s.includes('Unknown bundle product'));assert(s.includes("jsonb_typeof(entry) is distinct from 'string'"));
 assert(m.includes("jsonb_build_object('card',false,'valu',false,'cod',true)"));assert(m.includes('before insert or update on public.settings'));
 assert(m.includes("state text not null default 'unconfigured'"));assert(!/insert into public\.shipments|insert into public\.shipment_requests/i.test(s));
 for(const text of ["where order_id=p_order_id and state='reserved'","state='released',released_at=now()","if txn.status='paid' then return",'Payment settlement mismatch',"p_provider||':'||p_event_id",'reconciliation_required=true',"c.auth_user_id=auth.uid()"])assert(s.includes(text),text);
 const scenarios=fs.readFileSync('supabase/tests/final-security-regressions.sql','utf8');await parser.parse(scenarios);await parser.parsePlPgSQL(scenarios);
 for(const text of ['Staff deleted a support message','Cross-customer SELECT leak','Cross-customer UPDATE succeeded','Failed payment did not restore stock exactly once','Late settlement was not flagged','Staff role escalation succeeded'])assert(scenarios.includes(text));
 console.log('PASS source-only permissions, isolation guards, preservation, bundle validation, payment settings, shipping scaffold and settlement/stock invariants. Deferred SQL scenarios parse; NOT executed.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
