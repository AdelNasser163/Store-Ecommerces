/* Local Lighthouse fixture: match GitHub Pages compression and its 10-minute cache header.
 * These headers are test-only and do not pretend to configure github.io hosting.
 */
const {serve}=require('./perf-measure.cjs'),zlib=require('node:zlib');
function start(port=8781,baseline=false){
const server=serve(port,baseline);
server.prependListener('request',(request,response)=>{
 response.setHeader('Cache-Control','public, max-age=600');
 if(!/\.(?:html|css|js)(?:\?|$)/.test(request.url)||!request.headers['accept-encoding']?.includes('gzip'))return;
 const end=response.end;response.end=function(body,...args){if(body&&response.statusCode===200){response.setHeader('Content-Encoding','gzip');response.setHeader('Vary','Accept-Encoding');body=zlib.gzipSync(body);}return end.call(this,body,...args);};
});return server;
}
module.exports={start};
if(require.main===module){start(Number(process.argv[2]||8781),process.argv.includes('--baseline'));console.log('PageSpeed local fixture on '+(process.argv[2]||8781));}
