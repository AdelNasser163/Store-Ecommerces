/* Set the saved reading direction before styles or body content are painted. */
(function(){
 'use strict';
 try{
  let language=localStorage.getItem('almumez-language');
  const requested=new URLSearchParams(location.search).get('lang');
  if(requested==='ar'||requested==='en'){language=requested;localStorage.setItem('almumez-language',language)}
  if(language!=='ar'&&language!=='en'){try{language=JSON.parse(language)}catch(_){}}
  language=language==='en'?'en':'ar';
  document.documentElement.lang=language;
  document.documentElement.dir=language==='ar'?'rtl':'ltr';
 }catch(_){}
 // Decide before paint; never hide the document or delay a link navigation.
 let internal=false;
 try{
  const nav=performance.getEntriesByType('navigation')[0];
  const pending=JSON.parse(sessionStorage.getItem('almumez-next-page')||'null');
  sessionStorage.removeItem('almumez-next-page');
  const referrer=document.referrer?new URL(document.referrer):null;
  internal=nav?.type==='back_forward'||(nav?.type!=='reload'&&((pending&&pending.path===location.pathname&&Date.now()-pending.time<20000)||referrer?.origin===location.origin));
 }catch(_){}
 document.documentElement.dataset.pageEntry=internal?'internal':'initial';
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');
  if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
  const target=new URL(link.href,location.href);
  if(target.origin!==location.origin||target.pathname===location.pathname)return;
  try{sessionStorage.setItem('almumez-next-page',JSON.stringify({path:target.pathname,time:Date.now()}));}catch(_){}
 },{capture:true,passive:true});
})();
