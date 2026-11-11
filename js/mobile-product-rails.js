/* Native horizontal scrolling; card markup and commerce handlers stay intact. */
(function(){
 'use strict';
 if(!document.body.classList.contains('pg-page'))return;
 const mobile=matchMedia('(max-width:767px)'),reduce=matchMedia('(prefers-reduced-motion:reduce)');
 const instances=[];
 document.querySelectorAll('[data-products-section="home-flash"],[data-products-section="home-featured"]').forEach(rail=>{
  const heading=rail.closest('section')?.querySelector('h2');
  rail.classList.add('pg-mobile-product-rail');
  if(!rail.id)rail.id=`pg-rail-${rail.dataset.productsSection}`;
  rail.setAttribute('role','region');rail.tabIndex=0;
  if(heading?.id)rail.setAttribute('aria-labelledby',heading.id);
  const controls=document.createElement('div');controls.className='pg-rail-controls';controls.setAttribute('role','group');controls.hidden=true;
  const buttons=[-1,1].map(step=>{
   const button=document.createElement('button');button.type='button';button.className='pg-rail-button';button.setAttribute('aria-controls',rail.id);
   button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${step<0?'M15 5l-7 7 7 7':'M9 5l7 7-7 7'}"/></svg>`;
   button.addEventListener('click',()=>move(step));controls.append(button);return button;
  });
  rail.after(controls);
  const cards=()=>Array.from(rail.children).filter(node=>node.matches('.hb-card')&&!node.hidden);
  const rtl=()=>document.documentElement.dir==='rtl';
  const offset=card=>{const box=rail.getBoundingClientRect(),item=card.getBoundingClientRect();return rtl()?item.right-box.right:item.left-box.left};
  function nearest(items){let index=0,distance=Infinity;items.forEach((card,i)=>{const value=Math.abs(offset(card));if(value<distance){index=i;distance=value}});return index}
  function align(card,behavior){if(card)rail.scrollBy({left:offset(card),behavior})}
  function move(step){if(!mobile.matches)return;const items=cards();align(items[Math.max(0,Math.min(items.length-1,nearest(items)+step))],reduce.matches?'auto':'smooth')}
  function sync(){
   const items=cards(),overflow=rail.scrollWidth>rail.clientWidth+2,current=nearest(items),ar=document.documentElement.lang==='ar';
   controls.hidden=!mobile.matches||items.length<2||!overflow;
   controls.setAttribute('aria-label',`${heading?.textContent||''} — ${ar?'التنقل بين المنتجات':'Product navigation'}`);
   buttons[0].setAttribute('aria-label',ar?'المنتجات السابقة':'Previous products');
   buttons[1].setAttribute('aria-label',ar?'المنتجات التالية':'Next products');
   buttons[0].disabled=!overflow||current===0;buttons[1].disabled=!overflow||current>=items.length-1;
   rail.classList.toggle('pg-product-rail--empty',items.length===0);
  }
  let frame=0,resetPending=false;
  function schedule(reset=false){resetPending=resetPending||reset;if(frame)return;frame=requestAnimationFrame(()=>{frame=0;if(resetPending&&mobile.matches)align(cards()[0],'auto');resetPending=false;sync()})}
  rail.addEventListener('scroll',()=>schedule(),{passive:true});
  rail.addEventListener('keydown',event=>{if(event.target!==rail||!mobile.matches||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();move((event.key==='ArrowRight'?1:-1)*(rtl()?-1:1))});
  new MutationObserver(()=>schedule(true)).observe(rail,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  if(window.ResizeObserver)new ResizeObserver(()=>schedule()).observe(rail);
  instances.push(schedule);schedule(true);
 });
 new MutationObserver(()=>instances.forEach(schedule=>schedule(true))).observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
 mobile.addEventListener('change',()=>instances.forEach(schedule=>schedule(true)));
 window.addEventListener('resize',()=>instances.forEach(schedule=>schedule()));
})();
