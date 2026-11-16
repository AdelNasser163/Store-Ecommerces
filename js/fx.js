/* Compositor-only effects; native scrolling, no GSAP/Lenis/WebGL runtime. */
(function(){
 'use strict';
 const reduce=matchMedia('(prefers-reduced-motion:reduce)'),mobile=matchMedia('(max-width:767px)');
 const header=document.querySelector('[data-component="site-header"]');
 const bar=document.createElement('div');bar.className='fx-progress';bar.setAttribute('aria-hidden','true');document.body.append(bar);
 const topButton=document.querySelector('[data-back-top]')||document.createElement('button');
 if(!topButton.isConnected){topButton.className='fx-top';topButton.type='button';topButton.innerHTML='<span class="material-symbols-outlined" aria-hidden="true">arrow_upward</span>';topButton.setAttribute('aria-label','Back to top');document.body.append(topButton)}
 topButton.hidden=true;
 topButton.addEventListener('click',()=>scrollTo({top:0,behavior:reduce.matches?'instant':'smooth'}));
 let range=1,frame=0,lastScrolled=false;
 function draw(){frame=0;const y=window.scrollY;bar.style.transform=`scaleX(${Math.min(1,y/range)})`;topButton.hidden=y<700;const scrolled=y>8;if(scrolled!==lastScrolled){lastScrolled=scrolled;header?.classList.toggle('fx-header-scrolled',scrolled)}}
 function schedule(){if(!frame)frame=requestAnimationFrame(draw)}
 function resize(){range=Math.max(1,document.documentElement.scrollHeight-innerHeight);schedule()}
 window.addEventListener('scroll',schedule,{passive:true});
 let resizeFrame=0;function scheduleResize(){if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;resize()})}
 window.addEventListener('resize',scheduleResize,{passive:true});
 if(window.ResizeObserver)new ResizeObserver(scheduleResize).observe(document.body);
 resize();
 const seen=new WeakSet();
 const reveal=window.IntersectionObserver&&new IntersectionObserver(entries=>{for(const e of entries){if(!e.isIntersecting)continue;reveal.unobserve(e.target);if(!reduce.matches&&!mobile.matches&&e.target.animate)e.target.animate([{opacity:.35,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'})}},{threshold:.03});
 function scan(root=document){if(!reveal)return;const nodes=root.matches?.('.hb-card,.pt-heading,.pt-review')?[root]:Array.from(root.querySelectorAll?.('.hb-card,.pt-heading,.pt-review')||[]);for(const node of nodes){if(seen.has(node)||node.closest('[data-fx-skip]'))continue;seen.add(node);reveal.observe(node)}}
 // Initial content remains still; only later sections reveal, never hidden by CSS.
 document.querySelectorAll('main>section:not([data-fx-skip])').forEach(scan);
 const main=document.querySelector('main');if(main)new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node.nodeType===1)scan(node)}).observe(main,{childList:true,subtree:true});
 const active=window.IntersectionObserver&&new IntersectionObserver(entries=>entries.forEach(e=>{e.target.classList.toggle('perf-in-view',e.isIntersecting);e.target.classList.toggle('perf-offscreen',!e.isIntersecting)}),{rootMargin:'80px'});
 function visibility(){document.documentElement.toggleAttribute('data-page-hidden',document.hidden)}
 document.addEventListener('visibilitychange',visibility);visibility();
 if(!active)document.querySelectorAll('.hb-hero,[data-rb="brands"]').forEach(n=>n.classList.add('perf-in-view'));
 document.querySelectorAll('.hb-hero,[data-rb="brands"]').forEach(n=>active?.observe(n));
 document.querySelectorAll('[data-rb="brands"]').forEach(host=>{
  const names=['Apple','SAMSUNG','DELL','SONY','Lenovo','LG','PHILIPS'];
  host.innerHTML='<div class="perf-brands-track">'+[false,true].map(copy=>`<div class="perf-brands-list"${copy?' aria-hidden="true"':''}>${names.map(n=>`<span class="rb-brand">${n}</span>`).join('')}</div>`).join('')+'</div>';
 });
 document.querySelectorAll('[data-rb="particles"]').forEach(host=>{host.innerHTML=Array.from({length:8},(_,i)=>`<i class="perf-particle" style="--x:${8+i*12}%;--delay:-${i*1.8}s"></i>`).join('')});
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-add-to-cart]');if(!button||button.disabled||reduce.matches||mobile.matches)return;
  const target=document.querySelector('.home-cart-button,.product-cart-button'),card=button.closest('.hb-card,article,[data-product-card]'),image=card?.querySelector('img')||document.querySelector('#mainProductImage');
  if(!target||!image)return;
  // Two reads on an explicit click, before any DOM writes; never in a scroll loop.
  const a=image.getBoundingClientRect(),b=target.getBoundingClientRect();if(!a.width)return;
  const ghost=image.cloneNode(false);ghost.removeAttribute('id');ghost.removeAttribute('srcset');ghost.removeAttribute('loading');ghost.className='fx-fly';ghost.setAttribute('aria-hidden','true');ghost.style.cssText=`left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;will-change:transform,opacity`;
  document.body.append(ghost);const dx=b.left+b.width/2-a.left-a.width/2,dy=b.top+b.height/2-a.top-a.height/2;
  const flight=ghost.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.08)`,opacity:.15}],{duration:650,easing:'cubic-bezier(.4,0,1,1)'});
  flight.onfinish=()=>{ghost.remove();target.animate([{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:260})};flight.oncancel=()=>ghost.remove();
 },true);
 new MutationObserver(()=>{topButton.setAttribute('aria-label',document.documentElement.lang==='ar'?'العودة لأعلى':'Back to top')}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 window.AlMumezFX={lenis:null,refresh:()=>{scan();scheduleResize()}};
})();
