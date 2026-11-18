/* The audit and its temporary server share one lifetime; no orphaned background service. */
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{start}=require('./pagespeed-server.cjs'),{browserPath}=require('./perf-measure.cjs');
(async()=>{
 const baseline=process.argv.includes('--baseline'),port=baseline?8782:8781,output='docs/performance/pagespeed-'+(baseline?'baseline':'final')+'.json';
 const cache=path.join(process.env.LOCALAPPDATA||'C:/Users/WG/AppData/Local','npm-cache/_npx');
 const cli=process.env.LIGHTHOUSE_CLI||fs.readdirSync(cache).map(n=>path.join(cache,n,'node_modules/lighthouse/cli/index.js')).find(p=>fs.existsSync(p));
 if(!cli)throw Error('Install the audit CLI with: npm exec --yes --package=lighthouse -- lighthouse --version');
 if(baseline)process.env.PERF_BASE_REF='5449bad2ba1994551edd9cbd48595572033dc52d';
 const server=start(port,baseline);
 try{await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[cli,`http://127.0.0.1:${port}/index.html`,'--chrome-flags=--headless --no-sandbox','--only-categories=performance,accessibility,best-practices,seo','--output=json','--output-path='+output,'--quiet'],{stdio:'inherit',env:{...process.env,CHROME_PATH:browserPath}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Lighthouse exited '+code)));});
 const report=JSON.parse(fs.readFileSync(output));if(report.runtimeError)throw Error(report.runtimeError.message);console.log(JSON.stringify({output,scores:Object.fromEntries(Object.entries(report.categories).map(([key,value])=>[key,value.score]))}));
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
