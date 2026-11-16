/* Shared cart presentation only. Page-owned quantity, pricing and checkout handlers stay intact. */
(function(){
 'use strict';
 const drawers=document.querySelectorAll('#cart-drawer,[data-cart-drawer]');
 const ar=()=>document.documentElement.lang==='ar',t=(a,b)=>ar()?a:b;
 const bag='<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/></svg>';
 drawers.forEach(drawer=>{
  drawer.classList.add('cd-cart');
  const header=drawer.querySelector(':scope>header'),items=drawer.querySelector('[data-cart-items]'),footer=drawer.querySelector(':scope>footer'),close=header?.querySelector('button');if(!header||!items||!footer)return;
  const title=header.querySelector('h2'),heading=document.createElement('div');heading.className='cd-heading';const icon=document.createElement('span');icon.className='cd-bag';icon.innerHTML=bag;const text=document.createElement('div'),eyebrow=document.createElement('small');eyebrow.className='cd-eyebrow';eyebrow.setAttribute('translate','no');text.append(eyebrow,title);heading.append(icon,text);header.prepend(heading);
  const meta=document.createElement('div');meta.className='cd-meta';meta.setAttribute('translate','no');items.before(meta);
  const note=document.createElement('p');note.className='cd-note';note.setAttribute('translate','no');const secondary=document.createElement('button');secondary.type='button';secondary.className='cd-continue';secondary.setAttribute('translate','no');secondary.onclick=()=>close?.click();footer.append(note,secondary);
  let wasOpen=false,previousFocus;
  drawer.setAttribute('role','dialog');
  drawer.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();close?.click();return;}
   if(event.key!=='Tab')return;
   const controls=Array.from(drawer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]')).filter(n=>!n.hidden&&n.getClientRects().length);
   const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  function sync(){
   const open=drawer.id==='cart-drawer'?drawer.classList.contains('open'):!drawer.hidden;
   document.body.classList.toggle('cd-cart-visible',open);drawer.inert=!open;drawer.setAttribute('aria-modal',String(open));
   if(open&&!wasOpen){previousFocus=document.activeElement;close?.focus({preventScroll:true});}else if(!open&&wasOpen&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
   if(open&&wasOpen&&!drawer.contains(document.activeElement))close?.focus({preventScroll:true});wasOpen=open;
   eyebrow.textContent=t('اختياراتك في مكان واحد','YOUR SELECTION');title.textContent=t('سلة التسوق','Shopping bag');if(close)close.setAttribute('aria-label',t('إغلاق السلة','Close shopping bag'));
   const rows=Array.from(items.querySelectorAll('.drawer-item'));let cart=[];try{cart=JSON.parse(localStorage.getItem('cartItems')||'[]');}catch{}if(!Array.isArray(cart))cart=[];
   let quantity=0;
   for(const row of rows){
    row.classList.add('cd-item');const remove=row.querySelector('[data-remove-cart]'),key=remove?.dataset.removeCart;
    const matching=cart.filter(item=>String(item.key||item.id)===key||String(item.id)===key),q=Number(row.querySelector('.quantity>span')?.textContent)||matching.reduce((sum,item)=>sum+(Number(item.quantity)||0),0)||1;quantity+=q;
    row.querySelectorAll('img').forEach(image=>{image.width=80;image.height=80;image.decoding='async';image.sizes='80px';});
    if(remove){remove.setAttribute('aria-label',t('حذف المنتج من السلة','Remove item from bag'));remove.title=remove.getAttribute('aria-label');if(!remove.querySelector('svg'))remove.innerHTML='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';}
    row.querySelectorAll('[data-quantity]').forEach(button=>{button.type='button';button.setAttribute('aria-label',Number(button.dataset.quantity)>0?t('زيادة الكمية','Increase quantity'):t('تقليل الكمية','Decrease quantity'));});
    const qty=row.querySelector('.quantity');if(qty)qty.setAttribute('aria-label',t('الكمية','Quantity'));
   }
   meta.replaceChildren();const label=document.createElement('span');label.textContent=t('المنتجات في سلتك','Items in your bag');const count=document.createElement('b');count.textContent=`${quantity.toLocaleString(ar()?'ar-EG':'en-US')} ${t('قطعة','items')}`;meta.append(label,count);
   drawer.classList.toggle('cd-is-empty',!rows.length);
   const checkout=footer.querySelector('a');if(checkout){checkout.textContent=t('متابعة لإتمام الطلب','Continue to checkout');checkout.setAttribute('aria-label',checkout.textContent);checkout.hidden=!rows.length;}
   const totalLabel=footer.querySelector(':scope>div>span,:scope>p:not(.cd-note)>span');if(totalLabel)totalLabel.textContent=t('إجمالي المنتجات','Items total');
   note.textContent=t('راجع تفاصيل الإجمالي في صفحة إتمام الطلب.','Review the full total on the checkout page.');note.hidden=!rows.length;secondary.textContent=t('متابعة التسوق','Continue shopping');
   if(!rows.length){let empty=items.querySelector('.cd-empty');if(!empty){empty=document.createElement('div');empty.className='cd-empty';empty.setAttribute('translate','no');const artwork=document.createElement('span');artwork.className='cd-empty-icon';artwork.innerHTML=bag;empty.append(artwork,document.createElement('h3'),document.createElement('p'));items.replaceChildren(empty);}empty.querySelector('h3').textContent=t('سلتك لسه فاضية','Your bag is waiting');empty.querySelector('p').textContent=t('اكتشف المنتجات وأضف اختياراتك هنا، ثم راجع طلبك بسهولة.','Explore the collection, add your favourites and review them here.');}
  }
  // Observe page-owned replacements only, never our own nested presentation changes.
  let queued=false;const schedule=()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;sync();});}};
  const observer=new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length&&Array.from(r.addedNodes).some(n=>!n.classList?.contains('cd-empty'))))schedule();});observer.observe(items,{childList:true});
  new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  new MutationObserver(schedule).observe(drawer,{attributes:true,attributeFilter:['hidden','aria-hidden']});sync();
 });
})();
