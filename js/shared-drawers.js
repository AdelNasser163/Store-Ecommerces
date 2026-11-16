/* Shared drawer rows and layout. Existing page handlers own all cart/wishlist mutations. */
(function(){
 'use strict';
 const ar=()=>document.documentElement.lang==='ar',t=(a,b)=>ar()?a:b;
 const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return[];}};
 const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=value;return n;};
 const bag='<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/></svg>';
 const heart='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
 const trash='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
 const drawers=Array.from(document.querySelectorAll('#cart-drawer,[data-cart-drawer],#wishlist-drawer,[data-wishlist-drawer]'));
 const isOpen=d=>d.classList.contains('store-drawer')?d.classList.contains('open'):!d.hidden;
 const money=v=>new Intl.NumberFormat(ar()?'ar-EG':'en-EG',{maximumFractionDigits:0}).format(Number(v)||0)+' '+t('ج.م','EGP');
 function updateBody(){document.body.classList.toggle('cd-drawer-visible',drawers.some(isOpen));document.body.classList.toggle('cd-cart-visible',drawers.some(d=>!d.classList.contains('cd-wishlist')&&isOpen(d)));}
 drawers.forEach(drawer=>{
  const wish=drawer.id==='wishlist-drawer'||drawer.hasAttribute('data-wishlist-drawer'),catalog=!drawer.classList.contains('store-drawer');
  const items=drawer.querySelector(wish?'[data-wishlist-items]':'[data-cart-items]'),header=drawer.querySelector(':scope>header'),close=header?.querySelector('button');if(!items||!header)return;
  drawer.classList.add('cd-cart');drawer.classList.toggle('cd-wishlist',wish);drawer.setAttribute('role','dialog');
  const heading=el('div','cd-heading'),icon=el('span','cd-bag');icon.innerHTML=wish?heart:bag;const copy=el('div'),eyebrow=el('small','cd-eyebrow'),title=header.querySelector('h2');copy.append(eyebrow,title);heading.append(icon,copy);header.prepend(heading);
  const meta=el('div','cd-meta');meta.setAttribute('translate','no');items.before(meta);
  let footer=drawer.querySelector(':scope>footer');if(!footer){footer=el('footer');drawer.append(footer);}
  const note=el('p','cd-note'),secondary=el('button','cd-continue');secondary.type='button';secondary.onclick=()=>close?.click();footer.append(note,secondary);
  let wasOpen=false,previousFocus,queued=false;
  function normalize(row,products){
   if(row.dataset.sharedDrawer)return;
   const remove=row.querySelector('[data-remove-cart],[data-remove-wishlist],[data-remove-wish]');if(!remove)return;
   const key=remove.dataset.removeCart||remove.dataset.removeWishlist||remove.dataset.removeWish;
   const matches=read(wish?'almumez-wishlist':'cartItems').filter(i=>i&&(String(i.key||i.id)===key||String(i.id)===key));
   const saved=matches[0]||{},id=String(saved.id||key).split('::')[0],product=products.find(p=>String(p.id)===id);
   const oldImage=row.querySelector('img'),quantity=Number(row.querySelector('.quantity>span')?.textContent)||matches.reduce((n,i)=>n+(Number(i.quantity)||0),0)||1;
   const name=row.querySelector('h3,a')?.textContent||saved.name||product?.name||id,price=Number(saved.price??(product?window.StoreProducts.getEffectivePrice(product).price:0)),variant=row.querySelector('div>small')?.textContent;
   row.__drawerModel={id,key,product,name,price,quantity,variant};
   const image=el('img');image.width=80;image.height=80;image.decoding='async';image.alt='';const source=saved.image||oldImage?.getAttribute('src')||product?.image||'assets/images/logo.png';if(window.AlMumezImages)window.AlMumezImages.apply(image,source);else image.src=source;image.sizes='80px';
   const body=el('div','cd-item-body'),title=el('h3','cd-item-title'),variantNode=el('small','cd-item-variant',variant||''),priceNode=el('strong','cd-item-price');variantNode.hidden=!variant;body.append(title,variantNode,priceNode);
   if(wish){const add=el('button','move-to-cart');add.type='button';add.dataset.wishlistToCart=id;if(catalog){add.dataset.qty=id;add.dataset.delta='1';}body.append(add);}
   else{const controls=el('div','quantity');for(const delta of [-1,0,1]){if(!delta){controls.append(el('span','',quantity));continue;}const button=el('button','',delta>0?'+':'−');button.type='button';button.dataset.quantity=delta;button.dataset.id=key;if(catalog){button.dataset.qty=id;button.dataset.delta=delta;}controls.append(button);}body.append(controls);}
   remove.innerHTML=trash;remove.classList.add('remove-item');remove.type='button';row.classList.add('cd-item');row.dataset.sharedDrawer='true';row.setAttribute('translate','no');row.replaceChildren(image,body,remove);
  }
  function sync(){
   const open=isOpen(drawer);drawer.inert=!open;drawer.setAttribute('aria-modal',String(open));updateBody();if(open&&!wasOpen){previousFocus=document.activeElement;close?.focus({preventScroll:true});}else if(!open&&wasOpen&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});if(open&&wasOpen&&!drawer.contains(document.activeElement))close?.focus({preventScroll:true});wasOpen=open;
   title.textContent=wish?t('المفضلة','Wishlist'):t('سلة التسوق','Shopping bag');eyebrow.textContent=wish?t('احتفظ باختياراتك المفضلة','SAVED FOR YOU'):t('اختياراتك في مكان واحد','YOUR SELECTION');close?.setAttribute('aria-label',t('إغلاق','Close'));
   const rows=Array.from(items.querySelectorAll('.drawer-item'));let count=0;
   const products=rows.some(row=>!row.dataset.sharedDrawer)?(window.StoreProducts?.read?.()||[]):[];for(const row of rows){normalize(row,products);const model=row.__drawerModel;if(!model)continue;count+=wish?1:model.quantity;const name=model.product?.name||model.name;row.querySelector('.cd-item-title').textContent=typeof name==='object'?(name[ar()?'ar':'en']||name.en||name.ar||model.id):String(name);row.querySelector('.cd-item-price').textContent=money(model.price);
    row.querySelector('.remove-item').setAttribute('aria-label',wish?t('حذف من المفضلة','Remove from wishlist'):t('حذف من السلة','Remove from bag'));
    row.querySelectorAll('[data-quantity]').forEach(button=>{button.setAttribute('aria-label',Number(button.dataset.quantity)>0?t('زيادة الكمية','Increase quantity'):t('تقليل الكمية','Decrease quantity'));if(catalog&&Number(button.dataset.quantity)>0)button.disabled=Number(model.product?.stock)<=model.quantity;});
    const add=row.querySelector('.move-to-cart');if(add){add.textContent=t('أضف للسلة','Add to cart');add.disabled=Number(model.product?.stock)===0;}
   }
   meta.replaceChildren(el('span','',wish?t('منتجات محفوظة','Saved items'):t('المنتجات في سلتك','Items in your bag')),el('b','',`${count.toLocaleString(ar()?'ar-EG':'en-US')} ${wish?t('منتج','items'):t('قطعة','items')}`));drawer.classList.toggle('cd-is-empty',!rows.length);
   const checkout=footer.querySelector('a');if(checkout&&!wish){checkout.textContent=t('متابعة لإتمام الطلب','Continue to checkout');checkout.hidden=!rows.length;}const label=footer.querySelector(':scope>div>span,:scope>p:not(.cd-note)>span');if(label)label.textContent=t('إجمالي المنتجات','Items total');
   // Normalize only the presentation of the authoritative, page-calculated total.
   const total=footer.querySelector('[data-cart-drawer-total],[data-drawer-total]');if(total){const value=total.textContent.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[٬,\s\u200e\u200f]/g,'').match(/-?\d+(?:[.٫]\d+)?/);if(value)total.textContent=money(Number(value[0].replace('٫','.')));}
   note.textContent=wish?t('أضف ما يعجبك إلى السلة عندما تكون مستعدًا.','Move your favourites to the bag whenever you are ready.'):t('راجع تفاصيل الإجمالي في صفحة إتمام الطلب.','Review the full total on the checkout page.');note.hidden=!rows.length;secondary.textContent=t('متابعة التسوق','Continue shopping');
   if(!rows.length){let empty=items.querySelector('.cd-empty');if(!empty){empty=el('div','cd-empty');empty.setAttribute('translate','no');const art=el('span','cd-empty-icon');art.innerHTML=wish?heart:bag;empty.append(art,el('h3'),el('p'));items.replaceChildren(empty);}empty.querySelector('h3').textContent=wish?t('اختياراتك المفضلة تبدأ هنا','Save something you love'):t('سلتك لسه فاضية','Your bag is waiting');empty.querySelector('p').textContent=wish?t('اضغط على القلب بجانب أي منتج لتحتفظ به هنا.','Tap the heart on a product to save it here.'):t('اكتشف المنتجات وأضف اختياراتك هنا، ثم راجع طلبك بسهولة.','Explore the collection, add your favourites and review them here.');}
  }
  const schedule=()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;sync();});}};
  // Older content-page headers translated title="Wishlist", so their legacy opener missed Arabic.
  // Route that same header control to its existing drawer, independently of translated copy.
  if(wish&&!catalog)document.addEventListener('click',event=>{if(!event.target.closest('.home-header-wishlist,.product-header-wishlist')||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();if(isOpen(drawer))return;drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');document.querySelector('[data-close-drawer="wishlist"].store-drawer-backdrop')?.classList.add('open');document.body.classList.add('drawer-open');});
  new MutationObserver(records=>{if(records.some(r=>Array.from(r.addedNodes).some(n=>!n.classList?.contains('cd-empty'))))schedule();}).observe(items,{childList:true});
  new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});new MutationObserver(schedule).observe(drawer,{attributes:true,attributeFilter:['hidden','aria-hidden']});
  drawer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close?.click();return;}if(event.key!=='Tab')return;const controls=Array.from(drawer.querySelectorAll('button:not([disabled]),a[href]')).filter(n=>!n.hidden&&n.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});sync();
 });
})();
