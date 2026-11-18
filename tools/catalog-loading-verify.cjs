const assert=require('node:assert/strict'),fs=require('node:fs');
const {serve,chromium,browserPath}=require('./perf-measure.cjs');
(async()=>{const server=serve(8790),browser=await chromium.launch({executablePath:browserPath}),results=[];try{
 for(const width of [390,1440])for(const lang of ['ar','en']){
  const context=await browser.newContext({viewport:{width,height:850}}),page=await context.newPage(),errors=[];let navigations=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++});
  await page.route('**/dist/*.css',async route=>{await new Promise(resolve=>setTimeout(resolve,1500));await route.continue()});
  await page.route('**/dist/*.js',async route=>{await new Promise(resolve=>setTimeout(resolve,600));await route.continue()});
  await page.addInitScript(l=>{
   localStorage.setItem('almumez-language',l);window.loadingSamples=[];const start=performance.now();
   function sample(){const h=document.querySelector('[data-component=site-header]'),m=document.querySelector('main');if(h&&m)window.loadingSamples.push({time:Math.round(performance.now()-start),headerY:h.getBoundingClientRect().y,headerHeight:h.getBoundingClientRect().height,mainY:m.getBoundingClientRect().y,hearts:h.querySelectorAll('.home-header-wishlist svg').length});if(performance.now()-start<2600)requestAnimationFrame(sample)}requestAnimationFrame(sample);
  },lang);
  await page.goto('http://127.0.0.1:8790/accessories.html');await page.waitForFunction(()=>window.loadingSamples?.at(-1)?.time>=2500);
  const samples=await page.evaluate(()=>loadingSamples);assert.ok(samples.some(s=>s.time<1200),'Captured the critical-CSS-only frame');
  for(const key of ['headerY','headerHeight','mainY'])assert.equal(new Set(samples.map(s=>s[key])).size,1,`${width} ${lang}: ${key} shifted`);
  assert.ok(samples.every(s=>s.hearts===1),'Exactly one heart throughout loading');assert.equal(navigations,1,'No reload');
  const nav=page.locator('.home-navigation');assert.equal((await nav.locator('a[href="accessories.html"]').textContent()).trim(),lang==='ar'?'المنتجات':'Products');assert.equal((await nav.locator('a[href="about.html"]').textContent()).trim(),lang==='ar'?'من نحن':'About');
  await page.addScriptTag({path:'js/site-chrome-theme.js'});assert.equal(await page.locator('.home-header-wishlist svg').count(),1,'Theme initialization is idempotent');
  await page.locator('.home-header-wishlist').click();await page.waitForFunction(()=>document.querySelector('.cd-wishlist')?.getAttribute('aria-modal')==='true');
  assert.deepEqual(errors,[]);results.push({width,lang,slowCSS:true,oneHeart:true,noReload:true,stableHeader:true,stableMain:true});await context.close();
 }
 fs.writeFileSync('docs/performance/catalog-loading.json',JSON.stringify(results,null,2));console.log('PASS 4 slow-loading catalog cases');
}finally{await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
