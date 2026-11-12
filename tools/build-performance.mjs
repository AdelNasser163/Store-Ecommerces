/* Static assets for GitHub Pages. Run after changing a source stylesheet/script. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {transform} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{serve,chromium,browserPath}=require('./perf-measure.cjs');
const {prune}=require('./prune-utilities.cjs');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex').slice(0,12);
const metaFile='tools/performance-pages.json';
const metadata=fs.existsSync(metaFile)?JSON.parse(fs.readFileSync(metaFile,'utf8')):{};
const images=JSON.parse(fs.readFileSync('assets/images/image-manifest.json','utf8'));
const manifest={},fontCSS=fs.readFileSync('assets/fonts/fonts-performance.css','utf8');
fs.mkdirSync('dist',{recursive:true});
const generated=new Set();
const sourceFiles=[...fs.readdirSync('.').filter(n=>/\.(html|js)$/.test(n)),...fs.readdirSync('js').filter(n=>n.endsWith('.js')).map(n=>'js/'+n)];
const sourcePool=sourceFiles.map(file=>fs.readFileSync(file,'utf8').replace(/<style id="perf-critical">[\s\S]*?<\/style>/g,'')).join('\n');
const identicalAssets=new Map();
const mainSource=fs.readFileSync('main.js','utf8');
const dictionaryStart=mainSource.indexOf('{',mainSource.indexOf('Object.entries({',mainSource.indexOf('const translations')));
let depth=0,quote='',escaped=false,dictionaryEnd=dictionaryStart;
for(let i=dictionaryStart;i<mainSource.length;i++){const ch=mainSource[i];if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue}if(ch==='"'||ch==="'"){quote=ch;continue}if(ch==='{')depth++;if(ch==='}'&&!--depth){dictionaryEnd=i+1;break}}
const dictionary=Function('return ('+mainSource.slice(dictionaryStart,dictionaryEnd)+')')();
function asset(name,code,extension){const key=hash(code)+'.'+extension;if(identicalAssets.has(key))return identicalAssets.get(key);const file=`dist/${name}.${key}`;fs.writeFileSync(file,code);generated.add(file);identicalAssets.set(key,file);return file}
function staticImages(html){return html.replace(/<img\b[^>]*>/g,tag=>{
 const source=tag.match(/\bsrc=["']([^"']+)["']/)?.[1],item=images[source];
 if(item){tag=tag.replace(/\bsrc=["'][^"']+["']/,`src="${item.src}"`);if(!/\bsrcset=/.test(tag))tag=tag.replace(/\s*\/?>$/,` srcset="${item.variants.map(v=>`${v.src} ${v.width}w`).join(',')}" sizes="${/logo/.test(source)?'150px':'(max-width:767px) 90vw, 600px'}">`)}
 if(!/\bwidth=/.test(tag))tag=tag.replace(/>$/,` width="${item?.width||600}">`);
 if(!/\bheight=/.test(tag))tag=tag.replace(/>$/,` height="${item?.height||600}">`);
 if(!/\bdecoding=/.test(tag))tag=tag.replace(/>$/,' decoding="async">');
 if(/optimized\/logo-\d+/.test(tag))tag=tag.replace(/\sloading=["']lazy["']/,'');
 if(!/optimized\/logo-\d+|logo\.png|id=["']mainProductImage/.test(tag)&&!/\bloading=/.test(tag))tag=tag.replace(/>$/,' loading="lazy">');
 return tag;
})}
for(const page of fs.readdirSync('.').filter(n=>n.endsWith('.html')&&n!=='products.html')){
 let html=fs.readFileSync(page,'utf8');
 if(!metadata[page])metadata[page]={styles:[...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g)].map(m=>m[0].match(/href=["']([^"']+)/)?.[1]).filter(Boolean).map(s=>s.split('?')[0]).filter(s=>!s.startsWith('http')),scripts:[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/g)].map(m=>m[1].split('?')[0])};
 const meta=metadata[page];
 let css='';
 for(let source of meta.styles){if(source==='assets/fonts/fonts.css')source='assets/fonts/fonts-performance.css';if(source==='js/vendor/rb-islands.css')source='src-islands/islands.css';let value=fs.readFileSync(source,'utf8');if(source==='style.css')value=prune(value,sourcePool);value=value.replace(/url\((["']?)(?!data:|https?:|\/)([^)'"\s]+)\1\)/g,(_,q,url)=>`url(${q}../${path.posix.normalize(path.posix.join(path.posix.dirname(source),url))}${q})`);css+='\n'+value}
 css+='\n'+fs.readFileSync('performance.css','utf8');
 const compiled=(await transform(css,{loader:'css',minify:true,target:'es2020',legalComments:'none',charset:'utf8'})).code;
 const cssFile=asset(page.replace('.html',''),compiled,'css');
 const moveLast=['js/site-navigation.js','js/site-theme.js'];
 const informational=['about.html','blog.html','contact.html','checkout.html'].includes(page);
 const motionVendors=new Set(['js/vendor/gsap.min.js','js/vendor/ScrollTrigger.min.js','js/vendor/lenis.min.js','js/vendor/rb-islands.js']);
 const scripts=meta.scripts.filter(s=>s!=='js/page-bootstrap.js'&&!motionVendors.has(s)&&!moveLast.includes(s)&&s!=='js/fx.js'&&!(informational&&['catalog.js','js/product-card.js'].includes(s)));
 const hasStore=scripts.includes('data/store.js');
 if(hasStore)scripts.unshift('js/image-manifest.js','js/image-performance.js');
 scripts.push(...moveLast.filter(s=>meta.scripts.includes(s)));
 if(meta.scripts.includes('js/fx.js'))scripts.push('js/fx.js');
 let code='';
 for(const source of [...new Set(scripts)]){let text=fs.readFileSync(source,'utf8');if(!source.startsWith('data/')&&source!=='js/image-manifest.js')for(const original of ['assets/images/logo.png','assets/images/logo-footer.png'])text=text.split(original).join(images[original]?.src||original);code+=';\n'+text}
 const jsFile=asset(page.replace('.html',''),(await transform(code,{loader:'js',minify:true,target:'es2020',legalComments:'none',charset:'utf8'})).code,'js');
 html=html.replace(/<!--perf-assets:start-->[\s\S]*?<!--perf-assets:end-->/g,'').replace(/<!--perf-bootstrap:start-->[\s\S]*?<!--perf-bootstrap:end-->/g,'').replace(/<!--perf-early:start-->[\s\S]*?<!--perf-early:end-->/g,'').replace(/<!--perf-hero:start-->[\s\S]*?<!--perf-hero:end-->/g,'').replace(/<!--perf-skeleton:start-->[\s\S]*?<!--perf-skeleton:end-->/g,'').replace(/<style id="perf-critical">[\s\S]*?<\/style>/g,'');
 html=html.replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/g,'').replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g,'').replace(/<noscript>\s*<\/noscript>/g,'');
 if(meta.scripts.includes('js/page-bootstrap.js')){const boot=(await transform(fs.readFileSync('js/page-bootstrap.js','utf8'),{minify:true,loader:'js'})).code;html=html.replace(/<head>/,'<head><!--perf-bootstrap:start--><script>'+boot+'</script><!--perf-bootstrap:end-->')}
 const iconFont=fontCSS.match(/url\((icons-[^)]+)\)/)?.[1];
 const arabicFont=fontCSS.match(/src: url\((arabic-[^)]+)\)[^}]*unicode-range: U\+0600/)?.[1];
 const cairoLatin=fontCSS.split('}').find(block=>/font-family: 'Cairo'/.test(block)&&/unicode-range: U\+0000/.test(block))?.match(/url\(([^)]+)\)/)?.[1];
 const preloads=[iconFont&&`assets/fonts/${iconFont}`,'assets/fonts/font-2.woff2','assets/fonts/font-6.woff2',arabicFont&&`assets/fonts/${arabicFont}`,cairoLatin&&`assets/fonts/${cairoLatin}`].filter(Boolean).map(src=>`<link rel="preload" href="${src}" as="font" type="font/woff2" crossorigin>`).join('');
 let hero='';
 if(page==='index.html'){
  html=html.replace(/<div\b[^>]*data-products-section="home-(?:flash|featured)"[^>]*>/g,tag=>{if(!tag.includes('data-perf-pending'))tag=tag.replace(/>$/,' data-perf-pending aria-busy="true">');return tag+'<!--perf-skeleton:start-->'+Array.from({length:4},()=>'<div class="perf-skeleton" aria-hidden="true"></div>').join('')+'<!--perf-skeleton:end-->'});
  const mapping=JSON.parse('{'+fs.readFileSync('js/hero-b.js','utf8').match(/const images = \{([\s\S]*?)\};/)[1].replace(/,\s*$/,'')+'}');
  const selected=mapping['apple-iphone-15-pro-max-256gb'],image=images['assets/images/'+selected];if(image)hero=`<link rel="preload" as="image" href="${image.src}" imagesrcset="${image.variants.map(v=>`${v.src} ${v.width}w`).join(',')}" imagesizes="(max-width:639px) 258px, 284px" fetchpriority="high">`;
  const artwork=(id,side)=>{const item=images['assets/images/'+mapping[id]];if(!item)return '';return `<!--perf-hero:start--><div class="${side?'hb-side-link':'hb-slide is-active'}"><img src="${item.src}" srcset="${item.variants.map(v=>`${v.src} ${v.width}w`).join(',')}" sizes="${side?'220px':'(max-width:639px) 258px, 284px'}" width="${item.width}" height="${item.height}" decoding="async" ${side?'loading="lazy"':'fetchpriority="high"'} alt="${side?'Technology product':'Smartphone'}"></div><!--perf-hero:end-->`};
  html=html.replace(/(<div\b[^>]*data-hb-slides[^>]*>)/,'$1'+artwork('apple-iphone-15-pro-max-256gb',false));
  for(const id of ['macbook-pro-16-m3-max','playstation-5-slim-bundle'])html=html.replace(new RegExp('(<div\\b[^>]*data-hb-side="'+id+'"[^>]*>)'),'$1'+artwork(id,true));
  const heroBlock=html.match(/<section\b[^>]*class="[^"]*\bhb-hero\b[\s\S]*?<\/section>/)?.[0]||'';
  const copy=Object.fromEntries(Object.entries(dictionary).filter(([key])=>heroBlock.includes(key)));
  const early=`(function(){if(document.documentElement.lang!=="ar")return;const entries=${JSON.stringify(Object.entries(copy).sort((a,b)=>b[0].length-a[0].length))};window.AlMumezEarlyTexts=new WeakMap();const w=document.createTreeWalker(document.querySelector('.hb-hero'),NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode;if(n.parentElement.matches('.material-symbols-outlined,script,style'))continue;let text=n.textContent;window.AlMumezEarlyTexts.set(n,text);for(const [en,ar]of entries)if(text.includes(en))text=text.replaceAll(en,ar);if(text!==n.textContent)n.textContent=text}})();`;
  if(heroBlock)html=html.replace(heroBlock,heroBlock+'<!--perf-early:start--><script>'+early+'</script><!--perf-early:end-->');
 }
 html=html.replace('</head>',`<!--perf-assets:start-->${preloads}${hero}<link rel="stylesheet" href="${cssFile}"><!--perf-assets:end--></head>`);
 html=html.replace('</body>',`<!--perf-assets:start--><script defer src="${jsFile}"></script><!--perf-assets:end--></body>`);
 html=staticImages(html);
 fs.writeFileSync(page,html.replace(/[ \t]+$/gm,''));
 manifest[page]={css:cssFile,js:jsFile,sources:meta};
}
fs.writeFileSync(metaFile,JSON.stringify(metadata,null,2));
// Extract header/hero rules in their original cascade order, including both directions
// and all responsive groups. Full CSS then loads without blocking the first paint.
const server=serve(),browser=await chromium.launch({executablePath:browserPath});
try{
 for(const [documentName,assets] of Object.entries(manifest)){
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.route('https://**/*',r=>r.abort());
 await page.goto('http://127.0.0.1:8767/'+documentName,{waitUntil:'domcontentloaded'});
 if(documentName==='index.html')await page.waitForSelector('.hb-slide img');
 const critical=await page.evaluate(()=>{
  const nodes=[...new Set([...document.querySelectorAll('html,body,main,header,header *,.hb-hero,.hb-hero *'),...[...document.querySelectorAll('main *')].filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight})])];
  function used(selector){if(/drawer|overlay|modal|menu|filter|search|account|toast|suggest|skeleton|pending|\[hidden\]/.test(selector))return true;return selector.split(',').some(s=>{try{const normalized=s.replace(/\[(?:dir|lang)[^\]]*\]/g,'').replace(/::(?:before|after)/g,'').trim();return normalized&&nodes.some(n=>n.matches(normalized))}catch{return /\.hb-|site-header|:root/.test(s)}})}
  function extract(rules){let text='';for(const rule of rules){if(rule.type===CSSRule.FONT_FACE_RULE)text+=rule.cssText;else if(rule.type===CSSRule.STYLE_RULE){if(used(rule.selectorText))text+=rule.cssText}else if(rule.type===CSSRule.KEYFRAMES_RULE){if(/^hb-|^perf-/.test(rule.name))text+=rule.cssText}else if(rule.cssRules){const child=extract(rule.cssRules);if(child)text+=rule.cssText.slice(0,rule.cssText.indexOf('{')+1)+child+'}'} }return text}
  return [...document.styleSheets].map(sheet=>{try{return extract(sheet.cssRules)}catch{return ''}}).join('');
 });
 let html=fs.readFileSync(documentName,'utf8');
 const inline=(await transform(critical,{loader:'css',minify:true,legalComments:'none'})).code;
 // CSS URLs are relative to dist/ externally and to the document when inlined.
 const fixed=inline.replaceAll('../assets/','assets/');
 html=html.replace(`<link rel="stylesheet" href="${assets.css}">`,`<style id="perf-critical">${fixed}</style><link rel="stylesheet" href="${assets.css}" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${assets.css}"></noscript>`);
 fs.writeFileSync(documentName,html.replace(/[ \t]+$/gm,''));
 assets.criticalBytes=Buffer.byteLength(fixed);
 await page.close();
 }
}finally{await browser.close();server.close()}
fs.writeFileSync('dist/manifest.json',JSON.stringify(manifest,null,2));
// Only remove obsolete generated assets inside the verified dist directory.
for(const name of fs.readdirSync('dist')){const file='dist/'+name;if(/\.[a-f0-9]{12}\.(css|js)$/.test(name)&&!generated.has(file))fs.unlinkSync(file)}
console.log('Built '+Object.keys(manifest).length+' pages. Critical CSS: '+manifest['index.html'].criticalBytes+' bytes');
