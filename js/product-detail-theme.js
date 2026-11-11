/* Presentational hooks only; purchasing, variants and gallery stay in main.js. */
(function(){
  'use strict';
  if(!document.body.classList.contains('pd-page'))return;
  const productsLink=document.querySelector('.home-navigation a[href="accessories.html"]');
  if(productsLink){productsLink.classList.add('is-active');productsLink.setAttribute('aria-current','location');}
  const product=window.StoreProducts?.read().find(item=>item.id===new URLSearchParams(location.search).get('id'));
  const crumbs=document.querySelectorAll('.pd-breadcrumb a');
  if(crumbs[1])crumbs[1].href=product?.category?`accessories.html?dept=${encodeURIComponent(product.category)}`:'accessories.html';
  if(crumbs[2]){const brand=product?.brand?.en||product?.brand;crumbs[2].href=brand?`accessories.html?brand=${encodeURIComponent(brand)}`:'accessories.html';}
  document.querySelectorAll('main a[href="#"]').forEach(link=>link.href='contact.html');
  document.querySelector('#addBundleToCartButton')?.closest('section')?.classList.add('pd-bundle');
  document.querySelector('#addBundleToCartButton')?.parentElement?.classList.add('pd-bundle-price');
  document.querySelector('#specifications')?.closest('section')?.classList.add('pd-details');
  const actions=document.querySelector('.product-actions-mobile');
  actions?.querySelector(':scope>div')?.classList.add('pd-quantity');
  actions?.parentElement?.querySelector(':scope>button')?.classList.add('pd-buy');
  if(!document.querySelector('[data-product-tab][aria-selected="true"]'))document.querySelector('[data-product-tab="specifications"]')?.setAttribute('aria-selected','true');
  const logo=document.querySelector('.products-footer-grid>section:first-child>img');if(logo)logo.src='assets/images/logo-footer.png';
  document.querySelectorAll('.products-footer a[href^="#"]').forEach(link=>{const text=document.createElement('span');text.className=link.closest('.products-social')?'pd-social-placeholder':'pd-footer-label';text.append(...link.childNodes);if(link.id)text.id=link.id;const label=link.getAttribute('aria-label');if(label){text.setAttribute('role','img');text.setAttribute('aria-label',label)}link.replaceWith(text)});
  document.querySelectorAll('main img').forEach(img=>{if(!img.hasAttribute('width'))img.width=img.id==='mainProductImage'?600:120;if(!img.hasAttribute('height'))img.height=img.id==='mainProductImage'?600:120;if(img.id!=='mainProductImage')img.loading='lazy'});
})();
