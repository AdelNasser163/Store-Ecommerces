// UI role fixtures only; this does NOT exercise database RLS or a Supabase project.
const assert=require('node:assert/strict'),{serve,chromium,browserPath}=require('./perf-measure.cjs');
(async()=>{const server=serve(8792),browser=await chromium.launch({executablePath:browserPath});try{
 for(const role of ['staff','admin']){
  const context=await browser.newContext({viewport:{width:1440,height:950}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(role=>{
   sessionStorage.setItem('almumez-admin','1');localStorage.setItem('almumez-language',JSON.stringify('en'));
   localStorage.setItem('almumez-support-demo-v1',JSON.stringify([{id:'fixture-message',name:'Fixture',email:'fixture@example.invalid',subject:'product',message:'A fixture support question',consent:true,status:'new',created_at:new Date().toISOString()}]));
   let auth;Object.defineProperty(window,'AdminAuth',{configurable:true,get:()=>auth,set:value=>{auth=value;auth.current=async()=>({id:'local-'+role,name:'Fixture '+role,email:'fixture@example.invalid',role})}});
  },role);
  await page.goto('http://127.0.0.1:8792/admin-contact.html');await page.locator('[data-message-id]').click();await page.locator('.aw-message-detail h2').waitFor();
  assert.equal(await page.locator('[data-action=delete]').count(),role==='admin'?1:0);
  await page.locator('[data-action=resolved]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('almumez-support-demo-v1'))[0].status==='resolved');assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS MOCKED UI identities: staff sees read/update controls without delete; admin sees delete. Database RLS NOT executed.');
}finally{await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
