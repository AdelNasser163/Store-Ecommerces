// Static grammar/source tests ONLY. Does not start or connect to a database.
const fs=require('node:fs'),assert=require('node:assert/strict'),parser=require('libpg-query');
(async()=>{
 const deploy=fs.readFileSync('supabase/DEPLOY_TO_SUPABASE.sql','utf8');
 const verify=fs.readFileSync('supabase/VERIFY_DEPLOYMENT.sql','utf8');
 const setup=fs.readFileSync('supabase/setup.sql','utf8');
 await parser.parse(deploy);await parser.parsePlPgSQL(deploy);
 const checks=await parser.parse(verify);
 assert(checks.stmts.every(row=>Object.hasOwn(row.stmt,'SelectStmt')),'Verification must contain SELECT statements only');
 assert.equal((deploy.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((deploy.match(/^COMMIT;$/gm)||[]).length,1);
 assert(deploy.indexOf('$first_deployment_guard$')<deploy.indexOf('-- FILE: preflight.sql'));
 const platformGuard=deploy.split('do $first_deployment_guard$')[1].split('end $first_deployment_guard$;')[0];
 assert(!/elsif\s+exists\s*\(select 1 from pg_event_trigger/i.test(platformGuard));
 assert(platformGuard.includes('if candidate_oid is null then'));
 assert(platformGuard.indexOf('if candidate_oid is null then')<platformGuard.indexOf('pg_catalog.md5(pg_catalog.pg_get_functiondef'));
 assert(platformGuard.indexOf('verified_platform_oid=candidate_oid')>platformGuard.indexOf('ensure_rls event trigger missing or configuration mismatch'));
 assert(deploy.includes("pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid))='846ec2fbff751d24b890656d63c3a9bf'"));
 for(const text of ["owner_role.rolname='postgres'","l.lanname='plpgsql'","p.prosecdef","p.pronargs=0","p.proconfig=array['search_path=pg_catalog']","e.evtname='ensure_rls'","e.evtfoid=candidate_oid","e.evtevent='ddl_command_end'","e.evtenabled='O'","and p.oid<>verified_platform_oid"]){assert(deploy.includes(text),text)}
 assert(!/drop\s+(?:event\s+trigger\s+ensure_rls|function\s+public\.rls_auto_enable)|alter\s+(?:event\s+trigger\s+ensure_rls|function\s+public\.rls_auto_enable)|create\s+(?:or\s+replace\s+)?function\s+public\.rls_auto_enable/i.test(deploy));
 assert(deploy.indexOf('$deployment_assertions$')<deploy.indexOf('\nCOMMIT;'));
 assert(deploy.includes(verify));
 assert(deploy.indexOf("SELECT 'MIGRATION_COMMITTED'")>deploy.indexOf('\nCOMMIT;'));
 assert(deploy.indexOf("SELECT 'POST_DEPLOY_QUERIES_COMPLETED_REVIEW_RESULTS'")>deploy.indexOf(verify));
 assert(!/drop\s+(table|schema|view|function)\b|truncate\s+/i.test(deploy));
 for(const message of ['existing relations','existing routines','Existing application Auth trigger','Existing named application Storage policies','Storage no longer matches'])assert(deploy.includes(message));
 const files=fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort();
 assert.equal(files.length,11);
 let last=0;for(const file of files){const position=deploy.indexOf('-- FILE: '+file);assert(position>last);last=position;const body=fs.readFileSync('supabase/migrations/'+file,'utf8').replace(/^begin;\r?$/gmi,'').replace(/^commit;\r?$/gmi,'');assert(deploy.includes(body));assert(setup.includes(body))}
 const bucketNames=[...deploy.matchAll(/values\('product-images','product-images'/g)];assert.equal(bucketNames.length,1);
 assert(deploy.includes("tablename='categories'"));assert(deploy.includes('alter publication supabase_realtime add table public.categories'));
 assert(deploy.includes('existing.request_fingerprint is distinct from fingerprint'));
 assert(deploy.includes("'almumez-order-request:'"));assert(deploy.includes('Commercial order fields are immutable'));
 assert(deploy.includes("'cod',true"));assert(deploy.includes('Online payments require a configured server-side provider'));
 assert(deploy.includes("if public.admin_role() is distinct from 'admin' then raise insufficient_privilege"));
 assert(deploy.includes('revoke all on public.deleted_support_messages from public,anon,authenticated'));
 console.log('PASS source/SQL grammar: 11 ordered migrations embedded, first-install guard, one transaction, precommit checks, '+checks.stmts.length+' SELECT-only verification queries. NO SQL executed; NO database contacted.');
})().catch(error=>{console.error(error);process.exitCode=1});
