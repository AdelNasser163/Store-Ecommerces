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
})();
