const assert=require('node:assert/strict'),fs=require('node:fs');
const {serve,chromium,browserPath}=require('./perf-measure.cjs');
(async()=>{const server=serve(8792),browser=await chromium.launch({executablePath:browserPath}),results=[];try{
 for(const width of [390,1440])for(const lang of ['ar','en'])for(const file of ['index.html','accessories.html','about.html','blog.html','contact.html','checkout.html','product.html?id=sony-wf-1000xm5']){
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(l=>{localStorage.setItem('almumez-language',l);localStorage.setItem('almumez-wishlist',JSON.stringify([{id:'sony-wf-1000xm5',name:'Sony WF-1000XM5',price:8499,image:'assets/images/sony-wf.jpg'}]));},lang);
  await page.goto('http://127.0.0.1:8792/'+file);await page.waitForFunction(()=>getComputedStyle(document.querySelector('.home-header-wishlist svg')).fill==='rgb(165, 214, 110)');
  assert.equal(await page.locator('.home-header-wishlist svg').count(),1);
  assert.equal(await page.locator('.home-header-wishlist svg').evaluate(n=>getComputedStyle(n).stroke),'rgb(165, 214, 110)');
  await page.locator('.home-header-wishlist').click();const drawer=page.locator('.cd-wishlist');await drawer.locator('[data-remove-wishlist],[data-remove-wish]').click();await page.mouse.move(0,900);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.home-header-wishlist svg')).fill==='rgba(0, 0, 0, 0)');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('almumez-wishlist'))),[]);assert.deepEqual(errors,[]);
  results.push({file,width,lang,filledWhenSaved:true,outlineWhenEmpty:true});await context.close();
 }
 fs.writeFileSync('docs/performance/wishlist-header.json',JSON.stringify(results,null,2));console.log('PASS 28 shared wishlist heart state cases');
}finally{await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
