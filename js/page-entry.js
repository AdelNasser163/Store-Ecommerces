/* One short first-visit reveal. No hidden content, timers, navigation interception or libraries. */
(function(){
 'use strict';
 const root=document.documentElement,reduce=matchMedia('(prefers-reduced-motion:reduce)');
 if(root.dataset.pageEntry!=='initial'||reduce.matches||document.hidden||!Element.prototype.animate)return;
 const animations=[];
 function start(){
  if(reduce.matches||document.hidden||scrollY>16)return;
  const selectors='.hb-copy,.about-hero-copy,.products-heading,.auth-card,.orders-admin-header,main h1';
  const candidates=Array.from(document.querySelectorAll(selectors));
  const visible=candidates.filter(node=>!candidates.some(other=>other!==node&&other.contains(node))).filter(node=>{const box=node.getBoundingClientRect();return box.width&&box.height&&box.top<innerHeight&&box.bottom>0;}).slice(0,2);
  for(const [index,node] of visible.entries()){
   try{animations.push(node.animate([{opacity:.92,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:index*30,easing:'cubic-bezier(.22,1,.36,1)',fill:'none'}));}catch(_){}
  }
 }
 const schedule=()=>requestAnimationFrame(start);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
 const cancel=()=>animations.forEach(animation=>animation.cancel());
 reduce.addEventListener?.('change',event=>{if(event.matches)cancel();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 window.addEventListener('pagehide',cancel,{once:true});
})();
