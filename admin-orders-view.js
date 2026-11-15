(function(){
 'use strict';
 const list=document.querySelector('[data-orders-list]');if(!list||sessionStorage.getItem('almumez-admin')!=='1')return;
 const ar=window.AdminUI?.language!=='en',t=(a,b)=>ar?a:b;
 const states=['new','processing','shipping','completed'],labels=ar?['جديد','قيد التجهيز','جاري التوصيل','مكتمل']:['New','Preparing','Shipping','Completed'];
 const toolbar=document.createElement('div');toolbar.className='ao-toolbar';toolbar.setAttribute('translate','no');
 toolbar.innerHTML=`<div><h2>${t('سجل الطلبات','Order register')}</h2><p data-ao-count role="status"></p></div><label>${t('ترتيب الطلبات','Sort orders')}<select aria-label="${t('ترتيب الطلبات','Sort orders')}"><option value="newest">${t('الأحدث أولًا','Newest first')}</option><option value="oldest">${t('الأقدم أولًا','Oldest first')}</option><option value="highest">${t('الأعلى قيمة','Highest value')}</option></select></label>`;list.before(toolbar);
 const intro=document.createElement('p');intro.className='ao-intro';intro.textContent=t('بيانات العميل والمنتجات وخطوات التنفيذ، بشكل واضح لكل طلب.','Review customer details, ordered products and fulfilment steps for every order.');intro.setAttribute('translate','no');document.querySelector('.orders-admin-header h1').parentElement.append(intro);
 const badge=document.querySelector('.orders-breadcrumb i');badge.textContent=t('بيانات هذا المتصفح','Data from this browser');badge.setAttribute('translate','no');
 const search=document.querySelector('[data-orders-search]'),filters=document.querySelector('[data-orders-filters]'),reset=document.querySelector('.orders-search button');reset.title=t('مسح البحث والفلاتر','Clear search and filters');reset.setAttribute('aria-label',reset.title);reset.innerHTML='<span class="material-symbols-outlined" aria-hidden="true">close</span>';reset.onclick=()=>{search.value='';toolbar.querySelector('select').value='newest';filters.querySelector('[data-status="all"]').click();search.focus();};
 function data(){try{const rows=JSON.parse(localStorage.getItem('store-orders-v1')||'[]');return Array.isArray(rows)?rows:[];}catch{return[];}}
 function enhance(){observer.disconnect();try{
  const rows=data(),cards=Array.from(list.querySelectorAll('.order-admin-card'));
  for(const card of cards){if(card.dataset.organized)continue;card.dataset.organized='true';card.classList.add('ao-order');
   const order=rows.find(o=>String(o.id)===card.dataset.orderId)||{},header=card.querySelector('header'),customer=card.querySelector('.order-customer'),products=card.querySelector('.order-products'),footer=card.querySelector('footer'),status=card.querySelector('.order-status');
   const current=states.findIndex(s=>status?.classList.contains(s));const progress=document.createElement('ol');progress.className='ao-progress';progress.setAttribute('translate','no');progress.setAttribute('aria-label',t('مراحل الطلب','Order progress'));
   states.forEach((s,i)=>{const li=document.createElement('li');li.className=i<=current?'is-done':'';if(i===current){li.classList.add('is-current');li.setAttribute('aria-current','step');}const dot=document.createElement('span');dot.textContent=i<current?'✓':String(i+1);dot.setAttribute('aria-hidden','true');li.append(dot,labels[i]);progress.append(li);});header.after(progress);
   const body=document.createElement('div');body.className='ao-order-body';progress.after(body);body.append(customer,products);
   const heading=document.createElement('h3');heading.textContent=t('بيانات العميل','Customer details');heading.className='ao-section-label';heading.setAttribute('translate','no');customer.prepend(heading);
   const tracking=card.querySelector('.order-tracking');if(tracking)customer.append(tracking);
   const total=document.createElement('section');total.className='ao-total';total.append(footer.firstElementChild);body.append(total);
   const details=footer.querySelector('[data-details]');if(details)total.append(details);
   const actionHint=document.createElement('span');actionHint.className='ao-action-hint';actionHint.textContent=labels[current]||labels[0];actionHint.setAttribute('translate','no');footer.prepend(actionHint);
   // Preserve customer text exactly; the shared dashboard translator owns labels only.
   customer.querySelectorAll('b,small').forEach(n=>{if(!n.querySelector('.material-symbols-outlined'))return;if(n.closest('.order-customer>div:first-of-type'))n.setAttribute('translate','no');});
   products.querySelectorAll('div>span').forEach(n=>n.setAttribute('translate','no'));
   if(!footer.querySelector('[data-next]')){const done=document.createElement('span');done.className='ao-done';done.textContent='✓ '+labels[3];done.setAttribute('translate','no');footer.lastElementChild.append(done);}
   card.dataset.sortDate=String(Date.parse(order.createdAt)||0);card.dataset.sortTotal=String(Number(order.total)||0);
  }
  const sort=toolbar.querySelector('select').value;cards.sort((a,b)=>sort==='highest'?Number(b.dataset.sortTotal)-Number(a.dataset.sortTotal):sort==='oldest'?Number(a.dataset.sortDate)-Number(b.dataset.sortDate):Number(b.dataset.sortDate)-Number(a.dataset.sortDate));const fragment=document.createDocumentFragment();cards.forEach(c=>fragment.append(c));list.append(fragment);
  toolbar.querySelector('[data-ao-count]').textContent=`${cards.length} ${t('طلب مطابق للعرض الحالي','orders in the current view')}`;
 }finally{observer.observe(list,{childList:true});}}
 const observer=new MutationObserver(enhance);toolbar.querySelector('select').onchange=enhance;enhance();
 const modal=document.querySelector('[data-order-modal]'),content=modal.querySelector('[data-modal-content]');
 const detailObserver=new MutationObserver(()=>{detailObserver.disconnect();try{const title=content.querySelector('h2');if(!title)return;title.id='ao-order-detail-title';modal.setAttribute('aria-labelledby',title.id);const order=data().find(o=>title.textContent.endsWith(String(o.id)));const card=Array.from(list.children).find(c=>c.dataset.orderId===String(order?.id));if(!card)return;const meta=document.createElement('div');meta.className='ao-detail-meta';Array.from(content.querySelectorAll(':scope>p')).forEach(p=>meta.append(p));title.after(card.querySelector('.ao-progress').cloneNode(true),meta);const items=card.querySelector('.order-products').cloneNode(true);items.className='ao-detail-products';content.append(items);}finally{detailObserver.observe(content,{childList:true});}});detailObserver.observe(content,{childList:true});
})();
