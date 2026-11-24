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
 assert(deploy.indexOf('$deployment_assertions$')<deploy.indexOf('\nCOMMIT;'));
 assert(deploy.endsWith(verify));
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
