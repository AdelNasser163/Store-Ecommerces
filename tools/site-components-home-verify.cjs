/* Compare the refactored homepage header with the committed pre-refactor output. */
const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {serve,chromium,browserPath}=require('./perf-measure.cjs');
const cache=new Map(),baselineRef=process.argv[2]||'e6a4a0a';
function original(name){if(!cache.has(name))cache.set(name,execFileSync('git',['show',baselineRef+':'+name],{maxBuffer:6000000}));return cache.get(name)}
(async()=>{const server=serve(8786),browser=await chromium.launch({executablePath:browserPath}),results=[];try{
 for(const width of [390,820,1440])for(const lang of ['ar','en']){
  const captures=[];
  for(const baseline of [true,false]){
   const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
   await page.addInitScript(l=>localStorage.setItem('almumez-language',l),lang);
   if(baseline)await context.route('http://127.0.0.1:8786/**',async route=>{
    const name=new URL(route.request().url()).pathname.slice(1);
    if(name==='index.html'||/^dist\/[^/]+\.(css|js)$/.test(name))return route.fulfill({body:original(name),contentType:name.endsWith('.css')?'text/css':name.endsWith('.js')?'application/javascript':'text/html'});
    return route.continue();
   });
   await page.goto('http://127.0.0.1:8786/index.html');await page.evaluate(()=>document.fonts.ready);
   captures.push(await page.locator('[data-component="site-header"]').screenshot({animations:'disabled'}));await context.close();
  }
  if(!captures[0].equals(captures[1])){fs.writeFileSync('docs/performance/header-before.png',captures[0]);fs.writeFileSync('docs/performance/header-after.png',captures[1]);}
  assert.equal(captures[0].equals(captures[1]),true,`Homepage header changed visually: ${width} ${lang}`);results.push({width,lang,identicalPixels:true});
 }
 fs.writeFileSync('docs/performance/shared-header-home.json',JSON.stringify(results,null,2));console.log('PASS 6 unchanged homepage header screenshots');
}finally{await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
