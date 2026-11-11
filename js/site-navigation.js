/* Shared presentation only: keep page-owned menu, cart, search and language handlers. */
(function(){
 'use strict';
 const header=document.querySelector('[data-component="site-header"]');if(!header)return;
 header.querySelector('.shared-site-header-wrap')?.classList.remove('shared-site-header-wrap');
 const nav=header.querySelector('.home-navigation>div');
 const products=nav?.querySelector('a[href="accessories.html"]'),about=nav?.querySelector('a[href="about.html"]');
 if(products&&about)products.after(about);
 // Reuse the existing dashboard destination; keep the desktop account menu intact.
 const dashboardSource=header.querySelector('.home-account-dropdown a[href*="admin"]');
 let mobileDashboard=nav?.querySelector('.mobile-menu-dashboard');
 if(dashboardSource&&nav&&!mobileDashboard){
  mobileDashboard=dashboardSource.cloneNode(true);
  mobileDashboard.removeAttribute('id');
  mobileDashboard.classList.add('mobile-menu-dashboard');
  const languageControl=nav.querySelector('.mobile-menu-language');
  nav.insertBefore(mobileDashboard,languageControl);
 }
 const wish=header.querySelector('.home-header-wishlist');
 // The catalog owns the wishlist drawer; keep the anchor from reloading it.
 if(wish&&document.querySelector('[data-wishlist-drawer]'))wish.addEventListener('click',event=>event.preventDefault());
 if(wish&&!wish.querySelector('svg')){
  wish.querySelector('.material-symbols-outlined')?.remove();
  wish.insertAdjacentHTML('afterbegin','<svg class="hb-wishlist-heart" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>');
 }
 header.querySelectorAll('img').forEach(img=>{img.width=112;img.height=36});
 header.querySelectorAll('.home-language-badge,.home-wishlist-count').forEach(badge=>{
  ['inset-inline-start','inset-inline-end','top','right','bottom','left','transform'].forEach(name=>badge.style.removeProperty(name));
 });
 function syncCopy(){
  const ar=document.documentElement.lang==='ar';
  if(mobileDashboard)mobileDashboard.textContent=ar?'لوحة التحكم':'Dashboard';
  header.querySelector('.home-cart-button')?.setAttribute('aria-label',ar?'فتح السلة':'Open cart');
  const menuIcon=header.querySelector('.mobile-menu-button .material-symbols-outlined');
  if(menuIcon)menuIcon.textContent=header.querySelector('.home-navigation')?.classList.contains('is-open')?'close':'menu';
  const input=header.querySelector('input');if(input)input.placeholder=ar?'ابحث عن المنتجات...':'Search products...';
  let items=[];try{items=JSON.parse(localStorage.getItem('cartItems')||'[]')}catch(_){}
  if(!Array.isArray(items))return;
  const quantity=items.reduce((n,item)=>n+(Number(item.quantity)||0),0),total=items.reduce((n,item)=>n+(Number(item.price)||0)*(Number(item.quantity)||0),0);
  const number=new Intl.NumberFormat(ar?'ar-EG':'en-EG',{maximumFractionDigits:0});
  const meta=header.querySelector('.home-cart-meta'),price=header.querySelector('.home-cart-total');
  const count=ar?`السلة: ${number.format(quantity)} منتج`:`Cart: ${number.format(quantity)} items`;
  const amount=`${number.format(total)} ${ar?'ج.م':'EGP'}`;
  if(meta&&meta.textContent!==count)meta.textContent=count;
  if(price&&price.textContent!==amount)price.textContent=amount;
 }
 syncCopy();
 const cart=header.querySelector('.home-cart-button');
 if(cart)new MutationObserver(syncCopy).observe(cart,{childList:true,subtree:true,characterData:true});
 new MutationObserver(syncCopy).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 window.addEventListener('storage',event=>{if(event.key==='cartItems')syncCopy()});
 // Let the browser perform document navigation and preserve history/forms normally.
 // Do not animate or delay document navigation.
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest('a[href]');if(!link||link.target||link.hasAttribute('download'))return;
  const url=new URL(link.href,location.href);
  if(url.origin!==location.origin||url.pathname===location.pathname&&url.search===location.search)return;
  try{sessionStorage.setItem('almumez-pending-navigation',JSON.stringify({path:url.pathname+url.search,time:Date.now()}))}catch(_){}
 });
})();
