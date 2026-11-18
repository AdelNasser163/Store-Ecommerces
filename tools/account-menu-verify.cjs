const assert=require('node:assert/strict'),fs=require('node:fs');
const {serve,chromium,browserPath}=require('./perf-measure.cjs');
(async()=>{const server=serve(8793),browser=await chromium.launch({executablePath:browserPath}),results=[];try{
 for(const width of [390,1440])for(const lang of ['ar','en'])for(const file of ['index.html','accessories.html','about.html','blog.html','contact.html','checkout.html','product.html?id=sony-wf-1000xm5']){
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(l=>localStorage.setItem('almumez-language',l),lang);
  await page.goto('http://127.0.0.1:8793/'+file);const links=page.locator('.home-account-dropdown a');assert.equal(await links.count(),2);
  assert.deepEqual(await links.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),['auth.html','admin.html']);
  assert.deepEqual(await links.locator('.site-account-label').allTextContents(),lang==='ar'?['تسجيل الدخول','لوحة التحكم']:['Sign in','Dashboard']);
  if(width===1440){
   const trigger=page.locator('.home-account-trigger'),menu=page.locator('.home-account-dropdown');await trigger.click();assert.equal(await menu.isVisible(),true);
   const rect=await menu.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width,'Dropdown fits the viewport');
   await page.keyboard.press('Escape');assert.equal(await menu.isVisible(),false);assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);
   await trigger.press('ArrowDown');assert.equal(await links.first().evaluate(n=>n===document.activeElement),true);await page.keyboard.press('ArrowDown');assert.equal(await links.last().evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Escape');
   await trigger.click();await page.locator('main').click({position:{x:5,y:5}});assert.equal(await menu.isVisible(),false);
   await trigger.click();await links.first().click();
  }else{
   await page.locator('.mobile-menu-button').click();const login=page.locator('.mobile-menu-login'),dashboard=page.locator('.mobile-menu-dashboard');assert.equal(await login.getAttribute('href'),'auth.html');assert.equal(await dashboard.getAttribute('href'),'admin.html');assert.equal(await dashboard.isVisible(),true);await login.click();
  }
  await page.waitForURL('**/auth.html');assert.equal(await page.locator('[data-auth-form=login]').isVisible(),true);assert.equal(await page.locator('[data-component=site-header]').count(),0);assert.deepEqual(errors,[]);results.push({file,width,lang,twoWorkingLinks:true,keyboard:width===1440});await context.close();
 }
 // Dashboard is a real destination and preserves its existing authentication screen.
 const page=await browser.newPage();const response=await page.goto('http://127.0.0.1:8793/admin.html');assert.equal(response.status(),200);await page.close();
 fs.writeFileSync('docs/performance/account-menu.json',JSON.stringify(results,null,2));console.log('PASS 28 account menu cases');
}finally{await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
