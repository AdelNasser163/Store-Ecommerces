const fs=require('fs'),assert=require('assert');
const before=JSON.parse(fs.readFileSync('docs/performance/before.json')),after=JSON.parse(fs.readFileSync('docs/performance/after.json'));
const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
const summary={baselineCommit:'0b0fe3f',runsPerViewport:3,method:'Chrome PerformanceObserver, local HTTP, CPU x4, latency 100ms, 200000 bytes/s download, fresh context, reduced motion, 18s after DCL. blockingProxy is not Lighthouse TBT.',viewports:[]};
let table='| المقياس | العرض | قبل | بعد | الانخفاض |\n|---|---|---:|---:|---:|\n';
for(const width of [390,1440]){const b=before.filter(x=>x.width===width),a=after.filter(x=>x.width===width);assert.equal(b.length,3);assert.equal(a.length,3);assert([...b,...a].every(x=>!x.errors.length));const row={width,before:{},after:{},improvementPercent:{}};for(const key of ['lcp','blockingProxy','cls','bytes','requests']){row.before[key]=median(b.map(x=>x[key]));row.after[key]=median(a.map(x=>x[key]));row.improvementPercent[key]=row.before[key]?100*(1-row.after[key]/row.before[key]):0}summary.viewports.push(row);for(const [key,label,format]of [['lcp','LCP',n=>(n/1000).toFixed(2)+'s'],['blockingProxy','مؤشر المهام الطويلة (تقريب TBT)',n=>n+'ms'],['cls','CLS المسجّل',n=>n.toFixed(4)]])table+=`| ${label} | ${width}px | ${format(row.before[key])} | ${format(row.after[key])} | ${row.improvementPercent[key].toFixed(1)}% |\n`}
fs.writeFileSync('docs/performance/summary.json',JSON.stringify(summary,null,2));
const file='docs/performance/REPORT.md',text=fs.readFileSync(file,'utf8');fs.writeFileSync(file,text.replace(/<!--metrics:start-->[\s\S]*?<!--metrics:end-->/,'<!--metrics:start-->\n'+table+'<!--metrics:end-->'));
console.log(JSON.stringify(summary,null,2));
