const assert=require('node:assert/strict'),fs=require('node:fs');
const {serve,chromium,browserPath}=require('./perf-measure.cjs');
const props=['width','height','padding','backgroundColor','color','borderRadius','fontFamily','fontSize','fontWeight','display','alignItems','justifyContent'];
const selectors=['[data-component="site-header"]','.home-cart-button','.home-header-wishlist','.home-account-trigger','.home-language-toggle','.products-footer','.products-footer-grid','.products-footer-bottom'];
(async()=>{const server=serve(8785),browser=await chromium.launch({executablePath:browserPath}),results=[];try{
 for(const width of [390,820,1440])for(const lang of ['ar','en']){
  let home;
  for(const file of ['index.html','accessories.html','about.html','blog.html','contact.html','checkout.html','product.html?id=sony-wf-1000xm5','forgot-password.html','reset-password.html']){
   const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(l=>localStorage.setItem('almumez-language',l),lang);
   await page.goto('http://127.0.0.1:8785/'+file);
   await page.addStyleTag({content:'.products-footer{content-visibility:visible!important;contain-intrinsic-size:none!important}'});
   await page.evaluate(()=>document.fonts.ready);
   const passwordPage=['forgot-password.html','reset-password.html'].includes(file);
   assert.equal(await page.locator('[data-component="site-header"]').count(),passwordPage?0:1,file);
   assert.equal(await page.locator('[data-component="site-footer"]').count(),1,file);
   if(passwordPage){const footer=await page.evaluate(({props,selectors})=>selectors.slice(5).map(selector=>{const s=getComputedStyle(document.querySelector(selector));return props.map(p=>s[p])}),{props,selectors});assert.deepEqual(footer,home.slice(5),file+' shared footer');assert.deepEqual(errors,[],file);results.push({file,width,lang,sharedFooter:true,navbarRemoved:true});await context.close();continue;}
   assert.equal((await page.locator('.home-navigation a[href="blog.html"]').textContent()).trim(),lang==='ar'?'المدونة':'Blog');
   assert.doesNotMatch(await page.locator('.home-account-dropdown').textContent(),/\?{2,}/);
   const signature=await page.evaluate(({props,selectors})=>selectors.map(selector=>{const n=document.querySelector(selector);if(!n)throw Error(selector);const s=getComputedStyle(n);return props.map(p=>s[p])}),{props,selectors});
   if(!home)home=signature;else assert.deepEqual(signature,home,`Shared shell differs: ${file} ${width} ${lang} `+JSON.stringify(signature.flatMap((row,i)=>row.flatMap((v,j)=>v===home[i][j]?[]:[{selector:selectors[i],property:props[j],actual:v,home:home[i][j]}]))));
   if(width===390){await page.locator('.mobile-menu-button').click();assert.equal(await page.locator('.home-navigation.is-open').count(),1);assert.equal(await page.locator('.mobile-menu-dashboard').isVisible(),true);await page.keyboard.press('Escape');}
   assert.deepEqual(errors,[],file);results.push({file,width,lang,sharedShell:true});await context.close();
  }
 }
 // Static component output is present before JavaScript, and excluded pages stay excluded.
 const metadata=require('./performance-pages.json');
 for(const [file,meta]of Object.entries(metadata)){
  const h=fs.readFileSync(file,'utf8');
  if(file==='index.html'||meta.scripts.includes('shared-site-header.js'))assert.match(h,/<header\b[\s\S]*?home-cart-button/);
  if(meta.scripts.includes('shared-site-footer.js'))assert.match(h,/<footer\s+data-component="site-footer"/);
 }
 const catalog=fs.readFileSync('accessories.html','utf8');
 assert.match(catalog,/<footer>\s*<button[^>]*[\s\S]*?data-filter-results/);
 for(const file of ['forgot-password.html','reset-password.html']){
  const h=fs.readFileSync(file,'utf8');
  assert.match(h,/<main\b[\s\S]*?<header\b/,'Keep the account form heading: '+file);
 }
 assert.doesNotMatch(fs.readFileSync('auth.html','utf8').replace(/<style[\s\S]*?<\/style>/g,''),/data-component="site-(?:header|footer)"/);
 fs.writeFileSync('docs/performance/shared-components.json',JSON.stringify(results,null,2));console.log('PASS '+results.length+' shared header/footer comparisons');
}finally{await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
