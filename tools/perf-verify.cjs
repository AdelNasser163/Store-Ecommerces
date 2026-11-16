const fs=require('fs'),assert=require('assert'),{serve,chromium,browserPath}=require('./perf-measure.cjs');
(async()=>{const server=serve(8769),browser=await chromium.launch({executablePath:browserPath}),results=[];try{
 for(const width of [390,1440])for(const lang of ['en','ar']){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(l=>{if(!sessionStorage.seed){localStorage.setItem('almumez-language',l);sessionStorage.seed='1'}},lang);
  await page.goto('http://127.0.0.1:8769/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('[data-hb-slides] img').waitFor();
  assert.equal(await page.locator('[data-hb-slides] a,[data-hb-side] a').count(),0);
  assert.equal(await page.locator('canvas').count(),0);
  await page.screenshot({path:`docs/performance/after-hero-${width}-${lang}.png`});
  const flash=page.locator('[data-products-section="home-flash"]');await flash.scrollIntoViewIfNeeded();await flash.locator('.hb-card').first().waitFor();
  const card=flash.locator('.hb-card').first(),id=await card.getAttribute('data-product-id');
  await card.locator('[data-add-to-cart]').click();await card.locator('[data-home-card-quantity]').waitFor();
  await card.locator('[data-quantity="1"]').click();await page.waitForTimeout(150);assert.equal(await card.locator('[data-home-card-quantity] b').textContent(),'2');
  await card.locator('[data-toggle-wishlist]').click();assert.equal(await card.locator('[data-toggle-wishlist]').getAttribute('aria-pressed'),'true');
  await page.locator('.home-cart-button').click();assert(await page.locator('.store-drawer.open').isVisible());
  await page.locator('.store-drawer.open [data-close-drawer],.store-drawer.open .close-drawer').first().click();
  const featured=page.locator('[data-products-section="home-featured"]');await featured.scrollIntoViewIfNeeded();await featured.locator('.hb-card').first().waitFor();
  const audio=page.locator('[data-product-filter="audio"]');await audio.click();await page.waitForTimeout(150);assert.equal(await featured.locator('.hb-card:not([hidden])').count(),0);
  await page.locator('[data-product-filter="electronics"]').click();
  if(width===390){const controls=page.locator('[aria-controls="pg-rail-home-flash"]').last();await controls.scrollIntoViewIfNeeded();assert(await controls.isVisible());await controls.click();await page.waitForTimeout(150);const position=await flash.evaluate(e=>e.scrollLeft);assert(Math.abs(position)>100);const second=flash.locator('.hb-card').nth(1);await second.locator('[data-add-to-cart]').click();await second.locator('[data-home-card-quantity]').waitFor();await page.waitForTimeout(150);assert(Math.abs((await flash.evaluate(e=>e.scrollLeft))-position)<2,'adding to cart reset the mobile rail');await page.locator('.mobile-menu-button').click();await page.locator('.mobile-menu-language').click()}
  else await page.locator('.home-language-toggle:visible,[data-language-toggle]:visible').first().click();
  await page.waitForTimeout(200);assert.notEqual(await page.locator('html').getAttribute('lang'),lang);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.goto('http://127.0.0.1:8769/accessories.html',{waitUntil:'domcontentloaded'});await page.locator('.hb-card').first().waitFor();
  const catalogCard=page.locator(`.hb-card[data-product-id="${id}"]`);if(await catalogCard.count()){assert.equal(await catalogCard.locator('.product-stepper b').textContent(),'2')}
  const add=page.locator('.hb-card-add:not([disabled])').first();await add.click();await page.waitForTimeout(500);assert(await page.locator('.product-stepper').count()>0);
  const form=page.locator('[data-search-form]');await form.locator('input').evaluate(e=>{e.value='Sony';e.dispatchEvent(new Event('input',{bubbles:true}))});await form.evaluate(e=>e.requestSubmit());await page.waitForTimeout(500);
  await page.screenshot({path:`docs/performance/after-catalog-${width}-${lang}.png`});
  await page.goto('http://127.0.0.1:8769/checkout.html',{waitUntil:'domcontentloaded'});assert(await page.locator('[data-checkout-items] img').count()>0);assert((await page.locator('[data-checkout-total]').textContent()).trim().length>0);
  assert.deepEqual(errors,[]);results.push({width,lang,homeCart:true,wishlist:true,quantity:true,filters:true,language:true,mobileArrows:true,catalogCart:true,search:true,errors});await context.close();
 }
 for(const file of fs.readdirSync('.').filter(n=>n.endsWith('.html')&&n!=='products.html')){const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const response=await page.goto('http://127.0.0.1:8769/'+file+(file==='product.html'?'?id=sony-wf-1000xm5':''),{waitUntil:'domcontentloaded'});await page.waitForTimeout(250);assert.equal(response.status(),200);assert.deepEqual(errors,[],file);if(file==='auth.html')assert.equal(await page.locator('[data-component="site-header"],.products-footer').count(),0);results.push({file,status:response.status(),errors});await context.close()}
}finally{await browser.close();server.close()}
fs.writeFileSync('docs/performance/functional.json',JSON.stringify(results,null,2));console.log('PASS '+results.length+' checks');
})().catch(e=>{console.error(e);process.exitCode=1});
