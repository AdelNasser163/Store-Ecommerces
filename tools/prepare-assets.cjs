/* Reproducible, non-destructive image/font preparation. Originals are retained. */
const fs=require('fs'),path=require('path'),https=require('https'),crypto=require('crypto');
const {chromium,browserPath}=require('./perf-measure.cjs');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex').slice(0,10);
const get=url=>new Promise((resolve,reject)=>https.get(url,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'}},r=>{if(r.statusCode>=300&&r.statusCode<400)return get(new URL(r.headers.location,url)).then(resolve,reject);if(r.statusCode!==200){r.resume();return reject(new Error(url+' HTTP '+r.statusCode))}const chunks=[];r.on('data',x=>chunks.push(x));r.on('end',()=>resolve(Buffer.concat(chunks)))}).on('error',reject));
function sources(dir='.'){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(['.git','node_modules','docs','assets','dist','tools'].includes(e.name)||e.name==='vendor'?[]:sources(path.join(dir,e.name))):/\.(html|js|jsx)$/.test(e.name)?[path.join(dir,e.name)]:[])}
async function fonts(){
 fs.mkdirSync('assets/fonts/licenses',{recursive:true});
 for(const [name,url] of Object.entries({'Cairo-OFL.txt':'https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/OFL.txt','Tajawal-OFL.txt':'https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/OFL.txt','Material-Symbols-LICENSE.txt':'https://raw.githubusercontent.com/google/material-design-icons/master/LICENSE'}))fs.writeFileSync('assets/fonts/licenses/'+name,(await get(url)).toString().replace(/[ \t]+$/gm,''));
 const codepoints=(await get('https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsOutlined%5BFILL,GRAD,opsz,wght%5D.codepoints')).toString();
 const valid=new Set(codepoints.split('\n').map(l=>l.split(' ')[0]));
 const words=new Set(sources().flatMap(f=>{const text=fs.readFileSync(f,'utf8');return [...text.matchAll(/["'`]([a-z][a-z0-9_]{1,50})["'`]|>\s*([a-z][a-z0-9_]{1,50})\s*</g)].map(m=>m[1]||m[2])}));
 const names=[...words].filter(n=>valid.has(n)).sort();
 fs.writeFileSync('docs/performance/icon-names.json',JSON.stringify(names,null,2));
 const iconCSS=(await get('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:FILL@0..1&icon_names='+names.join(',')+'&display=swap')).toString();
 const original=fs.readFileSync('assets/fonts/fonts.css','utf8');
 let local=original.replace(/\/\* fallback \*\/[\s\S]*?\n}\s*/, '');
 async function localize(css,prefix){for(const url of [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m=>m[1]))]){const data=await get(url),name=prefix+'-'+hash(data)+'.woff2';fs.writeFileSync('assets/fonts/'+name,data);css=css.split(url).join(name)}return css}
 local+='\n'+await localize(iconCSS,'icons');
 const arabic=(await get('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap')).toString();
 local+='\n'+await localize(arabic,'arabic');
 fs.writeFileSync('assets/fonts/fonts-performance.css',local);
 console.log('Prepared '+names.length+' icon glyphs and local Arabic fonts');
}
async function images(){
 fs.mkdirSync('assets/images/optimized',{recursive:true});
 const browser=await chromium.launch({executablePath:browserPath}),page=await browser.newPage(),map={};
 try{for(const name of fs.readdirSync('assets/images').filter(n=>/\.(png|jpe?g)$/i.test(n))){
  const file='assets/images/'+name,source=fs.readFileSync(file),ext=path.extname(name).toLowerCase(),base=path.basename(name,ext).replace(/[^a-zA-Z0-9_-]/g,'_');
  const data=await page.evaluate(async({src,widths})=>{const i=new Image();i.src=src;await i.decode();const variants=[];for(const max of widths){const w=Math.min(max,i.naturalWidth),h=Math.round(i.naturalHeight*w/i.naturalWidth),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(i,0,0,w,h);variants.push({width:w,height:h,data:c.toDataURL('image/webp',.84).split(',')[1]})}return variants},{src:'data:image/'+(ext==='.png'?'png':'jpeg')+';base64,'+source.toString('base64'),widths:name.includes('logo')?[400]:[480,960,1280]});
  const variants=[];for(const item of data){if(variants.some(v=>v.width===item.width))continue;const bytes=Buffer.from(item.data,'base64');if(bytes.length>150000&&item.width>960)continue;const out='assets/images/optimized/'+base+'-'+item.width+'-'+hash(bytes)+'.webp';fs.writeFileSync(out,bytes);variants.push({src:out,width:item.width,height:item.height,bytes:bytes.length})}
  const main=variants.find(v=>v.width>=960)||variants[variants.length-1];map[file]={...main,variants,originalBytes:source.length};
 }
 }finally{await browser.close()}
 fs.writeFileSync('assets/images/image-manifest.json',JSON.stringify(map,null,2));
 const runtime=Object.fromEntries(Object.entries(map).map(([key,item])=>[key,{src:item.src,width:item.width,height:item.height,variants:item.variants.map(v=>({src:v.src,width:v.width}))}]));
 fs.writeFileSync('js/image-manifest.js','window.AlMumezImageManifest='+JSON.stringify(runtime)+';\n');
 console.log('Prepared '+Object.keys(map).length+' responsive image sets');
}
(async()=>{if(!process.argv.includes('--images-only'))await fonts();if(!process.argv.includes('--fonts-only'))await images()})().catch(e=>{console.error(e);process.exitCode=1});
