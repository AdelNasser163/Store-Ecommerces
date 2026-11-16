/* First-visit stagger; native compositor animation, no navigation delay or layout changes. */
(function(){
 'use strict';
 const root=document.documentElement,reduce=matchMedia('(prefers-reduced-motion:reduce)');
 if(root.dataset.pageEntry!=='initial'||reduce.matches||document.hidden||!Element.prototype.animate)return;
 const animations=[];
 function start(){
  if(reduce.matches||document.hidden||scrollY>16)return;
  const copy=document.querySelector('.hb-copy,.about-hero-copy');
  const candidates=copy?Array.from(copy.children):Array.from(document.querySelectorAll('.products-heading,.auth-card,.orders-admin-header,main h1'));
  const visible=candidates.filter(node=>!candidates.some(other=>other!==node&&other.contains(node))).filter(node=>{const box=node.getBoundingClientRect();return box.width&&box.height&&box.top<innerHeight&&box.bottom>0;}).slice(0,5);
  const distance=innerWidth<768?16:24;
  for(const [index,node] of visible.entries()){
   try{node.dataset.entryReveal='true';animations.push(node.animate([{opacity:.3,transform:`translateY(${distance}px)`},{opacity:1,transform:'translateY(0)'}],{duration:520,delay:index*55,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'}));}catch(_){}
  }
 }
 const schedule=()=>requestAnimationFrame(start);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
 const cancel=()=>animations.forEach(animation=>animation.cancel());
 reduce.addEventListener?.('change',event=>{if(event.matches)cancel();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 window.addEventListener('pagehide',cancel,{once:true});
})();
